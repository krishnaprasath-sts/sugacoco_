/** Accounts: verify payments against company bank records, and the verification queue. */
import { Router } from 'express';
import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool, withTransaction } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { parse } from '../middleware/validate.js';
import { audit } from '../services/audit.js';
import { changeStatus, lockOrder } from '../services/workflow.js';
import { sameAmount, toDecimal } from '../lib/money.js';
import { amount, optionalDate } from '../lib/validation.js';
import type { OrderStatus } from '../workflow/statuses.js';

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth, requireRole('ACCOUNTS'));

type PaymentType = 'ADVANCE' | 'BALANCE';

/** Status an order must be in for each payment type to be verified, and where it goes next. */
const FLOW: Record<PaymentType, { waiting: OrderStatus; approved: OrderStatus; rejected: OrderStatus; label: string }> = {
  ADVANCE: { waiting: 'AWAITING_ADVANCE_VERIFICATION', approved: 'AWAITING_QC', rejected: 'ADVANCE_REJECTED', label: 'Advance' },
  BALANCE: { waiting: 'AWAITING_BALANCE_VERIFICATION', approved: 'AWAITING_DOCUMENT_RELEASE', rejected: 'BALANCE_REJECTED', label: 'Balance' },
};

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

const verifySchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED'], { error: 'Choose approve or reject' }),
  bankCreditDate: optionalDate,
  bankCreditReference: optionalText(100),
  amountReceived: amount('Enter the amount credited in the bank', { allowZero: true }).optional().nullable(),
  remarks: optionalText(2000),
});

