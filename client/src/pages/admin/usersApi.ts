import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type ManagedUser = {
  id: number;
  name: string;
  email: string;
  /** Role code, e.g. SALES or CUSTOM_7. */
  role: string;
  roleName: string;
  /** Per-user exception: may see pricing even though the role doesn't allow it. */
  canViewPricing: boolean;
  /** The role itself already allows pricing. */
  roleSeesPricing: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type UserInput = {
  name: string;
  email: string;
  role: string;
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['roles'] }); // user counts per role
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Omit<UserInput, 'password'> & { isActive: boolean }> & { id: number }) =>
      api<{ user: ManagedUser }>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['roles'] });
      qc.invalidateQueries({ queryKey: ['auth', 'me'] }); // editing yourself updates the top bar name
    },
  });
}

/** Works only for users with no recorded work; others get a 409 telling the admin to deactivate instead. */
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['roles'] }); // user counts per role
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      api(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),
  });
}
