/** In-app notifications: tell the team that now owns an order, and the Sales person who created it. */
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { parsePermissions, seesPricing } from '../auth/users.js';
import { STATUS_LABEL, STATUS_PERMISSION, type OrderStatus } from '../workflow/statuses.js';

// Sales hears about these even though another team owns the next step.
const TELL_SALES: OrderStatus[] = [
  'AWAITING_QC', // advance approved
  'ADVANCE_REJECTED',
  'BALANCE_REJECTED',
  'READY_FOR_DOCUMENTATION',
  'AWAITING_DOCUMENT_RELEASE', // balance approved
  'CLOSED',
  'CANCELLED',
];

/**
 * Every container is loaded, so the balance payment can be recorded now.
 * The status does not change at this point, so the usual status notification does not fire.
 * Goes to the Sales person who created the order and everyone who records payments; when no balance
 * is due, to Accounts instead, who confirm that before gate-in.
 */
export async function notifyBalanceDue(conn: PoolConnection, actorId: number, orderId: number) {
  const [[order]] = await conn.query<RowDataPacket[]>(
    `SELECT o.order_no AS orderNo, o.created_by AS createdBy, o.balance_amount AS balanceAmount, c.company_name AS customerName
     FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`,
    [orderId],
  );
  if (!order) return;
  const noBalance = Number(order.balanceAmount) === 0;
  const [team] = await conn.query<RowDataPacket[]>(
    `SELECT u.id FROM users u
     WHERE u.is_active = 1 AND EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = u.role_id AND rp.permission = ?)`,
    [noBalance ? 'payments.verify' : 'payments.record'],
  );
  const recipients = new Set<number>(team.map((u) => Number(u.id)));
  if (!noBalance) recipients.add(Number(order.createdBy));
  recipients.delete(actorId);
  if (!recipients.size) return;
  const title = `${order.orderNo ?? `Order #${orderId}`}: All containers loaded`;
  const message = `${order.customerName} · ${noBalance ? 'No balance due: confirm it so gate-in can start' : 'Record the balance payment'}`;
  const values = [...recipients].map((id) => [id, orderId, title, message, `/orders/${orderId}`]);
  await conn.query('INSERT INTO notifications (user_id, order_id, title, message, link) VALUES ?', [values]);
}

export async function notifyStatusChange(conn: PoolConnection, actorId: number, orderId: number, to: OrderStatus, remarks?: string | null) {
  const [[order]] = await conn.query<RowDataPacket[]>(
    `SELECT o.order_no AS orderNo, o.created_by AS createdBy, c.company_name AS customerName
     FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`,
    [orderId],
  );
  if (!order) return;

  // Everyone whose role has the permission for the next step.
  const next = STATUS_PERMISSION[to];
  const [team] = next
    ? await conn.query<RowDataPacket[]>(
        `SELECT u.id, u.can_view_pricing,
                (SELECT GROUP_CONCAT(rp.permission) FROM role_permissions rp WHERE rp.role_id = u.role_id) AS permissions
         FROM users u
         WHERE u.is_active = 1 AND EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = u.role_id AND rp.permission = ?)`,
        [next],
      )
    : [[] as RowDataPacket[]];
  // Remarks can mention amounts, so people who can't see pricing get the short message.
  const recipients = new Map<number, boolean>(
    team.map((u) => [Number(u.id), seesPricing(parsePermissions(u.permissions), u.can_view_pricing)]),
  );
  if (TELL_SALES.includes(to)) recipients.set(Number(order.createdBy), true);
  recipients.delete(actorId); // don't notify people about their own action
  if (!recipients.size) return;

  const title = `${order.orderNo ?? `Order #${orderId}`}: ${STATUS_LABEL[to]}`;
  const full = [order.customerName, remarks].filter(Boolean).join(' · ').slice(0, 500);
  const link = `/orders/${orderId}`;
  const values = [...recipients].map(([id, pricing]) => [id, orderId, title, pricing ? full : order.customerName, link]);
  await conn.query('INSERT INTO notifications (user_id, order_id, title, message, link) VALUES ?', [values]);
}
