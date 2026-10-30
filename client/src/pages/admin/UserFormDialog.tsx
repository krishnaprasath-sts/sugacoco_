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
import { PRICE_RESTRICTED_ROLES, ROLE_LABEL, type Role } from '../../auth/roles';
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
  const [role, setRole] = useState<Role | ''>(user?.role ?? '');
  const [password, setPassword] = useState('');
  const [canViewPricing, setCanViewPricing] = useState(user?.canViewPricing ?? false);

  const isRestricted = !!role && PRICE_RESTRICTED_ROLES.includes(role);
  const create = useCreateUser();
  const update = useUpdateUser();
  const mutation = isEdit ? update : create;
  const errors = fieldErrors(mutation.error);
  const general = formError(mutation.error);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = { name, email, role: role as Role, canViewPricing: isRestricted && canViewPricing };
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
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={isSelf}
            error={!!errors.role}
            helperText={errors.role ?? (isSelf ? 'You cannot change your own role' : undefined)}
            slotProps={{
              select: {
                renderValue: (v) => (v ? ROLE_LABEL[v as Role] : <Box component="span" sx={{ color: 'text.disabled' }}>Choose a role</Box>),
              },
            }}
          >
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <MenuItem key={r} value={r}>
                {ROLE_LABEL[r]}
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
              label={`Allow this ${ROLE_LABEL[role as Role]} user to see pricing and payments`}
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
