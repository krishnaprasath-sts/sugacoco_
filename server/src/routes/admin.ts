/** MD/Admin: overview, pending actions, cancellations. Read-only apart from cancelling (in orders route). */
import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { RECEIVED_BY_ORDER } from '../services/received.js';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { STATUS_OWNER, type OrderStatus } from '../workflow/statuses.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('ADMIN'));

adminRouter.get('/summary', async (_req, res) => {
  const [statusRows] = await pool.query<RowDataPacket[]>('SELECT status, COUNT(*) AS n FROM orders GROUP BY status');
  const counts = Object.fromEntries(statusRows.map((r) => [r.status, Number(r.n)])) as Partial<Record<OrderStatus, number>>;
  const pendingByDept: Record<string, number> = {};
  for (const [status, n] of Object.entries(counts)) {
    const owner = STATUS_OWNER[status as OrderStatus];
    if (owner) pendingByDept[owner] = (pendingByDept[owner] ?? 0) + (n ?? 0);
  }
  // Open orders only (not cancelled / closed), same rule as the money cards (/api/summary/money):
  // still to collect per order = total − credit used − received, never below zero.
  const [money] = await pool.query<RowDataPacket[]>(
    `SELECT o.currency,
            COUNT(*) AS orders,
            SUM(o.total_value - o.credit_applied_amount) AS totalValue,
            SUM(LEAST(COALESCE(r.received, 0), o.total_value - o.credit_applied_amount)) AS received,
            SUM(GREATEST(o.total_value - o.credit_applied_amount - COALESCE(r.received, 0), 0)) AS outstanding
     FROM orders o
     LEFT JOIN (${RECEIVED_BY_ORDER}) r ON r.order_id = o.id
     WHERE o.status NOT IN ('CANCELLED','CLOSED')
     GROUP BY o.currency`,
  );
  const [pendingVerification] = await pool.query<RowDataPacket[]>(
    `SELECT p.currency, p.payment_type AS type, COUNT(*) AS n, SUM(p.amount) AS amount
     FROM payments p JOIN orders o ON o.id = p.order_id
     WHERE p.status = 'PENDING' AND o.status <> 'CANCELLED' GROUP BY p.currency, p.payment_type`,
  );
  res.json({
    counts,
    pendingByDept,
    money: money.map((m) => ({
      currency: m.currency,
      orders: Number(m.orders),
      totalValue: Number(m.totalValue).toFixed(2),
      received: Number(m.received).toFixed(2),
      outstanding: Number(m.outstanding).toFixed(2),
    })),
    pendingVerification: pendingVerification.map((p) => ({ ...p, n: Number(p.n), amount: String(p.amount) })),
  });
});

/** Open orders with the department that must act and how long they have waited. */
adminRouter.get('/pending', async (_req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT o.id, o.order_no AS orderNo, o.pi_number AS piNumber, o.status, o.status_changed_at AS statusChangedAt,
            c.company_name AS customerName, TIMESTAMPDIFF(HOUR, o.status_changed_at, NOW()) AS hoursWaiting
     FROM orders o JOIN customers c ON c.id = o.customer_id
     WHERE o.status NOT IN ('CLOSED','CANCELLED') ORDER BY o.status_changed_at`,
  );
  res.json({
    orders: rows.map((r) => ({ ...r, hoursWaiting: Number(r.hoursWaiting), owner: STATUS_OWNER[r.status as OrderStatus] })),
  });
});

adminRouter.get('/cancellations', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  const [[count]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM order_cancellations');
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT oc.id, oc.reason, oc.status_before AS statusBefore, oc.cancelled_at AS cancelledAt, u.name AS cancelledByName,
            o.id AS orderId, o.order_no AS orderNo, o.pi_number AS piNumber, o.currency, o.total_value AS totalValue,
            c.company_name AS customerName
     FROM order_cancellations oc
     JOIN orders o ON o.id = oc.order_id JOIN customers c ON c.id = o.customer_id JOIN users u ON u.id = oc.cancelled_by
     ORDER BY oc.cancelled_at DESC
     LIMIT ? OFFSET ?`,
    [pageSize, (page - 1) * pageSize],
  );
  res.json({ cancellations: rows, total: Number(count.n), page, pageSize });
});
