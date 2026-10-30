-- Core business schema (developer document, Section 6).
-- Money: DECIMAL(15,2). Quantities: DECIMAL(14,3). All times stored in UTC.
-- Status codes must match server/src/workflow/statuses.ts.

-- ───────────────────────── Masters ─────────────────────────

CREATE TABLE customers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(120) NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(40) NULL,
  alt_phone VARCHAR(40) NULL,
  address_line1 VARCHAR(255) NULL,
  address_line2 VARCHAR(255) NULL,
  city VARCHAR(100) NULL,
  state VARCHAR(100) NULL,
  country VARCHAR(100) NULL,
  postal_code VARCHAR(20) NULL,
  notes TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NOT NULL,
  updated_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_customers_name (company_name),
  KEY idx_customers_country (country),
  CONSTRAINT fk_customers_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_customers_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional product master for quick picking. Order lines copy name/spec so old orders never change.
CREATE TABLE products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  default_unit VARCHAR(20) NOT NULL DEFAULT 'MT',
  hs_code VARCHAR(20) NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_products_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────── Orders / PI ─────────────────────────

CREATE TABLE orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(30) NULL,                 -- e.g. SC-2026-00001, set right after insert
  customer_id INT UNSIGNED NOT NULL,
  pi_number VARCHAR(60) NOT NULL,
  pi_date DATE NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  total_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  advance_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  advance_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  balance_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  credit_applied_amount DECIMAL(15,2) NOT NULL DEFAULT 0,  -- withheld credit used from earlier orders
  payment_terms TEXT NULL,
  remarks TEXT NULL,

  -- Overall order status (one of 14 workflow statuses)
  status VARCHAR(40) NOT NULL DEFAULT 'AWAITING_ADVANCE_VERIFICATION',
  status_changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Department snapshot (latest values, history lives in qc_updates)
  qc_status VARCHAR(20) NULL,
  expected_ready_date DATE NULL,

  created_by INT UNSIGNED NOT NULL,          -- Sales user who registered the PI
  updated_by INT UNSIGNED NULL,
  closed_by INT UNSIGNED NULL,
  closed_at DATETIME NULL,
  closure_remarks TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_orders_order_no (order_no),
  UNIQUE KEY uq_orders_pi_number (pi_number),
  KEY idx_orders_status (status),
  KEY idx_orders_customer (customer_id),
  KEY idx_orders_created_by (created_by),
  KEY idx_orders_pi_date (pi_date),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_orders_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_orders_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
  CONSTRAINT fk_orders_closed_by FOREIGN KEY (closed_by) REFERENCES users(id),
  CONSTRAINT chk_orders_status CHECK (status IN (
    'AWAITING_ADVANCE_VERIFICATION','ADVANCE_REJECTED','AWAITING_QC','QC_IN_PROGRESS',
    'WAITING_FOR_MATERIALS','AWAITING_QUALITY_CHECK','READY_FOR_DOCUMENTATION',
    'DOCUMENTATION_IN_PROGRESS','AWAITING_BALANCE_VERIFICATION','BALANCE_REJECTED',
    'AWAITING_DOCUMENT_RELEASE','AWAITING_FINAL_VERIFICATION','CLOSED','CANCELLED')),
  CONSTRAINT chk_orders_qc_status CHECK (qc_status IS NULL OR qc_status IN ('ONGOING','WAITING','READY','ON_HOLD')),
  CONSTRAINT chk_orders_amounts CHECK (
    total_value >= 0 AND advance_amount >= 0 AND balance_amount >= 0 AND credit_applied_amount >= 0
    AND advance_percent BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NULL,
  product_name VARCHAR(200) NOT NULL,
  specification TEXT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'MT',
  quantity_mt DECIMAL(14,3) NULL,            -- metric-ton value when unit is not MT
  unit_price DECIMAL(15,4) NOT NULL,
  line_total DECIMAL(15,2) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  KEY idx_order_items_order (order_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT chk_order_items_values CHECK (quantity > 0 AND unit_price >= 0 AND line_total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────── Files ─────────────────────────
-- All uploads (PI, vouchers, QC images, shipping docs, bills). Files live on disk under UPLOAD_DIR.
-- Visibility per category is enforced in the API (e.g. QC never gets payment vouchers).

CREATE TABLE order_documents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  category VARCHAR(30) NOT NULL,
  title VARCHAR(200) NULL,
  reference_no VARCHAR(100) NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,         -- random name on disk
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  payment_id INT UNSIGNED NULL,              -- set for payment vouchers
  uploaded_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,                  -- soft delete, file kept for audit
  deleted_by INT UNSIGNED NULL,
  UNIQUE KEY uq_order_documents_stored (stored_name),
  KEY idx_order_documents_order (order_id, category),
  CONSTRAINT fk_order_documents_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_order_documents_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id),
  CONSTRAINT fk_order_documents_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),
  CONSTRAINT chk_order_documents_category CHECK (category IN (
    'QUOTATION','PI','ADVANCE_VOUCHER','BALANCE_VOUCHER',
    'CONTAINER_IMAGE','LOADING_IMAGE','QC_MEDIA',
    'SHIPPING_DOC','LOADING_BILL','OTHER'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────── Payments ─────────────────────────
-- One row per payment Sales records. A rejected payment stays; Sales records a new one.

CREATE TABLE payments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  payment_type VARCHAR(10) NOT NULL,         -- ADVANCE | BALANCE
  amount DECIMAL(15,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  payment_date DATE NULL,                    -- date reported by customer
  bank_reference VARCHAR(100) NULL,          -- UTR / SWIFT / transaction ref
  payer_bank VARCHAR(150) NULL,
  remarks TEXT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'PENDING',  -- PENDING | APPROVED | REJECTED
  recorded_by INT UNSIGNED NOT NULL,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_payments_order (order_id, payment_type),
  KEY idx_payments_status (status),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_payments_recorded_by FOREIGN KEY (recorded_by) REFERENCES users(id),
  CONSTRAINT chk_payments_type CHECK (payment_type IN ('ADVANCE','BALANCE')),
  CONSTRAINT chk_payments_status CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  CONSTRAINT chk_payments_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE order_documents
  ADD CONSTRAINT fk_order_documents_payment FOREIGN KEY (payment_id) REFERENCES payments(id);

-- Accounts' independent check against company bank records.
CREATE TABLE payment_verifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id INT UNSIGNED NOT NULL,
  decision VARCHAR(10) NOT NULL,             -- APPROVED | REJECTED
  bank_credit_date DATE NULL,                -- date seen in company bank statement
  bank_credit_reference VARCHAR(100) NULL,
  amount_received DECIMAL(15,2) NULL,
  remarks TEXT NULL,                         -- required when rejected (API rule)
  verified_by INT UNSIGNED NOT NULL,
  verified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_payment_verifications_payment (payment_id),
  CONSTRAINT fk_payment_verifications_payment FOREIGN KEY (payment_id) REFERENCES payments(id),
  CONSTRAINT fk_payment_verifications_user FOREIGN KEY (verified_by) REFERENCES users(id),
  CONSTRAINT chk_payment_verifications_decision CHECK (decision IN ('APPROVED','REJECTED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────── Customer credit / withheld ─────────────────────────
-- Ledger per customer. Available credit = verified WITHHELD − verified APPLIED.
-- REFUND = money returned to the customer (does not add to available credit).

CREATE TABLE customer_credits (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id INT UNSIGNED NOT NULL,
  entry_type VARCHAR(10) NOT NULL,           -- WITHHELD | APPLIED | REFUND
  amount DECIMAL(15,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  source_order_id INT UNSIGNED NULL,         -- order the money came from
  applied_order_id INT UNSIGNED NULL,        -- order it was used against (APPLIED)
  status VARCHAR(10) NOT NULL DEFAULT 'PENDING',  -- PENDING | VERIFIED | REJECTED
  reference VARCHAR(100) NULL,
  remarks TEXT NULL,
  recorded_by INT UNSIGNED NOT NULL,
  verified_by INT UNSIGNED NULL,
  verified_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_customer_credits_customer (customer_id, status),
  CONSTRAINT fk_customer_credits_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_customer_credits_source FOREIGN KEY (source_order_id) REFERENCES orders(id),
  CONSTRAINT fk_customer_credits_applied FOREIGN KEY (applied_order_id) REFERENCES orders(id),
  CONSTRAINT fk_customer_credits_recorded_by FOREIGN KEY (recorded_by) REFERENCES users(id),
  CONSTRAINT fk_customer_credits_verified_by FOREIGN KEY (verified_by) REFERENCES users(id),
  CONSTRAINT chk_customer_credits_type CHECK (entry_type IN ('WITHHELD','APPLIED','REFUND')),
  CONSTRAINT chk_customer_credits_status CHECK (status IN ('PENDING','VERIFIED','REJECTED')),
  CONSTRAINT chk_customer_credits_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────── QC / Production ─────────────────────────
-- Every QC save adds a row (full history). Latest qc_status / expected date is copied to orders.

CREATE TABLE qc_updates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  qc_status VARCHAR(20) NOT NULL,            -- ONGOING | WAITING | READY | ON_HOLD
  sourcing_status VARCHAR(30) NULL,          -- NOT_STARTED | IN_PROGRESS | SOURCED
  expected_ready_date DATE NULL,
  processing_timeline VARCHAR(200) NULL,
  quality_check_status VARCHAR(20) NULL,     -- NOT_STARTED | IN_PROGRESS | PASSED | FAILED
  quality_check_result TEXT NULL,
  date_change_reason TEXT NULL,              -- required when expected date moves (API rule)
  remarks TEXT NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_qc_updates_order (order_id, created_at),
  CONSTRAINT fk_qc_updates_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_qc_updates_user FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_qc_updates_status CHECK (qc_status IN ('ONGOING','WAITING','READY','ON_HOLD')),
  CONSTRAINT chk_qc_updates_sourcing CHECK (sourcing_status IS NULL OR sourcing_status IN ('NOT_STARTED','IN_PROGRESS','SOURCED')),
  CONSTRAINT chk_qc_updates_quality CHECK (quality_check_status IS NULL OR quality_check_status IN ('NOT_STARTED','IN_PROGRESS','PASSED','FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────── Documentation ─────────────────────────
-- One row per container. Gate-in date may only be set after balance payment is approved (API rule).

CREATE TABLE container_bookings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  booking_no VARCHAR(60) NULL,
  shipping_line VARCHAR(120) NULL,
  vessel_name VARCHAR(120) NULL,
  voyage_no VARCHAR(40) NULL,
  container_no VARCHAR(20) NULL,
  container_size VARCHAR(20) NULL,           -- 20FT / 40FT / 40HC
  seal_no VARCHAR(40) NULL,
  port_of_loading VARCHAR(120) NULL,
  port_of_discharge VARCHAR(120) NULL,
  loading_date DATE NULL,
  gate_in_date DATE NULL,
  transport_details TEXT NULL,
  remarks TEXT NULL,
  created_by INT UNSIGNED NOT NULL,
  updated_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_container_bookings_order (order_id),
  KEY idx_container_bookings_container (container_no),
  CONSTRAINT fk_container_bookings_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_container_bookings_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_container_bookings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Record of releasing the loading bill / other documents to the customer.
CREATE TABLE bill_releases (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  document_type VARCHAR(60) NOT NULL,        -- e.g. Bill of Lading, Loading Bill, Invoice
  document_reference VARCHAR(100) NULL,
  document_id INT UNSIGNED NULL,             -- uploaded file in order_documents
  release_status VARCHAR(10) NOT NULL DEFAULT 'PENDING',  -- PENDING | RELEASED
  release_date DATE NULL,
  remarks TEXT NULL,
  recorded_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_bill_releases_order (order_id),
  CONSTRAINT fk_bill_releases_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_bill_releases_document FOREIGN KEY (document_id) REFERENCES order_documents(id),
  CONSTRAINT fk_bill_releases_user FOREIGN KEY (recorded_by) REFERENCES users(id),
  CONSTRAINT chk_bill_releases_status CHECK (release_status IN ('PENDING','RELEASED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────── Cancellation ─────────────────────────

CREATE TABLE order_cancellations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  status_before VARCHAR(40) NOT NULL,
  reason TEXT NOT NULL,
  cancelled_by INT UNSIGNED NOT NULL,
  cancelled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_order_cancellations_order (order_id),
  CONSTRAINT fk_order_cancellations_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_order_cancellations_user FOREIGN KEY (cancelled_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────── History & audit ─────────────────────────

CREATE TABLE order_status_history (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  from_status VARCHAR(40) NULL,              -- NULL for the first entry (order created)
  to_status VARCHAR(40) NOT NULL,
  remarks TEXT NULL,
  changed_by INT UNSIGNED NOT NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order_status_history_order (order_id, changed_at),
  CONSTRAINT fk_order_status_history_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_order_status_history_user FOREIGN KEY (changed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Every material change: who, what, when, before/after.
CREATE TABLE audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,                 -- NULL for system actions
  action VARCHAR(60) NOT NULL,               -- e.g. ORDER_CREATED, PAYMENT_APPROVED, USER_UPDATED
  entity_type VARCHAR(40) NOT NULL,          -- e.g. order, payment, user
  entity_id INT UNSIGNED NULL,
  order_id INT UNSIGNED NULL,                -- set when the change belongs to an order
  changes JSON NULL,                         -- { field: [before, after] } or details
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_order (order_id),
  KEY idx_audit_user (user_id),
  KEY idx_audit_created (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_audit_order FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
