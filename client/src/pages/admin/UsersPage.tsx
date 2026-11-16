import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import PersonAddAlt1Outlined from '@mui/icons-material/PersonAddAlt1Outlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import LockResetOutlined from '@mui/icons-material/LockResetOutlined';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import { useMe } from '../../auth/useAuth';
import { formError } from '../../lib/formErrors';
import { formatDateTime } from '../../lib/format';
import PageHeader from '../../components/PageHeader';
import { useConfirm, useToast } from '../../components/useToast';
import { useDeleteUser, useUpdateUser, useUsers, type ManagedUser } from './usersApi';
import UserFormDialog from './UserFormDialog';
import ResetPasswordDialog from './ResetPasswordDialog';

type DialogState = { kind: 'add' } | { kind: 'edit'; user: ManagedUser } | { kind: 'reset'; user: ManagedUser } | null;

const formatDate = (value: string | null) => formatDateTime(value, 'Never');

function UserIdentity({ user, isSelf }: { user: ManagedUser; isSelf: boolean }) {
  return (
    <>
      <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
        {user.name}
        {isSelf && (
          <Typography component="span" sx={{ color: 'text.secondary', fontWeight: 400, fontSize: 13 }}>
            {' '}
            (you)
          </Typography>
        )}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
        {user.email}
      </Typography>
    </>
  );
}

function RoleChips({ user }: { user: ManagedUser }) {
  return (
    <>
      <Chip label={user.roleName} size="small" variant="outlined" />
      {!user.roleSeesPricing && user.canViewPricing && (
        <Chip label="Can see pricing" size="small" color="warning" variant="outlined" />
      )}
    </>
  );
}

function ActiveSwitch(props: { user: ManagedUser; isSelf: boolean; disabled: boolean; onToggle: (u: ManagedUser) => void }) {
  const { user, isSelf, disabled, onToggle } = props;
  return (
    <Stack direction="row" sx={{ alignItems: 'center' }}>
      <Tooltip title={isSelf ? 'You cannot deactivate your own account' : ''}>
        <span>
          <Switch
            checked={user.isActive}
            disabled={isSelf || disabled}
            onChange={() => onToggle(user)}
            slotProps={{ input: { 'aria-label': `${user.isActive ? 'Deactivate' : 'Activate'} ${user.name}` } }}
          />
        </span>
      </Tooltip>
      <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
        {user.isActive ? 'Active' : 'Inactive'}
      </Typography>
    </Stack>
  );
}

