/** API hooks for Packaging, Documentation, balance/closure, credits, tracking links, admin and reports. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { OrderStatus, PackagingStatus } from '../workflow/statuses';
import type { Role } from '../auth/roles';

/** Invalidate everything an order change can affect. */
export function useRefresh(orderId?: number) {
  const qc = useQueryClient();
  return () => {
    for (const key of ['orders', 'qc', 'packaging', 'documentation', 'payments', 'accounts', 'admin', 'credits', 'customer', 'customers', 'reports']) {
      qc.invalidateQueries({ queryKey: [key] });
    }
    if (orderId) qc.invalidateQueries({ queryKey: ['order', orderId] });
  };
}

function useOrderMutation<TBody>(orderId: number, path: (body: TBody) => string, method: 'POST' | 'PATCH' | 'DELETE' = 'POST') {
  const refresh = useRefresh(orderId);
  return useMutation({
    mutationFn: (body: TBody) =>
      api(path(body), { method, body: method === 'DELETE' ? undefined : JSON.stringify(body) }),
    onSuccess: refresh,
  });
}

// ───────────── Shared queue row ─────────────
export type StageRow = {
  id: number;
  orderNo: string;
  piNumber: string;
  status: OrderStatus;
  statusChangedAt: string;
  customerName: string;
  products: string | null;
  qcStatus: string | null;
  packagingStatus: PackagingStatus | null;
  expectedReadyDate: string | null;
  mediaCount?: number;
  quantityPacked?: string | null;
  containerCount?: number;
  loadedCount?: number;
  gatedCount?: number;
  releasedCount?: number;
};

// ───────────── Packaging ─────────────
export type PackagingUpdate = {
  id: number;
  packagingStatus: PackagingStatus;
  startDate: string | null;
  completionDate: string | null;
  quantityPacked: string | null;
  quantityUnit: string | null;
  issueType: 'SHORTAGE' | 'DAMAGE' | 'REWORK' | 'OTHER' | null;
  issueReason: string | null;
  remarks: string | null;
  createdByName: string;
  createdAt: string;
};
export type PackagingInput = {
  packagingStatus: 'IN_PROGRESS' | 'ON_HOLD' | 'ISSUE' | 'COMPLETED';
  startDate: string | null;
  completionDate: string | null;
  quantityPacked: number | null;
  quantityUnit: string | null;
  issueType: string | null;
  issueReason: string | null;
  remarks: string | null;
};
export const ISSUE_LABEL = { SHORTAGE: 'Shortage', DAMAGE: 'Damage', REWORK: 'Rework', OTHER: 'Other' } as const;

export const usePackagingQueue = () =>
  useQuery({
    queryKey: ['packaging', 'queue'],
    queryFn: () => api<{ active: StageRow[]; sentToDocumentation: StageRow[]; sentTotal: number }>('/packaging/queue'),
    refetchInterval: 60_000,
  });
export type PackagingSentRow = StageRow & { sentAt: string; quantityUnit: string | null };
export const usePackagingSent = (page: number, pageSize: number, q: string) =>
  useQuery({
    queryKey: ['packaging', 'sent', page, pageSize, q],
    queryFn: () =>
      api<{ orders: PackagingSentRow[]; total: number }>(
        `/packaging/sent?${new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...(q ? { q } : {}) })}`,
      ),
    placeholderData: keepPreviousData,
  });
export const useSavePackaging = (orderId: number) =>
  useOrderMutation<PackagingInput>(orderId, () => `/packaging/orders/${orderId}/updates`);

// ───────────── Documentation ─────────────
export type Container = {
  id: number;
  bookingNo: string | null;
  shippingLine: string | null;
  vesselName: string | null;
  voyageNo: string | null;
  containerNo: string | null;
  containerSize: string | null;
  sealNo: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  loadingDate: string | null;
  gateInDate: string | null;
  transportDetails: string | null;
  remarks: string | null;
};
export type ContainerInput = Omit<Container, 'id'>;
export type BillRelease = {
  id: number;
  documentType: string;
  documentReference: string | null;
  documentId: number | null;
  releaseStatus: 'PENDING' | 'RELEASED';
  releaseDate: string | null;
  remarks: string | null;
  recordedByName: string;
  createdAt: string;
};
export type BillReleaseInput = Omit<BillRelease, 'id' | 'recordedByName' | 'createdAt'>;

export const useDocumentationQueue = () =>
  useQuery({
    queryKey: ['documentation', 'queue'],
    queryFn: () => api<{ orders: StageRow[] }>('/documentation/queue'),
    refetchInterval: 60_000,
  });
