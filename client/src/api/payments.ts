import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { OrderStatus } from '../workflow/statuses';

export type QueueRow = {
  id: number;
  orderNo: string;
  piNumber: string;
  currency: string;
  status: OrderStatus;
  statusChangedAt: string;
  customerName: string;
  paymentType: 'ADVANCE' | 'BALANCE';
  expectedAmount: string;
  paymentId: number | null;
  reportedAmount: string | null;
  paymentDate: string | null;
  bankReference: string | null;
  recordedAt: string | null;
  recordedByName: string | null;
  voucherCount: number;
};

export type RecentVerification = {
  id: number;
  decision: 'APPROVED' | 'REJECTED';
  remarks: string | null;
  verifiedAt: string;
  verifiedByName: string;
  paymentType: 'ADVANCE' | 'BALANCE';
  amount: string;
  currency: string;
  orderId: number;
  orderNo: string;
  customerName: string;
};

export function useVerificationQueue() {
  return useQuery({
    queryKey: ['payments', 'queue'],
    queryFn: () => api<{ ready: QueueRow[]; waitingForSales: QueueRow[]; recent: RecentVerification[] }>('/payments/queue'),
    refetchInterval: 60_000,
  });
}

export type VerifyInput = {
  decision: 'APPROVED' | 'REJECTED';
  bankCreditDate: string | null;
  bankCreditReference: string | null;
  amountReceived: number | null;
  remarks: string | null;
};

export function useVerifyPayment(orderId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, ...body }: VerifyInput & { paymentId: number }) =>
      api<{ ok: true }>(`/payments/${paymentId}/verify`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });
}
