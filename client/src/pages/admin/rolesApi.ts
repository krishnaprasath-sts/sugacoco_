import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Permission } from '../../auth/roles';

export type PermissionDef = { key: Permission; label: string; description: string; requires?: Permission[] };
export type PermissionGroup = { title: string; permissions: PermissionDef[] };

export type ManagedRole = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  /** Built-in roles can't be deleted. */
  isSystem: boolean;
  permissions: Permission[];
  userCount: number;
  activeUserCount: number;
};

export type RolesResponse = {
  roles: ManagedRole[];
  groups: PermissionGroup[];
  /** Permissions the built-in MD/Admin role always keeps. */
  adminLocked: Permission[];
  adminRoleCode: string;
};

export type RoleInput = { name: string; description: string | null; permissions: Permission[] };

const KEY = ['roles'] as const;

export function useRoles() {
  return useQuery({ queryKey: KEY, queryFn: () => api<RolesResponse>('/roles') });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ['users'] }); // role names and pricing flags show on the users list
    qc.invalidateQueries({ queryKey: ['auth', 'me'] }); // editing your own role changes your menu
  };
}

export function useCreateRole() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: RoleInput) => api<{ role: ManagedRole }>('/roles', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
}

export function useUpdateRole() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<RoleInput> & { id: number }) =>
      api<{ role: ManagedRole }>(`/roles/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: invalidate,
  });
}

export function useDeleteRole() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api(`/roles/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

/** Adds what each permission needs (e.g. Verify payments needs See prices). Same rule as the server. */
export function withRequired(chosen: Iterable<Permission>, groups: PermissionGroup[]): Set<Permission> {
  const set = new Set(chosen);
  for (const p of groups.flatMap((g) => g.permissions)) {
    if (set.has(p.key)) p.requires?.forEach((r) => set.add(r));
  }
  return set;
}