export function useSaveContainer(orderId: number) {
  const refresh = useRefresh(orderId);
  return useMutation({
    mutationFn: ({ id, ...body }: ContainerInput & { id?: number }) =>
      api(id ? `/documentation/containers/${id}` : `/documentation/orders/${orderId}/containers`, {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: refresh,
  });
}
export const useDeleteContainer = (orderId: number) =>
  useOrderMutation<{ id: number }>(orderId, (b) => `/documentation/containers/${b.id}`, 'DELETE');
export function useSaveRelease(orderId: number) {
  const refresh = useRefresh(orderId);
  return useMutation({
    mutationFn: ({ id, ...body }: BillReleaseInput & { id?: number }) =>
      api(id ? `/documentation/bill-releases/${id}` : `/documentation/orders/${orderId}/bill-releases`, {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: refresh,
  });
}
export const useCompleteDocumentation = (orderId: number) =>
  useOrderMutation<{ remarks?: string | null }>(orderId, () => `/documentation/orders/${orderId}/complete`);

// ───────────── Payments / credit / cancel ─────────────
export type PaymentInput = {
  paymentType: 'ADVANCE' | 'BALANCE';
  amount: number;
  paymentDate: string | null;
  bankReference: string | null;
  payerBank: string | null;
  remarks: string | null;
};
export function useRecordPayment(orderId: number) {
  const refresh = useRefresh(orderId);
  return useMutation({
    mutationFn: (body: PaymentInput) =>
      api<{ paymentId: number }>(`/orders/${orderId}/payments`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: refresh,
  });
}
export const useApplyCredit = (orderId: number) =>
  useOrderMutation<{ amount: number; remarks: string | null }>(orderId, () => `/orders/${orderId}/credit-applications`);
export const useCancelOrder = (orderId: number) => useOrderMutation<{ reason: string }>(orderId, () => `/orders/${orderId}/cancel`);
/** Accounts: move on when no advance / balance is due (0 amount), without a payment record. */
export const useConfirmNoPayment = (orderId: number) =>
  useOrderMutation<{ type: 'ADVANCE' | 'BALANCE' }>(orderId, () => `/accounts/orders/${orderId}/confirm-no-payment`);

// ───────────── Accounts ─────────────
export type FinalRow = {
  id: number;
  orderNo: string;
  piNumber: string;
  currency: string;
  totalValue: string;
  received: string;
  status: OrderStatus;
  statusChangedAt: string;
  customerName: string;
};
export const useFinalQueue = () =>
  useQuery({ queryKey: ['accounts', 'final'], queryFn: () => api<{ orders: FinalRow[] }>('/accounts/final-queue') });
export const useCloseOrder = (orderId: number) =>
  useOrderMutation<{ remarks: string | null }>(orderId, () => `/accounts/orders/${orderId}/close`);

export type CreditEntry = {
  id: number;
  entryType: 'WITHHELD' | 'APPLIED' | 'REFUND';
  amount: string;
  currency: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  reference: string | null;
  remarks: string | null;
  createdAt: string;
  verifiedAt: string | null;
  customerId: number;
  customerName: string;
  sourceOrderId: number | null;
  sourceOrderNo: string | null;
  appliedOrderId: number | null;
  appliedOrderNo: string | null;
  recordedByName: string;
  verifiedByName: string | null;
};
export type CreditBalance = {
  customerId: number;
  customerName: string;
  currency: string;
  withheld: string;
  applied: string;
  refunded: string;
  available: string;
};
export const useCredits = (page = 1, pageSize = 25) =>
  useQuery({
    queryKey: ['credits', page, pageSize],
    placeholderData: keepPreviousData,
    queryFn: () =>
      api<{ entries: CreditEntry[]; pending: CreditEntry[]; total: number; page: number; pageSize: number; balances: CreditBalance[] }>(
        `/accounts/credits?page=${page}&pageSize=${pageSize}`,
      ),
  });
export function useAddCredit() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: { customerId: number; entryType: 'WITHHELD' | 'REFUND'; amount: number; currency: string; sourceOrderId: number | null; reference: string | null; remarks: string }) =>
      api('/accounts/credits', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: refresh,
  });
}
export function useVerifyCredit() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; decision: 'VERIFIED' | 'REJECTED'; remarks: string | null }) =>
      api(`/accounts/credits/${id}/verify`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: refresh,
  });
}

// ───────────── Tracking link ─────────────
export type TrackingLink = { id: number; url: string | null; createdAt: string; createdByName: string; viewCount: number; lastViewedAt: string | null };
export const useTrackingLink = (orderId: number, enabled: boolean) =>
  useQuery({
    queryKey: ['tracking', orderId],
    enabled,
    queryFn: async () => (await api<{ link: TrackingLink | null }>(`/orders/${orderId}/tracking-link`)).link,
  });
