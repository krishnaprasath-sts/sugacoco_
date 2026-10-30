import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { OrderStatus, PackagingStatus, QcStatus } from '../workflow/statuses';
import type { DocumentCategory } from '../workflow/documents';
import type { Role } from '../auth/roles';
import type { QcUpdate } from './qc';
import type { BillRelease, Container, PackagingUpdate } from './stages';

export type OrderListRow = {
  id: number;
  orderNo: string;
  piNumber: string;
  piDate: string;
  currency: string;
  totalValue?: string;
  status: OrderStatus;
  statusChangedAt: string;
  qcStatus: QcStatus | null;
  packagingStatus: PackagingStatus | null;
  expectedReadyDate: string | null;
  customerId: number;
  customerName: string;
  createdByName: string;
  createdAt: string;
};

export type OrderItem = {
  id?: number;
  productId?: number | null;
  productName: string;
  specification: string | null;
  quantity: string;
  unit: string;
  quantityMt: string | null;
  unitPrice?: string;
  lineTotal?: string;
};

export type OrderDocument = {
  id: number;
  category: DocumentCategory;
  title: string | null;
  referenceNo: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  paymentId: number | null;
  uploadedBy: number;
  uploadedByName: string;
  createdAt: string;
};

export type Payment = {
  id: number;
  paymentType: 'ADVANCE' | 'BALANCE';
  amount: string;
  currency: string;
  paymentDate: string | null;
  bankReference: string | null;
  payerBank: string | null;
  remarks: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  recordedByName: string;
  recordedAt: string;
  decision: string | null;
  verificationRemarks: string | null;
  verifiedAt: string | null;
  verifiedByName: string | null;
  amountReceived: string | null;
  bankCreditDate: string | null;
  bankCreditReference: string | null;
};

export type OrderDetail = {
  order: {
    id: number;
    orderNo: string;
    customerId: number;
    piNumber: string;
    piDate: string;
    currency: string;
    totalValue?: string;
    advancePercent?: string;
    advanceAmount?: string;
    balanceAmount?: string;
    creditAppliedAmount?: string;
    closedAt?: string | null;
    closureRemarks?: string | null;
    paymentTerms?: string | null;
    remarks: string | null;
    status: OrderStatus;
    statusChangedAt: string;
    qcStatus: QcStatus | null;
    expectedReadyDate: string | null;
    packagingStatus: PackagingStatus | null;
    createdBy: number;
    createdByName: string;
    createdAt: string;
  };
  customer: {
    id: number;
    companyName: string;
    contactPerson: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  };
  items: OrderItem[];
  documents: OrderDocument[];
  payments: Payment[];
  history: {
    id: number;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    remarks: string | null;
    changedAt: string;
    changedByName: string;
    changedByRole: Role;
  }[];
  qcUpdates: QcUpdate[];
  packagingUpdates: PackagingUpdate[];
  containers: Container[];
  billReleases: BillRelease[];
  credits: { id: number; amount: string; currency: string; status: 'PENDING' | 'VERIFIED' | 'REJECTED'; remarks: string | null; createdAt: string }[];
  cancellation: { reason: string; statusBefore: OrderStatus; cancelledAt: string; cancelledByName: string } | null;
  closureChecklist: { key: string; label: string; ok: boolean }[] | null;
  permissions: {
    canEdit: boolean;
    canRecordAdvance: boolean;
    uploadCategories: DocumentCategory[];
    canViewPricing: boolean;
    /** Set for Accounts when a payment is waiting for their verification. */
    verifyPaymentId: number | null;
    canUpdateQc: boolean;
    /** Accounts: advance/balance is 0, confirm without a payment record. */
    confirmNoPaymentType: 'ADVANCE' | 'BALANCE' | null;
    canRecordBalance: boolean;
    balanceWaitingForLoading: boolean;
    canApplyCredit: boolean;
    canUpdatePackaging: boolean;
    canEditContainers: boolean;
    canGateIn: boolean;
    canRelease: boolean;
    canClose: boolean;
    canCancel: boolean;
    canManageTracking: boolean;
  };
};

