import { useState, type FormEvent } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material';
import { fieldErrors, formError } from '../../lib/formErrors';
import { PRODUCT_UNITS, useCreateProduct, useUpdateProduct, type Product } from './productsApi';

type Props = {
  /** Product to edit, or null to add a new one. */
  product: Product | null;
  onClose: () => void;
  onSaved: (message: string) => void;
};

export default function ProductFormDialog({ product, onClose, onSaved }: Props) {
  const isEdit = !!product;
  const [name, setName] = useState(product?.name ?? '');
  const [defaultUnit, setDefaultUnit] = useState(product?.defaultUnit ?? 'MT');
  const [hsCode, setHsCode] = useState(product?.hsCode ?? '');
  const [description, setDescription] = useState(product?.description ?? '');

  const create = useCreateProduct();
  const update = useUpdateProduct();
  const mutation = isEdit ? update : create;
  const errors = fieldErrors(mutation.error);
  const general = formError(mutation.error);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = { name, defaultUnit, hsCode: hsCode.trim() || null, description: description.trim() || null };
    if (isEdit) update.mutate({ id: product.id, ...body }, { onSuccess: () => onSaved(`${name.trim()} updated`) });
    else create.mutate(body, { onSuccess: () => onSaved(`${name.trim()} added`) });
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" slotProps={{ paper: { component: 'form', onSubmit, noValidate: true } as object }}>
      <DialogTitle>{isEdit ? 'Edit product' : 'Add product'}</DialogTitle>
      <DialogContent>
        {general && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert">
            {general}
          </Alert>
        )}
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            label="Product name"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={!!errors.name}
            helperText={errors.name ?? (isEdit && product.orderCount ? 'Old orders keep the name they were saved with' : 'Sales sees this name on the order form')}
          />
          <TextField
            select
            label="Default unit"
            value={defaultUnit}
            onChange={(e) => setDefaultUnit(e.target.value)}
            error={!!errors.defaultUnit}
            helperText={errors.defaultUnit ?? 'Filled in when Sales picks this product'}
          >
            {PRODUCT_UNITS.map((u) => (
              <MenuItem key={u} value={u}>
                {u}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="HS code" value={hsCode} onChange={(e) => setHsCode(e.target.value)} error={!!errors.hsCode} helperText={errors.hsCode ?? 'Optional'} />
          <TextField
            label="Notes"
            multiline
            minRows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={!!errors.description}
            helperText={errors.description ?? 'Optional'}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button type="submit" variant="contained" loading={mutation.isPending}>
          {isEdit ? 'Save changes' : 'Add product'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
