/**
 * Order workflow: statuses and who may move an order between them.
 * Confirmed with the client (2026-10-28):
 *  - Packaging is required for every order: QC → Packaging → Documentation.
 *  - Balance payment is verified AFTER loading and BEFORE port gate-in.
 *  - A rejected balance payment holds the order in BALANCE_REJECTED until Sales re-submits.
 * Must match the CHECK constraint on orders.status (migrations 003 + 004).
 */
import type { Role } from '../auth/roles.js';

export const ORDER_STATUSES = [
  'AWAITING_ADVANCE_VERIFICATION',
  'ADVANCE_REJECTED',
  'AWAITING_QC',
  'QC_IN_PROGRESS',
  'WAITING_FOR_MATERIALS',
  'AWAITING_QUALITY_CHECK',
  'AWAITING_PACKAGING',
  'PACKAGING_IN_PROGRESS',
  'PACKAGING_ON_HOLD',
  'PACKAGING_ISSUE',
  'READY_FOR_DOCUMENTATION',
  'DOCUMENTATION_IN_PROGRESS',
  'AWAITING_BALANCE_VERIFICATION',
  'BALANCE_REJECTED',
  'AWAITING_DOCUMENT_RELEASE',
  'AWAITING_FINAL_VERIFICATION',
  'CLOSED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  AWAITING_ADVANCE_VERIFICATION: 'Awaiting Advance Verification',
  ADVANCE_REJECTED: 'Advance Payment Rejected',
  AWAITING_QC: 'Awaiting QC',
  QC_IN_PROGRESS: 'QC / Production In Progress',
  WAITING_FOR_MATERIALS: 'Waiting for Materials',
  AWAITING_QUALITY_CHECK: 'Awaiting Quality Check',
  AWAITING_PACKAGING: 'Awaiting Packaging',
  PACKAGING_IN_PROGRESS: 'Packaging In Progress',
  PACKAGING_ON_HOLD: 'Packaging On Hold',
  PACKAGING_ISSUE: 'Packaging Issue / Rework Required',
  READY_FOR_DOCUMENTATION: 'Ready for Documentation',
  DOCUMENTATION_IN_PROGRESS: 'Documentation In Progress',
  AWAITING_BALANCE_VERIFICATION: 'Awaiting Balance Payment Verification',
  BALANCE_REJECTED: 'Balance Payment Rejected',
  AWAITING_DOCUMENT_RELEASE: 'Awaiting Document Release',
  AWAITING_FINAL_VERIFICATION: 'Awaiting Final Accounts Verification',
  CLOSED: 'Completed / Closed',
  CANCELLED: 'Cancelled',
};

export const QC_STATUSES = ['ONGOING', 'WAITING', 'READY', 'ON_HOLD'] as const;
export type QcStatus = (typeof QC_STATUSES)[number];

export const PACKAGING_STATUSES = ['AWAITING', 'IN_PROGRESS', 'ON_HOLD', 'ISSUE', 'COMPLETED'] as const;
export type PackagingStatus = (typeof PACKAGING_STATUSES)[number];

/** Department that must act next, for queues and "pending actions". */
export const STATUS_OWNER: Record<OrderStatus, Role | null> = {
  AWAITING_ADVANCE_VERIFICATION: 'ACCOUNTS',
  ADVANCE_REJECTED: 'SALES',
  AWAITING_QC: 'QC',
  QC_IN_PROGRESS: 'QC',
  WAITING_FOR_MATERIALS: 'QC',
  AWAITING_QUALITY_CHECK: 'QC',
  AWAITING_PACKAGING: 'PACKAGING',
  PACKAGING_IN_PROGRESS: 'PACKAGING',
  PACKAGING_ON_HOLD: 'PACKAGING',
  PACKAGING_ISSUE: 'PACKAGING',
  READY_FOR_DOCUMENTATION: 'DOCUMENTATION',
  DOCUMENTATION_IN_PROGRESS: 'DOCUMENTATION', // Sales records balance payment from here too
  AWAITING_BALANCE_VERIFICATION: 'ACCOUNTS',
  BALANCE_REJECTED: 'SALES',
  AWAITING_DOCUMENT_RELEASE: 'DOCUMENTATION',
  AWAITING_FINAL_VERIFICATION: 'ACCOUNTS',
  CLOSED: null,
  CANCELLED: null,
};

