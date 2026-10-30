/** Mirror of server/src/workflow/statuses.ts (labels + display colors). Keep both in sync. */
import type { Role } from '../auth/roles';

export type OrderStatus =
  | 'AWAITING_ADVANCE_VERIFICATION'
  | 'ADVANCE_REJECTED'
  | 'AWAITING_QC'
  | 'QC_IN_PROGRESS'
  | 'WAITING_FOR_MATERIALS'
  | 'AWAITING_QUALITY_CHECK'
  | 'AWAITING_PACKAGING'
  | 'PACKAGING_IN_PROGRESS'
  | 'PACKAGING_ON_HOLD'
  | 'PACKAGING_ISSUE'
  | 'READY_FOR_DOCUMENTATION'
  | 'DOCUMENTATION_IN_PROGRESS'
  | 'AWAITING_BALANCE_VERIFICATION'
  | 'BALANCE_REJECTED'
  | 'AWAITING_DOCUMENT_RELEASE'
  | 'AWAITING_FINAL_VERIFICATION'
  | 'CLOSED'
  | 'CANCELLED';

type ChipColor = 'default' | 'info' | 'warning' | 'success' | 'error';

/** Label, chip color, and which department acts next. Color is never the only signal: the label is always shown. */
export const STATUS: Record<OrderStatus, { label: string; color: ChipColor; owner: Role | null }> = {
  AWAITING_ADVANCE_VERIFICATION: { label: 'Awaiting Advance Verification', color: 'warning', owner: 'ACCOUNTS' },
  ADVANCE_REJECTED: { label: 'Advance Payment Rejected', color: 'error', owner: 'SALES' },
  AWAITING_QC: { label: 'Awaiting QC', color: 'warning', owner: 'QC' },
  QC_IN_PROGRESS: { label: 'QC / Production In Progress', color: 'info', owner: 'QC' },
  WAITING_FOR_MATERIALS: { label: 'Waiting for Materials', color: 'warning', owner: 'QC' },
  AWAITING_QUALITY_CHECK: { label: 'Awaiting Quality Check', color: 'warning', owner: 'QC' },
  AWAITING_PACKAGING: { label: 'Awaiting Packaging', color: 'warning', owner: 'PACKAGING' },
  PACKAGING_IN_PROGRESS: { label: 'Packaging In Progress', color: 'info', owner: 'PACKAGING' },
  PACKAGING_ON_HOLD: { label: 'Packaging On Hold', color: 'warning', owner: 'PACKAGING' },
  PACKAGING_ISSUE: { label: 'Packaging Issue / Rework Required', color: 'error', owner: 'PACKAGING' },
  READY_FOR_DOCUMENTATION: { label: 'Ready for Documentation', color: 'info', owner: 'DOCUMENTATION' },
  DOCUMENTATION_IN_PROGRESS: { label: 'Documentation In Progress', color: 'info', owner: 'DOCUMENTATION' },
  AWAITING_BALANCE_VERIFICATION: { label: 'Awaiting Balance Payment Verification', color: 'warning', owner: 'ACCOUNTS' },
  BALANCE_REJECTED: { label: 'Balance Payment Rejected', color: 'error', owner: 'SALES' },
  AWAITING_DOCUMENT_RELEASE: { label: 'Awaiting Document Release', color: 'info', owner: 'DOCUMENTATION' },
  AWAITING_FINAL_VERIFICATION: { label: 'Awaiting Final Accounts Verification', color: 'warning', owner: 'ACCOUNTS' },
  CLOSED: { label: 'Completed / Closed', color: 'success', owner: null },
  CANCELLED: { label: 'Cancelled', color: 'default', owner: null },
};

export type QcStatus = 'ONGOING' | 'WAITING' | 'READY' | 'ON_HOLD';
export const QC_STATUS_LABEL: Record<QcStatus, string> = {
  ONGOING: 'Ongoing',
  WAITING: 'Waiting',
  READY: 'Ready',
  ON_HOLD: 'On Hold',
};

export type PackagingStatus = 'AWAITING' | 'IN_PROGRESS' | 'ON_HOLD' | 'ISSUE' | 'COMPLETED';
export const PACKAGING_STATUS_LABEL: Record<PackagingStatus, string> = {
  AWAITING: 'Awaiting Packaging',
  IN_PROGRESS: 'Packaging In Progress',
  ON_HOLD: 'Packaging On Hold',
  ISSUE: 'Issue / Rework Required',
  COMPLETED: 'Packaging Completed',
};

export const isLocked = (s: OrderStatus) => s === 'CLOSED' || s === 'CANCELLED';
