import type { Request } from 'express';
import type { Pool, PoolConnection } from 'mysql2/promise';
import { pool } from '../db/pool.js';

type Db = Pool | PoolConnection;

export type AuditEntry = {
  action: string;
  entityType: string;
  entityId?: number | null;
  orderId?: number | null;
  /** { field: [before, after] } or any details worth keeping. Never put passwords here. */
  changes?: Record<string, unknown> | null;
};

/**
 * Write one audit row. Pass the transaction connection so the audit row
 * is saved (or rolled back) together with the change itself.
 */
export async function audit(req: Request, entry: AuditEntry, db: Db = pool) {
  await db.query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, order_id, changes, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user?.id ?? null,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.orderId ?? null,
      entry.changes ? JSON.stringify(entry.changes) : null,
      req.ip ?? null,
    ],
  );
}

/** Build { field: [before, after] } for fields that actually changed. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const out: Record<string, [unknown, unknown]> = {};
  for (const key of Object.keys(after)) {
    if (after[key] !== undefined && after[key] !== before[key]) out[key] = [before[key], after[key]];
  }
  return out;
}
