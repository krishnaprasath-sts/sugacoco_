/** Order read helpers shared by routes. All pricing is stripped for users who may not see it. */
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db/pool.js';
import type { AuthUser } from '../auth/users.js';
import { HttpError } from '../middleware/error.js';
import { canView, uploadCategoriesAt } from '../workflow/documents.js';
import { isLocked, type OrderStatus } from '../workflow/statuses.js';
import { closureChecklist } from '../routes/accounts.js';

const QC_WORKING: OrderStatus[] = ['AWAITING_QC', 'QC_IN_PROGRESS', 'WAITING_FOR_MATERIALS', 'AWAITING_QUALITY_CHECK'];
const PACKAGING_WORKING: OrderStatus[] = ['AWAITING_PACKAGING', 'PACKAGING_IN_PROGRESS', 'PACKAGING_ON_HOLD', 'PACKAGING_ISSUE'];
const DOCS_EDITABLE: OrderStatus[] = ['READY_FOR_DOCUMENTATION', 'DOCUMENTATION_IN_PROGRESS', 'AWAITING_BALANCE_VERIFICATION', 'BALANCE_REJECTED', 'AWAITING_DOCUMENT_RELEASE'];

const FINANCIAL_ORDER_FIELDS = [
  'totalValue',
  'advancePercent',
  'advanceAmount',
  'balanceAmount',
  'creditAppliedAmount',
  'paymentTerms',
  'closureRemarks',
] as const;
const FINANCIAL_ITEM_FIELDS = ['unitPrice', 'lineTotal'] as const;

export function stripPricing<T extends Record<string, unknown>>(row: T, fields: readonly string[]): T {
  const copy = { ...row };
  for (const f of fields) delete copy[f];
  return copy;
}

const ORDER_COLUMNS = `
  o.id, o.order_no AS orderNo, o.customer_id AS customerId, o.pi_number AS piNumber, o.pi_date AS piDate,
  o.currency, o.total_value AS totalValue, o.advance_percent AS advancePercent, o.advance_amount AS advanceAmount,
  o.balance_amount AS balanceAmount, o.credit_applied_amount AS creditAppliedAmount, o.payment_terms AS paymentTerms,
  o.remarks, o.status, o.status_changed_at AS statusChangedAt, o.qc_status AS qcStatus,
  o.expected_ready_date AS expectedReadyDate, o.packaging_status AS packagingStatus,
  o.created_by AS createdBy, cu.name AS createdByName, o.created_at AS createdAt, o.updated_at AS updatedAt,
  o.closed_at AS closedAt, o.closure_remarks AS closureRemarks`;

export async function getOrderRow(id: number) {
  const [[row]] = await pool.query<RowDataPacket[]>(
    `SELECT ${ORDER_COLUMNS} FROM orders o JOIN users cu ON cu.id = o.created_by WHERE o.id = ?`,
    [id],
  );
  if (!row) throw new HttpError(404, 'Order not found');
  return row as RowDataPacket & { status: OrderStatus; createdBy: number };
}

