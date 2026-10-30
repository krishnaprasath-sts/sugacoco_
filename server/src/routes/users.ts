/** User management. MD/Admin only. */
import { Router } from 'express';
import { hashPassword } from '../auth/password.js';
import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool, withTransaction } from '../db/pool.js';
import { audit, diff } from '../services/audit.js';
import { ROLES } from '../auth/roles.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { parse } from '../middleware/validate.js';

export const usersRouter = Router();
usersRouter.use(requireAuth, requireRole('ADMIN'));

const name = z.string({ error: 'Enter a name' }).trim().min(2, 'Enter a name').max(120);
const email = z
  .string({ error: 'Enter an email' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email').max(190));
const role = z.enum(ROLES, { error: 'Choose a role' });
const password = z
  .string({ error: 'Enter a password' })
  .min(8, 'At least 8 characters')
  .max(100)
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/[0-9]/, 'Include at least one number');

const createSchema = z.object({ name, email, role, password, canViewPricing: z.boolean().default(false) });
const updateSchema = z
  .object({ name, email, role, isActive: z.boolean(), canViewPricing: z.boolean() })
  .partial();
const resetSchema = z.object({ password });
const idSchema = z.coerce.number().int().positive();

const SELECT_LIST = `
  SELECT u.id, u.name, u.email, r.code AS role, u.can_view_pricing AS canViewPricing,
         u.is_active AS isActive, u.last_login_at AS lastLoginAt, u.created_at AS createdAt
  FROM users u JOIN roles r ON r.id = u.role_id`;

type ListRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  role: string;
  canViewPricing: number;
  isActive: number;
  lastLoginAt: string | null;
  createdAt: string;
};
const toDto = (r: ListRow) => ({ ...r, canViewPricing: r.canViewPricing === 1, isActive: r.isActive === 1 });

async function getUser(id: number) {
  const [rows] = await pool.query<ListRow[]>(`${SELECT_LIST} WHERE u.id = ?`, [id]);
  if (!rows[0]) throw new HttpError(404, 'User not found');
  return toDto(rows[0]);
}

function isDuplicate(err: unknown) {
  return (err as { code?: string })?.code === 'ER_DUP_ENTRY';
}
const duplicateError = () =>
  new HttpError(409, 'This email is already used', { fields: { email: 'This email is already used' } });

usersRouter.get('/', async (_req, res) => {
  const [rows] = await pool.query<ListRow[]>(`${SELECT_LIST} ORDER BY u.is_active DESC, r.id, u.name`);
  res.json({ users: rows.map(toDto) });
});

usersRouter.post('/', async (req, res) => {
  const body = parse(createSchema, req.body);
  const hash = await hashPassword(body.password);
  try {
    const id = await withTransaction(async (conn) => {
      const [result] = await conn.query<ResultSetHeader>(
        `INSERT INTO users (name, email, password_hash, role_id, can_view_pricing)
         VALUES (?, ?, ?, (SELECT id FROM roles WHERE code = ?), ?)`,
        [body.name, body.email, hash, body.role, body.canViewPricing ? 1 : 0],
      );
      await audit(
        req,
        {
          action: 'USER_CREATED',
          entityType: 'user',
          entityId: result.insertId,
          changes: { name: body.name, email: body.email, role: body.role, canViewPricing: body.canViewPricing },
        },
        conn,
      );
      return result.insertId;
    });
    res.status(201).json({ user: await getUser(id) });
  } catch (err) {
    if (isDuplicate(err)) throw duplicateError();
    throw err;
  }
});

usersRouter.patch('/:id', async (req, res) => {
  const id = parse(idSchema, req.params.id);
  const body = parse(updateSchema, req.body);
  const existing = await getUser(id);

  // Stop an admin from locking themselves out.
  if (id === req.user!.id) {
    if (body.isActive === false) throw new HttpError(400, 'You cannot deactivate your own account');
    if (body.role && body.role !== 'ADMIN') throw new HttpError(400, 'You cannot change your own role');
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  if (body.name !== undefined) sets.push('name = ?'), values.push(body.name);
  if (body.email !== undefined) sets.push('email = ?'), values.push(body.email);
  if (body.role !== undefined) sets.push('role_id = (SELECT id FROM roles WHERE code = ?)'), values.push(body.role);
  if (body.canViewPricing !== undefined) sets.push('can_view_pricing = ?'), values.push(body.canViewPricing ? 1 : 0);
  if (body.isActive !== undefined) sets.push('is_active = ?'), values.push(body.isActive ? 1 : 0);

  // Deactivating or changing role logs the user out everywhere.
  const roleChanged = body.role !== undefined && body.role !== existing.role;
  if (body.isActive === false || roleChanged) sets.push('token_version = token_version + 1');

  const changes = diff(existing, body);
  if (sets.length && Object.keys(changes).length) {
    try {
      await withTransaction(async (conn) => {
        await conn.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);
        await audit(req, { action: 'USER_UPDATED', entityType: 'user', entityId: id, changes }, conn);
      });
    } catch (err) {
      if (isDuplicate(err)) throw duplicateError();
      throw err;
    }
  }
  res.json({ user: await getUser(id) });
});

usersRouter.post('/:id/reset-password', async (req, res) => {
  const id = parse(idSchema, req.params.id);
  const body = parse(resetSchema, req.body);
  await getUser(id);
  const hash = await hashPassword(body.password);
  await withTransaction(async (conn) => {
    await conn.query('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', [hash, id]);
    await audit(req, { action: 'USER_PASSWORD_RESET', entityType: 'user', entityId: id }, conn);
  });
  res.json({ ok: true });
});