function RowActions(props: { user: ManagedUser; isSelf: boolean; onEdit: () => void; onReset: () => void; onDelete: () => void }) {
  const { user, isSelf, onEdit, onReset, onDelete } = props;
  return (
    <Box sx={{ whiteSpace: 'nowrap' }}>
      <Tooltip title="Edit">
        <IconButton
          aria-label={`Edit ${user.name}`}
          onClick={onEdit}
          sx={{
            bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(37, 99, 235, 0.20)' : '#E8F0FE',
            color: (t) => t.palette.mode === 'dark' ? '#93C5FD' : '#2563EB',
            mr: 1,
            '&:hover': { bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(37, 99, 235, 0.32)' : '#D6E4FD' },
          }}
        >
          <EditOutlined />
        </IconButton>
      </Tooltip>
      <Tooltip title="Reset password">
        <IconButton
          aria-label={`Reset password for ${user.name}`}
          onClick={onReset}
          sx={{
            bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(245, 158, 11, 0.20)' : '#FEF3C7',
            color: (t) => t.palette.mode === 'dark' ? '#FCD34D' : '#B45309',
            mr: 1,
            '&:hover': { bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(245, 158, 11, 0.32)' : '#FDE8A8' },
          }}
        >
          <LockResetOutlined />
        </IconButton>
      </Tooltip>
      <Tooltip title={isSelf ? 'You cannot delete your own account' : 'Delete'}>
        <span>
          <IconButton
            aria-label={`Delete ${user.name}`}
            onClick={onDelete}
            disabled={isSelf}
            sx={{
              bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(220, 38, 38, 0.20)' : '#FDECEC',
              color: (t) => t.palette.mode === 'dark' ? '#FCA5A5' : '#DC2626',
              '&:hover': { bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(220, 38, 38, 0.32)' : '#FBDADA' },
              '&.Mui-disabled': { bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#F3F4F6' },
            }}
          >
            <DeleteOutlineOutlined />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}

export default function UsersPage() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { data: me } = useMe();
  const { data: users, isPending, error } = useUsers();
  const update = useUpdateUser();
  const remove = useDeleteUser();
  const [dialog, setDialog] = useState<DialogState>(null);
  const toast = useToast();
  const confirm = useConfirm();

  function saved(message: string) {
    setDialog(null);
    toast(message);
  }

  async function deleteUser(user: ManagedUser) {
    const ok = await confirm({
      title: `Delete ${user.name}?`,
      message: `${user.email} will be removed for good. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    remove.mutate(user.id, {
      onSuccess: () => toast(`${user.name} deleted`),
      onError: (err) => toast(formError(err) ?? 'Could not delete user', 'error'),
    });
  }

  async function toggleActive(user: ManagedUser) {
    if (user.isActive) {
      const ok = await confirm({
        title: `Deactivate ${user.name}?`,
        message: 'They are signed out at once and cannot log in until activated again.',
        confirmLabel: 'Deactivate',
        danger: true,
      });
      if (!ok) return;
    }
    update.mutate(
      { id: user.id, isActive: !user.isActive },
      {
        onSuccess: () => toast(`${user.name} ${user.isActive ? 'deactivated' : 'activated'}`),
        onError: (err) => toast(formError(err) ?? 'Could not update user', 'error'),
      },
    );
  }

  return (
    <Box>
      <PageHeader
        overline="Administration"
        title="Manage Users"
        subtitle="Add staff, choose their role, and reset passwords. What each role can do is set under Roles & Permissions."
        actions={
          <Button variant="contained" startIcon={<PersonAddAlt1Outlined />} onClick={() => setDialog({ kind: 'add' })} fullWidth={!isDesktop}>
            Add user
          </Button>
        }
      />

      {error && <Alert severity="error">{formError(error)}</Alert>}

      {!isDesktop && (
        <Stack spacing={1.5}>
          {isPending && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rounded" height={120} />)}
          {users?.map((u) => {
            const isSelf = u.id === me?.id;
            return (
              <Card key={u.id} sx={{ p: 2, opacity: u.isActive ? 1 : 0.6 }}>
                <UserIdentity user={u} isSelf={isSelf} />
                <Stack direction="row" spacing={0.75} sx={{ mt: 1.25, flexWrap: 'wrap', alignItems: 'center' }}>
                  <RoleChips user={u} />
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                  Last sign-in: {formatDate(u.lastLoginAt)}
                </Typography>
                <Stack direction="row" sx={{ mt: 1, alignItems: 'center', justifyContent: 'space-between' }}>
                  <ActiveSwitch user={u} isSelf={isSelf} disabled={update.isPending} onToggle={toggleActive} />
                  <RowActions user={u} isSelf={isSelf} onEdit={() => setDialog({ kind: 'edit', user: u })} onReset={() => setDialog({ kind: 'reset', user: u })} onDelete={() => deleteUser(u)} />
                </Stack>
              </Card>
            );
          })}
        </Stack>
      )}

      <Card sx={{ display: isDesktop ? 'block' : 'none' }}>
        <TableContainer>
          <Table sx={{ minWidth: 760 }} aria-label="Users">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Last sign-in</TableCell>
                <TableCell>Active</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isPending &&
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              {users?.map((u) => {
                const isSelf = u.id === me?.id;
                return (
                  <TableRow key={u.id} hover sx={{ opacity: u.isActive ? 1 : 0.6 }}>
                    <TableCell>
                      <UserIdentity user={u} isSelf={isSelf} />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <RoleChips user={u} />
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{formatDate(u.lastLoginAt)}</TableCell>
                    <TableCell>
                      <ActiveSwitch user={u} isSelf={isSelf} disabled={update.isPending} onToggle={toggleActive} />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <RowActions user={u} isSelf={isSelf} onEdit={() => setDialog({ kind: 'edit', user: u })} onReset={() => setDialog({ kind: 'reset', user: u })} onDelete={() => deleteUser(u)} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {(dialog?.kind === 'add' || dialog?.kind === 'edit') && (
        <UserFormDialog
          user={dialog.kind === 'edit' ? dialog.user : null}
          isSelf={dialog.kind === 'edit' && dialog.user.id === me?.id}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {dialog?.kind === 'reset' && (
        <ResetPasswordDialog user={dialog.user} onClose={() => setDialog(null)} onSaved={saved} />
      )}
    </Box>
  );
}
