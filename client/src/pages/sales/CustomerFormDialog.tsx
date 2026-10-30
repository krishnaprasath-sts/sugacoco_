import { useState, type FormEvent } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField, Typography } from '@mui/material';
import { useSaveCustomer, type Customer, type CustomerInput } from '../../api/customers';
import { fieldErrors, formError } from '../../lib/formErrors';

type Props = {
  customer?: Customer | null;
  /** Prefill the company name, e.g. from what was typed in the customer search. */
  initialName?: string;
  onClose: () => void;
  onSaved: (customer: Customer) => void;
};

const EMPTY: CustomerInput = {
  companyName: '',
  contactPerson: '',
  email: '',
  phone: '',
  altPhone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
  notes: '',
};

export default function CustomerFormDialog({ customer, initialName, onClose, onSaved }: Props) {
  const [values, setValues] = useState<CustomerInput>(() => {
    const base = { ...EMPTY, companyName: initialName ?? '' };
    if (!customer) return base;
    return Object.fromEntries(Object.keys(EMPTY).map((k) => [k, customer[k as keyof CustomerInput] ?? ''])) as CustomerInput;
  });
  const save = useSaveCustomer();
  const errors = fieldErrors(save.error);
  const general = formError(save.error);

  const field = (name: keyof CustomerInput, label: string, extra: Partial<React.ComponentProps<typeof TextField>> = {}) => (
    <TextField
      label={label}
      value={values[name] ?? ''}
      onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
      error={!!errors[name]}
      helperText={errors[name]}
      {...extra}
    />
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate({ ...values, id: customer?.id }, { onSuccess: ({ customer: c }) => onSaved(c) });
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" slotProps={{ paper: { component: 'form', onSubmit, noValidate: true } as object }}>
      <DialogTitle>{customer ? 'Edit customer' : 'New customer'}</DialogTitle>
      <DialogContent>
        {general && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {general}
          </Alert>
        )}
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid size={12}>{field('companyName', 'Company name', { required: true, autoFocus: true })}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{field('contactPerson', 'Contact person')}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{field('email', 'Email', { type: 'email' })}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{field('phone', 'Phone', { type: 'tel' })}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{field('altPhone', 'Alternate phone', { type: 'tel' })}</Grid>
          <Grid size={12}>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, mt: 1 }}>
              Address
            </Typography>
          </Grid>
          <Grid size={12}>{field('addressLine1', 'Address line 1')}</Grid>
          <Grid size={12}>{field('addressLine2', 'Address line 2')}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{field('city', 'City')}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{field('state', 'State / Province')}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{field('country', 'Country')}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{field('postalCode', 'Postal code')}</Grid>
          <Grid size={12}>{field('notes', 'Notes', { multiline: true, minRows: 2 })}</Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button type="submit" variant="contained" loading={save.isPending}>
          {customer ? 'Save changes' : 'Add customer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
