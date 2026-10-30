import { useState, type FormEvent } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import PasswordField from '../../components/PasswordField';
import { fieldErrors, formError } from '../../lib/formErrors';
import { useResetPassword, type ManagedUser } from './usersApi';

type Props = { user: ManagedUser; onClose: () => void; onSaved: (message: string) => void };

export default function ResetPasswordDialog({ user, onClose, onSaved }: Props) {
  const [password, setPassword] = useState('');
  const reset = useResetPassword();
  const errors = fieldErrors(reset.error);
  const general = formError(reset.error);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    reset.mutate({ id: user.id, password }, { onSuccess: () => onSaved(`Password reset for ${user.name}`) });
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" slotProps={{ paper: { component: 'form', onSubmit, noValidate: true } as object }}>
      <DialogTitle>Reset password</DialogTitle>
      <DialogContent>
        <Typography sx={{ color: 'text.secondary', mb: 2.5 }}>
          Set a new password for <strong>{user.name}</strong>. They will be signed out on all devices and must use
          the new password.
        </Typography>
        {general && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert">
            {general}
          </Alert>
        )}
        <PasswordField
          label="New password"
          required
          autoFocus
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={!!errors.password}
          helperText={errors.password ?? 'At least 8 characters, with a letter and a number'}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button type="submit" variant="contained" loading={reset.isPending}>
          Reset password
        </Button>
      </DialogActions>
    </Dialog>
  );
}
