import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutlined';
import HighlightOff from '@mui/icons-material/HighlightOff';
import ReceiptOutlined from '@mui/icons-material/ReceiptOutlined';
import type { OrderDetail } from '../../api/orders';
import { useVerifyPayment } from '../../api/payments';
import { fieldErrors, formError } from '../../lib/formErrors';
import { formatDate, formatMoney } from '../../lib/format';
import { parseNum } from '../../lib/money';
import { useToast } from '../../components/useToast';

type Decision = 'APPROVED' | 'REJECTED';

/** Accounts checks the payment against the company bank statement, then approves or rejects. */
export default function VerifyPaymentCard({ detail }: { detail: OrderDetail }) {
  const { order, payments, documents, permissions } = detail;
  const payment = payments.find((p) => p.id === permissions.verifyPaymentId)!;
  const isAdvance = payment.paymentType === 'ADVANCE';
  const expected = isAdvance ? order.advanceAmount : order.balanceAmount;
  const voucherCategory = isAdvance ? 'ADVANCE_VOUCHER' : 'BALANCE_VOUCHER';
  const vouchers = documents.filter((d) => d.category === voucherCategory);
  const m = (v?: string | number | null) => formatMoney(v, order.currency);

  const [values, setValues] = useState({
    // Left empty on purpose: Accounts types what the bank statement shows.
    bankCreditDate: '',
    bankCreditReference: '',
    amountReceived: '',
    remarks: '',
  });
  const [confirm, setConfirm] = useState<Decision | null>(null);
  const verify = useVerifyPayment(order.id);
  const toast = useToast();
  const errors = fieldErrors(verify.error);
  const general = formError(verify.error);

  const received = parseNum(values.amountReceived);
  const due = Number(expected ?? 0);
  const differs = !Number.isNaN(received) && Math.abs(received - due) >= 0.005;
  const reportedDiffers = Math.abs(Number(payment.amount) - due) >= 0.005;
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [k]: e.target.value });
  const missingAmount = Number.isNaN(received);

  function submit(decision: Decision) {
    verify.mutate(
      {
        paymentId: payment.id,
        decision,
        bankCreditDate: values.bankCreditDate || null,
        bankCreditReference: values.bankCreditReference.trim() || null,
        amountReceived: Number.isNaN(received) ? null : received,
        remarks: values.remarks.trim() || null,
      },
      {
        onSuccess: () => {
          setConfirm(null);
          toast(decision === 'APPROVED' ? (isAdvance ? 'Advance approved. Order sent to QC.' : 'Balance approved.') : 'Payment rejected. Sales will follow up.', decision === 'APPROVED' ? 'success' : 'info');
        },
        onError: () => setConfirm(null),
      },
    );
  }

  return (
    <Card sx={{ border: '2px solid', borderColor: 'primary.main' }}>
      <CardContent>
        <Typography variant="subtitle1">Verify {isAdvance ? 'advance' : 'balance'} payment</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Check the company bank statement. Don't rely on the voucher alone.
        </Typography>

        <Box sx={{ bgcolor: 'background.default', borderRadius: '14px', p: 1.5, mb: 2 }}>
          <Stack spacing={0.75}>
            <Row label="Expected" value={m(expected)} />
            <Row label="Reported by Sales" value={reportedDiffers ? `${m(payment.amount)} (differs)` : m(payment.amount)} warn={reportedDiffers} />
            {payment.paymentDate && <Row label="Customer paid on" value={formatDate(payment.paymentDate)} />}
            {payment.bankReference && <Row label="Customer reference" value={payment.bankReference} />}
            {payment.payerBank && <Row label="Customer's bank" value={payment.payerBank} />}
          </Stack>
          {payment.remarks && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Sales note: {payment.remarks}
            </Typography>
          )}
        </Box>

        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Vouchers
        </Typography>
        {vouchers.length === 0 ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No voucher uploaded. You can still verify from the bank statement.
          </Alert>
        ) : (
          <Stack spacing={0.5} sx={{ mb: 2 }}>
            {vouchers.map((v) => (
              <Link key={v.id} href={`/api/documents/${v.id}/download?inline=1`} target="_blank" rel="noopener" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                <ReceiptOutlined fontSize="small" /> {v.originalName}
              </Link>
            ))}
          </Stack>
        )}

        {general && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {general}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid size={12}>
            <TextField
              label="Amount credited in bank (₹)"
              value={values.amountReceived}
              onChange={set('amountReceived')}
              error={!!errors.amountReceived}
              required
              helperText={
                errors.amountReceived ??
                (differs
                  ? `Differs from the amount due (${m(due)}) by ${m(Math.abs(received - due))}. Add remarks to approve.`
                  : 'Type the amount shown in the bank statement.')
              }
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            />
          </Grid>
          <Grid size={12}>
            <TextField label="Bank credit date" type="date" value={values.bankCreditDate} onChange={set('bankCreditDate')} slotProps={{ inputLabel: { shrink: true } }} error={!!errors.bankCreditDate} helperText={errors.bankCreditDate} />
          </Grid>
          <Grid size={12}>
            <TextField label="Bank statement ref." value={values.bankCreditReference} onChange={set('bankCreditReference')} />
          </Grid>
          <Grid size={12}>
            <TextField
              label="Remarks"
              multiline
              minRows={2}
              value={values.remarks}
              onChange={set('remarks')}
              error={!!errors.remarks}
              helperText={errors.remarks ?? 'Required when rejecting'}
            />
          </Grid>
        </Grid>

        <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<HighlightOff />}
            onClick={() => setConfirm('REJECTED')}
            disabled={verify.isPending}
            sx={{ flex: 1, minHeight: 38 }}
          >
            Reject
          </Button>
          <Button variant="contained" startIcon={<CheckCircleOutline />} onClick={() => setConfirm('APPROVED')} disabled={missingAmount || verify.isPending} sx={{ flex: 1, minHeight: 38 }}>
            Approve
          </Button>
        </Stack>
      </CardContent>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{confirm === 'APPROVED' ? 'Approve payment?' : 'Reject payment?'}</DialogTitle>
        <DialogContent>
          {confirm === 'APPROVED' ? (
            <Typography>
              Confirm that {Number.isNaN(received) ? 'the amount' : m(received)} is credited in the company bank account.
              {isAdvance ? ' The order moves to QC / Production.' : ' The order moves to document release.'}
            </Typography>
          ) : (
            <Typography>
              The order goes back to Sales{values.remarks.trim() ? ' with your reason' : ''}. It returns to you when Sales records the payment again.
            </Typography>
          )}
          {confirm === 'REJECTED' && !values.remarks.trim() && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Add a reason in Remarks first.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={confirm === 'REJECTED' ? 'error' : 'primary'}
            loading={verify.isPending}
            disabled={confirm === 'REJECTED' && !values.remarks.trim()}
            onClick={() => confirm && submit(confirm)}
          >
            {confirm === 'APPROVED' ? 'Yes, approve' : 'Yes, reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, color: warn ? 'warning.main' : 'text.primary', textAlign: 'right' }}>
        {value}
      </Typography>
    </Stack>
  );
}
