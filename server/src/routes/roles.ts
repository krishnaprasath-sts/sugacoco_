/**
 * Roles & permissions. Listing needs roles.manage or users.manage (the user form picks a role);
 * creating, editing and deleting roles needs roles.manage.
 * Changes apply on the next request of every affected user (permissions are loaded per request).
 */
import { Router } from 'express';
import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { pool, withTransaction } from '../db/pool.js';
import { ADMIN_LOCKED, ADMIN_ROLE_CODE, PERMISSION_GROUPS, PERMISSIONS, withRequired, type Permission } from '../auth/permissions.js';
import { parsePermissions } from '../auth/users.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { parse } from '../middleware/validate.js';
import { audit } from '../services/audit.js';

export const rolesRouter = Router();
rolesRouter.use(requireAuth);

const idParam = z.coerce.number().int().positive().max(255);
const name = z.string({ error: 'Enter a role name' }).trim().min(2, 'Enter a role name').max(60);
const description = z
  .string()
  .trim()
  .max(255)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));
const permissions = z.array(z.enum(PERMISSIONS as unknown as [Permission, ...Permission[]]), { error: 'Choose permissions' }).max(100);

const createSchema = z.object({ name, description, permissions });
const updateSchema = z.object({ name, description, permissions }).partial();

type RoleRow = RowDataPacket & {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isSystem: number;
  permissions: string | null;
  userCount: number;
  activeUserCount: number;
};

const SELECT_ROLES = `
  SELECT r.id, r.code, r.name, r.description, r.is_system AS isSystem,
         (SELECT GROUP_CONCAT(rp.permission) FROM role_permissions rp WHERE rp.role_id = r.id) AS permissions,
         (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS userCount,
         (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id AND u.is_active = 1) AS activeUserCount
  FROM roles r`;

const toDto = (r: RoleRow) => ({
  id: r.id,
  code: r.code,
  name: r.name,
  description: r.description,
  isSystem: r.isSystem === 1,
  // Catalog order, so the screen and the audit log read the same way every time.
  permissions: PERMISSIONS.filter((p) => parsePermissions(r.permissions).includes(p)),
  userCount: Number(r.userCount),
  activeUserCount: Number(r.activeUserCount),
});

async function getRole(id: number, db: PoolConnection | typeof pool = pool) {
  const [rows] = await db.query<RoleRow[]>(`${SELECT_ROLES} WHERE r.id = ?`, [id]);
  if (!rows[0]) throw new HttpError(404, 'Role not found');
  return toDto(rows[0]);
}

const isDuplicate = (err: unknown) => (err as { code?: string })?.code === 'ER_DUP_ENTRY';
const duplicateName = () =>
  new HttpError(409, 'A role with this name already exists', { fields: { name: 'A role with this name already exists' } });

/** Final permission list for a role: adds what each permission needs, and the Admin role's locked ones. */
function finalPermissions(code: string, chosen: Permission[]) {
  return withRequired(code === ADMIN_ROLE_CODE ? [...chosen, ...ADMIN_LOCKED] : chosen);
}

async function writePermissions(conn: PoolConnection, roleId: number, list: Permission[]) {
  await conn.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
  if (list.length) {
    await conn.query('INSERT INTO role_permissions (role_id, permission) VALUES ?', [list.map((p) => [roleId, p])]);
  }
}

rolesRouter.get('/', requirePermission('roles.manage', 'users.manage'), async (_req, res) => {
  const [rows] = await pool.query<RoleRow[]>(`${SELECT_ROLES} ORDER BY r.is_system DESC, r.id`);
  res.json({ roles: rows.map(toDto), groups: PERMISSION_GROUPS, adminLocked: ADMIN_LOCKED, adminRoleCode: ADMIN_ROLE_CODE });
});

