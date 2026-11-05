-- Roles & permissions. MD/Admin can change what each role may do and add new roles.
-- The six built-in roles start with exactly the access they had before this migration.
-- Permission keys are listed in server/src/auth/permissions.ts.

ALTER TABLE roles
  ADD COLUMN description VARCHAR(255) NULL AFTER name,
  -- Built-in roles cannot be deleted. Their permissions can still be changed.
  ADD COLUMN is_system TINYINT(1) NOT NULL DEFAULT 0 AFTER description,
  ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE roles ADD UNIQUE KEY uq_roles_name (name);

UPDATE roles SET is_system = 1 WHERE code IN ('SALES', 'ACCOUNTS', 'QC', 'PACKAGING', 'DOCUMENTATION', 'ADMIN');
UPDATE roles SET description = 'Registers customers and PIs, records payments, shares tracking links.' WHERE code = 'SALES';
UPDATE roles SET description = 'Verifies payments, manages refunds and withheld amounts, closes orders.' WHERE code = 'ACCOUNTS';
UPDATE roles SET description = 'Sourcing, production timeline and quality check.' WHERE code = 'QC';
UPDATE roles SET description = 'Packaging status, quantities, issues and photos.' WHERE code = 'PACKAGING';
UPDATE roles SET description = 'Containers, loading, gate-in and bill release.' WHERE code = 'DOCUMENTATION';
UPDATE roles SET description = 'Overview of all orders, cancellations, reports and administration.' WHERE code = 'ADMIN';

CREATE TABLE role_permissions (
  role_id TINYINT UNSIGNED NOT NULL,
  permission VARCHAR(50) NOT NULL,
  PRIMARY KEY (role_id, permission),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO role_permissions (role_id, permission)
SELECT r.id, p.permission
FROM roles r
JOIN (
  SELECT 'SALES' AS code, 'orders.create' AS permission UNION ALL
  SELECT 'SALES', 'customers.manage' UNION ALL
  SELECT 'SALES', 'payments.record' UNION ALL
  SELECT 'SALES', 'tracking.manage' UNION ALL
  SELECT 'SALES', 'pricing.view' UNION ALL

  SELECT 'ACCOUNTS', 'payments.verify' UNION ALL
  SELECT 'ACCOUNTS', 'orders.close' UNION ALL
  SELECT 'ACCOUNTS', 'credits.manage' UNION ALL
  SELECT 'ACCOUNTS', 'reports.view' UNION ALL
  SELECT 'ACCOUNTS', 'pricing.view' UNION ALL

  SELECT 'QC', 'qc.work' UNION ALL

  SELECT 'PACKAGING', 'packaging.work' UNION ALL

  SELECT 'DOCUMENTATION', 'documentation.work' UNION ALL
  SELECT 'DOCUMENTATION', 'pricing.view' UNION ALL

  SELECT 'ADMIN', 'overview.view' UNION ALL
  SELECT 'ADMIN', 'orders.view_all' UNION ALL
  SELECT 'ADMIN', 'customers.view' UNION ALL
  SELECT 'ADMIN', 'orders.cancel' UNION ALL
  SELECT 'ADMIN', 'tracking.manage' UNION ALL
  SELECT 'ADMIN', 'reports.view' UNION ALL
  SELECT 'ADMIN', 'audit.view' UNION ALL
  SELECT 'ADMIN', 'products.manage' UNION ALL
  SELECT 'ADMIN', 'users.manage' UNION ALL
  SELECT 'ADMIN', 'roles.manage' UNION ALL
  SELECT 'ADMIN', 'pricing.view'
) p ON p.code = r.code;
