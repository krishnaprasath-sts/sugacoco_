/** The signed-in user's in-app notifications. */
import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req, res) => {
  const userId = req.user!.id;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, order_id AS orderId, title, message, link, read_at AS readAt, created_at AS createdAt
     FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30`,
    [userId],
  );
  const [[{ unread }]] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND read_at IS NULL',
    [userId],
  );
  res.json({ notifications: rows, unread: Number(unread) });
});

notificationsRouter.post('/read-all', async (req, res) => {
  await pool.query('UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE user_id = ? AND read_at IS NULL', [req.user!.id]);
  res.json({ ok: true });
});

notificationsRouter.post('/:id/read', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid notification' });
  // user_id in the WHERE: nobody can mark someone else's notification.
  await pool.query('UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE id = ? AND user_id = ? AND read_at IS NULL', [id, req.user!.id]);
  res.json({ ok: true });
});

/** Clear all of the signed-in user's notifications. */
notificationsRouter.delete('/', async (req, res) => {
  await pool.query('DELETE FROM notifications WHERE user_id = ?', [req.user!.id]);
  res.json({ ok: true });
});

/** Dismiss one notification. user_id in the WHERE: nobody can delete someone else's. */
notificationsRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid notification' });
  await pool.query('DELETE FROM notifications WHERE id = ? AND user_id = ?', [id, req.user!.id]);
  res.json({ ok: true });
});