type Transition = { from: OrderStatus[]; to: OrderStatus; role: Role; action: string };

const QC_WORKING: OrderStatus[] = ['AWAITING_QC', 'QC_IN_PROGRESS', 'WAITING_FOR_MATERIALS', 'AWAITING_QUALITY_CHECK'];
const PACKAGING_WORKING: OrderStatus[] = ['AWAITING_PACKAGING', 'PACKAGING_IN_PROGRESS', 'PACKAGING_ON_HOLD', 'PACKAGING_ISSUE'];

export const TRANSITIONS: Transition[] = [
  // Stage 2: advance payment
  { from: ['AWAITING_ADVANCE_VERIFICATION'], to: 'AWAITING_QC', role: 'ACCOUNTS', action: 'Approve advance payment' },
  { from: ['AWAITING_ADVANCE_VERIFICATION'], to: 'ADVANCE_REJECTED', role: 'ACCOUNTS', action: 'Reject advance payment' },
  { from: ['ADVANCE_REJECTED'], to: 'AWAITING_ADVANCE_VERIFICATION', role: 'SALES', action: 'Re-submit advance payment' },

  // Stage 3: QC / production (QC moves freely between working states until Ready)
  { from: QC_WORKING, to: 'QC_IN_PROGRESS', role: 'QC', action: 'Production in progress' },
  { from: QC_WORKING, to: 'WAITING_FOR_MATERIALS', role: 'QC', action: 'Waiting for materials' },
  { from: QC_WORKING, to: 'AWAITING_QUALITY_CHECK', role: 'QC', action: 'Awaiting quality check' },
  { from: QC_WORKING, to: 'AWAITING_PACKAGING', role: 'QC', action: 'Mark ready for packaging' },

  // Stage 3b: packaging (required for every order)
  { from: PACKAGING_WORKING, to: 'PACKAGING_IN_PROGRESS', role: 'PACKAGING', action: 'Packaging in progress' },
  { from: PACKAGING_WORKING, to: 'PACKAGING_ON_HOLD', role: 'PACKAGING', action: 'Put packaging on hold' },
  { from: PACKAGING_WORKING, to: 'PACKAGING_ISSUE', role: 'PACKAGING', action: 'Report packaging issue / rework' },
  { from: ['PACKAGING_IN_PROGRESS'], to: 'READY_FOR_DOCUMENTATION', role: 'PACKAGING', action: 'Mark packaging completed' },

  // Stage 4: container booking and loading
  { from: ['READY_FOR_DOCUMENTATION'], to: 'DOCUMENTATION_IN_PROGRESS', role: 'DOCUMENTATION', action: 'Start documentation' },

  // Stage 5: balance payment (after loading, before gate-in)
  { from: ['DOCUMENTATION_IN_PROGRESS'], to: 'AWAITING_BALANCE_VERIFICATION', role: 'SALES', action: 'Record balance payment' },
  { from: ['AWAITING_BALANCE_VERIFICATION'], to: 'AWAITING_DOCUMENT_RELEASE', role: 'ACCOUNTS', action: 'Approve balance payment' },
  { from: ['DOCUMENTATION_IN_PROGRESS'], to: 'AWAITING_DOCUMENT_RELEASE', role: 'ACCOUNTS', action: 'Confirm no balance due' },
  { from: ['AWAITING_BALANCE_VERIFICATION'], to: 'BALANCE_REJECTED', role: 'ACCOUNTS', action: 'Reject balance payment' },
  { from: ['BALANCE_REJECTED'], to: 'AWAITING_BALANCE_VERIFICATION', role: 'SALES', action: 'Re-submit balance payment' },

  // Stage 6: gate-in and bill release
  { from: ['AWAITING_DOCUMENT_RELEASE'], to: 'AWAITING_FINAL_VERIFICATION', role: 'DOCUMENTATION', action: 'Complete documentation' },

  // Stage 7: closure
  { from: ['AWAITING_FINAL_VERIFICATION'], to: 'CLOSED', role: 'ACCOUNTS', action: 'Close order' },
];

