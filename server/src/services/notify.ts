/** In-app notifications: tell the team that now owns an order, and the Sales person who created it. */
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { PRICE_RESTRICTED_ROLES } from '../auth/roles.js';
import { STATUS_LABEL, STATUS_OWNER, type OrderStatus } from '../workflow/statuses.js';

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

  const owner = STATUS_OWNER[to];
  const [team] = owner
    ? await conn.query<RowDataPacket[]>(`SELECT u.id, r.code AS role, u.can_view_pricing FROM users u JOIN roles r ON r.id = u.role_id
         WHERE r.code = ? AND u.is_active = 1`, [owner])
    : [[] as RowDataPacket[]];
  // Remarks can mention amounts, so people who can't see pricing get the short message.
  const recipients = new Map<number, boolean>(
    team.map((u) => [Number(u.id), !PRICE_RESTRICTED_ROLES.includes(u.role) || u.can_view_pricing === 1]),
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
