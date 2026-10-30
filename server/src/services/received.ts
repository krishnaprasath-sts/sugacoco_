/**
 * Money received per order = the bank amount Accounts confirmed when approving
 * (falls back to the reported amount for approvals recorded before amountReceived was required).
 * Use as a derived table: LEFT JOIN (${RECEIVED_BY_ORDER}) r ON r.order_id = o.id
 */
export const RECEIVED_BY_ORDER = `
  SELECT p.order_id, SUM(COALESCE(v.amount_received, p.amount)) AS received
  FROM payments p
  LEFT JOIN payment_verifications v ON v.payment_id = p.id AND v.decision = 'APPROVED'
  WHERE p.status = 'APPROVED'
  GROUP BY p.order_id`;
