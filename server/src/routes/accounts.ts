/** Accounts: final verification + closure, and the customer credit ledger (withheld / refund / applied). */
import { Router } from 'express';
import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool, withTransaction } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { parse } from '../middleware/validate.js';
import { audit } from '../services/audit.js';
import { changeStatus, lockOrder } from '../services/workflow.js';
import { CURRENCIES, round2, toDecimal } from '../lib/money.js';
import { amount } from '../lib/validation.js';
import { availableCredit } from '../services/credit.js';
import { RECEIVED_BY_ORDER } from '../services/received.js';

export const accountsRouter = Router();
accountsRouter.use(requireAuth);

const idParam = z.coerce.number().int().positive();
const text = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

/** What must be true before an order can be closed. Shared with the order detail checklist. */
export async function closureChecklist(orderId: number) {
  const [[o]] = await pool.query<RowDataPacket[]>('SELECT advance_amount, balance_amount FROM orders WHERE id = ?', [orderId]);
  const [[p]] = await pool.query<RowDataPacket[]>(
    `SELECT SUM(payment_type = 'ADVANCE' AND status = 'APPROVED') AS adv,
            SUM(payment_type = 'BALANCE' AND status = 'APPROVED') AS bal,
            SUM(status = 'PENDING') AS pending
     FROM payments WHERE order_id = ?`,
    [orderId],
  );
  const [[c]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total, SUM(gate_in_date IS NOT NULL) AS gated FROM container_bookings WHERE order_id = ?`,
    [orderId],
  );
  const [[b]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM bill_releases WHERE order_id = ? AND release_status = 'RELEASED'`, [orderId]);
  const [[cr]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM customer_credits WHERE applied_order_id = ? AND status = 'PENDING'`, [orderId]);
  return [
    { key: 'advance', label: 'Advance payment verified', ok: Number(o.advance_amount) === 0 || Number(p.adv) > 0 },
    { key: 'balance', label: 'Balance payment verified', ok: Number(o.balance_amount) === 0 || Number(p.bal) > 0 },
    { key: 'noPending', label: 'No payments waiting for verification', ok: !Number(p.pending) },
    { key: 'gateIn', label: 'All containers loaded and gated in', ok: c.total > 0 && Number(c.gated) === c.total },
    { key: 'released', label: 'Documents released to customer', ok: b.n > 0 },
    { key: 'credit', label: 'No credit use waiting for verification', ok: !cr.n },
  ];
}

accountsRouter.get('/final-queue', requireRole('ACCOUNTS'), async (_req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT o.id, o.order_no AS orderNo, o.pi_number AS piNumber, o.currency, o.total_value AS totalValue,
            o.status, o.status_changed_at AS statusChangedAt, c.company_name AS customerName,
            COALESCE(r.received, 0) AS received
     FROM orders o JOIN customers c ON c.id = o.customer_id
     LEFT JOIN (${RECEIVED_BY_ORDER}) r ON r.order_id = o.id
     WHERE o.status = 'AWAITING_FINAL_VERIFICATION' ORDER BY o.status_changed_at`,
  );
  res.json({ orders: rows });
});

accountsRouter.get('/orders/:id/checklist', requireRole('ACCOUNTS', 'ADMIN'), async (req, res) => {
  res.json({ items: await closureChecklist(parse(idParam, req.params.id)) });
});

accountsRouter.post('/orders/:id/close', requireRole('ACCOUNTS'), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const remarks = parse(text(2000), req.body?.remarks);
  await withTransaction(async (conn) => {
    const { status } = await lockOrder(conn, id);
    if (status !== 'AWAITING_FINAL_VERIFICATION') throw new HttpError(409, 'This order is not waiting for final verification');
    const failed = (await closureChecklist(id)).filter((i) => !i.ok);
    if (failed.length) throw new HttpError(409, `Cannot close yet: ${failed.map((f) => f.label.toLowerCase()).join('; ')}.`);
    await conn.query('UPDATE orders SET closed_by = ?, closed_at = NOW(), closure_remarks = ? WHERE id = ?', [req.user!.id, remarks, id]);
    await changeStatus(conn, req, id, 'CLOSED', 'Final verification done. Order closed');
  });
  res.json({ ok: true });
});

// ───────────── Customer credit ledger ─────────────

