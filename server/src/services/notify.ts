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
