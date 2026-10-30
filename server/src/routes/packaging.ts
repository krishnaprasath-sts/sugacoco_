/** Packaging: queue and progress updates (updated document, Section 10). No pricing returned. */
import { Router } from 'express';
import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool, withTransaction } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { parse } from '../middleware/validate.js';
import { audit } from '../services/audit.js';
import { changeStatus, lockOrder } from '../services/workflow.js';
import { ordersInStatuses, recentlyMoved } from '../services/queue.js';
import type { OrderStatus } from '../workflow/statuses.js';
import { optionalDate } from '../lib/validation.js';

export const packagingRouter = Router();
packagingRouter.use(requireAuth, requireRole('PACKAGING'));

export const PACKAGING_WORKING: OrderStatus[] = ['AWAITING_PACKAGING', 'PACKAGING_IN_PROGRESS', 'PACKAGING_ON_HOLD', 'PACKAGING_ISSUE'];

const text = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const date = optionalDate;

const updateSchema = z.object({
  packagingStatus: z.enum(['IN_PROGRESS', 'ON_HOLD', 'ISSUE', 'COMPLETED'], { error: 'Choose the packaging status' }),
  startDate: date,
  completionDate: date,
  quantityPacked: z.coerce.number().nonnegative('Cannot be negative').max(1e9, 'Quantity is too large').optional().nullable(),
  quantityUnit: text(20),
  issueType: z.enum(['SHORTAGE', 'DAMAGE', 'REWORK', 'OTHER']).optional().nullable(),
  issueReason: text(2000),
  remarks: text(5000),
});

const TO_STATUS: Record<string, OrderStatus> = {
  IN_PROGRESS: 'PACKAGING_IN_PROGRESS',
  ON_HOLD: 'PACKAGING_ON_HOLD',
  ISSUE: 'PACKAGING_ISSUE',
  COMPLETED: 'READY_FOR_DOCUMENTATION',
};
const LABEL: Record<string, string> = { IN_PROGRESS: 'In progress', ON_HOLD: 'On hold', ISSUE: 'Issue / rework', COMPLETED: 'Completed' };

