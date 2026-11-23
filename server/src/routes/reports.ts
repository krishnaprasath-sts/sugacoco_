/** Reports (document Section 8) with CSV export, and the audit log viewer (Section 9). */
import { Router } from 'express';
import { sendExport } from '../services/exportFiles.js';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db/pool.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { parse } from '../middleware/validate.js';
import { ORDER_STATUSES, STATUS_LABEL, type OrderStatus } from '../workflow/statuses.js';
import { RECEIVED } from '../services/received.js';
import { AVAILABLE_SQL } from '../services/credit.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

const format = z.enum(['json', 'csv', 'xlsx', 'pdf']).default('json');
const money2 = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

reportsRouter.get('/orders', requirePermission('reports.view'), async (req, res) => {
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
    `SELECT STRAIGHT_JOIN o.id, o.order_no AS orderNo, o.pi_number AS piNumber, o.pi_date AS piDate, c.company_name AS customerName,
            o.status, o.currency, o.total_value AS totalValue, o.advance_amount AS advanceAmount, o.balance_amount AS balanceAmount,
            o.credit_applied_amount AS creditApplied,
            ${RECEIVED} AS received,
            u.name AS salesName, o.status_changed_at AS statusChangedAt, o.closed_at AS closedAt
     FROM orders o JOIN customers c ON c.id = o.customer_id JOIN users u ON u.id = o.created_by
     
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
            SUM(IF(o.status = 'CANCELLED', 0, ${RECEIVED})) AS received,
            SUM(IF(o.status = 'CANCELLED', 0, o.total_value - o.credit_applied_amount - ${RECEIVED})) AS outstanding
     FROM orders o 
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
reportsRouter.get('/customers', requirePermission('reports.view'), async (req, res) => {
  const fmt = parse(format, req.query.format);
  const [rows] = await pool.query<RowDataPacket[]>(
    // Totals per customer are added up on the orders table first; names and credit are looked up per result row.
    `SELECT c.id AS customerId, c.company_name AS customerName, g.currency,
            g.orders, g.closed, g.open, g.totalValue, g.creditUsed, g.received,
            (SELECT ${AVAILABLE_SQL('cc', true)}
               FROM customer_credits cc WHERE cc.customer_id = c.id AND cc.currency = g.currency) AS creditAvailable,
            (SELECT COALESCE(SUM(cc.amount), 0) FROM customer_credits cc
               WHERE cc.customer_id = c.id AND cc.currency = g.currency AND cc.status = 'VERIFIED' AND cc.entry_type = 'REFUND') AS refunded
     FROM (SELECT o.customer_id, o.currency,
                  COUNT(*) AS orders,
                  SUM(o.status = 'CLOSED') AS closed,
                  SUM(o.status NOT IN ('CLOSED','CANCELLED')) AS open,
                  SUM(IF(o.status = 'CANCELLED', 0, o.total_value)) AS totalValue,
                  SUM(IF(o.status = 'CANCELLED', 0, o.credit_applied_amount)) AS creditUsed,
                  SUM(IF(o.status = 'CANCELLED', 0, ${RECEIVED})) AS received
           FROM orders o GROUP BY o.customer_id, o.currency) g
     JOIN customers c ON c.id = g.customer_id
     ORDER BY c.company_name`,
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

// ───────────── Sales-wise and product-wise ─────────────

/** Shared filters: PI date range and which orders (open / closed / all). Cancelled orders never count. */
const groupedQuery = z.object({
  from: date,
  to: date,
  scope: z.enum(['all', 'open', 'closed']).default('all'),
  format,
});
type GroupedQuery = z.infer<typeof groupedQuery>;

function groupedWhere(q: GroupedQuery) {
  const where = ["o.status <> 'CANCELLED'"];
  const params: unknown[] = [];
  if (q.from) where.push('o.pi_date >= ?'), params.push(q.from);
  if (q.to) where.push('o.pi_date <= ?'), params.push(q.to);
  if (q.scope === 'open') where.push("o.status <> 'CLOSED'");
  if (q.scope === 'closed') where.push("o.status = 'CLOSED'");
  const scopeLabel = { all: 'Open and closed orders', open: 'Open orders', closed: 'Closed orders' }[q.scope];
  const subtitle = [scopeLabel, q.from || q.to ? `PI date ${q.from ?? 'start'} to ${q.to ?? 'today'}` : '', 'Cancelled orders not counted']
    .filter(Boolean)
    .join('  ·  ');
  return { sql: `WHERE ${where.join(' AND ')}`, params, subtitle };
}

/** One row per sales person (and currency): orders, customers, value, received, outstanding. */
reportsRouter.get('/sales', requirePermission('reports.view'), async (req, res) => {
  const q = parse(groupedQuery, req.query);
  const w = groupedWhere(q);
  const [rows] = await pool.query<RowDataPacket[]>(
    // Added up on the orders table first, then joined to the few users.
    `SELECT u.id AS salesId, u.name AS salesName, g.*
     FROM (SELECT o.created_by, o.currency,
                  COUNT(*) AS orders,
                  COUNT(DISTINCT o.customer_id) AS customers,
                  SUM(o.status <> 'CLOSED') AS open,
                  SUM(o.status = 'CLOSED') AS closed,
                  SUM(o.total_value) AS totalValue,
                  SUM(${RECEIVED}) AS received,
                  SUM(o.total_value - o.credit_applied_amount - ${RECEIVED}) AS outstanding
           FROM orders o
           ${w.sql}
           GROUP BY o.created_by, o.currency) g
     JOIN users u ON u.id = g.created_by
     ORDER BY g.currency, g.totalValue DESC`,
    w.params,
  );
  const data = rows.map((r) => ({
    salesId: Number(r.salesId),
    salesName: String(r.salesName),
    currency: String(r.currency),
    orders: Number(r.orders),
    customers: Number(r.customers),
    open: Number(r.open),
    closed: Number(r.closed),
    totalValue: Number(r.totalValue).toFixed(2),
    received: Number(r.received).toFixed(2),
    outstanding: Number(r.outstanding).toFixed(2),
    averageOrder: (Number(r.totalValue) / Math.max(1, Number(r.orders))).toFixed(2),
  }));
  if (q.format !== 'json') {
    return sendExport(res, q.format, {
      name: 'sales-wise-report',
      title: 'Sales-wise Report',
      subtitle: w.subtitle,
      cols: [
        { header: 'Sales person', width: 22 },
        { header: 'Currency', width: 9 },
        { header: 'Orders', type: 'number', width: 8 },
        { header: 'Open', type: 'number', width: 8 },
        { header: 'Closed', type: 'number', width: 8 },
        { header: 'Customers', type: 'number', width: 10 },
        { header: 'Order value', type: 'money', width: 15 },
        { header: 'Average order', type: 'money', width: 14 },
        { header: 'Received', type: 'money', width: 15 },
        { header: 'Outstanding', type: 'money', width: 15 },
      ],
      rows: data.map((r) => [r.salesName, r.currency, r.orders, r.open, r.closed, r.customers, r.totalValue, r.averageOrder, r.received, r.outstanding]),
      footer: totalsByCurrency(data).map((t) => `${t.currency}: ${t.orders} orders · value ${money2(t.totalValue)} · received ${money2(t.received)} · outstanding ${money2(t.outstanding)}`),
    });
  }
  const totals = totalsByCurrency(data).map((t) => ({
    ...t,
    totalValue: t.totalValue.toFixed(2),
    received: t.received.toFixed(2),
    outstanding: t.outstanding.toFixed(2),
  }));
  res.json({ rows: data, totals });
});

/** One row per product (and unit, currency): orders, customers, quantity, value, average price. */
reportsRouter.get('/products', requirePermission('reports.view'), async (req, res) => {
  const q = parse(groupedQuery, req.query);
  const w = groupedWhere(q);
  // Lines linked to the product list group by product; older free-text lines group by name.
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT MAX(COALESCE(p.name, oi.product_name)) AS productName, MAX(oi.product_id) AS productId,
            oi.unit, o.currency,
            COUNT(DISTINCT o.id) AS orders,
            COUNT(DISTINCT o.customer_id) AS customers,
            SUM(oi.quantity) AS quantity,
            SUM(COALESCE(oi.quantity_mt, 0)) AS quantityMt,
            SUM(oi.line_total) AS totalValue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN products p ON p.id = oi.product_id
     ${w.sql}
     GROUP BY COALESCE(CONCAT('id:', oi.product_id), CONCAT('name:', LOWER(TRIM(oi.product_name)))), oi.unit, o.currency
     ORDER BY o.currency, totalValue DESC`,
    w.params,
  );
  const data = rows.map((r) => ({
    productId: r.productId == null ? null : Number(r.productId),
    productName: String(r.productName),
    unit: String(r.unit),
    currency: String(r.currency),
    orders: Number(r.orders),
    customers: Number(r.customers),
    quantity: Number(r.quantity).toFixed(3),
    quantityMt: Number(r.quantityMt).toFixed(3),
    totalValue: Number(r.totalValue).toFixed(2),
    averagePrice: (Number(r.totalValue) / Math.max(Number(r.quantity), 0.001)).toFixed(2),
  }));
  if (q.format !== 'json') {
    const byCur = new Map<string, number>();
    for (const r of data) byCur.set(r.currency, (byCur.get(r.currency) ?? 0) + Number(r.totalValue));
    return sendExport(res, q.format, {
      name: 'product-wise-report',
      title: 'Product-wise Report',
      subtitle: w.subtitle,
      cols: [
        { header: 'Product', width: 26 },
        { header: 'Unit', width: 7 },
        { header: 'Currency', width: 9 },
        { header: 'Orders', type: 'number', width: 8 },
        { header: 'Customers', type: 'number', width: 10 },
        { header: 'Quantity', type: 'number', width: 12 },
        { header: 'Quantity (MT)', type: 'number', width: 12 },
        { header: 'Value', type: 'money', width: 15 },
        { header: 'Average price', type: 'money', width: 13 },
      ],
      rows: data.map((r) => [r.productName, r.unit, r.currency, r.orders, r.customers, Number(r.quantity), Number(r.quantityMt), r.totalValue, r.averagePrice]),
      footer: [...byCur].map(([cur, v]) => `${cur}: product value ${money2(v)}`),
    });
  }
  res.json({ rows: data });
});

