import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Role } from '../../auth/roles';

export type ManagedUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  canViewPricing: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type UserInput = {
  name: string;
  email: string;
  role: Role;
  canViewPricing: boolean;
  password?: string;
};

const KEY = ['users'] as const;

export function useUsers() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => (await api<{ users: ManagedUser[] }>('/users')).users,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UserInput) => api<{ user: ManagedUser }>('/users', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Omit<ManagedUser, 'id'>> & { id: number }) =>
      api<{ user: ManagedUser }>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['auth', 'me'] }); // editing yourself updates the top bar name
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      api(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),
  });
}
