import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  Skeleton,
  Snackbar,
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
import { useMe } from '../../auth/useAuth';
import { PRICE_RESTRICTED_ROLES, ROLE_LABEL } from '../../auth/roles';
import { formError } from '../../lib/formErrors';
import { formatDateTime } from '../../lib/format';
import PageHeader from '../../components/PageHeader';
import { useUpdateUser, useUsers, type ManagedUser } from './usersApi';
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
      <Chip label={ROLE_LABEL[user.role]} size="small" variant="outlined" />
      {PRICE_RESTRICTED_ROLES.includes(user.role) && user.canViewPricing && (
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

function RowActions({ user, onEdit, onReset }: { user: ManagedUser; onEdit: () => void; onReset: () => void }) {
  return (
    <Box sx={{ whiteSpace: 'nowrap' }}>
      <Tooltip title="Edit">
        <IconButton aria-label={`Edit ${user.name}`} onClick={onEdit} sx={{ bgcolor: "#E8F0FE", color: "#2563EB", mr: 1, "&:hover": { bgcolor: "#D6E4FD" } }}>
          <EditOutlined />
        </IconButton>
      </Tooltip>
      <Tooltip title="Reset password">
        <IconButton aria-label={`Reset password for ${user.name}`} onClick={onReset} sx={{ bgcolor: "#FDECEC", color: "#DC2626", "&:hover": { bgcolor: "#FBDADA" } }}>
          <LockResetOutlined />
        </IconButton>
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
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);

  function saved(message: string) {
    setDialog(null);
    setToast({ message });
  }

  function toggleActive(user: ManagedUser) {
    if (user.isActive && !window.confirm(`Deactivate ${user.name}? They are signed out at once and cannot log in until activated again.`)) return;
    update.mutate(
      { id: user.id, isActive: !user.isActive },
      {
        onSuccess: () => setToast({ message: `${user.name} ${user.isActive ? 'deactivated' : 'activated'}` }),
        onError: (err) => setToast({ message: formError(err) ?? 'Could not update user', error: true }),
      },
    );
  }

  return (
    <Box>
      <PageHeader
        overline="Administration"
        title="Manage Users"
        subtitle="Add staff, set their department, and reset passwords."
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
                  <RowActions user={u} onEdit={() => setDialog({ kind: 'edit', user: u })} onReset={() => setDialog({ kind: 'reset', user: u })} />
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
                      <RowActions user={u} onEdit={() => setDialog({ kind: 'edit', user: u })} onReset={() => setDialog({ kind: 'reset', user: u })} />
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

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast?.error ? 'error' : 'success'} variant="filled" onClose={() => setToast(null)}>
          {toast?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
