/** QC / Production: work queue and progress updates. No pricing is ever returned here. */
import { Router } from 'express';
import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool, withTransaction } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { parse } from '../middleware/validate.js';
import { audit } from '../services/audit.js';
import { changeStatus, lockOrder } from '../services/workflow.js';
import type { OrderStatus } from '../workflow/statuses.js';
import { optionalDate } from '../lib/validation.js';

export const qcRouter = Router();
qcRouter.use(requireAuth, requireRole('QC'));

export const QC_WORKING: OrderStatus[] = ['AWAITING_QC', 'QC_IN_PROGRESS', 'WAITING_FOR_MATERIALS', 'AWAITING_QUALITY_CHECK'];

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const dateOrNull = optionalDate;

const updateSchema = z.object({
  /** READY = mark ready for packaging. */
  qcStatus: z.enum(['ONGOING', 'WAITING', 'ON_HOLD', 'READY'], { error: 'Choose the QC status' }),
  sourcingStatus: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'SOURCED']).optional().nullable(),
  expectedReadyDate: dateOrNull,
  processingTimeline: optionalText(200),
  qualityCheckStatus: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'PASSED', 'FAILED']).optional().nullable(),
  qualityCheckResult: optionalText(5000),
  dateChangeReason: optionalText(2000),
  remarks: optionalText(5000),
});

/** Overall order status for a QC update. */
function nextStatus(qcStatus: string, quality: string | null | undefined): OrderStatus {
  if (qcStatus === 'READY') return 'AWAITING_PACKAGING';
  if (qcStatus === 'WAITING') return 'WAITING_FOR_MATERIALS';
  if (qcStatus === 'ONGOING' && quality === 'IN_PROGRESS') return 'AWAITING_QUALITY_CHECK';
  return 'QC_IN_PROGRESS'; // ONGOING or ON_HOLD (hold is shown through qc_status)
}

qcRouter.post('/orders/:id/updates', async (req, res) => {
  const orderId = parse(z.coerce.number().int().positive(), req.params.id);
  const body = parse(updateSchema, req.body);

  await withTransaction(async (conn) => {
    const { status } = await lockOrder(conn, orderId);
    if (!QC_WORKING.includes(status)) throw new HttpError(409, 'This order is not at the QC / Production stage');

    const [[order]] = await conn.query<RowDataPacket[]>('SELECT expected_ready_date FROM orders WHERE id = ?', [orderId]);
    const fields: Record<string, string> = {};
    const oldDate: string | null = order.expected_ready_date;
    if (oldDate && body.expectedReadyDate !== oldDate && !body.dateChangeReason) {
      fields.dateChangeReason = 'Explain why the ready date changed';
    }
    if (body.qcStatus === 'ON_HOLD' && !body.remarks) fields.remarks = 'Say why the order is on hold';
    if (body.qcStatus === 'READY') {
      if (body.qualityCheckStatus !== 'PASSED') fields.qualityCheckStatus = 'Quality check must be Passed before marking ready';
      if (body.sourcingStatus !== 'SOURCED') fields.sourcingStatus = 'Materials must be Sourced before marking ready';
    }
    if (body.qualityCheckStatus === 'FAILED' && !body.qualityCheckResult) fields.qualityCheckResult = 'Describe what failed';
    if (Object.keys(fields).length) throw new HttpError(400, 'Please check the highlighted fields', { fields });

    const savedQc = body.qcStatus === 'READY' ? 'READY' : body.qcStatus;
    const [r] = await conn.query<ResultSetHeader>(
      `INSERT INTO qc_updates (order_id, qc_status, sourcing_status, expected_ready_date, processing_timeline,
                               quality_check_status, quality_check_result, date_change_reason, remarks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, savedQc, body.sourcingStatus ?? null, body.expectedReadyDate, body.processingTimeline,
       body.qualityCheckStatus ?? null, body.qualityCheckResult, body.dateChangeReason, body.remarks, req.user!.id],
    );
    await conn.query('UPDATE orders SET qc_status = ?, expected_ready_date = ?, updated_by = ? WHERE id = ?', [
      savedQc, body.expectedReadyDate, req.user!.id, orderId,
    ]);
    await audit(req, { action: 'QC_UPDATED', entityType: 'qc_update', entityId: r.insertId, orderId, changes: { ...body, previousReadyDate: oldDate } }, conn);

    const to = nextStatus(body.qcStatus, body.qualityCheckStatus);
    if (to !== status) {
      const label = { ONGOING: 'Ongoing', WAITING: 'Waiting for materials', ON_HOLD: 'On hold', READY: 'Ready' }[body.qcStatus];
      const note = body.qcStatus === 'READY' ? 'QC passed. Ready for packaging' : `QC status: ${label}${body.remarks ? ` · ${body.remarks}` : ''}`;
      await changeStatus(conn, req, orderId, to, note);
      if (to === 'AWAITING_PACKAGING') await conn.query("UPDATE orders SET packaging_status = 'AWAITING' WHERE id = ?", [orderId]);
    }
  });
  res.status(201).json({ ok: true });
});

/** Orders at the QC stage (oldest first) and orders recently sent to Packaging. */
qcRouter.get('/queue', async (_req, res) => {
  const select = `
    SELECT o.id, o.order_no AS orderNo, o.pi_number AS piNumber, o.status, o.status_changed_at AS statusChangedAt,
           o.qc_status AS qcStatus, o.expected_ready_date AS expectedReadyDate, c.company_name AS customerName,
           (SELECT GROUP_CONCAT(CONCAT(i.product_name, ' (', TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM i.quantity)), ' ', i.unit, ')')
                                ORDER BY i.sort_order SEPARATOR ', ')
              FROM order_items i WHERE i.order_id = o.id) AS products,
           (SELECT q.sourcing_status FROM qc_updates q WHERE q.order_id = o.id ORDER BY q.id DESC LIMIT 1) AS sourcingStatus,
           (SELECT q.quality_check_status FROM qc_updates q WHERE q.order_id = o.id ORDER BY q.id DESC LIMIT 1) AS qualityCheckStatus,
           (SELECT COUNT(*) FROM order_documents d WHERE d.order_id = o.id AND d.deleted_at IS NULL
              AND d.category IN ('QC_MEDIA','CONTAINER_IMAGE','LOADING_IMAGE')) AS mediaCount
    FROM orders o JOIN customers c ON c.id = o.customer_id`;
  const [active] = await pool.query<RowDataPacket[]>(
    `${select} WHERE o.status IN (${QC_WORKING.map(() => '?').join(',')})
     ORDER BY (o.expected_ready_date IS NULL), o.expected_ready_date, o.status_changed_at`,
    QC_WORKING,
  );
  const [sent] = await pool.query<RowDataPacket[]>(
    `${select}
     WHERE o.id IN (SELECT h.order_id FROM order_status_history h
                    WHERE h.from_status IN (${QC_WORKING.map(() => '?').join(',')}) AND h.to_status = 'AWAITING_PACKAGING')
     ORDER BY o.status_changed_at DESC LIMIT 20`,
    QC_WORKING,
  );
  const clean = (rows: RowDataPacket[]) => rows.map((r) => ({ ...r, mediaCount: Number(r.mediaCount) }));
  res.json({ active: clean(active), sentToPackaging: clean(sent) });
});
