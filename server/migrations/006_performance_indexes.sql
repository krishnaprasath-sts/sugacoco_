-- Indexes for the order list sort, department queues and "recently moved" lookups.
ALTER TABLE orders
  ADD KEY idx_orders_status_changed (status_changed_at),
  ADD KEY idx_orders_status_status_changed (status, status_changed_at),
  ADD KEY idx_orders_created_by_changed (created_by, status_changed_at);

ALTER TABLE order_status_history
  ADD KEY idx_history_to_from (to_status, from_status, order_id);

ALTER TABLE payment_verifications
  ADD KEY idx_payment_verifications_verified (verified_at);

ALTER TABLE customer_credits
  ADD KEY idx_customer_credits_applied_order (applied_order_id, status);
