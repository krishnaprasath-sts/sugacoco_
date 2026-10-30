import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export type Notification = {
  id: number;
  orderId: number | null;
  title: string;
  message: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export const useNotifications = () =>
  useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<{ notifications: Notification[]; unread: number }>('/notifications'),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | 'all') => api(id === 'all' ? '/notifications/read-all' : `/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

/** Delete one notification, or all of them with 'all'. Removes it from the list right away. */
export function useDismissNotification() {
  const qc = useQueryClient();
  type Data = { notifications: Notification[]; unread: number };
  return useMutation({
    mutationFn: (id: number | 'all') => api(id === 'all' ? '/notifications' : `/notifications/${id}`, { method: 'DELETE' }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['notifications'] });
      const prev = qc.getQueryData<Data>(['notifications']);
      if (prev) {
        const left = id === 'all' ? [] : prev.notifications.filter((n) => n.id !== id);
        const removedUnread = prev.notifications.filter((n) => (id === 'all' || n.id === id) && !n.readAt).length;
        qc.setQueryData<Data>(['notifications'], { notifications: left, unread: Math.max(0, prev.unread - removedUnread) });
      }
      return { prev };
    },
    onError: (_e, _id, ctx) => ctx?.prev && qc.setQueryData(['notifications'], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export type MoneyFigure = { amount: string; count: number };
export type MoneySummary = Record<'receivedToday' | 'receivedMonth' | 'pendingAdvance' | 'pendingBalance' | 'outstanding' | 'balanceDue', MoneyFigure>;

export const useMoneySummary = () =>
  useQuery({
    queryKey: ['accounts', 'money-summary'],
    queryFn: () => api<MoneySummary>('/summary/money'),
    refetchInterval: 60_000,
  });
