export const ROLES = ['SALES', 'ACCOUNTS', 'QC', 'PACKAGING', 'DOCUMENTATION', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** Roles that must not see pricing/payment data unless the user has can_view_pricing. */
export const PRICE_RESTRICTED_ROLES: readonly Role[] = ['QC', 'PACKAGING'];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