/** Sales may edit order details only until Accounts approves the advance payment. */
export async function salesCanEdit(orderId: number, status: OrderStatus) {
  if (!['AWAITING_ADVANCE_VERIFICATION', 'ADVANCE_REJECTED'].includes(status)) return false;
  const [[approved]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM payments WHERE order_id = ? AND payment_type = 'ADVANCE' AND status = 'APPROVED'`,
    [orderId],
  );
  return approved.n === 0;
}

/** Full order detail, shaped for the given user. */
export async function getOrderDetail(id: number, user: AuthUser) {
  const order = await getOrderRow(id);

  const [[customer]] = await pool.query<RowDataPacket[]>(
    `SELECT id, company_name AS companyName, contact_person AS contactPerson, email, phone,
            city, state, country FROM customers WHERE id = ?`,
    [order.customerId],
  );
  const [items] = await pool.query<RowDataPacket[]>(
    `SELECT id, product_id AS productId, product_name AS productName, specification, quantity, unit,
            quantity_mt AS quantityMt, unit_price AS unitPrice, line_total AS lineTotal
     FROM order_items WHERE order_id = ? ORDER BY sort_order, id`,
    [id],
  );
  const [documents] = await pool.query<RowDataPacket[]>(
    `SELECT d.id, d.category, d.title, d.reference_no AS referenceNo, d.original_name AS originalName,
            d.mime_type AS mimeType, d.size_bytes AS sizeBytes, d.payment_id AS paymentId,
            d.uploaded_by AS uploadedBy, u.name AS uploadedByName, d.created_at AS createdAt
     FROM order_documents d JOIN users u ON u.id = d.uploaded_by
     WHERE d.order_id = ? AND d.deleted_at IS NULL ORDER BY d.created_at DESC`,
    [id],
  );
  const [history] = await pool.query<RowDataPacket[]>(
    `SELECT h.id, h.from_status AS fromStatus, h.to_status AS toStatus, h.remarks, h.changed_at AS changedAt,
            u.name AS changedByName, r.code AS changedByRole
     FROM order_status_history h JOIN users u ON u.id = h.changed_by JOIN roles r ON r.id = u.role_id
     WHERE h.order_id = ? ORDER BY h.changed_at, h.id`,
    [id],
  );

  const [qcUpdates] = await pool.query<RowDataPacket[]>(
    `SELECT q.id, q.qc_status AS qcStatus, q.sourcing_status AS sourcingStatus, q.expected_ready_date AS expectedReadyDate,
            q.processing_timeline AS processingTimeline, q.quality_check_status AS qualityCheckStatus,
            q.quality_check_result AS qualityCheckResult, q.date_change_reason AS dateChangeReason, q.remarks,
            u.name AS createdByName, q.created_at AS createdAt
     FROM qc_updates q JOIN users u ON u.id = q.created_by
     WHERE q.order_id = ? ORDER BY q.id DESC`,
    [id],
  );

  let payments: RowDataPacket[] = [];
  if (user.canViewPricing) {
    [payments] = await pool.query<RowDataPacket[]>(
      `SELECT p.id, p.payment_type AS paymentType, p.amount, p.currency, p.payment_date AS paymentDate,
              p.bank_reference AS bankReference, p.payer_bank AS payerBank, p.remarks, p.status,
              u.name AS recordedByName, p.recorded_at AS recordedAt,
              v.decision, v.remarks AS verificationRemarks, v.verified_at AS verifiedAt, vu.name AS verifiedByName,
              v.amount_received AS amountReceived, v.bank_credit_date AS bankCreditDate, v.bank_credit_reference AS bankCreditReference
       FROM payments p
       JOIN users u ON u.id = p.recorded_by
       LEFT JOIN payment_verifications v ON v.id = (
         SELECT MAX(v2.id) FROM payment_verifications v2 WHERE v2.payment_id = p.id)
       LEFT JOIN users vu ON vu.id = v.verified_by
       WHERE p.order_id = ? ORDER BY p.recorded_at DESC, p.id DESC`,
      [id],
    );
  }

  const [packagingUpdates] = await pool.query<RowDataPacket[]>(
    `SELECT p.id, p.packaging_status AS packagingStatus, p.start_date AS startDate, p.completion_date AS completionDate,
            p.quantity_packed AS quantityPacked, p.quantity_unit AS quantityUnit, p.issue_type AS issueType,
            p.issue_reason AS issueReason, p.remarks, u.name AS createdByName, p.created_at AS createdAt
     FROM packaging_updates p JOIN users u ON u.id = p.created_by WHERE p.order_id = ? ORDER BY p.id DESC`,
    [id],
  );
  const [containers] = await pool.query<RowDataPacket[]>(
    `SELECT id, booking_no AS bookingNo, shipping_line AS shippingLine, vessel_name AS vesselName, voyage_no AS voyageNo,
            container_no AS containerNo, container_size AS containerSize, seal_no AS sealNo, port_of_loading AS portOfLoading,
            port_of_discharge AS portOfDischarge, loading_date AS loadingDate, gate_in_date AS gateInDate,
            transport_details AS transportDetails, remarks, updated_at AS updatedAt
     FROM container_bookings WHERE order_id = ? ORDER BY id`,
    [id],
  );
  const [billReleases] = await pool.query<RowDataPacket[]>(
    `SELECT b.id, b.document_type AS documentType, b.document_reference AS documentReference, b.document_id AS documentId,
            b.release_status AS releaseStatus, b.release_date AS releaseDate, b.remarks, u.name AS recordedByName, b.created_at AS createdAt
     FROM bill_releases b JOIN users u ON u.id = b.recorded_by WHERE b.order_id = ? ORDER BY b.id`,
    [id],
  );
  const [[cancellation]] = await pool.query<RowDataPacket[]>(
    `SELECT oc.reason, oc.status_before AS statusBefore, oc.cancelled_at AS cancelledAt, u.name AS cancelledByName
     FROM order_cancellations oc JOIN users u ON u.id = oc.cancelled_by WHERE oc.order_id = ?`,
    [id],
  );
  let credits: RowDataPacket[] = [];
  if (user.canViewPricing) {
    [credits] = await pool.query<RowDataPacket[]>(
      `SELECT id, amount, currency, status, remarks, created_at AS createdAt FROM customer_credits
       WHERE applied_order_id = ? AND entry_type = 'APPLIED' ORDER BY id DESC`,
      [id],
    );
  }

  const locked = isLocked(order.status);
  const role = user.role;
  const isSales = role === 'SALES';
  const editable = isSales && !locked && (await salesCanEdit(id, order.status));
  const hasPendingAdvance = payments.some((p) => p.paymentType === 'ADVANCE' && p.status === 'PENDING');
  const hasApprovedAdvance = payments.some((p) => p.paymentType === 'ADVANCE' && p.status === 'APPROVED');
  const hasOpenBalance = payments.some((p) => p.paymentType === 'BALANCE' && (p.status === 'PENDING' || p.status === 'APPROVED'));
  const allLoaded = containers.length > 0 && containers.every((c) => c.loadingDate);

  // Accounts can verify the pending payment that matches the stage the order is in.
  const verifyType =
    order.status === 'AWAITING_ADVANCE_VERIFICATION' ? 'ADVANCE' : order.status === 'AWAITING_BALANCE_VERIFICATION' ? 'BALANCE' : null;
  const verifyPaymentId =
    role === 'ACCOUNTS' && verifyType
      ? (payments.find((p) => p.paymentType === verifyType && p.status === 'PENDING')?.id ?? null)
      : null;

  const docsStage = DOCS_EDITABLE.includes(order.status);
  return {
    order: user.canViewPricing ? order : stripPricing(order, FINANCIAL_ORDER_FIELDS),
    customer,
    items: user.canViewPricing ? items : items.map((i) => stripPricing(i, FINANCIAL_ITEM_FIELDS)),
    documents: documents.filter((d) => canView(user, d.category)),
    payments,
    // Accounts' notes can mention amounts; QC/Packaging only see the status change itself.
    history: user.canViewPricing ? history : history.map((h) => (h.changedByRole === 'ACCOUNTS' ? { ...h, remarks: null } : h)),
    qcUpdates,
    packagingUpdates,
    containers,
    billReleases,
    credits,
    cancellation: cancellation ?? null,
    closureChecklist:
      (role === 'ACCOUNTS' || role === 'ADMIN') && order.status === 'AWAITING_FINAL_VERIFICATION' ? await closureChecklist(id) : null,
    permissions: {
      canEdit: editable,
      canRecordAdvance: editable && !hasPendingAdvance && !hasApprovedAdvance,
      canRecordBalance:
        isSales && ['DOCUMENTATION_IN_PROGRESS', 'BALANCE_REJECTED'].includes(order.status) && allLoaded && !hasOpenBalance,
      balanceWaitingForLoading: isSales && order.status === 'DOCUMENTATION_IN_PROGRESS' && !allLoaded,
      canApplyCredit: editable,
      uploadCategories: uploadCategoriesAt(user, order.status),
      canViewPricing: user.canViewPricing,
      verifyPaymentId,
      canUpdateQc: role === 'QC' && QC_WORKING.includes(order.status),
      canUpdatePackaging: role === 'PACKAGING' && PACKAGING_WORKING.includes(order.status),
      canEditContainers: role === 'DOCUMENTATION' && docsStage,
      canGateIn: role === 'DOCUMENTATION' && order.status === 'AWAITING_DOCUMENT_RELEASE',
      canRelease: role === 'DOCUMENTATION' && order.status === 'AWAITING_DOCUMENT_RELEASE',
      canClose: role === 'ACCOUNTS' && order.status === 'AWAITING_FINAL_VERIFICATION',
      canCancel: role === 'ADMIN' && !locked,
      canManageTracking: role === 'SALES' || role === 'ADMIN',
      confirmNoPaymentType:
        role !== 'ACCOUNTS'
          ? null
          : order.status === 'AWAITING_ADVANCE_VERIFICATION' && Number(order.advanceAmount) === 0
            ? 'ADVANCE'
            : order.status === 'DOCUMENTATION_IN_PROGRESS' && Number(order.balanceAmount) === 0 && allLoaded
              ? 'BALANCE'
              : null,
    },
  };
}
