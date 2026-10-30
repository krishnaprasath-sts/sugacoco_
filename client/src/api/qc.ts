import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { OrderStatus, QcStatus } from '../workflow/statuses';

export type SourcingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SOURCED';
export type QualityStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PASSED' | 'FAILED';

export const SOURCING_LABEL: Record<SourcingStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  SOURCED: 'Sourced',
};
export const QUALITY_LABEL: Record<QualityStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  PASSED: 'Passed',
  FAILED: 'Failed',
};

export type QcQueueRow = {
  id: number;
  orderNo: string;
  piNumber: string;
  status: OrderStatus;
  statusChangedAt: string;
  qcStatus: QcStatus | null;
  expectedReadyDate: string | null;
  customerName: string;
  products: string | null;
  sourcingStatus: SourcingStatus | null;
  qualityCheckStatus: QualityStatus | null;
  mediaCount: number;
};

export type QcUpdate = {
  id: number;
  qcStatus: QcStatus;
  sourcingStatus: SourcingStatus | null;
  expectedReadyDate: string | null;
  processingTimeline: string | null;
  qualityCheckStatus: QualityStatus | null;
  qualityCheckResult: string | null;
  dateChangeReason: string | null;
  remarks: string | null;
  createdByName: string;
  createdAt: string;
};

export type QcUpdateInput = {
  qcStatus: 'ONGOING' | 'WAITING' | 'ON_HOLD' | 'READY';
  sourcingStatus: SourcingStatus | null;
  expectedReadyDate: string | null;
  processingTimeline: string | null;
  qualityCheckStatus: QualityStatus | null;
  qualityCheckResult: string | null;
  dateChangeReason: string | null;
  remarks: string | null;
};

export function useQcQueue() {
  return useQuery({
    queryKey: ['qc', 'queue'],
    queryFn: () => api<{ active: QcQueueRow[]; sentToPackaging: QcQueueRow[] }>('/qc/queue'),
    refetchInterval: 60_000,
  });
}

export function useSaveQcUpdate(orderId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: QcUpdateInput) => api(`/qc/orders/${orderId}/updates`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qc'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });
}