accountsRouter.get('/credits', requireRole('ACCOUNTS', 'ADMIN'), async (req, res) => {
  const q = parse(
    z.object({
      status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional(),
      customerId: z.coerce.number().int().positive().optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
    }),
    req.query,
  );
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.status) where.push('cc.status = ?'), params.push(q.status);
  if (q.customerId) where.push('cc.customer_id = ?'), params.push(q.customerId);
  const ENTRY_SELECT = `SELECT cc.id, cc.entry_type AS entryType, cc.amount, cc.currency, cc.status, cc.reference, cc.remarks, cc.created_at AS createdAt,
            cc.verified_at AS verifiedAt, c.id AS customerId, c.company_name AS customerName,
            so.id AS sourceOrderId, so.order_no AS sourceOrderNo, ao.id AS appliedOrderId, ao.order_no AS appliedOrderNo,
            ru.name AS recordedByName, vu.name AS verifiedByName
     FROM customer_credits cc
     JOIN customers c ON c.id = cc.customer_id
     LEFT JOIN orders so ON so.id = cc.source_order_id
     LEFT JOIN orders ao ON ao.id = cc.applied_order_id
     JOIN users ru ON ru.id = cc.recorded_by
     LEFT JOIN users vu ON vu.id = cc.verified_by`;
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [[count]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM customer_credits cc ${whereSql}`, params);
  const [entries] = await pool.query<RowDataPacket[]>(
    `${ENTRY_SELECT} ${whereSql} ORDER BY cc.created_at DESC, cc.id DESC LIMIT ? OFFSET ?`,
    [...params, q.pageSize, (q.page - 1) * q.pageSize],
  );
  // Credit use waiting for Accounts: always the full list, whatever page is shown.
  const [pending] = await pool.query<RowDataPacket[]>(
    `${ENTRY_SELECT} WHERE cc.entry_type = 'APPLIED' AND cc.status = 'PENDING' ORDER BY cc.created_at`,
  );
  const [balances] = await pool.query<RowDataPacket[]>(
    `SELECT c.id AS customerId, c.company_name AS customerName, cc.currency,
            SUM(CASE WHEN cc.entry_type = 'WITHHELD' AND cc.status = 'VERIFIED' THEN cc.amount ELSE 0 END) AS withheld,
            SUM(CASE WHEN cc.entry_type = 'APPLIED' AND cc.status = 'VERIFIED' THEN cc.amount ELSE 0 END) AS applied,
            SUM(CASE WHEN cc.entry_type = 'REFUND' AND cc.status = 'VERIFIED' THEN cc.amount ELSE 0 END) AS refunded
     FROM customer_credits cc JOIN customers c ON c.id = cc.customer_id
     GROUP BY c.id, c.company_name, cc.currency ORDER BY c.company_name`,
  );
  res.json({
    entries,
    pending,
    total: Number(count.n),
    page: q.page,
    pageSize: q.pageSize,
    balances: balances.map((b) => ({ ...b, available: toDecimal(round2(Number(b.withheld) - Number(b.applied) - Number(b.refunded))) })),
  });
});

/** Accounts records money withheld for future orders, or a refund paid back to the customer. */
accountsRouter.post('/credits', requireRole('ACCOUNTS'), async (req, res) => {
  const body = parse(
    z.object({
      customerId: z.coerce.number({ error: 'Choose a customer' }).int().positive('Choose a customer'),
      entryType: z.enum(['WITHHELD', 'REFUND'], { error: 'Choose withheld or refund' }),
      amount: amount('Enter the amount'),
      currency: z.enum(CURRENCIES).default('INR'),
      sourceOrderId: z.coerce.number().int().positive().optional().nullable(),
      reference: text(100),
      remarks: z.string({ error: 'Add a note' }).trim().min(3, 'Add a note').max(2000),
    }),
    req.body,
  );
  const id = await withTransaction(async (conn) => {
    const [[cust]] = await conn.query<RowDataPacket[]>('SELECT id FROM customers WHERE id = ?', [body.customerId]);
    if (!cust) throw new HttpError(400, 'Please check the highlighted fields', { fields: { customerId: 'Customer not found' } });
    if (body.sourceOrderId) {
      const [[o]] = await conn.query<RowDataPacket[]>('SELECT customer_id FROM orders WHERE id = ?', [body.sourceOrderId]);
      if (!o || o.customer_id !== body.customerId) {
        throw new HttpError(400, 'Please check the highlighted fields', { fields: { sourceOrderId: 'Order does not belong to this customer' } });
      }
    }
    if (body.entryType === 'REFUND') {
      const available = await availableCredit(conn, body.customerId, body.currency, { includePending: true, lock: true });
      if (body.amount > available + 0.005) {
        throw new HttpError(400, 'Please check the highlighted fields', {
          fields: { amount: `Refund cannot be more than the customer's available credit (₹${toDecimal(Math.max(0, available))})` },
        });
      }
    }
    const [r] = await conn.query<ResultSetHeader>(
      `INSERT INTO customer_credits (customer_id, entry_type, amount, currency, source_order_id, status, reference, remarks,
                                     recorded_by, verified_by, verified_at)
       VALUES (?, ?, ?, ?, ?, 'VERIFIED', ?, ?, ?, ?, NOW())`,
      [body.customerId, body.entryType, toDecimal(body.amount), body.currency, body.sourceOrderId ?? null, body.reference, body.remarks,
       req.user!.id, req.user!.id],
    );
    await audit(req, { action: `CREDIT_${body.entryType}_RECORDED`, entityType: 'credit', entityId: r.insertId, orderId: body.sourceOrderId ?? null, changes: body }, conn);
    return r.insertId;
  });
  res.status(201).json({ id });
});

