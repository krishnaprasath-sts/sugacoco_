/**
 * Customer order-tracking links (updated document, Section 10.5).
 *  - Token: 24 random bytes (base64url). Lookup by SHA-256 hash; token kept only AES-256-GCM encrypted
 *    so Sales can copy the link again. Tokens are never logged or put in error messages.
 *  - Public endpoint returns customer-safe fields for that one order only.
 */
import { Router } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { pool, withTransaction } from '../db/pool.js';
import { env } from '../config/env.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { parse } from '../middleware/validate.js';
import { audit } from '../services/audit.js';
import { assertEditable, lockOrder } from '../services/workflow.js';
import { CUSTOMER_MILESTONES, CUSTOMER_VIEW, type OrderStatus } from '../workflow/statuses.js';

const key = () => Buffer.from(env.trackingLinkKey, 'hex');
const sha256 = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

function encrypt(token: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(token, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString('base64url')).join('.');
}
function decrypt(stored: string) {
  const [iv, tag, ct] = stored.split('.').map((s) => Buffer.from(s, 'base64url'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}
const linkUrl = (token: string) => `${env.publicAppUrl}/track/${token}`;

// ───────────── Staff: manage the link (Sales, MD/Admin) ─────────────

export const trackingRouter = Router();
const staff = [requireAuth, requireRole('SALES', 'ADMIN')];
const idParam = z.coerce.number().int().positive();

async function activeLink(orderId: number) {
  const [[row]] = await pool.query<RowDataPacket[]>(
    `SELECT t.id, t.token_encrypted, t.created_at AS createdAt, t.view_count AS viewCount, t.last_viewed_at AS lastViewedAt,
            u.name AS createdByName
     FROM order_tracking_links t JOIN users u ON u.id = t.created_by
     WHERE t.order_id = ? AND t.status = 'ACTIVE' ORDER BY t.id DESC LIMIT 1`,
    [orderId],
  );
  if (!row) return null;
  let url: string | null = null;
  try {
    url = linkUrl(decrypt(row.token_encrypted));
  } catch {
    url = null; // key changed: link still works for customers but can't be shown; regenerate to copy
  }
  return { id: row.id, url, createdAt: row.createdAt, createdByName: row.createdByName, viewCount: row.viewCount, lastViewedAt: row.lastViewedAt };
}

async function createLink(conn: PoolConnection, orderId: number, userId: number) {
  const token = crypto.randomBytes(24).toString('base64url');
  await conn.query(
    `INSERT INTO order_tracking_links (order_id, token_hash, token_encrypted, created_by) VALUES (?, ?, ?, ?)`,
    [orderId, sha256(token), encrypt(token), userId],
  );
}

async function revokeActive(conn: PoolConnection, orderId: number, userId: number) {
  const [r] = await conn.query<import('mysql2').ResultSetHeader>(
    `UPDATE order_tracking_links SET status = 'REVOKED', revoked_by = ?, revoked_at = NOW() WHERE order_id = ? AND status = 'ACTIVE'`,
    [userId, orderId],
  );
  return r.affectedRows;
}

trackingRouter.get('/orders/:id/tracking-link', ...staff, async (req, res) => {
  res.json({ link: await activeLink(parse(idParam, req.params.id)) });
});

trackingRouter.post('/orders/:id/tracking-link', ...staff, async (req, res) => {
  const orderId = parse(idParam, req.params.id);
  await withTransaction(async (conn) => {
    assertEditable((await lockOrder(conn, orderId)).status);
    const [[existing]] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM order_tracking_links WHERE order_id = ? AND status = 'ACTIVE' LIMIT 1`,
      [orderId],
    );
    if (existing) return;
    await createLink(conn, orderId, req.user!.id);
    await audit(req, { action: 'TRACKING_LINK_CREATED', entityType: 'order', entityId: orderId, orderId }, conn);
  });
  res.status(201).json({ link: await activeLink(orderId) });
});

trackingRouter.post('/orders/:id/tracking-link/regenerate', ...staff, async (req, res) => {
  const orderId = parse(idParam, req.params.id);
  await withTransaction(async (conn) => {
    assertEditable((await lockOrder(conn, orderId)).status);
    await revokeActive(conn, orderId, req.user!.id);
    await createLink(conn, orderId, req.user!.id);
    await audit(req, { action: 'TRACKING_LINK_REGENERATED', entityType: 'order', entityId: orderId, orderId }, conn);
  });
  res.json({ link: await activeLink(orderId) });
});

trackingRouter.post('/orders/:id/tracking-link/revoke', ...staff, async (req, res) => {
  const orderId = parse(idParam, req.params.id);
  await withTransaction(async (conn) => {
    await lockOrder(conn, orderId);
    const n = await revokeActive(conn, orderId, req.user!.id);
    if (!n) throw new HttpError(404, 'There is no active link for this order');
    await audit(req, { action: 'TRACKING_LINK_REVOKED', entityType: 'order', entityId: orderId, orderId }, conn);
  });
  res.json({ link: null });
});

// ───────────── Public: customer tracking page ─────────────

export const publicRouter = Router();
const NOT_FOUND = 'This tracking link is not valid or has expired. Please contact us for a new link.';

publicRouter.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many requests. Please try again later.' },
  }),
);

publicRouter.get('/track/:token', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const token = String(req.params.token ?? '');
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new HttpError(404, NOT_FOUND);

  const [[link]] = await pool.query<RowDataPacket[]>(
    `SELECT id, order_id FROM order_tracking_links
     WHERE token_hash = ? AND status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > NOW())`,
    [sha256(token)],
  );
  if (!link) throw new HttpError(404, NOT_FOUND);

  const [[o]] = await pool.query<RowDataPacket[]>(
    `SELECT o.order_no, o.pi_number, o.pi_date, o.status, o.status_changed_at, o.expected_ready_date, c.company_name
     FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`,
    [link.order_id],
  );
  if (!o) throw new HttpError(404, NOT_FOUND);
  const [items] = await pool.query<RowDataPacket[]>(
    'SELECT product_name AS name, quantity, unit FROM order_items WHERE order_id = ? ORDER BY sort_order, id',
    [link.order_id],
  );
  await pool.query('UPDATE order_tracking_links SET view_count = view_count + 1, last_viewed_at = NOW() WHERE id = ?', [link.id]);

  const status = o.status as OrderStatus;
  const view = CUSTOMER_VIEW[status];
  const currentIdx = CUSTOMER_MILESTONES.findIndex((m) => m.key === view.milestone);
  const cancelled = status === 'CANCELLED';
  const closed = status === 'CLOSED';
  const beforePackagingDone = currentIdx <= CUSTOMER_MILESTONES.findIndex((m) => m.key === 'PACKAGING');

  res.json({
    company: env.company,
    order: {
      orderNo: o.order_no,
      piNumber: o.pi_number,
      piDate: o.pi_date,
      customerName: o.company_name,
      statusLabel: view.label,
      cancelled,
      closed,
      lastUpdate: o.status_changed_at,
      // Only while still being produced; customer-safe date.
      expectedReadyDate: !cancelled && beforePackagingDone ? o.expected_ready_date : null,
      products: items.map((i) => ({ name: i.name, quantity: String(Number(i.quantity)), unit: i.unit })),
      milestones: CUSTOMER_MILESTONES.map((m, i) => ({
        key: m.key,
        label: m.label,
        state: cancelled ? 'upcoming' : closed || i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'upcoming',
      })),
    },
  });
});
