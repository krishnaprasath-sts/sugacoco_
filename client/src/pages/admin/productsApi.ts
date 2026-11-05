import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export const PRODUCT_UNITS = ['MT', 'KG', 'Bags', 'Cartons', 'Pcs', 'Litres'] as const;

export type Product = {
  id: number;
  name: string;
  defaultUnit: string;
  hsCode: string | null;
  description: string | null;
  isActive: boolean;
  orderCount: number;
  updatedAt: string;
};

export type ProductInput = { name: string; defaultUnit: string; hsCode: string | null; description: string | null };

// Also refreshes the order form's product list (['products', 'suggestions']).
const KEY = ['products'] as const;

export function useProducts() {
  return useQuery({
    queryKey: [...KEY, 'all'],
    queryFn: async () => (await api<{ products: Product[] }>('/products')).products,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProductInput) => api<{ product: Product }>('/products', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<ProductInput & { isActive: boolean }> & { id: number }) =>
      api<{ product: Product }>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
