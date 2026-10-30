/** Orders / PI. Every role can view (pricing hidden where needed); Sales creates and edits early-stage orders. */
import { Router } from 'express';
import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { pool, withTransaction } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { parse } from '../middleware/validate.js';
import { audit, diff } from '../services/audit.js';
import { getOrderDetail, getOrderRow, salesCanEdit, stripPricing } from '../services/orders.js';
import { changeStatus, lockOrder, recordStatus } from '../services/workflow.js';
import { advanceFromPercent, CURRENCIES, lineTotal, round2, sameAmount, sum, toDecimal } from '../lib/money.js';
import { ORDER_STATUSES, type OrderStatus } from '../workflow/statuses.js';
import { amount, optionalDate, quantity, requiredDate, unitPrice } from '../lib/validation.js';
import { availableCredit } from '../services/credit.js';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

// ───────────── Validation ─────────────

const dateStr = requiredDate();
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
const positive = (msg: string) => amount(msg);

const itemSchema = z.object({
  productId: z.coerce.number().int().positive().optional().nullable(),
  productName: z.string({ error: 'Enter the product' }).trim().min(1, 'Enter the product').max(200),
  specification: optionalText(5000),
  quantity: quantity('Enter a quantity above 0'),
  unit: z.string().trim().min(1).max(20).default('MT'),
  quantityMt: z.coerce.number().nonnegative().max(1e9).optional().nullable(),
  unitPrice: unitPrice('Enter the unit price'),
});

const advancePaymentSchema = z.object({
  amount: positive('Enter the amount received'),
  paymentDate: optionalDate,
  bankReference: optionalText(100),
  payerBank: optionalText(150),
  remarks: optionalText(2000),
});

const orderSchema = z.object({
  customerId: z.coerce.number({ error: 'Choose a customer' }).int().positive('Choose a customer'),
  piNumber: z.string({ error: 'Enter the PI number' }).trim().min(1, 'Enter the PI number').max(60),
  piDate: dateStr,
  currency: z.enum(CURRENCIES, { error: 'Choose a currency' }).default('INR'),
  items: z.array(itemSchema, { error: 'Add at least one product' }).min(1, 'Add at least one product').max(50),
  advancePercent: z.coerce.number({ error: 'Enter the advance %' }).min(0, '0 to 100').max(100, '0 to 100'),
  /** Optional manual corrections. If omitted, the server calculates them. */
  advanceAmount: amount('Enter the advance amount', { allowZero: true }).optional().nullable(),
  balanceAmount: amount('Enter the balance amount', { allowZero: true }).optional().nullable(),
  paymentTerms: optionalText(5000),
  remarks: optionalText(5000),
});
type OrderInput = z.infer<typeof orderSchema>;

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').filter((s): s is OrderStatus => (ORDER_STATUSES as readonly string[]).includes(s)) : [])),
  mine: z
    .enum(['1', '0', 'true', 'false'])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
  customerId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const idParam = z.coerce.number().int().positive();

// ───────────── Calculation ─────────────

/** Totals from items; advance/balance auto-calculated unless the user corrected them. */
function calculate(input: OrderInput, creditApplied = 0) {
  // Round to the DB column precision first, so the stored line total matches the stored qty × price.
  const items = input.items.map((i, idx) => {
    const quantity = Math.round(i.quantity * 1000) / 1000;
    const unitPrice = Math.round(i.unitPrice * 10000) / 10000;
    return { ...i, quantity, unitPrice, lineTotal: lineTotal(quantity, unitPrice), sortOrder: idx };
  });
  const total = sum(items.map((i) => i.lineTotal));
  const advance = input.advanceAmount ?? advanceFromPercent(total, input.advancePercent);
  // Verified customer credit used on this order reduces the balance.
  const balance = input.balanceAmount ?? round2(total - advance - creditApplied);

  const fields: Record<string, string> = {};
  if (advance > total + 0.005) fields.advanceAmount = 'Advance cannot be more than the order total';
  if (balance < -0.005) fields.balanceAmount = 'Advance and credit used are more than the order total';
  else if (!sameAmount(advance + balance + creditApplied, total)) {
    fields.balanceAmount = `Advance + balance${creditApplied ? ' + credit used' : ''} must equal the order total (${toDecimal(total)})`;
  }
  if (Object.keys(fields).length) throw new HttpError(400, 'Please check the highlighted fields', { fields });
  return { items, total, advance: round2(advance), balance: round2(balance) };
}

async function assertCustomer(customerId: number) {
  const [[c]] = await pool.query<RowDataPacket[]>('SELECT id FROM customers WHERE id = ? AND is_active = 1', [customerId]);
  if (!c) throw new HttpError(400, 'Please check the highlighted fields', { fields: { customerId: 'Customer not found' } });
}

