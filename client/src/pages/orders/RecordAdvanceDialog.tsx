import { useState, type FormEvent } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from '@mui/material';
import { uploadDocuments, type OrderDetail } from '../../api/orders';
import { useRecordPayment, useRefresh } from '../../api/stages';
import { fieldErrors, formError } from '../../lib/formErrors';
import { formatMoney } from '../../lib/format';
import { parseNum } from '../../lib/money';
import FilePicker from '../../components/FilePicker';
import { useToast } from '../../components/useToast';

type Props = { detail: OrderDetail; type?: 'ADVANCE' | 'BALANCE'; onClose: () => void };

/** Sales records a payment the customer reported (advance or balance), with the bank voucher if available. */
export default function RecordAdvanceDialog({ detail, type = 'ADVANCE', onClose }: Props) {
  const { order } = detail;
  const expected = type === 'ADVANCE' ? order.advanceAmount : order.balanceAmount;
  const [values, setValues] = useState({
    amount: expected ? String(Number(expected)) : '',
    paymentDate: new Date().toLocaleDateString('en-CA'),
    bankReference: '',
    payerBank: '',
    remarks: '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const record = useRecordPayment(order.id);
  const refresh = useRefresh(order.id);
  const toast = useToast();
  const errors = fieldErrors(record.error);
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [k]: e.target.value });
  const label = type === 'ADVANCE' ? 'advance' : 'balance';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const amount = parseNum(values.amount);
    let paymentId: number;
    try {
      ({ paymentId } = await record.mutateAsync({
        paymentType: type,
        amount: Number.isNaN(amount) ? (undefined as unknown as number) : amount,
        paymentDate: values.paymentDate || null,
        bankReference: values.bankReference.trim() || null,
        payerBank: values.payerBank.trim() || null,
        remarks: values.remarks.trim() || null,
      }));
    } catch {
      return;
    }
    if (files.length) {
      setUploading(true);
      try {
        await uploadDocuments(order.id, files, { category: type === 'ADVANCE' ? 'ADVANCE_VOUCHER' : 'BALANCE_VOUCHER', paymentId });
        refresh(); // show the voucher on the order straight away
      } catch (err) {
        toast(`Payment saved, but the voucher did not upload: ${(err as Error).message}`, 'warning');
        setUploading(false);
        onClose();
        return;
      }
      setUploading(false);
    }
    toast(`${type === 'ADVANCE' ? 'Advance' : 'Balance'} payment recorded for Accounts to verify`);
    onClose();
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" slotProps={{ paper: { component: 'form', onSubmit, noValidate: true } as object }}>
      <DialogTitle>Record {label} payment</DialogTitle>
      <DialogContent>
        {formError(record.error) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {formError(record.error)}
          </Alert>
        )}
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Amount received (₹)"
              required
              autoFocus
              value={values.amount}
              onChange={set('amount')}
              error={!!errors.amount}
              helperText={errors.amount ?? `Expected: ${formatMoney(expected, order.currency)}`}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Payment date" type="date" value={values.paymentDate} onChange={set('paymentDate')} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Bank reference / UTR / SWIFT" value={values.bankReference} onChange={set('bankReference')} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Customer's bank" value={values.payerBank} onChange={set('payerBank')} />
          </Grid>
          <Grid size={12}>
            <TextField label="Remarks" multiline minRows={2} value={values.remarks} onChange={set('remarks')} />
          </Grid>
          <Grid size={12}>
            <FilePicker label="Attach bank voucher" hint="Optional, can be added later" files={files} onChange={setFiles} onError={(m) => toast(m, 'error')} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button type="submit" variant="contained" loading={record.isPending || uploading}>
          Save payment
        </Button>
      </DialogActions>
    </Dialog>
  );
}
