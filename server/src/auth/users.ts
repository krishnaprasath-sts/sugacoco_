import type { RowDataPacket } from 'mysql2';
import { pool } from '../db/pool.js';
import { PRICE_RESTRICTED_ROLES, type Role } from './roles.js';

/** What the API exposes about the logged-in user. */
export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  canViewPricing: boolean;
};

type UserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  can_view_pricing: number;
  is_active: number;
  token_version: number;
};

const SELECT_USER = `
  SELECT u.id, u.name, u.email, u.password_hash, r.code AS role, u.can_view_pricing, u.is_active, u.token_version
  FROM users u JOIN roles r ON r.id = u.role_id`;

export async function findUserByEmail(email: string) {
  const [rows] = await pool.query<UserRow[]>(`${SELECT_USER} WHERE u.email = ? LIMIT 1`, [email]);
  return rows[0];
}

export async function findActiveUserById(id: number) {
  const [rows] = await pool.query<UserRow[]>(`${SELECT_USER} WHERE u.id = ? AND u.is_active = 1 LIMIT 1`, [id]);
  return rows[0];
}

export function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    // QC and Packaging are restricted by default; other roles see pricing per their screens.
    canViewPricing: !PRICE_RESTRICTED_ROLES.includes(row.role) || row.can_view_pricing === 1,
  };
}
