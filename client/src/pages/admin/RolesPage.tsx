import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddCircleOutline from '@mui/icons-material/AddCircleOutlineOutlined';
import CheckRounded from '@mui/icons-material/CheckRounded';
import DeleteOutline from '@mui/icons-material/DeleteOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import PageHeader from '../../components/PageHeader';
import ErrorState from '../../components/ErrorState';
import { useConfirm, useToast } from '../../components/useToast';
import { useMe } from '../../auth/useAuth';
import type { Permission } from '../../auth/roles';
import { fieldErrors, formError } from '../../lib/formErrors';
import { BRAND } from '../../theme';
import {
  useCreateRole,
  useDeleteRole,
  useRoles,
  useUpdateRole,
  withRequired,
  type ManagedRole,
  type PermissionGroup,
  type RolesResponse,
} from './rolesApi';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** MD/Admin decides what each role can open and do. Changes apply to everyone with the role on their next click. */
export default function RolesPage() {
  const { data, isPending, error, refetch } = useRoles();
  const [tab, setTab] = useState<'edit' | 'compare'>('edit');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [newRole, setNewRole] = useState<{ copyFrom: ManagedRole | null } | null>(null);
  const confirm = useConfirm();

  const roles = data?.roles ?? [];
  const selected = roles.find((r) => r.id === selectedId) ?? roles[0];

  async function select(id: number) {
    if (id === selected?.id) return;
    if (dirty && !(await confirm({ title: 'Discard unsaved changes?', message: 'You changed this role but did not save.', confirmLabel: 'Discard', danger: true }))) return;
    setDirty(false);
    setSelectedId(id);
    setTab('edit');
  }

  return (
    <Box>
      <PageHeader
        overline="Administration"
        title="Roles & Permissions"
        subtitle="Choose what each role can open and do. Changes apply at once to everyone with that role."
        actions={
          <Button variant="contained" startIcon={<AddCircleOutline />} onClick={() => setNewRole({ copyFrom: null })} disabled={!data}>
            New role
          </Button>
        }
      />

      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }} aria-label="Roles view">
        <Tab value="edit" label="Edit roles" />
        <Tab value="compare" label="Compare all roles" />
      </Tabs>

      {isPending && <Skeleton variant="rounded" height={420} />}

      {data && tab === 'compare' && <CompareTable data={data} onPick={select} />}

      {data && tab === 'edit' && selected && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            alignItems: 'start',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '280px minmax(0, 1fr)' },
          }}
        >
          <RoleList roles={roles} selectedId={selected.id} onSelect={select} />
          <RoleEditor
            key={selected.id}
            role={selected}
            data={data}
            onDirtyChange={setDirty}
            onCopy={() => setNewRole({ copyFrom: selected })}
            onDeleted={() => {
              setDirty(false);
              setSelectedId(null);
            }}
          />
        </Box>
      )}

      {newRole && data && (
        <NewRoleDialog
          data={data}
          copyFrom={newRole.copyFrom}
          onClose={() => setNewRole(null)}
          onCreated={(role) => {
            setNewRole(null);
            setDirty(false);
            setSelectedId(role.id);
            setTab('edit');
          }}
        />
      )}
    </Box>
  );
}

// ───────────── Role list ─────────────

function RoleList({ roles, selectedId, onSelect }: { roles: ManagedRole[]; selectedId: number; onSelect: (id: number) => void }) {
  return (
    <>
      {/* Phones: a picker instead of a long list above the editor. */}
      <TextField
        select
        label="Role"
        value={selectedId}
        onChange={(e) => onSelect(Number(e.target.value))}
        sx={{ display: { md: 'none' } }}
      >
        {roles.map((r) => (
          <MenuItem key={r.id} value={r.id}>
            {r.name} · {plural(r.activeUserCount, 'user')}
          </MenuItem>
        ))}
      </TextField>

      <Card sx={{ display: { xs: 'none', md: 'block' } }}>
        <List aria-label="Roles" sx={{ p: 1 }}>
          {roles.map((r) => (
            <ListItemButton
              key={r.id}
              selected={r.id === selectedId}
              onClick={() => onSelect(r.id)}
              sx={{
                borderRadius: '12px',
                mb: 0.5,
                '&.Mui-selected': { bgcolor: '#F3ECF7', boxShadow: `inset 3px 0 0 ${BRAND.plum}` },
                '&.Mui-selected:hover': { bgcolor: '#EDE3F3' },
              }}
            >
              <ListItemText
                primary={
                  <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                    <Box component="span" sx={{ fontWeight: 600, fontSize: 13.5 }}>
                      {r.name}
                    </Box>
                    {!r.isSystem && <Chip label="Custom" size="small" sx={{ height: 20, fontSize: 11 }} />}
                  </Stack>
                }
                secondary={`${plural(r.activeUserCount, 'active user')} · ${plural(r.permissions.length, 'permission')}`}
              />
            </ListItemButton>
          ))}
        </List>
      </Card>
    </>
  );
}

