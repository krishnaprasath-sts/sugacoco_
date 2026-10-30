/**
 * Documentation: container booking / loading, port gate-in, bill release, completion.
 * Confirmed rule: gate-in happens only after the balance payment is approved (AWAITING_DOCUMENT_RELEASE).
 */
import { Router } from 'express';
import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { withTransaction } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { parse } from '../middleware/validate.js';
import { audit, diff } from '../services/audit.js';
import { changeStatus, lockOrder } from '../services/workflow.js';
import { ordersInStatuses } from '../services/queue.js';
import type { OrderStatus } from '../workflow/statuses.js';
import { optionalDate } from '../lib/validation.js';

export const documentationRouter = Router();
documentationRouter.use(requireAuth, requireRole('DOCUMENTATION'));

/** Stages where Documentation can edit container records. */
export const DOCS_EDITABLE: OrderStatus[] = [
  'READY_FOR_DOCUMENTATION',
  'DOCUMENTATION_IN_PROGRESS',
  'AWAITING_BALANCE_VERIFICATION',
  'BALANCE_REJECTED',
  'AWAITING_DOCUMENT_RELEASE',
];

const text = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const date = optionalDate;
const idParam = z.coerce.number().int().positive();

const containerSchema = z.object({
  bookingNo: text(60),
  shippingLine: text(120),
  vesselName: text(120),
  voyageNo: text(40),
  containerNo: text(20),
  containerSize: text(20),
  sealNo: text(40),
  portOfLoading: text(120),
  portOfDischarge: text(120),
  loadingDate: date,
  gateInDate: date,
  transportDetails: text(5000),
  remarks: text(5000),
});
type ContainerInput = z.infer<typeof containerSchema>;
const COLS: Record<keyof ContainerInput, string> = {
  bookingNo: 'booking_no',
  shippingLine: 'shipping_line',
  vesselName: 'vessel_name',
  voyageNo: 'voyage_no',
  containerNo: 'container_no',
  containerSize: 'container_size',
  sealNo: 'seal_no',
  portOfLoading: 'port_of_loading',
  portOfDischarge: 'port_of_discharge',
  loadingDate: 'loading_date',
  gateInDate: 'gate_in_date',
  transportDetails: 'transport_details',
  remarks: 'remarks',
};

const releaseSchema = z.object({
  documentType: z.string({ error: 'Enter the document type' }).trim().min(1, 'Enter the document type').max(60),
  documentReference: text(100),
  documentId: z.coerce.number().int().positive().optional().nullable(),
  releaseStatus: z.enum(['PENDING', 'RELEASED']).default('PENDING'),
  releaseDate: date,
  remarks: text(2000),
});

function checkContainer(body: ContainerInput, status: OrderStatus) {
  const fields: Record<string, string> = {};
  if (body.gateInDate && status !== 'AWAITING_DOCUMENT_RELEASE') {
    fields.gateInDate = 'Gate-in can be recorded only after Accounts approves the balance payment';
  }
  if (body.gateInDate && !body.loadingDate) fields.loadingDate = 'Enter the loading date before gate-in';
  if (body.loadingDate && body.gateInDate && body.gateInDate < body.loadingDate) fields.gateInDate = 'Gate-in is before the loading date';
  if (Object.keys(fields).length) throw new HttpError(400, 'Please check the highlighted fields', { fields });
}

/** Booking/loading can change only until Sales records the balance; after that only gate-in, transport and remarks. */
const LOADING_STAGES: OrderStatus[] = ['READY_FOR_DOCUMENTATION', 'DOCUMENTATION_IN_PROGRESS'];
const LATE_EDITABLE: (keyof ContainerInput)[] = ['gateInDate', 'transportDetails', 'remarks'];

async function lockEditable(conn: PoolConnection, orderId: number) {
  const { status } = await lockOrder(conn, orderId);
  if (!DOCS_EDITABLE.includes(status)) throw new HttpError(409, 'This order is not at the Documentation stage');
  return status;
}

// ───────────── Containers ─────────────

