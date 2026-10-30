import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { OrderStatus } from '../workflow/statuses';

export type Customer = {
  id: number;
  companyName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  altPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  notes: string | null;
  createdAt: string;
  orderCount?: number;
  lastOrderDate?: string | null;
};
export type CustomerInput = Omit<Customer, 'id' | 'createdAt' | 'orderCount' | 'lastOrderDate'>;
export type Credit = { currency: string; available: string };

export function useCustomers(params: { q?: string; page?: number; pageSize?: number }) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  search.set('page', String(params.page ?? 1));
  search.set('pageSize', String(params.pageSize ?? 25));
  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => api<{ customers: Customer[]; total: number }>(`/customers?${search}`),
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: number | null | undefined) {
  return useQuery({
    queryKey: ['customer', id],
    enabled: !!id,
    queryFn: () =>
      api<{
        customer: Customer;
        credit: Credit[];
        orders: { id: number; orderNo: string; piNumber: string; piDate: string; currency: string; totalValue: string; status: OrderStatus }[];
      }>(`/customers/${id}`),
  });
}

export function useSaveCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<CustomerInput> & { id?: number }) =>
      api<{ customer: Customer }>(id ? `/customers/${id}` : '/customers', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: ({ customer }) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customer', customer.id] });
    },
  });
}
