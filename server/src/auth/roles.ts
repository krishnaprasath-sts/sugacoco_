/**
 * The six departments of the order workflow. They are also the codes of the built-in roles,
 * but what a user may do comes from their role's permissions (see permissions.ts), not from these codes.
 * Departments are used to say who must act next on an order (STATUS_OWNER).
 */
export const DEPARTMENTS = ['SALES', 'ACCOUNTS', 'QC', 'PACKAGING', 'DOCUMENTATION', 'ADMIN'] as const;
export type Department = (typeof DEPARTMENTS)[number];
