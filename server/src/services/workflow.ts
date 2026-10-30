import type { Request } from 'express';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { HttpError } from '../middleware/error.js';
import { canTransition, isLocked, type OrderStatus } from '../workflow/statuses.js';
import { audit } from './audit.js';
import { notifyStatusChange } from './notify.js';

/** Lock the order row for this transaction and return its status. */
export async function lockOrder(conn: PoolConnection, orderId: number) {
  const [rows] = await conn.query<(RowDataPacket & { id: number; status: OrderStatus })[]>(
    'SELECT id, status FROM orders WHERE id = ? FOR UPDATE',
    [orderId],
  );
  if (!rows[0]) throw new HttpError(404, 'Order not found');
  return rows[0];
}

/** Throws if the order is closed or cancelled. */
export function assertEditable(status: OrderStatus) {
  if (isLocked(status)) throw new HttpError(409, 'This order is closed or cancelled and can no longer be changed');
}

/**
 * Move an order to a new status. Checks the role may do it, then writes
 * the order, status history and audit log in the caller's transaction.
 */
export async function changeStatus(
  conn: PoolConnection,
  req: Request,
  orderId: number,
  to: OrderStatus,
  remarks?: string | null,
) {
  const order = await lockOrder(conn, orderId);
  assertEditable(order.status);
  if (!canTransition(req.user!.role, order.status, to)) {
    throw new HttpError(409, 'This action is not allowed at the current stage of the order');
  }
  await conn.query('UPDATE orders SET status = ?, status_changed_at = NOW(), updated_by = ? WHERE id = ?', [
    to,
    req.user!.id,
    orderId,
  ]);
  await recordStatus(conn, req, orderId, order.status, to, remarks);
}

/** Status history + audit row (also used for the very first status when an order is created). */
export async function recordStatus(
  conn: PoolConnection,
  req: Request,
  orderId: number,
  from: OrderStatus | null,
  to: OrderStatus,
  remarks?: string | null,
) {
  await conn.query(
    'INSERT INTO order_status_history (order_id, from_status, to_status, remarks, changed_by) VALUES (?, ?, ?, ?, ?)',
    [orderId, from, to, remarks ?? null, req.user!.id],
  );
  await audit(req, { action: 'ORDER_STATUS_CHANGED', entityType: 'order', entityId: orderId, orderId, changes: { status: [from, to], remarks } }, conn);
  await notifyStatusChange(conn, req.user!.id, orderId, to, remarks);
}