rolesRouter.post('/', requirePermission('roles.manage'), async (req, res) => {
  const body = parse(createSchema, req.body);
  try {
    const id = await withTransaction(async (conn) => {
      // roles.id is a small fixed-size key (no AUTO_INCREMENT), so pick the next free number under a lock.
      const [[next]] = await conn.query<RowDataPacket[]>('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM roles FOR UPDATE');
      const newId = Number(next.id);
      if (newId > 255) throw new HttpError(409, 'No more roles can be added. Delete a role you no longer use.');
      const code = `CUSTOM_${newId}`;
      const list = finalPermissions(code, body.permissions);
      await conn.query<ResultSetHeader>('INSERT INTO roles (id, code, name, description, is_system) VALUES (?, ?, ?, ?, 0)', [
        newId,
        code,
        body.name,
        body.description,
      ]);
      await writePermissions(conn, newId, list);
      await audit(
        req,
        { action: 'ROLE_CREATED', entityType: 'role', entityId: newId, changes: { name: body.name, description: body.description, permissions: list } },
        conn,
      );
      return newId;
    });
    res.status(201).json({ role: await getRole(id) });
  } catch (err) {
    if (isDuplicate(err)) throw duplicateName();
    throw err;
  }
});

rolesRouter.patch('/:id', requirePermission('roles.manage'), async (req, res) => {
  const id = parse(idParam, req.params.id);
  const body = parse(updateSchema, req.body);

  try {
    await withTransaction(async (conn) => {
      const existing = await getRole(id, conn);
      const changes: Record<string, unknown> = {};
      const sets: string[] = [];
      const values: unknown[] = [];
      if (body.name !== undefined && body.name !== existing.name) {
        sets.push('name = ?'), values.push(body.name), (changes.name = [existing.name, body.name]);
      }
      if (body.description !== undefined && body.description !== existing.description) {
        sets.push('description = ?'), values.push(body.description), (changes.description = [existing.description, body.description]);
      }

      if (body.permissions !== undefined) {
        const list = finalPermissions(existing.code, body.permissions);
        // Stop someone removing their own way back into this screen.
        if (req.user!.role === existing.code && existing.permissions.includes('roles.manage') && !list.includes('roles.manage')) {
          throw new HttpError(400, 'You cannot remove "Roles and permissions" from your own role');
        }
        const added = list.filter((p) => !existing.permissions.includes(p));
        const removed = existing.permissions.filter((p) => !list.includes(p));
        if (added.length || removed.length) {
          await writePermissions(conn, id, list);
          changes.added = added;
          changes.removed = removed;
        }
      }

      if (sets.length) await conn.query(`UPDATE roles SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);
      if (Object.keys(changes).length) {
        await audit(req, { action: 'ROLE_UPDATED', entityType: 'role', entityId: id, changes: { role: existing.name, ...changes } }, conn);
      }
    });
  } catch (err) {
    if (isDuplicate(err)) throw duplicateName();
    throw err;
  }
  res.json({ role: await getRole(id) });
});

rolesRouter.delete('/:id', requirePermission('roles.manage'), async (req, res) => {
  const id = parse(idParam, req.params.id);
  await withTransaction(async (conn) => {
    const [[row]] = await conn.query<RowDataPacket[]>('SELECT id FROM roles WHERE id = ? FOR UPDATE', [id]);
    if (!row) throw new HttpError(404, 'Role not found');
    const role = await getRole(id, conn);
    if (role.isSystem) throw new HttpError(400, 'Built-in roles cannot be deleted. You can change their permissions instead.');
    if (role.userCount > 0) {
      throw new HttpError(
        409,
        `${role.userCount} user${role.userCount === 1 ? ' has' : 's have'} this role (active or not). Move them to another role first.`,
      );
    }
    await conn.query('DELETE FROM roles WHERE id = ?', [id]);
    await audit(req, { action: 'ROLE_DELETED', entityType: 'role', entityId: id, changes: { name: role.name, permissions: role.permissions } }, conn);
  });
  res.json({ ok: true });
});