// ───────────── Editor ─────────────

type EditorProps = {
  role: ManagedRole;
  data: RolesResponse;
  onDirtyChange: (dirty: boolean) => void;
  onCopy: () => void;
  onDeleted: () => void;
};

function RoleEditor({ role, data, onDirtyChange, onCopy, onDeleted }: EditorProps) {
  const { data: me } = useMe();
  const toast = useToast();
  const confirm = useConfirm();
  const update = useUpdateRole();
  const remove = useDeleteRole();
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? '');
  const [chosen, setChosen] = useState<Set<Permission>>(() => new Set(role.permissions));

  const isAdminRole = role.code === data.adminRoleCode;
  const isOwnRole = me?.role === role.code;
  const effective = useMemo(() => {
    const set = withRequired(chosen, data.groups);
    if (isAdminRole) data.adminLocked.forEach((p) => set.add(p));
    return set;
  }, [chosen, data, isAdminRole]);

  // Which ticked permissions force this one on, e.g. "See prices" is needed by "Verify payments".
  const neededBy = useMemo(() => {
    const out = new Map<Permission, string[]>();
    for (const p of data.groups.flatMap((g) => g.permissions)) {
      if (!effective.has(p.key)) continue;
      p.requires?.forEach((r) => out.set(r, [...(out.get(r) ?? []), p.label]));
    }
    return out;
  }, [effective, data.groups]);

  const sameSet = (a: Set<Permission>, b: Permission[]) => a.size === b.length && b.every((p) => a.has(p));
  const isDirty = name.trim() !== role.name || (description.trim() || null) !== role.description || !sameSet(effective, role.permissions);
  // Tell the page so switching roles can warn about unsaved changes.
  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);

  const errors = fieldErrors(update.error);
  const general = formError(update.error);

  function toggle(p: Permission) {
    setChosen((prev) => {
      // Permissions forced on by another one are disabled, so only the user's own picks change here.
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  function reset() {
    setName(role.name);
    setDescription(role.description ?? '');
    setChosen(new Set(role.permissions));
    update.reset();
  }

  function save(e: FormEvent) {
    e.preventDefault();
    update.mutate(
      { id: role.id, name: name.trim(), description: description.trim() || null, permissions: [...effective] },
      {
        onSuccess: ({ role: saved }) => {
          setChosen(new Set(saved.permissions));
          toast(`${saved.name} saved. ${plural(saved.activeUserCount, 'user')} affected.`);
        },
      },
    );
  }

  async function onDelete() {
    if (!(await confirm({ title: `Delete the ${role.name} role?`, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true }))) return;
    remove.mutate(role.id, {
      onSuccess: () => {
        toast(`${role.name} deleted`);
        onDeleted();
      },
      onError: (err) => toast(formError(err) ?? 'Could not delete the role', 'error'),
    });
  }

  const bothSidesOfPayment = effective.has('payments.record') && effective.has('payments.verify');
  const noScreens = effective.size === 0 || [...effective].every((p) => p === 'pricing.view' || p === 'tracking.manage');

  return (
    <Card component="form" onSubmit={save} noValidate>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
          <Typography variant="h6" component="h2" sx={{ mr: 'auto' }}>
            {role.name}
          </Typography>
          <Chip label={role.isSystem ? 'Built-in' : 'Custom'} size="small" variant="outlined" />
          <Chip label={plural(role.activeUserCount, 'active user')} size="small" variant="outlined" />
        </Stack>

        {general && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert">
            {general}
          </Alert>
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2.5 }}>
          <TextField
            label="Role name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            sx={{ flex: 1 }}
            slotProps={{ htmlInput: { maxLength: 60 } }}
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            helperText={errors.description ?? 'Shown when choosing a role for a user'}
            error={!!errors.description}
            sx={{ flex: 2 }}
            slotProps={{ htmlInput: { maxLength: 255 } }}
          />
        </Stack>

        <Stack spacing={1} sx={{ mb: 2 }}>
          {bothSidesOfPayment && (
            <Alert severity="warning">
              This role can both record and verify payments. The same person could approve their own entry. Keep these in
              separate roles unless that is intended.
            </Alert>
          )}
          {noScreens && <Alert severity="info">With these permissions the role has no screens. Users will see a "No screens yet" page.</Alert>}
          {!effective.has('pricing.view') && (
            <Alert severity="info">
              Prices and payments are hidden from this role. You can still allow single users on the Users page.
            </Alert>
          )}
        </Stack>

        <Stack spacing={2.5}>
          {data.groups.map((group) => (
            <PermissionGroupBlock
              key={group.title}
              group={group}
              effective={effective}
              lockReason={(key) =>
                isAdminRole && data.adminLocked.includes(key)
                  ? 'Always on for MD / Admin, so someone can always manage users and roles'
                  : isOwnRole && key === 'roles.manage' && role.permissions.includes('roles.manage')
                    ? 'You cannot remove this from your own role'
                    : neededBy.get(key)
                      ? `Needed for: ${neededBy.get(key)!.join(', ')}`
                      : null
              }
              onToggle={toggle}
            />
          ))}
        </Stack>
      </CardContent>

      <Divider />
      <Stack
        direction={{ xs: 'column-reverse', sm: 'row' }}
        spacing={1}
        sx={{
          p: 2,
          px: { md: 3 },
          alignItems: { sm: 'center' },
          position: 'sticky',
          bottom: 0,
          bgcolor: 'background.paper',
          borderBottomLeftRadius: '24px',
          borderBottomRightRadius: '24px',
          zIndex: 1,
        }}
      >
        {!role.isSystem && (
          <Tooltip title={role.userCount ? 'Move its users to another role first' : ''}>
            <span>
              <Button
                color="error"
                variant="outlined"
                startIcon={<DeleteOutline />}
                onClick={onDelete}
                disabled={role.userCount > 0}
                loading={remove.isPending}
                fullWidth
              >
                Delete role
              </Button>
            </span>
          </Tooltip>
        )}
        <Button color="inherit" startIcon={<ContentCopyOutlined />} onClick={onCopy}>
          Copy as new role
        </Button>
        <Box sx={{ flex: 1, display: { xs: 'none', sm: 'block' } }} />
        <Button color="inherit" onClick={reset} disabled={!isDirty || update.isPending}>
          Discard changes
        </Button>
        <Button type="submit" variant="contained" disabled={!isDirty} loading={update.isPending}>
          Save changes
        </Button>
      </Stack>
    </Card>
  );
}

function PermissionGroupBlock(props: {
  group: PermissionGroup;
  effective: Set<Permission>;
  lockReason: (key: Permission) => string | null;
  onToggle: (key: Permission) => void;
}) {
  const { group, effective, lockReason, onToggle } = props;
  const on = group.permissions.filter((p) => effective.has(p.key)).length;
  return (
    <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
      <Stack direction="row" sx={{ alignItems: 'baseline', mb: 0.75 }}>
        <Typography
          component="legend"
          sx={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: BRAND.plum }}
        >
          {group.title}
        </Typography>
        <Typography sx={{ ml: 1, fontSize: 12, color: 'text.secondary' }}>
          {on} of {group.permissions.length}
        </Typography>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gap: 1,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' },
        }}
      >
        {group.permissions.map((p) => {
          const checked = effective.has(p.key);
          const reason = checked ? lockReason(p.key) : null;
          const id = `perm-${p.key}`;
          return (
            <Box
              key={p.key}
              component="label"
              htmlFor={id}
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'flex-start',
                p: 1.25,
                pr: 1.5,
                borderRadius: '14px',
                border: '1px solid',
                borderColor: checked ? '#D9C4E4' : '#ECE8F1',
                bgcolor: checked ? '#FAF5FC' : 'background.paper',
                cursor: reason ? 'default' : 'pointer',
                transition: 'background-color 150ms, border-color 150ms',
                '&:hover': reason ? undefined : { borderColor: '#CDB3DB' },
              }}
            >
              <Checkbox
                id={id}
                checked={checked}
                disabled={!!reason}
                onChange={() => onToggle(p.key)}
                sx={{ p: 0.75, mt: -0.25 }}
                slotProps={{ input: { 'aria-describedby': `${id}-desc` } }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 13.5 }}>{p.label}</Typography>
                <Typography id={`${id}-desc`} variant="body2" sx={{ color: 'text.secondary', fontSize: 12.5 }}>
                  {p.description}
                </Typography>
                {reason && (
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mt: 0.5, color: 'text.secondary' }}>
                    <LockOutlined sx={{ fontSize: 14 }} aria-hidden />
                    <Typography sx={{ fontSize: 12 }}>{reason}</Typography>
                  </Stack>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ───────────── Compare table ─────────────

function CompareTable({ data, onPick }: { data: RolesResponse; onPick: (id: number) => void }) {
  return (
    <Card>
      <TableContainer sx={{ maxHeight: '70vh' }}>
        <Table stickyHeader size="small" aria-label="Permissions by role" sx={{ minWidth: 640 + data.roles.length * 40 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 220, position: 'sticky', left: 0, zIndex: 3 }}>Permission</TableCell>
              {data.roles.map((r) => (
                <TableCell key={r.id} align="center" sx={{ minWidth: 96 }}>
                  <Button
                    size="small"
                    onClick={() => onPick(r.id)}
                    sx={{ color: 'inherit', fontWeight: 700, minHeight: 32, px: 1, lineHeight: 1.2, textTransform: 'none' }}
                    aria-label={`Edit ${r.name}`}
                  >
                    {r.name}
                  </Button>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.groups.map((g) => [
              <TableRow key={g.title}>
                <TableCell
                  colSpan={data.roles.length + 1}
                  sx={{ bgcolor: '#F7F3FA', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: BRAND.plum }}
                >
                  {g.title}
                </TableCell>
              </TableRow>,
              ...g.permissions.map((p) => (
                <TableRow key={p.key} hover>
                  <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1 }}>{p.label}</TableCell>
                  {data.roles.map((r) => {
                    const has = r.permissions.includes(p.key);
                    return (
                      <TableCell key={r.id} align="center">
                        {has ? (
                          <CheckRounded sx={{ color: 'success.main', fontSize: 20, verticalAlign: 'middle' }} aria-label="Yes" />
                        ) : (
                          <Box component="span" sx={{ color: 'text.disabled' }} aria-label="No">
                            –
                          </Box>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              )),
            ])}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

// ───────────── New role ─────────────

function NewRoleDialog(props: { data: RolesResponse; copyFrom: ManagedRole | null; onClose: () => void; onCreated: (r: ManagedRole) => void }) {
  const { data, copyFrom, onClose, onCreated } = props;
  const create = useCreateRole();
  const toast = useToast();
  const [name, setName] = useState(copyFrom ? `${copyFrom.name} (copy)` : '');
  const [description, setDescription] = useState(copyFrom?.description ?? '');
  const [startFrom, setStartFrom] = useState<number | ''>(copyFrom?.id ?? '');
  const errors = fieldErrors(create.error);
  const general = formError(create.error);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const base = data.roles.find((r) => r.id === startFrom);
    // The Admin role's locked permissions are not copied into a custom role.
    const permissions = (base?.permissions ?? []).filter((p) => !(base?.code === data.adminRoleCode && data.adminLocked.includes(p)));
    create.mutate(
      { name: name.trim(), description: description.trim() || null, permissions },
      {
        onSuccess: ({ role }) => {
          toast(`${role.name} created. Tick its permissions, then add users to it.`);
          onCreated(role);
        },
      },
    );
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" slotProps={{ paper: { component: 'form', onSubmit, noValidate: true } as object }}>
      <DialogTitle>New role</DialogTitle>
      <DialogContent>
        {general && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert">
            {general}
          </Alert>
        )}
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            label="Role name"
            required
            autoFocus
            placeholder="e.g. Sales Manager"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            slotProps={{ htmlInput: { maxLength: 60 } }}
          />
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            helperText="Optional. Shown when choosing a role for a user."
            slotProps={{ htmlInput: { maxLength: 255 } }}
          />
          <TextField
            select
            label="Start with permissions of"
            value={startFrom}
            onChange={(e) => setStartFrom(e.target.value === '' ? '' : Number(e.target.value))}
            helperText="You can change every permission after creating the role."
          >
            <MenuItem value="">No permissions (start empty)</MenuItem>
            {data.roles.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {r.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button type="submit" variant="contained" loading={create.isPending}>
          Create role
        </Button>
      </DialogActions>
    </Dialog>
  );
}
