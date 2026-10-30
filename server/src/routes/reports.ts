/** Reports (document Section 8) with CSV export, and the audit log viewer (Section 9). */
import { Router } from 'express';
import { sendExport } from '../services/exportFiles.js';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { parse } from '../middleware/validate.js';
import { ORDER_STATUSES, STATUS_LABEL, type OrderStatus } from '../workflow/statuses.js';
import { RECEIVED_BY_ORDER } from '../services/received.js';
import { AVAILABLE_SQL } from '../services/credit.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth, requireRole('ADMIN', 'ACCOUNTS'));

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

const format = z.enum(['json', 'csv', 'xlsx', 'pdf']).default('json');
const money2 = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

reportsRouter.get('/orders', async (req, res) => {
  const q = parse(
    z.object({
      from: date,
      to: date,
      customerId: z.coerce.number().int().positive().optional(),
      status: z.string().optional().transform((v) => (v ? v.split(',').filter((s): s is OrderStatus => (ORDER_STATUSES as readonly string[]).includes(s)) : [])),
      format,
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
    }),
    req.query,
  );
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.from) where.push('o.pi_date >= ?'), params.push(q.from);
  if (q.to) where.push('o.pi_date <= ?'), params.push(q.to);
  if (q.customerId) where.push('o.customer_id = ?'), params.push(q.customerId);
  if (q.status.length) where.push(`o.status IN (${q.status.map(() => '?').join(',')})`), params.push(...q.status);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT o.id, o.order_no AS orderNo, o.pi_number AS piNumber, o.pi_date AS piDate, c.company_name AS customerName,
            o.status, o.currency, o.total_value AS totalValue, o.advance_amount AS advanceAmount, o.balance_amount AS balanceAmount,
            o.credit_applied_amount AS creditApplied,
            COALESCE(r.received, 0) AS received,
            u.name AS salesName, o.status_changed_at AS statusChangedAt, o.closed_at AS closedAt
     FROM orders o JOIN customers c ON c.id = o.customer_id JOIN users u ON u.id = o.created_by
     LEFT JOIN (${RECEIVED_BY_ORDER}) r ON r.order_id = o.id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY o.pi_date DESC, o.id DESC
     ${q.format !== 'json' ? 'LIMIT 50000' : 'LIMIT ? OFFSET ?'}`,
    q.format !== 'json' ? params : [...params, q.pageSize, (q.page - 1) * q.pageSize],
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (rows as Record<string, any>[]).map((r): Record<string, any> => ({
    ...r,
    statusLabel: STATUS_LABEL[r.status as OrderStatus],
    outstanding: r.status === 'CANCELLED' ? '0.00' : (Number(r.totalValue) - Number(r.creditApplied) - Number(r.received)).toFixed(2),
  }));
  if (q.format !== 'json') {
    // Subtitle: the filters used. Footer: totals per currency (cancelled orders excluded).
    const filters = [
      q.status.length ? `Status: ${q.status.map((s) => STATUS_LABEL[s]).join(', ')}` : 'All orders',
      q.from || q.to ? `PI date ${q.from ?? 'start'} to ${q.to ?? 'today'}` : '',
    ].filter(Boolean);
    const byCur = new Map<string, { n: number; value: number; received: number; outstanding: number }>();
    for (const r of data) {
      if (r.status === 'CANCELLED') continue;
      const t = byCur.get(r.currency) ?? { n: 0, value: 0, received: 0, outstanding: 0 };
      t.n++;
      t.value += Number(r.totalValue);
      t.received += Number(r.received);
      t.outstanding += Number(r.outstanding);
      byCur.set(r.currency, t);
    }
    return sendExport(res, q.format, {
      name: 'orders-report',
      title: 'Order Report',
      subtitle: filters.join('  ·  '),
      cols: [
        { header: 'Order no', width: 11 },
        { header: 'PI no', width: 12 },
        { header: 'PI date', type: 'date', width: 11 },
        { header: 'Customer', width: 22 },
        { header: 'Status', width: 18 },
        { header: 'Currency', width: 8 },
        { header: 'Total', type: 'money', width: 13 },
        { header: 'Advance', type: 'money', width: 12 },
        { header: 'Balance', type: 'money', width: 12 },
        { header: 'Credit used', type: 'money', width: 11 },
        { header: 'Received', type: 'money', width: 13 },
        { header: 'Outstanding', type: 'money', width: 13 },
        { header: 'Sales', width: 13 },
        { header: 'Last update', type: 'datetime', width: 15 },
        { header: 'Closed on', type: 'datetime', width: 15 },
      ],
      rows: data.map((r) => [r.orderNo, r.piNumber, r.piDate, r.customerName, r.statusLabel, r.currency, r.totalValue, r.advanceAmount, r.balanceAmount, r.creditApplied, r.received, r.outstanding, r.salesName, r.statusChangedAt, r.closedAt]),
      footer: [...byCur].map(([cur, t]) => `${cur}: ${t.n} orders · value ${money2(t.value)} · received ${money2(t.received)} · outstanding ${money2(t.outstanding)}`),
    });
  }
  // Totals for the whole filter (not just this page).
  const [totals] = await pool.query<RowDataPacket[]>(
    `SELECT o.currency, COUNT(*) AS orders,
            SUM(IF(o.status = 'CANCELLED', 0, o.total_value)) AS totalValue,
            SUM(IF(o.status = 'CANCELLED', 0, COALESCE(r.received, 0))) AS received,
            SUM(IF(o.status = 'CANCELLED', 0, o.total_value - o.credit_applied_amount - COALESCE(r.received, 0))) AS outstanding
     FROM orders o LEFT JOIN (${RECEIVED_BY_ORDER}) r ON r.order_id = o.id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY o.currency`,
    params,
  );
  const total = totals.reduce((n, t) => n + Number(t.orders), 0);
  res.json({
    orders: data,
    total,
    page: q.page,
    pageSize: q.pageSize,
    totals: totals.map((t) => ({ currency: t.currency, orders: Number(t.orders), totalValue: String(t.totalValue), received: String(t.received), outstanding: String(t.outstanding) })),
  });
});

/** Per customer: orders, value, received, outstanding, withheld available, refunded. */
reportsRouter.get('/customers', async (req, res) => {
  const fmt = parse(format, req.query.format);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.id AS customerId, c.company_name AS customerName, o.currency,
            COUNT(o.id) AS orders,
            SUM(o.status = 'CLOSED') AS closed,
            SUM(o.status NOT IN ('CLOSED','CANCELLED')) AS open,
            SUM(IF(o.status = 'CANCELLED', 0, o.total_value)) AS totalValue,
            SUM(IF(o.status = 'CANCELLED', 0, o.credit_applied_amount)) AS creditUsed,
            SUM(IF(o.status = 'CANCELLED', 0, COALESCE(r.received, 0))) AS received,
            (SELECT ${AVAILABLE_SQL('cc', true)}
               FROM customer_credits cc WHERE cc.customer_id = c.id AND cc.currency = o.currency) AS creditAvailable,
            (SELECT COALESCE(SUM(cc.amount), 0) FROM customer_credits cc
               WHERE cc.customer_id = c.id AND cc.currency = o.currency AND cc.status = 'VERIFIED' AND cc.entry_type = 'REFUND') AS refunded
     FROM customers c JOIN orders o ON o.customer_id = c.id
     LEFT JOIN (${RECEIVED_BY_ORDER}) r ON r.order_id = o.id
     GROUP BY c.id, c.company_name, o.currency ORDER BY c.company_name`,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (rows as Record<string, any>[]).map((r): Record<string, any> => ({
    ...r,
    orders: Number(r.orders),
    closed: Number(r.closed),
    open: Number(r.open),
    outstanding: (Number(r.totalValue) - Number(r.creditUsed) - Number(r.received)).toFixed(2),
  }));
  if (fmt !== 'json') {
    return sendExport(res, fmt, {
      name: 'customer-balances',
      title: 'Customer Balances',
      subtitle: 'All customers with orders. Cancelled orders are not counted in value, received or outstanding.',
      cols: [
        { header: 'Customer', width: 26 },
        { header: 'Currency', width: 9 },
        { header: 'Orders', type: 'number', width: 8 },
        { header: 'Open', type: 'number', width: 8 },
        { header: 'Closed', type: 'number', width: 8 },
        { header: 'Order value', type: 'money', width: 15 },
        { header: 'Received', type: 'money', width: 15 },
        { header: 'Outstanding', type: 'money', width: 15 },
        { header: 'Credit available', type: 'money', width: 15 },
        { header: 'Refunded', type: 'money', width: 13 },
      ],
      rows: data.map((r) => [r.customerName, r.currency, r.orders, r.open, r.closed, r.totalValue, r.received, r.outstanding, r.creditAvailable, r.refunded]),
    });
  }
  res.json({ customers: data });
});