paymentsRouter.post('/:id/verify', async (req, res) => {
  const paymentId = parse(z.coerce.number().int().positive(), req.params.id);
  const body = parse(verifySchema, req.body);

  const orderId = await withTransaction(async (conn) => {
    const [[payment]] = await conn.query<RowDataPacket[]>(
      'SELECT id, order_id, payment_type, amount, currency, status FROM payments WHERE id = ? FOR UPDATE',
      [paymentId],
    );
    if (!payment) throw new HttpError(404, 'Payment not found');
    if (payment.status !== 'PENDING') throw new HttpError(409, 'This payment has already been verified');

    const flow = FLOW[payment.payment_type as PaymentType];
    const order = await lockOrder(conn, payment.order_id);
    if (order.status !== flow.waiting) {
      throw new HttpError(409, `This order is not waiting for ${flow.label.toLowerCase()} payment verification`);
    }

    // Approving needs the amount actually seen in the bank; a difference from the amount due needs a reason.
    const [[due]] = await conn.query<RowDataPacket[]>(
      'SELECT advance_amount, balance_amount FROM orders WHERE id = ?',
      [payment.order_id],
    );
    const amountDue = Number(payment.payment_type === 'ADVANCE' ? due.advance_amount : due.balance_amount);
    const fields: Record<string, string> = {};
    if (body.decision === 'REJECTED' && !body.remarks) fields.remarks = 'Give the reason so Sales can follow up with the customer';
    if (body.decision === 'APPROVED') {
      if (body.amountReceived == null) fields.amountReceived = 'Enter the amount credited in the company bank';
      else if (!sameAmount(body.amountReceived, amountDue) && !body.remarks) {
        fields.remarks = `The bank amount differs from the amount due (${toDecimal(amountDue)}). Explain why you are approving.`;
      }
    }
    if (Object.keys(fields).length) throw new HttpError(400, 'Please check the highlighted fields', { fields });
    if (payment.payment_type === 'ADVANCE' && body.decision === 'APPROVED') {
      const [[pendingCredit]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS n FROM customer_credits WHERE applied_order_id = ? AND entry_type = 'APPLIED' AND status = 'PENDING'`,
        [payment.order_id],
      );
      if (pendingCredit.n > 0) {
        throw new HttpError(409, 'Verify or reject the customer credit use on this order first (Refunds & Withheld).');
      }
    }

    const [v] = await conn.query<ResultSetHeader>(
      `INSERT INTO payment_verifications (payment_id, decision, bank_credit_date, bank_credit_reference, amount_received, remarks, verified_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [paymentId, body.decision, body.bankCreditDate, body.bankCreditReference,
       body.amountReceived != null ? toDecimal(body.amountReceived) : null, body.remarks, req.user!.id],
    );
    await conn.query('UPDATE payments SET status = ? WHERE id = ?', [body.decision, paymentId]);
    await audit(req, {
      action: body.decision === 'APPROVED' ? 'PAYMENT_APPROVED' : 'PAYMENT_REJECTED',
      entityType: 'payment',
      entityId: paymentId,
      orderId: payment.order_id,
      changes: { verificationId: v.insertId, type: payment.payment_type, reportedAmount: payment.amount, ...body },
    }, conn);

    const verb = body.decision === 'APPROVED' ? 'approved' : 'rejected';
    const note = `${flow.label} payment ${verb} by Accounts`;
    await changeStatus(conn, req, payment.order_id, body.decision === 'APPROVED' ? flow.approved : flow.rejected, note);
    return payment.order_id as number;
  });

  res.json({ ok: true, orderId });
});

/** Orders waiting for Accounts, oldest first, plus recently verified payments. */
paymentsRouter.get('/queue', async (_req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT o.id, o.order_no AS orderNo, o.pi_number AS piNumber, o.currency, o.status,
            o.status_changed_at AS statusChangedAt, c.company_name AS customerName,
            IF(o.status = 'AWAITING_ADVANCE_VERIFICATION', 'ADVANCE', 'BALANCE') AS paymentType,
            IF(o.status = 'AWAITING_ADVANCE_VERIFICATION', o.advance_amount, o.balance_amount) AS expectedAmount,
            p.id AS paymentId, p.amount AS reportedAmount, p.payment_date AS paymentDate, p.bank_reference AS bankReference,
            p.recorded_at AS recordedAt, u.name AS recordedByName,
            (SELECT COUNT(*) FROM order_documents d
              WHERE d.order_id = o.id AND d.deleted_at IS NULL
                AND d.category = IF(o.status = 'AWAITING_ADVANCE_VERIFICATION', 'ADVANCE_VOUCHER', 'BALANCE_VOUCHER')) AS voucherCount
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     LEFT JOIN payments p ON p.order_id = o.id AND p.status = 'PENDING'
          AND p.payment_type = IF(o.status = 'AWAITING_ADVANCE_VERIFICATION', 'ADVANCE', 'BALANCE')
     LEFT JOIN users u ON u.id = p.recorded_by
     WHERE o.status IN ('AWAITING_ADVANCE_VERIFICATION', 'AWAITING_BALANCE_VERIFICATION')
     ORDER BY COALESCE(p.recorded_at, o.status_changed_at) ASC`,
  );
  const [recent] = await pool.query<RowDataPacket[]>(
    `SELECT v.id, v.decision, v.remarks, v.verified_at AS verifiedAt, vu.name AS verifiedByName,
            p.payment_type AS paymentType, p.amount, p.currency,
            o.id AS orderId, o.order_no AS orderNo, c.company_name AS customerName
     FROM payment_verifications v
     JOIN payments p ON p.id = v.payment_id
     JOIN orders o ON o.id = p.order_id
     JOIN customers c ON c.id = o.customer_id
     JOIN users vu ON vu.id = v.verified_by
     ORDER BY v.verified_at DESC, v.id DESC
     LIMIT 30`,
  );
  const items = rows.map((r) => ({ ...r, paymentId: r.paymentId as number | null, voucherCount: Number(r.voucherCount) }));
  res.json({
    ready: items.filter((r) => r.paymentId),
    waitingForSales: items.filter((r) => !r.paymentId),
    recent,
  });
});