export function useTrackingAction(orderId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: 'create' | 'regenerate' | 'revoke') =>
      api<{ link: TrackingLink | null }>(`/orders/${orderId}/tracking-link${action === 'create' ? '' : `/${action}`}`, { method: 'POST' }),
    onSuccess: (data) => qc.setQueryData(['tracking', orderId], data.link),
  });
}

// ───────────── Admin ─────────────
export type AdminSummary = {
  counts: Partial<Record<OrderStatus, number>>;
  pendingByDept: Partial<Record<Role, number>>;
  money: { currency: string; orders: number; totalValue: string; received: string; outstanding: string }[];
  pendingVerification: { currency: string; type: 'ADVANCE' | 'BALANCE'; n: number; amount: string }[];
};
export const useAdminSummary = () => useQuery({ queryKey: ['admin', 'summary'], queryFn: () => api<AdminSummary>('/admin/summary') });
export type PendingRow = {
  id: number;
  orderNo: string;
  piNumber: string;
  status: OrderStatus;
  statusChangedAt: string;
  customerName: string;
  hoursWaiting: number;
  owner: Role | null;
};
export const usePendingActions = () =>
  useQuery({ queryKey: ['admin', 'pending'], queryFn: () => api<{ orders: PendingRow[] }>('/admin/pending') });
export type CancellationRow = {
  id: number;
  reason: string;
  statusBefore: OrderStatus;
  cancelledAt: string;
  cancelledByName: string;
  orderId: number;
  orderNo: string;
  piNumber: string;
  currency: string;
  totalValue: string;
  customerName: string;
};
export const useCancellations = (page = 1, pageSize = 25) =>
  useQuery({
    queryKey: ['admin', 'cancellations', page, pageSize],
    placeholderData: keepPreviousData,
    queryFn: () => api<{ cancellations: CancellationRow[]; total: number }>(`/admin/cancellations?page=${page}&pageSize=${pageSize}`),
  });

// ───────────── Reports ─────────────
export type ReportOrder = {
  id: number;
  orderNo: string;
  piNumber: string;
  piDate: string;
  customerName: string;
  status: OrderStatus;
  statusLabel: string;
  currency: string;
  totalValue: string;
  received: string;
  outstanding: string;
  salesName: string;
};
export type ReportCustomer = {
  customerId: number;
  customerName: string;
  currency: string;
  orders: number;
  open: number;
  closed: number;
  totalValue: string;
  received: string;
  outstanding: string;
  creditAvailable: string;
  refunded: string;
};
export const useOrdersReport = (qs: string) =>
  useQuery({ queryKey: ['reports', 'orders', qs], placeholderData: keepPreviousData, queryFn: () =>
    api<{
      orders: ReportOrder[];
      total: number;
      page: number;
      pageSize: number;
      totals: { currency: string; orders: number; totalValue: string; received: string; outstanding: string }[];
    }>(`/reports/orders?${qs}`) });
export const useCustomersReport = () =>
  useQuery({ queryKey: ['reports', 'customers'], queryFn: () => api<{ customers: ReportCustomer[] }>('/reports/customers') });
export type AuditEntry = {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  changes: unknown;
  ipAddress: string | null;
  createdAt: string;
  userName: string | null;
  userRole: Role | null;
  orderId: number | null;
  orderNo: string | null;
};
export const useAuditLog = (qs: string) =>
  useQuery({
    queryKey: ['reports', 'audit', qs],
    placeholderData: keepPreviousData,
    queryFn: () => api<{ entries: AuditEntry[]; total: number; page: number; pageSize: number; actions: string[] }>(`/reports/audit?${qs}`),
  });

// ───────────── Public tracking ─────────────
export type PublicTracking = {
  company: { name: string; supportEmail: string; supportPhone: string };
  order: {
    orderNo: string;
    piNumber: string;
    piDate: string;
    customerName: string;
    statusLabel: string;
    cancelled: boolean;
    closed: boolean;
    lastUpdate: string;
    expectedReadyDate: string | null;
    products: { name: string; quantity: string; unit: string }[];
    milestones: { key: string; label: string; state: 'done' | 'current' | 'upcoming' }[];
  };
};
export const usePublicTracking = (token: string) =>
  useQuery({ queryKey: ['public', token], retry: false, queryFn: () => api<PublicTracking>(`/public/track/${encodeURIComponent(token)}`) });