/** Statuses from which MD/Admin may cancel. */
export const CANCELLABLE = ORDER_STATUSES.filter((s) => s !== 'CLOSED' && s !== 'CANCELLED');

/** True if `role` may move an order from `from` to `to`. */
export function canTransition(role: Role, from: OrderStatus, to: OrderStatus): boolean {
  if (to === 'CANCELLED') return role === 'ADMIN' && (CANCELLABLE as readonly string[]).includes(from);
  return TRANSITIONS.some((t) => t.role === role && t.to === to && t.from.includes(from) && from !== to);
}

/** Closed and cancelled orders are read-only for everyone. */
export function isLocked(status: OrderStatus): boolean {
  return status === 'CLOSED' || status === 'CANCELLED';
}

// ───────────── Customer tracking page (public) ─────────────
// Customers see milestones and friendly labels only. Rejections and internal issues are never shown.

export const CUSTOMER_MILESTONES = [
  { key: 'ADVANCE', label: 'Advance payment confirmed' },
  { key: 'PRODUCTION', label: 'Production & quality check' },
  { key: 'PACKAGING', label: 'Packaging' },
  { key: 'DOCUMENTATION', label: 'Container & shipping documents' },
  { key: 'BALANCE', label: 'Balance payment confirmed' },
  { key: 'CLOSURE', label: 'Documents released & order completed' },
] as const;
export type MilestoneKey = (typeof CUSTOMER_MILESTONES)[number]['key'];

/** Which milestone the order is currently in, and the label the customer sees. */
export const CUSTOMER_VIEW: Record<OrderStatus, { milestone: MilestoneKey; label: string }> = {
  AWAITING_ADVANCE_VERIFICATION: { milestone: 'ADVANCE', label: 'Payment confirmation pending' },
  ADVANCE_REJECTED: { milestone: 'ADVANCE', label: 'Payment confirmation pending' },
  AWAITING_QC: { milestone: 'PRODUCTION', label: 'In production' },
  QC_IN_PROGRESS: { milestone: 'PRODUCTION', label: 'In production' },
  WAITING_FOR_MATERIALS: { milestone: 'PRODUCTION', label: 'In production' },
  AWAITING_QUALITY_CHECK: { milestone: 'PRODUCTION', label: 'Quality check' },
  AWAITING_PACKAGING: { milestone: 'PACKAGING', label: 'Packaging' },
  PACKAGING_IN_PROGRESS: { milestone: 'PACKAGING', label: 'Packaging' },
  PACKAGING_ON_HOLD: { milestone: 'PACKAGING', label: 'Packaging' },
  PACKAGING_ISSUE: { milestone: 'PACKAGING', label: 'Packaging' },
  READY_FOR_DOCUMENTATION: { milestone: 'DOCUMENTATION', label: 'Preparing shipment' },
  DOCUMENTATION_IN_PROGRESS: { milestone: 'DOCUMENTATION', label: 'Preparing shipment' },
  AWAITING_BALANCE_VERIFICATION: { milestone: 'BALANCE', label: 'Balance payment confirmation pending' },
  BALANCE_REJECTED: { milestone: 'BALANCE', label: 'Balance payment confirmation pending' },
  AWAITING_DOCUMENT_RELEASE: { milestone: 'CLOSURE', label: 'Releasing shipping documents' },
  AWAITING_FINAL_VERIFICATION: { milestone: 'CLOSURE', label: 'Finalising order' },
  CLOSED: { milestone: 'CLOSURE', label: 'Completed' },
  CANCELLED: { milestone: 'ADVANCE', label: 'Cancelled' },
};
