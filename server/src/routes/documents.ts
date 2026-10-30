/** Order files: upload, download, remove. Category rules in workflow/documents.ts. */
import { Router } from 'express';
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool, withTransaction } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { parse } from '../middleware/validate.js';
import { audit } from '../services/audit.js';
import { assertEditable, lockOrder } from '../services/workflow.js';
import { canUpload, canView, DOCUMENT_CATEGORIES } from '../workflow/documents.js';
import { removeFiles, resolveStored, storedName, upload, verifySignature } from '../lib/upload.js';

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

const idParam = z.coerce.number().int().positive();
const uploadSchema = z.object({
  category: z.enum(DOCUMENT_CATEGORIES, { error: 'Choose a document type' }),
  title: z.string().trim().max(200).optional().transform((v) => v || null),
  referenceNo: z.string().trim().max(100).optional().transform((v) => v || null),
  paymentId: z.coerce.number().int().positive().optional(),
});

documentsRouter.post('/orders/:id/documents', upload.array('files', 10), async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  try {
    const orderId = parse(idParam, req.params.id);
    const body = parse(uploadSchema, req.body);
    if (!files?.length) throw new HttpError(400, 'Choose at least one file');
    for (const f of files) await verifySignature(f);

    const ids = await withTransaction(async (conn) => {
      const { status } = await lockOrder(conn, orderId);
      assertEditable(status);
      if (!canUpload(req.user!, body.category, status)) {
        throw new HttpError(403, 'You cannot upload this type of document at the current stage');
      }
      if (body.paymentId) {
        const [[p]] = await conn.query<RowDataPacket[]>('SELECT id FROM payments WHERE id = ? AND order_id = ?', [body.paymentId, orderId]);
        if (!p) throw new HttpError(400, 'Payment not found on this order');
      }
      const out: number[] = [];
      for (const f of files) {
        const [r] = await conn.query<ResultSetHeader>(
          `INSERT INTO order_documents (order_id, category, title, reference_no, original_name, stored_name, mime_type,
                                        size_bytes, payment_id, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [orderId, body.category, body.title, body.referenceNo, f.originalname.slice(0, 255), storedName(f), f.mimetype,
           f.size, body.paymentId ?? null, req.user!.id],
        );
        out.push(r.insertId);
      }
      await audit(req, {
        action: 'DOCUMENT_UPLOADED', entityType: 'order', entityId: orderId, orderId,
        changes: { category: body.category, files: files.map((f) => f.originalname), documentIds: out },
      }, conn);
      return out;
    });
    res.status(201).json({ documentIds: ids });
  } catch (err) {
    await removeFiles(files);
    throw err;
  }
});

documentsRouter.get('/documents/:id/download', async (req, res) => {
  const id = parse(idParam, req.params.id);
  const [[doc]] = await pool.query<RowDataPacket[]>(
    'SELECT id, category, original_name, stored_name, mime_type FROM order_documents WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  // Same 404 for "missing" and "not allowed", so file ids can't be probed.
  if (!doc || !canView(req.user!, doc.category)) throw new HttpError(404, 'File not found');
  const full = resolveStored(doc.stored_name);
  if (!fs.existsSync(full)) throw new HttpError(404, 'File not found');

  const inline = req.query.inline === '1' && /^(image\/|application\/pdf)/.test(doc.mime_type);
  res.setHeader('Content-Type', doc.mime_type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(doc.original_name)}`);
  pipeline(fs.createReadStream(full), res).catch(() => {
    // Client went away or the file vanished mid-read: just end the response.
    if (!res.headersSent) res.status(404).end();
    else res.destroy();
  });
});

/** Soft delete: only the uploader, only while the order is open. The file stays on disk for audit. */
documentsRouter.delete('/documents/:id', async (req, res) => {
  const id = parse(idParam, req.params.id);
  await withTransaction(async (conn) => {
    const [[doc]] = await conn.query<RowDataPacket[]>(
      'SELECT id, order_id, category, original_name, uploaded_by FROM order_documents WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    if (!doc || !canView(req.user!, doc.category)) throw new HttpError(404, 'File not found');
    if (doc.uploaded_by !== req.user!.id) throw new HttpError(403, 'Only the person who uploaded this file can remove it');
    const { status } = await lockOrder(conn, doc.order_id);
    assertEditable(status);
    await conn.query('UPDATE order_documents SET deleted_at = NOW(), deleted_by = ? WHERE id = ?', [req.user!.id, id]);
    await audit(req, {
      action: 'DOCUMENT_REMOVED', entityType: 'document', entityId: id, orderId: doc.order_id,
      changes: { category: doc.category, file: doc.original_name },
    }, conn);
  });
  res.json({ ok: true });
});