documentationRouter.post('/orders/:id/containers', async (req, res) => {
  const orderId = parse(idParam, req.params.id);
  const body = parse(containerSchema, req.body);
  await withTransaction(async (conn) => {
    const status = await lockEditable(conn, orderId);
    if (!LOADING_STAGES.includes(status)) {
      throw new HttpError(409, 'Containers can be added only before the balance payment is recorded');
    }
    checkContainer(body, status);
    const keys = Object.keys(COLS) as (keyof ContainerInput)[];
    const [r] = await conn.query<ResultSetHeader>(
      `INSERT INTO container_bookings (order_id, ${keys.map((k) => COLS[k]).join(', ')}, created_by)
       VALUES (?, ${keys.map(() => '?').join(', ')}, ?)`,
      [orderId, ...keys.map((k) => body[k]), req.user!.id],
    );
    await audit(req, { action: 'CONTAINER_ADDED', entityType: 'container', entityId: r.insertId, orderId, changes: body }, conn);
    if (status === 'READY_FOR_DOCUMENTATION') await changeStatus(conn, req, orderId, 'DOCUMENTATION_IN_PROGRESS', 'Container booking started');
  });
  res.status(201).json({ ok: true });
});

documentationRouter.patch('/containers/:cid', async (req, res) => {
  const cid = parse(idParam, req.params.cid);
  const parsed = parse(containerSchema, req.body);
  const sent = new Set(Object.keys(req.body ?? {}));
  await withTransaction(async (conn) => {
    const [[existing]] = await conn.query<RowDataPacket[]>(
      `SELECT order_id AS orderId, ${Object.entries(COLS).map(([k, c]) => `${c} AS ${k}`).join(', ')} FROM container_bookings WHERE id = ?`,
      [cid],
    );
    if (!existing) throw new HttpError(404, 'Container not found');
    const status = await lockEditable(conn, existing.orderId);
    const keys = Object.keys(COLS) as (keyof ContainerInput)[];
    // Fields not sent keep their saved value (a partial update never blanks other columns).
    const body = Object.fromEntries(keys.map((k) => [k, sent.has(k) ? parsed[k] : existing[k]])) as ContainerInput;
    if (!LOADING_STAGES.includes(status)) {
      const changed = keys.filter((k) => !LATE_EDITABLE.includes(k) && (body[k] ?? null) !== (existing[k] ?? null));
      if (changed.length) {
        throw new HttpError(409, 'After the balance payment is recorded, only gate-in date, transport details and remarks can change');
      }
    }
    checkContainer(body, status);
    await conn.query(`UPDATE container_bookings SET ${keys.map((k) => `${COLS[k]} = ?`).join(', ')}, updated_by = ? WHERE id = ?`, [
      ...keys.map((k) => body[k]),
      req.user!.id,
      cid,
    ]);
    await audit(req, { action: 'CONTAINER_UPDATED', entityType: 'container', entityId: cid, orderId: existing.orderId, changes: diff(existing, body) }, conn);
  });
  res.json({ ok: true });
});

documentationRouter.delete('/containers/:cid', async (req, res) => {
  const cid = parse(idParam, req.params.cid);
  await withTransaction(async (conn) => {
    const [[c]] = await conn.query<RowDataPacket[]>('SELECT order_id, container_no, gate_in_date FROM container_bookings WHERE id = ?', [cid]);
    if (!c) throw new HttpError(404, 'Container not found');
    const status = await lockEditable(conn, c.order_id);
    if (!LOADING_STAGES.includes(status)) throw new HttpError(409, 'Containers can be removed only before the balance payment is recorded');
    if (c.gate_in_date) throw new HttpError(409, 'A container that has gated in cannot be removed');
    await conn.query('DELETE FROM container_bookings WHERE id = ?', [cid]);
    await audit(req, { action: 'CONTAINER_REMOVED', entityType: 'container', entityId: cid, orderId: c.order_id, changes: { containerNo: c.container_no } }, conn);
  });
  res.json({ ok: true });
});

// ───────────── Bill release ─────────────

function checkRelease(body: z.infer<typeof releaseSchema>) {
  if (body.releaseStatus === 'RELEASED' && !body.releaseDate) {
    throw new HttpError(400, 'Please check the highlighted fields', { fields: { releaseDate: 'Enter the release date' } });
  }
}

async function lockForRelease(conn: PoolConnection, orderId: number) {
  const { status } = await lockOrder(conn, orderId);
  if (status !== 'AWAITING_DOCUMENT_RELEASE') {
    throw new HttpError(409, 'Documents can be released only after the balance payment is approved');
  }
}

async function assertDocument(conn: PoolConnection, orderId: number, documentId?: number | null) {
  if (!documentId) return;
  const [[d]] = await conn.query<RowDataPacket[]>('SELECT id FROM order_documents WHERE id = ? AND order_id = ? AND deleted_at IS NULL', [documentId, orderId]);
  if (!d) throw new HttpError(400, 'Please check the highlighted fields', { fields: { documentId: 'File not found on this order' } });
}

