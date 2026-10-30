/** Which file categories each role may upload and see. Enforced on every document API. */
import type { Role } from '../auth/roles.js';
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

export const UPLOAD_CATEGORIES: Record<Role, readonly DocumentCategory[]> = {
  SALES: ['QUOTATION', 'PI', 'ADVANCE_VOUCHER', 'BALANCE_VOUCHER', 'OTHER'],
  ACCOUNTS: [],
  QC: ['QC_MEDIA', 'CONTAINER_IMAGE', 'LOADING_IMAGE'],
  PACKAGING: ['PACKAGING_IMAGE', 'PACKAGING_DOC'],
  DOCUMENTATION: ['SHIPPING_DOC', 'LOADING_BILL', 'OTHER'],
  ADMIN: [],
};

/** A department can add files only once the order has reached its stage (Sales: any time). */
const UPLOAD_FROM: Partial<Record<Role, OrderStatus>> = {
  QC: 'AWAITING_QC',
  PACKAGING: 'AWAITING_PACKAGING',
  DOCUMENTATION: 'READY_FOR_DOCUMENTATION',
};

export function uploadCategoriesAt(user: AuthUser, status: OrderStatus): readonly DocumentCategory[] {
  if (isLocked(status)) return [];
  const from = UPLOAD_FROM[user.role];
  if (from && ORDER_STATUSES.indexOf(status) < ORDER_STATUSES.indexOf(from)) return [];
  return UPLOAD_CATEGORIES[user.role];
}

export function canUpload(user: AuthUser, category: DocumentCategory, status: OrderStatus): boolean {
  return uploadCategoriesAt(user, status).includes(category);
}

export function canView(user: AuthUser, category: string): boolean {
  if (FINANCIAL_CATEGORIES.includes(category as DocumentCategory)) return user.canViewPricing;
  return true;
}