function totalsByCurrency(rows: { currency: string; orders: number; totalValue: string; received: string; outstanding: string }[]) {
  const map = new Map<string, { currency: string; orders: number; totalValue: number; received: number; outstanding: number }>();
  for (const r of rows) {
    const t = map.get(r.currency) ?? { currency: r.currency, orders: 0, totalValue: 0, received: 0, outstanding: 0 };
    t.orders += r.orders;
    t.totalValue += Number(r.totalValue);
    t.received += Number(r.received);
    t.outstanding += Number(r.outstanding);
    map.set(r.currency, t);
  }
  return [...map.values()];
}

/** Modification history. MD/Admin only. */
reportsRouter.get('/audit', requirePermission('audit.view'), async (req, res) => {
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
  // Matching orders are found first, then their entries through the audit order index.
  if (q.orderNo) where.push('a.order_id IN (SELECT so.id FROM orders so WHERE so.order_no LIKE ?)'), params.push(`%${q.orderNo}%`);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const pageSize = q.pageSize;
  const [[count]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM audit_logs a ${whereSql}`, params);
  const [rows] = await pool.query<RowDataPacket[]>(
    // Without an order filter, walk the newest entries first and stop at the page (STRAIGHT_JOIN keeps that plan).
    `SELECT ${q.orderNo ? '' : 'STRAIGHT_JOIN'} a.id, a.action, a.entity_type AS entityType, a.entity_id AS entityId, a.changes, a.ip_address AS ipAddress,
            a.created_at AS createdAt, u.name AS userName, r.name AS userRole, o.id AS orderId, o.order_no AS orderNo
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN orders o ON o.id = a.order_id
     ${whereSql} ORDER BY a.id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, (q.page - 1) * pageSize],
  );
  const [actions] = await pool.query<RowDataPacket[]>('SELECT DISTINCT action FROM audit_logs ORDER BY action');
  res.json({ entries: rows, total: Number(count.n), page: q.page, pageSize, actions: actions.map((a) => a.action) });
});