/** Modification history. MD/Admin only. */
reportsRouter.get('/audit', requireRole('ADMIN'), async (req, res) => {
  const q = parse(
    z.object({
      from: date,
      to: date,
      action: z.string().trim().max(60).optional(),
      orderNo: z.string().trim().max(30).optional(),
      pageSize: z.coerce.number().int().min(1).max(100).default(50),
      page: z.coerce.number().int().min(1).default(1),
    }),
    req.query,
  );
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.from) where.push('a.created_at >= ?'), params.push(`${q.from} 00:00:00`);
  if (q.to) where.push('a.created_at <= ?'), params.push(`${q.to} 23:59:59`);
  if (q.action) where.push('a.action = ?'), params.push(q.action);
  if (q.orderNo) where.push('o.order_no LIKE ?'), params.push(`%${q.orderNo}%`);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const pageSize = q.pageSize;
  const [[count]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM audit_logs a LEFT JOIN orders o ON o.id = a.order_id ${whereSql}`, params);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id, a.action, a.entity_type AS entityType, a.entity_id AS entityId, a.changes, a.ip_address AS ipAddress,
            a.created_at AS createdAt, u.name AS userName, r.code AS userRole, o.id AS orderId, o.order_no AS orderNo
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN orders o ON o.id = a.order_id
     ${whereSql} ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, (q.page - 1) * pageSize],
  );
  const [actions] = await pool.query<RowDataPacket[]>('SELECT DISTINCT action FROM audit_logs ORDER BY action');
  res.json({ entries: rows, total: Number(count.n), page: q.page, pageSize, actions: actions.map((a) => a.action) });
});
