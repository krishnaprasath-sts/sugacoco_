/**
 * Everything a role can be allowed to do. MD/Admin ticks these per role under Administration → Roles & Permissions.
 * Every API route checks one of these (see requirePermission). Keys are stored in role_permissions.permission,
 * so never rename a key without a migration. The client mirrors the keys in client/src/auth/roles.ts.
 */
export const PERMISSION_GROUPS = [
  {
    title: 'Sales',
    permissions: [
      { key: 'orders.create', label: 'Create and edit orders / PI', description: 'Sales dashboard, My Orders, Create Order. Includes the advance entered on a new order.', requires: ['pricing.view'] },
      { key: 'customers.manage', label: 'Add and edit customers', description: 'Customer list with add / edit and customer history.' },
      { key: 'payments.record', label: 'Record payments', description: 'Record or re-submit advance and balance payments, and use customer credit on an order.', requires: ['pricing.view'] },
      { key: 'tracking.manage', label: 'Share customer tracking links', description: 'Create, copy and revoke the customer order-tracking link.' },
    ],
  },
  {
    title: 'Accounts',
    permissions: [
      { key: 'payments.verify', label: 'Verify payments', description: 'Approve or reject advance and balance payments, confirm when no payment is due.', requires: ['pricing.view'] },
      { key: 'orders.close', label: 'Final verification and closure', description: 'Final check and closing of orders. Also shows Closed Orders.', requires: ['pricing.view'] },
      { key: 'credits.manage', label: 'Refunds and withheld amounts', description: 'Record and verify refunds, withheld amounts and credit use.', requires: ['pricing.view'] },
    ],
  },
  {
    title: 'Operations',
    permissions: [
      { key: 'qc.work', label: 'QC / Production work', description: 'QC queue: sourcing, ready date, quality check, images, mark ready for packaging.' },
      { key: 'packaging.work', label: 'Packaging work', description: 'Packaging queue: status, dates, quantity, issues, photos, mark completed.' },
      { key: 'documentation.work', label: 'Documentation work', description: 'Containers, loading, gate-in, bill release, complete documentation.' },
    ],
  },
  {
    title: 'Management',
    permissions: [
      { key: 'overview.view', label: 'Overview and pending actions', description: 'Overview dashboard, pending actions, cancellations list, closure checklist.' },
      { key: 'orders.view_all', label: 'All Orders list', description: 'Read-only list of every order.' },
      { key: 'customers.view', label: 'View customers (read-only)', description: 'Customer list and history without editing.' },
      { key: 'orders.cancel', label: 'Cancel orders', description: 'Cancel an order / PI with a reason. The order becomes read-only.' },
      { key: 'reports.view', label: 'Reports', description: 'Order and customer balance reports, with downloads.' },
      { key: 'pricing.view', label: 'See prices and payments', description: 'Prices, totals, payment details and financial documents. Without it these are hidden.' },
    ],
  },
  {
    title: 'Administration',
    permissions: [
      { key: 'audit.view', label: 'Audit log', description: 'Every change with who and when.' },
      { key: 'products.manage', label: 'Products', description: 'Add, edit and hide products Sales can pick.' },
      { key: 'users.manage', label: 'Users', description: 'Add staff, set their role, reset passwords, deactivate.' },
      { key: 'roles.manage', label: 'Roles and permissions', description: 'Create roles and change what each role can do.' },
    ],
  },
] as const;

export type Permission = (typeof PERMISSION_GROUPS)[number]['permissions'][number]['key'];
type PermissionDef = { readonly key: Permission; readonly requires?: readonly Permission[] };

const ALL: readonly PermissionDef[] = PERMISSION_GROUPS.flatMap((g): readonly PermissionDef[] => g.permissions);
export const PERMISSIONS = ALL.map((p) => p.key) as readonly Permission[];

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && (PERMISSIONS as readonly string[]).includes(value);
}

/** Adds what each chosen permission needs (e.g. Verify payments needs See prices). Keeps catalog order. */
export function withRequired(chosen: readonly Permission[]): Permission[] {
  const set = new Set<Permission>(chosen);
  for (const p of ALL) {
    if (set.has(p.key)) for (const r of p.requires ?? []) set.add(r);
  }
  return PERMISSIONS.filter((p) => set.has(p));
}

/** The built-in MD/Admin role always keeps these, so nobody can lock everyone out. */
export const ADMIN_ROLE_CODE = 'ADMIN';
export const ADMIN_LOCKED: readonly Permission[] = ['users.manage', 'roles.manage'];