/** Accounts verifies Sales' request to use credit on an order. Approved credit reduces that order's balance. */
accountsRouter.post('/credits/:id/verify', requireRole('ACCOUNTS'), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const body = parse(z.object({ decision: z.enum(['VERIFIED', 'REJECTED']), remarks: text(2000) }), req.body);
  await withTransaction(async (conn) => {
    const [[peek]] = await conn.query<RowDataPacket[]>('SELECT applied_order_id FROM customer_credits WHERE id = ?', [id]);
    if (!peek) throw new HttpError(404, 'Credit entry not found');
    const { status } = await lockOrder(conn, peek.applied_order_id);
    const [[c]] = await conn.query<RowDataPacket[]>('SELECT * FROM customer_credits WHERE id = ? FOR UPDATE', [id]);
    if (c.entry_type !== 'APPLIED' || c.status !== 'PENDING') throw new HttpError(409, 'Only pending credit use can be verified');
    if (body.decision === 'REJECTED' && !body.remarks) {
      throw new HttpError(400, 'Please check the highlighted fields', { fields: { remarks: 'Give the reason' } });
    }
    if (body.decision === 'VERIFIED') {
      if (!['AWAITING_ADVANCE_VERIFICATION', 'ADVANCE_REJECTED'].includes(status)) {
        throw new HttpError(409, 'Credit can be verified only before the advance payment is approved');
      }
      const [[o]] = await conn.query<RowDataPacket[]>('SELECT customer_id, balance_amount FROM orders WHERE id = ?', [c.applied_order_id]);
      if (o.customer_id !== c.customer_id) throw new HttpError(409, 'This credit belongs to a different customer than the order');
      const available = await availableCredit(conn, c.customer_id, c.currency, { lock: true });
      if (Number(c.amount) > available + 0.005) throw new HttpError(409, 'Not enough verified credit is available any more');
      if (Number(c.amount) > Number(o.balance_amount) + 0.005) throw new HttpError(409, 'Credit is more than the remaining balance');
      await conn.query(
        'UPDATE orders SET credit_applied_amount = credit_applied_amount + ?, balance_amount = balance_amount - ?, updated_by = ? WHERE id = ?',
        [c.amount, c.amount, req.user!.id, c.applied_order_id],
      );
    }
    await conn.query(
      `UPDATE customer_credits SET status = ?, verified_by = ?, verified_at = NOW(),
              remarks = CONCAT(COALESCE(remarks, ''), IF(? IS NULL, '', CONCAT(' | Accounts: ', ?))) WHERE id = ?`,
      [body.decision, req.user!.id, body.remarks, body.remarks, id],
    );
    await audit(req, { action: `CREDIT_APPLICATION_${body.decision}`, entityType: 'credit', entityId: id, orderId: c.applied_order_id, changes: { amount: c.amount, ...body } }, conn);
  });
  res.json({ ok: true });
});

/**
 * Advance 0 (or balance 0 after credit) means there is no payment to verify.
 * Accounts confirms it so the order isn't stuck waiting for a payment that will never come.
 */
accountsRouter.post('/orders/:id/confirm-no-payment', requireRole('ACCOUNTS'), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const { type } = parse(z.object({ type: z.enum(['ADVANCE', 'BALANCE']) }), req.body);
  await withTransaction(async (conn) => {
    const { status } = await lockOrder(conn, id);
    const [[o]] = await conn.query<RowDataPacket[]>('SELECT advance_amount, balance_amount FROM orders WHERE id = ?', [id]);
    if (type === 'ADVANCE') {
      if (status !== 'AWAITING_ADVANCE_VERIFICATION' || Number(o.advance_amount) !== 0) {
        throw new HttpError(409, 'Only an order with no advance due can skip advance verification');
      }
      const [[pending]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS n FROM customer_credits WHERE applied_order_id = ? AND entry_type = 'APPLIED' AND status = 'PENDING'`,
        [id],
      );
      if (pending.n > 0) throw new HttpError(409, 'Verify or reject the customer credit use on this order first');
      await changeStatus(conn, req, id, 'AWAITING_QC', 'No advance due. Confirmed by Accounts');
    } else {
      if (status !== 'DOCUMENTATION_IN_PROGRESS' || Number(o.balance_amount) !== 0) {
        throw new HttpError(409, 'Only an order with no balance due can skip balance verification');
      }
      const [[c]] = await conn.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS total, SUM(loading_date IS NOT NULL) AS loaded FROM container_bookings WHERE order_id = ?',
        [id],
      );
      if (!c.total || Number(c.loaded) < c.total) throw new HttpError(409, 'All containers must be loaded first');
      await changeStatus(conn, req, id, 'AWAITING_DOCUMENT_RELEASE', 'No balance due. Confirmed by Accounts');
    }
    await audit(req, { action: 'NO_PAYMENT_CONFIRMED', entityType: 'order', entityId: id, orderId: id, changes: { type } }, conn);
  });
  res.json({ ok: true });
});
