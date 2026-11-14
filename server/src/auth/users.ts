import type { RowDataPacket } from 'mysql2';
import { pool } from '../db/pool.js';
import { isPermission, type Permission } from './permissions.js';

/** What the API exposes about the logged-in user. */
export type AuthUser = {
  id: number;
  name: string;
  email: string;
  /** Role code, e.g. SALES or CUSTOM_7. */
  role: string;
  roleName: string;
  permissions: Permission[];
  canViewPricing: boolean;
};

type UserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  role_name: string;
  permissions: string | null;
  can_view_pricing: number;
  is_active: number;
  token_version: number;
};

// One query per request: the user, their role and the role's permissions.
const SELECT_USER = `
  SELECT u.id, u.name, u.email, u.password_hash, r.code AS role, r.name AS role_name,
         (SELECT GROUP_CONCAT(rp.permission) FROM role_permissions rp WHERE rp.role_id = u.role_id) AS permissions,
         u.can_view_pricing, u.is_active, u.token_version
  FROM users u JOIN roles r ON r.id = u.role_id`;

export async function findUserByEmail(email: string) {
  const [rows] = await pool.query<UserRow[]>(`${SELECT_USER} WHERE u.email = ? LIMIT 1`, [email]);
  return rows[0];
}

export async function findActiveUserById(id: number) {
  const [rows] = await pool.query<UserRow[]>(`${SELECT_USER} WHERE u.id = ? AND u.is_active = 1 LIMIT 1`, [id]);
  return rows[0];
}

/** Parses the comma list from GROUP_CONCAT, dropping keys this version doesn't know. */
export function parsePermissions(list: string | null | undefined): Permission[] {
  return (list ?? '').split(',').filter(isPermission);
}

/** See pricing = the role allows it, or MD/Admin allowed this one user (users.can_view_pricing). */
export function seesPricing(permissions: readonly Permission[], userFlag: number | boolean) {
  return permissions.includes('pricing.view') || userFlag === 1 || userFlag === true;
}

export function toAuthUser(row: UserRow): AuthUser {
  const permissions = parsePermissions(row.permissions);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    roleName: row.role_name,
    permissions,
    canViewPricing: seesPricing(permissions, row.can_view_pricing),
  };
}

export function can(user: Pick<AuthUser, 'permissions'> | undefined, ...anyOf: Permission[]) {
  return !!user && anyOf.some((p) => user.permissions.includes(p));
}
