/** Shared "order card" query used by department queues. Never includes pricing. */
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db/pool.js';
import type { OrderStatus } from '../workflow/statuses.js';

export const ORDER_CARD_SELECT = `
  SELECT o.id, o.order_no AS orderNo, o.pi_number AS piNumber, o.status, o.status_changed_at AS statusChangedAt,
         o.qc_status AS qcStatus, o.packaging_status AS packagingStatus, o.expected_ready_date AS expectedReadyDate,
         c.company_name AS customerName,
         (SELECT GROUP_CONCAT(CONCAT(i.product_name, ' (', TRIM(TRAILING '.' FROM TRIM(TRAILING '0' FROM i.quantity)), ' ', i.unit, ')')
                              ORDER BY i.sort_order SEPARATOR ', ')
            FROM order_items i WHERE i.order_id = o.id) AS products
  FROM orders o JOIN customers c ON c.id = o.customer_id`;

export async function ordersInStatuses(statuses: OrderStatus[], orderBy = 'o.status_changed_at ASC', extraSelect = '') {
  const [rows] = await pool.query<RowDataPacket[]>(
    `${ORDER_CARD_SELECT.replace('FROM orders o', `${extraSelect ? `, ${extraSelect}` : ''} FROM orders o`)}
     WHERE o.status IN (${statuses.map(() => '?').join(',')})
     ORDER BY ${orderBy}`,
    statuses,
  );
  return rows;
}

/** Orders that left one of `from` for `to` recently (e.g. QC → Packaging). */
export async function recentlyMoved(from: OrderStatus[], to: OrderStatus, limit = 20) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `${ORDER_CARD_SELECT}
     WHERE o.id IN (SELECT h.order_id FROM order_status_history h
                    WHERE h.from_status IN (${from.map(() => '?').join(',')}) AND h.to_status = ?)
     ORDER BY o.status_changed_at DESC LIMIT ?`,
    [...from, to, limit],
  );
  return rows;
}