packagingRouter.post('/orders/:id/updates', async (req, res) => {
  const orderId = parse(z.coerce.number().int().positive(), req.params.id);
  const body = parse(updateSchema, req.body);

  await withTransaction(async (conn) => {
    const { status } = await lockOrder(conn, orderId);
    if (!PACKAGING_WORKING.includes(status)) throw new HttpError(409, 'This order is not at the Packaging stage');

    const fields: Record<string, string> = {};
    if ((body.packagingStatus === 'ON_HOLD' || body.packagingStatus === 'ISSUE') && !body.issueReason) {
      fields.issueReason = 'Give the reason (shortage, damage, rework or delay)';
    }
    if (body.packagingStatus === 'ISSUE' && !body.issueType) fields.issueType = 'Choose the issue type';
    if (body.packagingStatus === 'COMPLETED') {
      if (status !== 'PACKAGING_IN_PROGRESS') fields.packagingStatus = 'Set packaging to In progress before completing';
      if (!body.startDate) fields.startDate = 'Enter the start date';
      if (!body.completionDate) fields.completionDate = 'Enter the completion date';
      if (body.quantityPacked == null || body.quantityPacked <= 0) fields.quantityPacked = 'Enter the quantity packed';
    }
    if (body.startDate && body.completionDate && body.completionDate < body.startDate) {
      fields.completionDate = 'Completion date is before the start date';
    }
    if (Object.keys(fields).length) throw new HttpError(400, 'Please check the highlighted fields', { fields });

    const [r] = await conn.query<ResultSetHeader>(
      `INSERT INTO packaging_updates (order_id, packaging_status, start_date, completion_date, quantity_packed, quantity_unit,
                                      issue_type, issue_reason, remarks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, body.packagingStatus, body.startDate, body.completionDate, body.quantityPacked ?? null, body.quantityUnit,
       body.issueType ?? null, body.issueReason, body.remarks, req.user!.id],
    );
    await conn.query('UPDATE orders SET packaging_status = ?, updated_by = ? WHERE id = ?', [body.packagingStatus, req.user!.id, orderId]);
    await audit(req, { action: 'PACKAGING_UPDATED', entityType: 'packaging_update', entityId: r.insertId, orderId, changes: body }, conn);

    const to = TO_STATUS[body.packagingStatus];
    if (to !== status) {
      const reason = body.issueReason ?? body.remarks;
      const note = body.packagingStatus === 'COMPLETED' ? 'Packaging completed. Ready for documentation' : `Packaging: ${LABEL[body.packagingStatus]}${reason ? ` · ${reason}` : ''}`;
      await changeStatus(conn, req, orderId, to, note);
    }
  });
  res.status(201).json({ ok: true });
});

packagingRouter.get('/queue', async (_req, res) => {
  const media = `(SELECT COUNT(*) FROM order_documents d WHERE d.order_id = o.id AND d.deleted_at IS NULL
                    AND d.category IN ('PACKAGING_IMAGE','PACKAGING_DOC')) AS mediaCount,
                 (SELECT p.quantity_packed FROM packaging_updates p WHERE p.order_id = o.id ORDER BY p.id DESC LIMIT 1) AS quantityPacked`;
  const active = await ordersInStatuses(PACKAGING_WORKING, 'o.status_changed_at ASC', media);
  const sent = await recentlyMoved(PACKAGING_WORKING, 'READY_FOR_DOCUMENTATION', 5);
  const [[{ sentTotal }]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT order_id) AS sentTotal FROM order_status_history
     WHERE from_status IN (${PACKAGING_WORKING.map(() => '?').join(',')}) AND to_status = 'READY_FOR_DOCUMENTATION'`,
    PACKAGING_WORKING,
  );
  res.json({
    active: active.map((r) => ({ ...r, mediaCount: Number(r.mediaCount) })),
    sentToDocumentation: sent,
    sentTotal: Number(sentTotal),
  });
});

/** Every order Packaging finished and handed to Documentation: when, how much was packed, where it is now. */
const sentQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  q: z.string().trim().max(100).optional(),
});
packagingRouter.get('/sent', async (req, res) => {
  const { page, pageSize, q } = parse(sentQuery, req.query);
  const marks = PACKAGING_WORKING.map(() => '?').join(',');
  const where = q ? 'WHERE (o.order_no LIKE ? OR o.pi_number LIKE ? OR c.company_name LIKE ?)' : '';
  const like = q ? Array(3).fill(`%${q.replace(/[\\%_]/g, '\\$&')}%`) : [];
  const from = `FROM orders o JOIN customers c ON c.id = o.customer_id
    JOIN (SELECT order_id, MAX(changed_at) AS sentAt FROM order_status_history
          WHERE from_status IN (${marks}) AND to_status = 'READY_FOR_DOCUMENTATION' GROUP BY order_id) s ON s.order_id = o.id
    ${where}`;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT o.id, o.order_no AS orderNo, o.pi_number AS piNumber, o.status, o.status_changed_at AS statusChangedAt,
            c.company_name AS customerName, s.sentAt,
            (SELECT GROUP_CONCAT(CONCAT(i.product_name, ' (', TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM i.quantity)), ' ', i.unit, ')')
                                 ORDER BY i.sort_order SEPARATOR ', ') FROM order_items i WHERE i.order_id = o.id) AS products,
            (SELECT p.quantity_packed FROM packaging_updates p WHERE p.order_id = o.id ORDER BY p.id DESC LIMIT 1) AS quantityPacked,
            (SELECT p.quantity_unit FROM packaging_updates p WHERE p.order_id = o.id ORDER BY p.id DESC LIMIT 1) AS quantityUnit,
            (SELECT COUNT(*) FROM order_documents d WHERE d.order_id = o.id AND d.deleted_at IS NULL
               AND d.category IN ('PACKAGING_IMAGE','PACKAGING_DOC')) AS mediaCount
     ${from}
     ORDER BY s.sentAt DESC, o.id DESC LIMIT ? OFFSET ?`,
    [...PACKAGING_WORKING, ...like, pageSize, (page - 1) * pageSize],
  );
  const [[{ total }]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total ${from}`, [...PACKAGING_WORKING, ...like]);
  res.json({ orders: rows.map((r) => ({ ...r, mediaCount: Number(r.mediaCount) })), total: Number(total), page, pageSize });
});

/** Loaded with the order detail. */
export async function packagingHistory(orderId: number, query: (sql: string, p: unknown[]) => Promise<RowDataPacket[]>) {
  return query(
    `SELECT p.id, p.packaging_status AS packagingStatus, p.start_date AS startDate, p.completion_date AS completionDate,
            p.quantity_packed AS quantityPacked, p.quantity_unit AS quantityUnit, p.issue_type AS issueType,
            p.issue_reason AS issueReason, p.remarks, u.name AS createdByName, p.created_at AS createdAt
     FROM packaging_updates p JOIN users u ON u.id = p.created_by WHERE p.order_id = ? ORDER BY p.id DESC`,
    [orderId],
  );
}
