-- Keeps lists, queues and reports fast when the database holds many years of orders.

-- Money received per order, kept on the order itself. It used to be summed from every approved
-- payment on each request (slow once there are lakhs of payments). It is updated in the same
-- transaction that approves a payment (routes/payments.ts). Rule unchanged: the bank amount
-- Accounts confirmed, or the reported amount for approvals recorded before that was required.
ALTER TABLE orders ADD COLUMN received_amount DECIMAL(15,2) NOT NULL DEFAULT 0 AFTER credit_applied_amount;

UPDATE orders o
JOIN (
  SELECT p.order_id, SUM(COALESCE(v.amount_received, p.amount)) AS received
  FROM payments p
  LEFT JOIN payment_verifications v ON v.payment_id = p.id AND v.decision = 'APPROVED'
  WHERE p.status = 'APPROVED'
  GROUP BY p.order_id
) r ON r.order_id = o.id
SET o.received_amount = r.received;

-- "Sent to Packaging / Documentation" lists: when each order moved, read from the index alone.
ALTER TABLE order_status_history
  DROP KEY idx_history_to_from,
  ADD KEY idx_history_to_from (to_status, from_status, order_id, changed_at);

-- Order list search: walk orders newest first and test order no / PI no / customer on the index,
-- stopping as soon as a page is full.
ALTER TABLE orders
  ADD KEY idx_orders_list_search (status_changed_at, order_no, pi_number, customer_id),
  ADD KEY idx_orders_report (pi_date, status, currency);

-- Pending payments per order (verification queue) and money cards.
ALTER TABLE payments ADD KEY idx_payments_status_order (status, order_id, payment_type);

-- Audit log "action" filter list (SELECT DISTINCT action) without reading every row.
ALTER TABLE audit_logs ADD KEY idx_audit_action (action);