async function insertItems(conn: PoolConnection, orderId: number, items: ReturnType<typeof calculate>['items']) {
  for (const i of items) {
    await conn.query(
      `INSERT INTO order_items (order_id, product_id, product_name, specification, quantity, unit, quantity_mt,
                                unit_price, line_total, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, i.productId ?? null, i.productName, i.specification, i.quantity, i.unit, i.quantityMt ?? null, i.unitPrice, toDecimal(i.lineTotal), i.sortOrder],
    );
  }
}

const duplicatePi = () =>
  new HttpError(409, 'This PI number already exists', { fields: { piNumber: 'This PI number already exists' } });
const isDuplicate = (err: unknown) => (err as { code?: string })?.code === 'ER_DUP_ENTRY';

// ───────────── Routes ─────────────

ordersRouter.get('/', async (req, res) => {
  const { q, status, mine, customerId, page, pageSize } = parse(listQuery, req.query);
  const where: string[] = [];
  const params: unknown[] = [];
  if (q) {
    where.push('(o.order_no LIKE ? OR o.pi_number LIKE ? OR c.company_name LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (status.length) {
    where.push(`o.status IN (${status.map(() => '?').join(',')})`);
    params.push(...status);
  }
  if (mine) {
    where.push('o.created_by = ?');
    params.push(req.user!.id);
  }
  if (customerId) {
    where.push('o.customer_id = ?');
    params.push(customerId);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = 'FROM orders o JOIN customers c ON c.id = o.customer_id JOIN users u ON u.id = o.created_by';

  const [[count]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total ${from} ${whereSql}`, params);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT o.id, o.order_no AS orderNo, o.pi_number AS piNumber, o.pi_date AS piDate, o.currency,
            o.total_value AS totalValue, o.status, o.status_changed_at AS statusChangedAt,
            o.qc_status AS qcStatus, o.packaging_status AS packagingStatus, o.expected_ready_date AS expectedReadyDate,
            c.id AS customerId, c.company_name AS customerName, u.name AS createdByName, o.created_at AS createdAt
     ${from} ${whereSql}
     ORDER BY o.status_changed_at DESC, o.id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  const orders = req.user!.canViewPricing ? rows : rows.map((r) => stripPricing(r, ['totalValue']));
  res.json({ orders, total: count.total, page, pageSize });
});

/** Count of orders per status (for dashboards). */
ordersRouter.get('/summary', async (req, res) => {
  const mine = req.query.mine === '1';
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT status, COUNT(*) AS count FROM orders ${mine ? 'WHERE created_by = ?' : ''} GROUP BY status`,
    mine ? [req.user!.id] : [],
  );
  res.json({ counts: Object.fromEntries(rows.map((r) => [r.status, Number(r.count)])) });
});

ordersRouter.get('/:id', async (req, res) => {
  res.json(await getOrderDetail(parse(idParam, req.params.id), req.user!));
});

ordersRouter.post('/', requireRole('SALES'), async (req, res) => {
  const input = parse(orderSchema, req.body);
  const advancePayment = req.body?.advancePayment ? parse(advancePaymentSchema, req.body.advancePayment) : null;
  await assertCustomer(input.customerId);
  const calc = calculate(input);

  try {
    const id = await withTransaction(async (conn) => {
      const [result] = await conn.query<ResultSetHeader>(
        `INSERT INTO orders (customer_id, pi_number, pi_date, currency, total_value, advance_percent, advance_amount,
                             balance_amount, payment_terms, remarks, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AWAITING_ADVANCE_VERIFICATION', ?)`,
        [input.customerId, input.piNumber, input.piDate, input.currency, toDecimal(calc.total), input.advancePercent,
         toDecimal(calc.advance), toDecimal(calc.balance), input.paymentTerms, input.remarks, req.user!.id],
      );
      const orderId = result.insertId;
      const orderNo = `SC-${new Date().getUTCFullYear()}-${String(orderId).padStart(5, '0')}`;
      await conn.query('UPDATE orders SET order_no = ? WHERE id = ?', [orderNo, orderId]);
      await insertItems(conn, orderId, calc.items);

      let paymentId: number | null = null;
      if (advancePayment) {
        const [p] = await conn.query<ResultSetHeader>(
          `INSERT INTO payments (order_id, payment_type, amount, currency, payment_date, bank_reference, payer_bank, remarks, recorded_by)
           VALUES (?, 'ADVANCE', ?, ?, ?, ?, ?, ?, ?)`,
          [orderId, toDecimal(advancePayment.amount), input.currency, advancePayment.paymentDate ?? null,
           advancePayment.bankReference, advancePayment.payerBank, advancePayment.remarks, req.user!.id],
        );
        paymentId = p.insertId;
      }

      await audit(req, {
        action: 'ORDER_CREATED', entityType: 'order', entityId: orderId, orderId,
        changes: { orderNo, ...input, totalValue: calc.total, advanceAmount: calc.advance, balanceAmount: calc.balance, advancePayment },
      }, conn);
      await recordStatus(conn, req, orderId, null, 'AWAITING_ADVANCE_VERIFICATION', 'Order registered and sent to Accounts');
      return { orderId, paymentId };
    });
    res.status(201).json({ id: id.orderId, advancePaymentId: id.paymentId });
  } catch (err) {
    if (isDuplicate(err)) throw duplicatePi();
    throw err;
  }
});

