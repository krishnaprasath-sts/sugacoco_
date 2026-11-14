/**
 * Permission keys. Mirror of server/src/auth/permissions.ts (labels and descriptions come from GET /api/roles).
 * What a user can open and do comes from their role's permissions, never from the role name.
 */
export const PERMISSIONS = [
  'orders.create',
  'customers.manage',
  'payments.record',
  'tracking.manage',
  'payments.verify',
  'orders.close',
  'credits.manage',
  'qc.work',
  'packaging.work',
  'documentation.work',
  'overview.view',
  'orders.view_all',
  'customers.view',
  'orders.cancel',
  'reports.view',
  'pricing.view',
  'audit.view',
  'products.manage',
  'users.manage',
  'roles.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** The six workflow departments ("who must act next" on an order). Also the codes of the built-in roles. */
export type Department = 'SALES' | 'ACCOUNTS' | 'QC' | 'PACKAGING' | 'DOCUMENTATION' | 'ADMIN';

export type User = {
  id: number;
  name: string;
  email: string;
  /** Role code, e.g. SALES or CUSTOM_7. */
  role: string;
  roleName: string;
  permissions: Permission[];
  canViewPricing: boolean;
};

export const DEPARTMENT_LABEL: Record<Department, string> = {
  SALES: 'Sales',
  ACCOUNTS: 'Accounts',
  QC: 'QC / Production',
  PACKAGING: 'Packaging',
  DOCUMENTATION: 'Documentation',
  ADMIN: 'MD / Admin',
};

/** True if the user's role has ANY of the given permissions. */
export function can(user: Pick<User, 'permissions'> | null | undefined, ...anyOf: Permission[]) {
  return !!user && anyOf.some((p) => user.permissions.includes(p));
}
