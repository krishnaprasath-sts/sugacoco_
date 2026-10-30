/** Money summary for Accounts and MD/Admin: received today / this month, waiting for verification, still to collect. */
import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const summaryRouter = Router();
summaryRouter.use(requireAuth, requireRole('ACCOUNTS', 'ADMIN'));

const IST_OFFSET_MS = 5.5 * 3600_000;
const sql = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

/** Start of today and of this month in India, as UTC DATETIME strings (the DB stores UTC). */
function istRanges(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const day = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS;
  const month = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS;
  return { today: sql(new Date(day)), month: sql(new Date(month)) };
}

summaryRouter.get('/money', async (_req, res) => {
  const { today, month } = istRanges();

  // Received = bank amount Accounts confirmed on approval (falls back to the reported amount).
  const [[received]] = await pool.query<RowDataPacket[]>(
    `SELECT
       COALESCE(SUM(CASE WHEN v.verified_at >= ? THEN COALESCE(v.amount_received, p.amount) END), 0) AS today,
       COUNT(CASE WHEN v.verified_at >= ? THEN 1 END) AS todayCount,
       COALESCE(SUM(CASE WHEN v.verified_at >= ? THEN COALESCE(v.amount_received, p.amount) END), 0) AS month,
       COUNT(CASE WHEN v.verified_at >= ? THEN 1 END) AS monthCount
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     JOIN payment_verifications v ON v.payment_id = p.id AND v.decision = 'APPROVED'
     WHERE p.status = 'APPROVED' AND o.status <> 'CANCELLED' AND v.verified_at >= ?`,
    [today, today, month, month, month < today ? month : today],
  );

  const [pending] = await pool.query<RowDataPacket[]>(
    `SELECT p.payment_type AS type, COUNT(*) AS n, COALESCE(SUM(p.amount), 0) AS amount
     FROM payments p JOIN orders o ON o.id = p.order_id
     WHERE p.status = 'PENDING' AND o.status <> 'CANCELLED' GROUP BY p.payment_type`,
  );
  const pend = (t: string) => pending.find((r) => r.type === t);

  // Still to collect on open orders = total − credit used − received. Split by where the order is.
  const [[due]] = await pool.query<RowDataPacket[]>(
    `SELECT
       COALESCE(SUM(GREATEST(o.total_value - o.credit_applied_amount - COALESCE(r.received, 0), 0)), 0) AS outstanding,
       COUNT(CASE WHEN o.total_value - o.credit_applied_amount - COALESCE(r.received, 0) > 0.005 THEN 1 END) AS outstandingOrders,
       COALESCE(SUM(CASE WHEN o.status IN ('DOCUMENTATION_IN_PROGRESS','AWAITING_BALANCE_VERIFICATION','BALANCE_REJECTED')
                         THEN GREATEST(o.total_value - o.credit_applied_amount - COALESCE(r.received, 0), 0) END), 0) AS balanceDue,
       COUNT(CASE WHEN o.status IN ('DOCUMENTATION_IN_PROGRESS','AWAITING_BALANCE_VERIFICATION','BALANCE_REJECTED')
                   AND o.total_value - o.credit_applied_amount - COALESCE(r.received, 0) > 0.005 THEN 1 END) AS balanceDueOrders
     FROM orders o
     LEFT JOIN (SELECT p.order_id, SUM(COALESCE(v.amount_received, p.amount)) AS received
                FROM payments p
                LEFT JOIN payment_verifications v ON v.payment_id = p.id AND v.decision = 'APPROVED'
                WHERE p.status = 'APPROVED' GROUP BY p.order_id) r ON r.order_id = o.id
     WHERE o.status NOT IN ('CANCELLED','CLOSED')`,
  );

  const money = (v: unknown) => Number(v ?? 0).toFixed(2);
  res.json({
    receivedToday: { amount: money(received.today), count: Number(received.todayCount) },
    receivedMonth: { amount: money(received.month), count: Number(received.monthCount) },
    pendingAdvance: { amount: money(pend('ADVANCE')?.amount), count: Number(pend('ADVANCE')?.n ?? 0) },
    pendingBalance: { amount: money(pend('BALANCE')?.amount), count: Number(pend('BALANCE')?.n ?? 0) },
    outstanding: { amount: money(due.outstanding), count: Number(due.outstandingOrders) },
    balanceDue: { amount: money(due.balanceDue), count: Number(due.balanceDueOrders) },
  });
});
