-- Updated document, Section 10: Packaging role + customer order-tracking link.
-- Confirmed 2026-10-28: packaging is required for every order; its 5 statuses are accepted;
-- "Completed" moves the order to READY_FOR_DOCUMENTATION.

INSERT INTO roles (id, code, name) VALUES (6, 'PACKAGING', 'Packaging');

-- Overall status list now includes the packaging stage.
ALTER TABLE orders DROP CONSTRAINT chk_orders_status;
ALTER TABLE orders ADD CONSTRAINT chk_orders_status CHECK (status IN (
  'AWAITING_ADVANCE_VERIFICATION','ADVANCE_REJECTED','AWAITING_QC','QC_IN_PROGRESS',
  'WAITING_FOR_MATERIALS','AWAITING_QUALITY_CHECK',
  'AWAITING_PACKAGING','PACKAGING_IN_PROGRESS','PACKAGING_ON_HOLD','PACKAGING_ISSUE',
  'READY_FOR_DOCUMENTATION','DOCUMENTATION_IN_PROGRESS','AWAITING_BALANCE_VERIFICATION','BALANCE_REJECTED',
  'AWAITING_DOCUMENT_RELEASE','AWAITING_FINAL_VERIFICATION','CLOSED','CANCELLED'));

-- Packaging department snapshot (history lives in packaging_updates).
ALTER TABLE orders
  ADD COLUMN packaging_status VARCHAR(20) NULL AFTER expected_ready_date,
  ADD CONSTRAINT chk_orders_packaging_status CHECK (
    packaging_status IS NULL OR packaging_status IN ('AWAITING','IN_PROGRESS','ON_HOLD','ISSUE','COMPLETED'));

-- Packaging photos / documents.
ALTER TABLE order_documents DROP CONSTRAINT chk_order_documents_category;
ALTER TABLE order_documents ADD CONSTRAINT chk_order_documents_category CHECK (category IN (
  'QUOTATION','PI','ADVANCE_VOUCHER','BALANCE_VOUCHER',
  'CONTAINER_IMAGE','LOADING_IMAGE','QC_MEDIA',
  'PACKAGING_IMAGE','PACKAGING_DOC',
  'SHIPPING_DOC','LOADING_BILL','OTHER'));

-- Every Packaging save adds a row (full history).
CREATE TABLE packaging_updates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  packaging_status VARCHAR(20) NOT NULL,     -- AWAITING | IN_PROGRESS | ON_HOLD | ISSUE | COMPLETED
  start_date DATE NULL,
  completion_date DATE NULL,
  quantity_packed DECIMAL(14,3) NULL,
  quantity_unit VARCHAR(20) NULL,
  issue_type VARCHAR(20) NULL,               -- SHORTAGE | DAMAGE | REWORK | OTHER
  issue_reason TEXT NULL,                    -- required for ISSUE / ON_HOLD / delays (API rule)
  remarks TEXT NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_packaging_updates_order (order_id, created_at),
  CONSTRAINT fk_packaging_updates_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_packaging_updates_user FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT chk_packaging_updates_status CHECK (packaging_status IN ('AWAITING','IN_PROGRESS','ON_HOLD','ISSUE','COMPLETED')),
  CONSTRAINT chk_packaging_updates_issue CHECK (issue_type IS NULL OR issue_type IN ('SHORTAGE','DAMAGE','REWORK','OTHER')),
  CONSTRAINT chk_packaging_updates_qty CHECK (quantity_packed IS NULL OR quantity_packed >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer tracking links. Lookup is by SHA-256 hash of the token.
-- The token itself is stored only encrypted (AES-256-GCM, key in TRACKING_LINK_KEY) so Sales can copy it again.
-- No expiry by default; staff revoke and regenerate. At most one ACTIVE link per order (API rule).
CREATE TABLE order_tracking_links (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  token_encrypted VARCHAR(255) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',   -- ACTIVE | REVOKED
  expires_at DATETIME NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_by INT UNSIGNED NULL,
  revoked_at DATETIME NULL,
  last_viewed_at DATETIME NULL,
  view_count INT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_tracking_token_hash (token_hash),
  KEY idx_tracking_order (order_id, status),
  CONSTRAINT fk_tracking_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_tracking_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_tracking_revoked_by FOREIGN KEY (revoked_by) REFERENCES users(id),
  CONSTRAINT chk_tracking_status CHECK (status IN ('ACTIVE','REVOKED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