documentationRouter.post('/orders/:id/bill-releases', async (req, res) => {
  const orderId = parse(idParam, req.params.id);
  const body = parse(releaseSchema, req.body);
  checkRelease(body);
  await withTransaction(async (conn) => {
    await lockForRelease(conn, orderId);
    await assertDocument(conn, orderId, body.documentId);
    const [r] = await conn.query<ResultSetHeader>(
      `INSERT INTO bill_releases (order_id, document_type, document_reference, document_id, release_status, release_date, remarks, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, body.documentType, body.documentReference, body.documentId ?? null, body.releaseStatus, body.releaseDate, body.remarks, req.user!.id],
    );
    await audit(req, { action: 'BILL_RELEASE_RECORDED', entityType: 'bill_release', entityId: r.insertId, orderId, changes: body }, conn);
  });
  res.status(201).json({ ok: true });
});

documentationRouter.patch('/bill-releases/:bid', async (req, res) => {
  const bid = parse(idParam, req.params.bid);
  const body = parse(releaseSchema, req.body);
  checkRelease(body);
  await withTransaction(async (conn) => {
    const [[b]] = await conn.query<RowDataPacket[]>(
      `SELECT order_id AS orderId, document_type AS documentType, document_reference AS documentReference, document_id AS documentId,
              release_status AS releaseStatus, release_date AS releaseDate, remarks FROM bill_releases WHERE id = ?`,
      [bid],
    );
    if (!b) throw new HttpError(404, 'Release record not found');
    await lockForRelease(conn, b.orderId);
    await assertDocument(conn, b.orderId, body.documentId);
    await conn.query(
      `UPDATE bill_releases SET document_type = ?, document_reference = ?, document_id = ?, release_status = ?, release_date = ?, remarks = ?
       WHERE id = ?`,
      [body.documentType, body.documentReference, body.documentId ?? null, body.releaseStatus, body.releaseDate, body.remarks, bid],
    );
    await audit(req, { action: 'BILL_RELEASE_UPDATED', entityType: 'bill_release', entityId: bid, orderId: b.orderId, changes: diff(b, body) }, conn);
  });
  res.json({ ok: true });
});

/** All containers gated in and at least one document released → Accounts final verification. */
documentationRouter.post('/orders/:id/complete', async (req, res) => {
  const orderId = parse(idParam, req.params.id);
  const remarks = parse(text(2000), req.body?.remarks);
  await withTransaction(async (conn) => {
    await lockForRelease(conn, orderId);
    const [containers] = await conn.query<RowDataPacket[]>(
      'SELECT container_no, loading_date, gate_in_date FROM container_bookings WHERE order_id = ?',
      [orderId],
    );
    const [[released]] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM bill_releases WHERE order_id = ? AND release_status = 'RELEASED'`,
      [orderId],
    );
    const problems: string[] = [];
    if (!containers.length) problems.push('add at least one container');
    if (containers.some((c) => !c.container_no || !c.loading_date || !c.gate_in_date)) {
      problems.push('every container needs a container no., loading date and gate-in date');
    }
    if (!released.n) problems.push('record at least one released document');
    if (problems.length) throw new HttpError(409, `Before completing: ${problems.join('; ')}.`);
    await changeStatus(conn, req, orderId, 'AWAITING_FINAL_VERIFICATION', remarks ?? 'Documentation completed: gate-in and document release recorded');
  });
  res.json({ ok: true });
});

documentationRouter.get('/queue', async (_req, res) => {
  const extra = `(SELECT COUNT(*) FROM container_bookings cb WHERE cb.order_id = o.id) AS containerCount,
                 (SELECT COUNT(*) FROM container_bookings cb WHERE cb.order_id = o.id AND cb.loading_date IS NOT NULL) AS loadedCount,
                 (SELECT COUNT(*) FROM container_bookings cb WHERE cb.order_id = o.id AND cb.gate_in_date IS NOT NULL) AS gatedCount,
                 (SELECT COUNT(*) FROM bill_releases br WHERE br.order_id = o.id AND br.release_status = 'RELEASED') AS releasedCount`;
  const rows = await ordersInStatuses(DOCS_EDITABLE, 'o.status_changed_at ASC', extra);
  res.json({
    orders: rows.map((r) => ({
      ...r,
      containerCount: Number(r.containerCount),
      loadedCount: Number(r.loadedCount),
      gatedCount: Number(r.gatedCount),
      releasedCount: Number(r.releasedCount),
    })),
  });
});
