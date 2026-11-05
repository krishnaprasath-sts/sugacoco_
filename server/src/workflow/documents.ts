/** Which file categories each permission may upload, and who may see them. Enforced on every document API. */
import type { Permission } from '../auth/permissions.js';
import type { AuthUser } from '../auth/users.js';
import { isLocked, ORDER_STATUSES, type OrderStatus } from './statuses.js';

export const DOCUMENT_CATEGORIES = [
  'QUOTATION',
  'PI',
  'ADVANCE_VOUCHER',
  'BALANCE_VOUCHER',
  'CONTAINER_IMAGE',
  'LOADING_IMAGE',
  'QC_MEDIA',
  'PACKAGING_IMAGE',
  'PACKAGING_DOC',
  'SHIPPING_DOC',
  'LOADING_BILL',
  'OTHER',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** Files that show prices or payments. Hidden from QC/Packaging unless allowed to see pricing. */
// Shipping documents, loading bills and "other" files often carry invoice values too.
export const FINANCIAL_CATEGORIES: readonly DocumentCategory[] = ['QUOTATION', 'PI', 'ADVANCE_VOUCHER', 'BALANCE_VOUCHER', 'SHIPPING_DOC', 'LOADING_BILL', 'OTHER'];

/**
 * Who may upload what, and from which stage on (`from` = the order must have reached this status).
 * A user gets every category of every permission their role has.
 */
const UPLOAD_RULES: { perm: Permission; categories: readonly DocumentCategory[]; from?: OrderStatus }[] = [
  { perm: 'orders.create', categories: ['QUOTATION', 'PI', 'ADVANCE_VOUCHER', 'BALANCE_VOUCHER', 'OTHER'] },
  { perm: 'payments.record', categories: ['ADVANCE_VOUCHER', 'BALANCE_VOUCHER'] },
  { perm: 'qc.work', categories: ['QC_MEDIA', 'CONTAINER_IMAGE', 'LOADING_IMAGE'], from: 'AWAITING_QC' },
  { perm: 'packaging.work', categories: ['PACKAGING_IMAGE', 'PACKAGING_DOC'], from: 'AWAITING_PACKAGING' },
  { perm: 'documentation.work', categories: ['SHIPPING_DOC', 'LOADING_BILL', 'OTHER'], from: 'READY_FOR_DOCUMENTATION' },
];

export function uploadCategoriesAt(user: AuthUser, status: OrderStatus): readonly DocumentCategory[] {
  if (isLocked(status)) return [];
  const reached = (from?: OrderStatus) => !from || ORDER_STATUSES.indexOf(status) >= ORDER_STATUSES.indexOf(from);
  // Set keeps the rule order, so a QC user still sees "QC media" first.
  const out = new Set<DocumentCategory>();
  for (const rule of UPLOAD_RULES) {
    if (user.permissions.includes(rule.perm) && reached(rule.from)) rule.categories.forEach((c) => out.add(c));
  }
  // Financial files can't be added by someone who can't see them.
  return [...out].filter((c) => canView(user, c));
}

export function canUpload(user: AuthUser, category: DocumentCategory, status: OrderStatus): boolean {
  return uploadCategoriesAt(user, status).includes(category);
}

export function canView(user: AuthUser, category: string): boolean {
  if (FINANCIAL_CATEGORIES.includes(category as DocumentCategory)) return user.canViewPricing;
  return true;
}
