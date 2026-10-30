export type Role = 'SALES' | 'ACCOUNTS' | 'QC' | 'PACKAGING' | 'DOCUMENTATION' | 'ADMIN';

export type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
  canViewPricing: boolean;
};

export const ROLE_LABEL: Record<Role, string> = {
  SALES: 'Sales',
  ACCOUNTS: 'Accounts',
  QC: 'QC / Production',
  PACKAGING: 'Packaging',
  DOCUMENTATION: 'Documentation',
  ADMIN: 'MD / Admin',
};

/** Landing page after login for each role. */
export const ROLE_HOME: Record<Role, string> = {
  SALES: '/sales',
  ACCOUNTS: '/accounts',
  QC: '/qc',
  PACKAGING: '/packaging',
  DOCUMENTATION: '/documentation',
  ADMIN: '/admin',
};

/** Roles that can't see pricing/payments unless the user is explicitly allowed. */
export const PRICE_RESTRICTED_ROLES: Role[] = ['QC', 'PACKAGING'];