export type OrderInput = {
  customerId: number;
  piNumber: string;
  piDate: string;
  currency: string;
  advancePercent: number;
  advanceAmount?: number | null;
  paymentTerms: string | null;
  remarks: string | null;
  items: {
    productName: string;
    specification: string | null;
    quantity: number;
    unit: string;
    quantityMt: number | null;
    unitPrice: number;
  }[];
  advancePayment?: AdvancePaymentInput | null;
};

export type AdvancePaymentInput = {
  amount: number;
  paymentDate: string | null;
  bankReference: string | null;
  payerBank: string | null;
  remarks: string | null;
};

export type OrderListParams = { q?: string; status?: OrderStatus[]; mine?: boolean; customerId?: number; page?: number; pageSize?: number };

export function useOrders(params: OrderListParams, opts: { enabled?: boolean } = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.status?.length) search.set('status', params.status.join(','));
  if (params.mine) search.set('mine', '1');
  if (params.customerId) search.set('customerId', String(params.customerId));
  search.set('page', String(params.page ?? 1));
  search.set('pageSize', String(params.pageSize ?? 25));
  return useQuery({
    queryKey: ['orders', params],
    enabled: opts.enabled ?? true,
    queryFn: () => api<{ orders: OrderListRow[]; total: number }>(`/orders?${search}`),
    placeholderData: keepPreviousData,
  });
}

export function useOrderSummary(mine: boolean) {
  return useQuery({
    queryKey: ['orders', 'summary', mine],
    queryFn: () => api<{ counts: Partial<Record<OrderStatus, number>> }>(`/orders/summary${mine ? '?mine=1' : ''}`),
  });
}

export function useOrder(id: number) {
  // Refetch when the tab gets focus again so nobody acts on an order another department already moved.
  return useQuery({ queryKey: ['order', id], enabled: id > 0, refetchOnWindowFocus: true, queryFn: () => api<OrderDetail>(`/orders/${id}`) });
}

function useInvalidateOrders() {
  const qc = useQueryClient();
  return (id?: number) => {
    qc.invalidateQueries({ queryKey: ['orders'] });
    qc.invalidateQueries({ queryKey: ['customer'] });
    if (id) qc.invalidateQueries({ queryKey: ['order', id] });
  };
}

export function useSaveOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: ({ id, ...body }: OrderInput & { id?: number }) =>
      api<{ id?: number; advancePaymentId?: number | null }>(id ? `/orders/${id}` : '/orders', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (_d, vars) => invalidate(vars.id),
  });
}

export function useRecordAdvance(orderId: number) {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (body: AdvancePaymentInput) =>
      api<{ paymentId: number }>(`/orders/${orderId}/payments`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => invalidate(orderId),
  });
}

export function uploadDocuments(
  orderId: number,
  files: File[],
  fields: { category: DocumentCategory; referenceNo?: string; title?: string; paymentId?: number | null },
) {
  const form = new FormData();
  form.set('category', fields.category);
  if (fields.referenceNo) form.set('referenceNo', fields.referenceNo);
  if (fields.title) form.set('title', fields.title);
  if (fields.paymentId) form.set('paymentId', String(fields.paymentId));
  for (const f of files) form.append('files', f);
  return api<{ documentIds: number[] }>(`/orders/${orderId}/documents`, { method: 'POST', body: form });
}

export function useUploadDocuments(orderId: number) {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (args: { files: File[]; category: DocumentCategory; referenceNo?: string; paymentId?: number | null }) =>
      uploadDocuments(orderId, args.files, args),
    onSuccess: () => invalidate(orderId),
  });
}

export function useRemoveDocument(orderId: number) {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: (docId: number) => api(`/documents/${docId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(orderId),
  });
}

export function useProductSuggestions() {
  return useQuery({
    queryKey: ['products', 'suggestions'],
    queryFn: async () => (await api<{ products: { name: string; unit: string }[] }>('/products/suggestions')).products,
    staleTime: 5 * 60 * 1000,
  });
}
