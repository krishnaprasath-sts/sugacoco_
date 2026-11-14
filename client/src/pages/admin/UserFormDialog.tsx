import { useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { useRoles } from './rolesApi';
import { fieldErrors, formError } from '../../lib/formErrors';
import PasswordField from '../../components/PasswordField';
import { useCreateUser, useUpdateUser, type ManagedUser } from './usersApi';

type Props = {
  /** Existing user to edit, or null to add a new one. */
  user: ManagedUser | null;
  isSelf: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
};

export default function UserFormDialog({ user, isSelf, onClose, onSaved }: Props) {
  const isEdit = !!user;
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<string>(user?.role ?? '');
  const [password, setPassword] = useState('');
  const [canViewPricing, setCanViewPricing] = useState(user?.canViewPricing ?? false);

  const { data: roleData, isPending: rolesLoading } = useRoles();
  const roles = roleData?.roles ?? [];
  const chosen = roles.find((r) => r.code === role);
  // The per-user pricing switch only matters when the role itself hides pricing.
  const isRestricted = !!chosen && !chosen.permissions.includes('pricing.view');
  const create = useCreateUser();
  const update = useUpdateUser();
  const mutation = isEdit ? update : create;
  const errors = fieldErrors(mutation.error);
  const general = formError(mutation.error);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = { name, email, role, canViewPricing: isRestricted && canViewPricing };
    if (isEdit) {
      update.mutate({ id: user.id, ...body }, { onSuccess: () => onSaved(`${name} updated`) });
    } else {
      create.mutate({ ...body, password }, { onSuccess: () => onSaved(`${name} added`) });
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" slotProps={{ paper: { component: 'form', onSubmit, noValidate: true } as object }}>
      <DialogTitle>{isEdit ? 'Edit user' : 'Add user'}</DialogTitle>
      <DialogContent>
        {general && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert">
            {general}
          </Alert>
        )}
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            label="Full name"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
          />
          <TextField
            label="Email"
            type="email"
            required
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={!!errors.email}
            helperText={errors.email ?? 'Used to sign in'}
          />
          <TextField
            select
            label="Role"
            required
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={isSelf}
            error={!!errors.role}
            helperText={errors.role ?? (isSelf ? 'You cannot change your own role' : undefined)}
            slotProps={{
              select: {
                renderValue: (v) =>
                  v ? (chosen?.name ?? user?.roleName ?? String(v)) : <Box component="span" sx={{ color: 'text.disabled' }}>{rolesLoading ? 'Loading roles…' : 'Choose a role'}</Box>,
              },
            }}
          >
            {roles.map((r) => (
              <MenuItem key={r.code} value={r.code} sx={{ display: 'block', whiteSpace: 'normal' }}>
                <Box sx={{ fontWeight: 500 }}>{r.name}</Box>
                {r.description && <Box sx={{ fontSize: 12, color: 'text.secondary' }}>{r.description}</Box>}
              </MenuItem>
            ))}
          </TextField>
          {!isEdit && (
            <PasswordField
              label="Temporary password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={!!errors.password}
              helperText={errors.password ?? 'At least 8 characters, with a letter and a number'}
            />
          )}
          {isRestricted && (
            <FormControlLabel
              control={<Switch checked={canViewPricing} onChange={(e) => setCanViewPricing(e.target.checked)} />}
              label={`Allow this user to see pricing and payments (the ${chosen?.name} role does not include it)`}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button type="submit" variant="contained" loading={mutation.isPending}>
          {isEdit ? 'Save changes' : 'Add user'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