ordersRouter.patch('/:id', requireRole('SALES'), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const input = parse(orderSchema, req.body);
  await assertCustomer(input.customerId);
  const before = await getOrderRow(id);

  try {
    await withTransaction(async (conn) => {
      const { status } = await lockOrder(conn, id);
      if (!(await salesCanEdit(id, status))) {
        throw new HttpError(409, 'This order can no longer be edited (advance payment already approved or order moved on)');
      }
      // Read credit inside the lock so a credit verified at the same moment can't give wrong totals.
      const [[locked]] = await conn.query<RowDataPacket[]>('SELECT customer_id, credit_applied_amount FROM orders WHERE id = ?', [id]);
      if (locked.customer_id !== input.customerId) {
        const [[used]] = await conn.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS n FROM customer_credits WHERE applied_order_id = ? AND entry_type = 'APPLIED' AND status IN ('PENDING','VERIFIED')`,
          [id],
        );
        if (used.n > 0) {
          throw new HttpError(400, 'Please check the highlighted fields', {
            fields: { customerId: "This order uses the customer's credit, so the customer can't be changed" },
          });
        }
      }
      const calc = calculate(input, Number(locked.credit_applied_amount));
      await conn.query(
        `UPDATE orders SET customer_id = ?, pi_number = ?, pi_date = ?, currency = ?, total_value = ?, advance_percent = ?,
                advance_amount = ?, balance_amount = ?, payment_terms = ?, remarks = ?, updated_by = ? WHERE id = ?`,
        [input.customerId, input.piNumber, input.piDate, input.currency, toDecimal(calc.total), input.advancePercent,
         toDecimal(calc.advance), toDecimal(calc.balance), input.paymentTerms, input.remarks, req.user!.id, id],
      );
      await conn.query('DELETE FROM order_items WHERE order_id = ?', [id]);
      await insertItems(conn, id, calc.items);

      const changes = diff(before, {
        customerId: input.customerId, piNumber: input.piNumber, piDate: input.piDate, currency: input.currency,
        totalValue: toDecimal(calc.total), advancePercent: toDecimal(input.advancePercent),
        advanceAmount: toDecimal(calc.advance), balanceAmount: toDecimal(calc.balance),
        paymentTerms: input.paymentTerms, remarks: input.remarks,
      });
      await audit(req, { action: 'ORDER_UPDATED', entityType: 'order', entityId: id, orderId: id, changes: { ...changes, items: input.items } }, conn);
    });
  } catch (err) {
    if (isDuplicate(err)) throw duplicatePi();
    throw err;
  }
  res.json(await getOrderDetail(id, req.user!));
});

/**
 * Sales records a payment the customer reported (one pending at a time per type).
 *  - ADVANCE: before Accounts approves it.
 *  - BALANCE: after loading is recorded (Documentation in progress) or after a balance rejection.
 */
const PAYMENT_STAGE: Record<'ADVANCE' | 'BALANCE', { allowed: OrderStatus[]; rejected: OrderStatus; waiting: OrderStatus }> = {
  ADVANCE: { allowed: ['AWAITING_ADVANCE_VERIFICATION', 'ADVANCE_REJECTED'], rejected: 'ADVANCE_REJECTED', waiting: 'AWAITING_ADVANCE_VERIFICATION' },
  BALANCE: { allowed: ['DOCUMENTATION_IN_PROGRESS', 'BALANCE_REJECTED'], rejected: 'BALANCE_REJECTED', waiting: 'AWAITING_BALANCE_VERIFICATION' },
};

ordersRouter.post('/:id/payments', requireRole('SALES'), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const type = parse(z.enum(['ADVANCE', 'BALANCE']).default('ADVANCE'), req.body?.paymentType);
  const body = parse(advancePaymentSchema, req.body);
  const stage = PAYMENT_STAGE[type];

  const paymentId = await withTransaction(async (conn) => {
    const { status } = await lockOrder(conn, id);
    if (!stage.allowed.includes(status)) {
      throw new HttpError(
        409,
        type === 'ADVANCE'
          ? 'Advance payment can only be recorded before Accounts approves it'
          : 'Balance payment can be recorded once loading is recorded by Documentation',
      );
    }
    if (type === 'BALANCE') {
      const [[loaded]] = await conn.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS total, SUM(loading_date IS NOT NULL) AS loaded FROM container_bookings WHERE order_id = ?',
        [id],
      );
      if (!loaded.total || Number(loaded.loaded) < loaded.total) {
        throw new HttpError(409, 'Balance payment is recorded after loading. Documentation has not recorded loading for all containers yet.');
      }
    }
    const [[open]] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM payments WHERE order_id = ? AND payment_type = ? AND status IN ('PENDING','APPROVED')`,
      [id, type],
    );
    if (open.n > 0) throw new HttpError(409, `A ${type.toLowerCase()} payment is already recorded for this order`);

    const [[order]] = await conn.query<RowDataPacket[]>('SELECT currency FROM orders WHERE id = ?', [id]);
    const [p] = await conn.query<ResultSetHeader>(
      `INSERT INTO payments (order_id, payment_type, amount, currency, payment_date, bank_reference, payer_bank, remarks, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, type, toDecimal(body.amount), order.currency, body.paymentDate ?? null, body.bankReference, body.payerBank, body.remarks, req.user!.id],
    );
    await audit(req, { action: 'PAYMENT_RECORDED', entityType: 'payment', entityId: p.insertId, orderId: id, changes: { type, ...body } }, conn);

    // Balance always goes to Accounts; advance goes back to Accounts after a rejection.
    if (type === 'BALANCE') {
      await changeStatus(conn, req, id, stage.waiting, status === stage.rejected ? 'Balance payment re-submitted by Sales' : 'Balance payment recorded by Sales');
    } else if (status === stage.rejected) {
      await changeStatus(conn, req, id, stage.waiting, 'Advance payment re-submitted by Sales');
    }
    return p.insertId;
  });
  res.status(201).json({ paymentId, ...(await getOrderDetail(id, req.user!)) });
});

/** Sales asks to use the customer's verified credit on this order. Accounts must verify it. */
ordersRouter.post('/:id/credit-applications', requireRole('SALES'), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const body = parse(
    z.object({ amount: positive('Enter the amount to use'), remarks: optionalText(2000) }),
    req.body,
  );
  await withTransaction(async (conn) => {
    const { status } = await lockOrder(conn, id);
    if (!(await salesCanEdit(id, status))) throw new HttpError(409, 'Credit can be applied only before Accounts approves the advance payment');
    const [[order]] = await conn.query<RowDataPacket[]>('SELECT customer_id, currency, balance_amount FROM orders WHERE id = ?', [id]);
    const available = await availableCredit(conn, order.customer_id, order.currency, { includePending: true, lock: true });
    const fields: Record<string, string> = {};
    if (body.amount > available + 0.005) fields.amount = `Only ₹${toDecimal(Math.max(0, available))} is available`;
    if (body.amount > Number(order.balance_amount) + 0.005) fields.amount = 'Cannot be more than the balance receivable';
    if (Object.keys(fields).length) throw new HttpError(400, 'Please check the highlighted fields', { fields });

    const [r] = await conn.query<ResultSetHeader>(
      `INSERT INTO customer_credits (customer_id, entry_type, amount, currency, applied_order_id, status, remarks, recorded_by)
       VALUES (?, 'APPLIED', ?, ?, ?, 'PENDING', ?, ?)`,
      [order.customer_id, toDecimal(body.amount), order.currency, id, body.remarks, req.user!.id],
    );
    await audit(req, { action: 'CREDIT_APPLICATION_REQUESTED', entityType: 'credit', entityId: r.insertId, orderId: id, changes: body }, conn);
  });
  res.status(201).json(await getOrderDetail(id, req.user!));
});

/** MD/Admin cancels an order/PI. The order becomes read-only for everyone. */
ordersRouter.post('/:id/cancel', requireRole('ADMIN'), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const { reason } = parse(z.object({ reason: z.string({ error: 'Give the reason' }).trim().min(3, 'Give the reason').max(2000) }), req.body);
  await withTransaction(async (conn) => {
    const { status } = await lockOrder(conn, id);
    await changeStatus(conn, req, id, 'CANCELLED', `Cancelled by MD/Admin: ${reason}`);
    await conn.query('INSERT INTO order_cancellations (order_id, status_before, reason, cancelled_by) VALUES (?, ?, ?, ?)', [id, status, reason, req.user!.id]);
    // Credit used on a cancelled order (pending or verified) goes back to the customer.
    await conn.query(`UPDATE customer_credits SET status = 'REJECTED', remarks = CONCAT(COALESCE(remarks, ''), ' [released: order cancelled]')
                      WHERE applied_order_id = ? AND entry_type = 'APPLIED' AND status IN ('PENDING','VERIFIED')`, [id]);
    await audit(req, { action: 'ORDER_CANCELLED', entityType: 'order', entityId: id, orderId: id, changes: { statusBefore: status, reason } }, conn);
  });
  res.json(await getOrderDetail(id, req.user!));
});
