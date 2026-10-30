import { useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import { useAddCredit, useCredits, useVerifyCredit, type CreditEntry } from '../../api/stages';
import { useOrders } from '../../api/orders';
import CustomerPicker from '../sales/CustomerPicker';
import type { Customer } from '../../api/customers';
import { CURRENCIES, parseNum } from '../../lib/money';
import { fieldErrors, formError } from '../../lib/formErrors';
import { formatDateTime, formatMoney } from '../../lib/format';
import PageHeader from '../../components/PageHeader';
import ResponsiveTable from '../../components/ResponsiveTable';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import ListPagination from '../../components/ListPagination';
import { usePageSize } from '../../lib/pageSize';
import { useToast } from '../../components/useToast';

const TYPE_LABEL = { WITHHELD: 'Withheld', APPLIED: 'Used on order', REFUND: 'Refund' } as const;
const STATUS_COLOR = { PENDING: 'warning', VERIFIED: 'success', REJECTED: 'error' } as const;

function AddCreditDialog({ onClose }: { onClose: () => void }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [v, setV] = useState({ entryType: 'WITHHELD', amount: '', currency: CURRENCIES[0] as string, sourceOrderId: '', reference: '', remarks: '' });
  const orders = useOrders({ pageSize: 100, customerId: customer?.id }, { enabled: !!customer });
  const add = useAddCredit();
  const toast = useToast();
  const errors = fieldErrors(add.error);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const customerOrders = customer ? (orders.data?.orders ?? []) : [];

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const amount = parseNum(v.amount);
    add.mutate(
      {
        customerId: customer?.id ?? 0,
        entryType: v.entryType as 'WITHHELD' | 'REFUND',
        amount: Number.isNaN(amount) ? (undefined as unknown as number) : amount,
        currency: v.currency,
        sourceOrderId: v.sourceOrderId ? Number(v.sourceOrderId) : null,
        reference: v.reference.trim() || null,
        remarks: v.remarks.trim(),
      },
      { onSuccess: () => { toast('Entry recorded'); onClose(); } },
    );
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" slotProps={{ paper: { component: 'form', onSubmit, noValidate: true } as object }}>
      <DialogTitle>Record withheld amount or refund</DialogTitle>
      <DialogContent>
        {formError(add.error) && <Alert severity="error" sx={{ mb: 2 }}>{formError(add.error)}</Alert>}
        <Stack spacing={2} sx={{ pt: 1 }}>
          <CustomerPicker
            value={customer}
            onChange={(c) => {
              setCustomer(c);
              setV((x) => ({ ...x, sourceOrderId: '' })); // old order belongs to the previous customer
            }}
            error={errors.customerId}
          />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="Type" value={v.entryType} onChange={set('entryType')}>
                <MenuItem value="WITHHELD">Withheld for future orders</MenuItem>
                <MenuItem value="REFUND">Refund paid to customer</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: CURRENCIES.length > 1 ? 4 : 6 }}>
              <TextField label="Amount (₹)" required value={v.amount} onChange={set('amount')} error={!!errors.amount} helperText={errors.amount} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
            </Grid>
            {CURRENCIES.length > 1 && (
              <Grid size={{ xs: 4, sm: 2 }}>
                <TextField select label="Currency" value={v.currency} onChange={set('currency')}>
                  {CURRENCIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField select label="From order (optional)" value={v.sourceOrderId} onChange={set('sourceOrderId')} disabled={!customer} error={!!errors.sourceOrderId} helperText={errors.sourceOrderId}>
                <MenuItem value="">None</MenuItem>
                {customerOrders.map((o) => <MenuItem key={o.id} value={String(o.id)}>{o.orderNo} · PI {o.piNumber}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Reference" value={v.reference} onChange={set('reference')} />
            </Grid>
            <Grid size={12}>
              <TextField label="Note" required multiline minRows={2} value={v.remarks} onChange={set('remarks')} error={!!errors.remarks} helperText={errors.remarks ?? 'Why the amount is withheld or refunded'} />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" loading={add.isPending}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function PendingRow({ e }: { e: CreditEntry }) {
  const verify = useVerifyCredit();
  const toast = useToast();
  const [decision, setDecision] = useState<'VERIFIED' | 'REJECTED' | null>(null);
  const [remarks, setRemarks] = useState('');
  const decide = () => {
    if (!decision) return;
    verify.mutate({ id: e.id, decision, remarks: remarks.trim() || null }, {
      onSuccess: () => {
        toast(decision === 'VERIFIED' ? 'Credit verified. Order balance reduced.' : 'Credit use rejected', decision === 'VERIFIED' ? 'success' : 'info');
        setDecision(null);
        setRemarks('');
      },
      onError: (err) => {
        toast(formError(err) ?? 'Could not update', 'error');
        setDecision(null);
      },
    });
  };
  return (
    <Card>
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>
              {formatMoney(e.amount, e.currency)} for{' '}
              <Typography component={RouterLink} to={`/orders/${e.appliedOrderId}`} sx={{ fontWeight: 700, color: 'primary.main' }}>{e.appliedOrderNo}</Typography>
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {e.customerName} · requested by {e.recordedByName}, {formatDateTime(e.createdAt)}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" color="error" onClick={() => setDecision('REJECTED')} disabled={verify.isPending}>Reject</Button>
            <Button variant="contained" onClick={() => setDecision('VERIFIED')} disabled={verify.isPending}>Verify</Button>
          </Stack>
        </Stack>
      </CardContent>
      <Dialog open={!!decision} onClose={() => setDecision(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{decision === 'VERIFIED' ? 'Verify credit use?' : 'Reject credit use?'}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            {decision === 'VERIFIED'
              ? `${formatMoney(e.amount, e.currency)} of ${e.customerName}'s credit is used on ${e.appliedOrderNo}. Its balance receivable goes down by the same amount.`
              : 'The credit stays available for the customer. Sales sees your reason.'}
          </Typography>
          <TextField
            label={decision === 'REJECTED' ? 'Reason' : 'Remarks (optional)'}
            required={decision === 'REJECTED'}
            multiline
            minRows={2}
            value={remarks}
            onChange={(ev) => setRemarks(ev.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={() => setDecision(null)}>Cancel</Button>
          <Button
            variant="contained"
            color={decision === 'REJECTED' ? 'error' : 'primary'}
            loading={verify.isPending}
            disabled={decision === 'REJECTED' && !remarks.trim()}
            onClick={decide}
          >
            {decision === 'VERIFIED' ? 'Yes, verify' : 'Yes, reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

export default function CreditsPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = usePageSize();
  const { data, isPending, error, refetch } = useCredits(page, pageSize);
  const [adding, setAdding] = useState(false);
  const pending = data?.pending ?? [];

  return (
    <Box>
      <PageHeader
        overline="Accounts"
        title="Refunds & Withheld"
        subtitle="Money withheld for future orders, refunds paid, and credit used on orders."
        actions={<Button variant="contained" startIcon={<AddOutlined />} onClick={() => setAdding(true)}>Record entry</Button>}
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      {pending.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>Credit use waiting for you ({pending.length})</Typography>
          <Stack spacing={1.5}>{pending.map((e) => <PendingRow key={e.id} e={e} />)}</Stack>
        </Box>
      )}

      <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>Customer balances</Typography>
      <Card sx={{ mb: 4 }}>
        {isPending ? <Skeleton height={120} /> : !data?.balances.length ? (
          <EmptyState title="No withheld amounts or refunds yet" />
        ) : (
          <ResponsiveTable
            ariaLabel="Customer balances"
            minWidth={640}
            rows={data.balances}
            rowKey={(b) => `${b.customerId}-${b.currency}`}
            columns={[
              { label: 'Customer', mobile: 'title', cellSx: { fontWeight: 600 }, render: (b) => b.customerName },
              { label: 'Withheld', align: 'right', nowrap: true, render: (b) => formatMoney(b.withheld, b.currency) },
              { label: 'Used', align: 'right', nowrap: true, render: (b) => formatMoney(b.applied, b.currency) },
              { label: 'Available', align: 'right', nowrap: true, mobile: 'end', cellSx: { fontWeight: 700 }, render: (b) => formatMoney(b.available, b.currency) },
              { label: 'Refunded', align: 'right', nowrap: true, render: (b) => formatMoney(b.refunded, b.currency) },
            ]}
          />
        )}
      </Card>

      <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>All entries</Typography>
      <Card>
        {isPending ? <Skeleton height={120} /> : !data?.entries.length ? (
          <EmptyState title="No entries" />
        ) : (
          <ResponsiveTable
            ariaLabel="All credit entries"
            minWidth={860}
            rows={data.entries}
            rowKey={(e) => e.id}
            columns={[
              { label: 'Date', nowrap: true, render: (e) => formatDateTime(e.createdAt) },
              { label: 'Customer', mobile: 'title', render: (e) => e.customerName },
              { label: 'Type', mobile: 'sub', render: (e) => TYPE_LABEL[e.entryType] },
              { label: 'Amount', align: 'right', nowrap: true, mobile: 'end', render: (e) => formatMoney(e.amount, e.currency) },
              {
                label: 'Order',
                render: (e) =>
                  (e.appliedOrderId ?? e.sourceOrderId) ? (
                    <Typography component={RouterLink} to={`/orders/${e.appliedOrderId ?? e.sourceOrderId}`} variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>
                      {e.appliedOrderNo ?? e.sourceOrderNo}
                    </Typography>
                  ) : '—',
              },
              {
                label: 'Status',
                render: (e) => <Chip size="small" variant="outlined" color={STATUS_COLOR[e.status]} label={e.status === 'VERIFIED' ? 'Verified' : e.status === 'PENDING' ? 'Pending' : 'Rejected'} />,
              },
              { label: 'Note', mobile: 'full', cellSx: { maxWidth: 280 }, render: (e) => [e.reference, e.remarks].filter(Boolean).join(' · ') || '—' },
            ]}
          />
        )}
      </Card>
      <ListPagination page={page} pageSize={pageSize} total={data?.total ?? 0} onChange={setPage} noun="entries" />
      {adding && <AddCreditDialog onClose={() => setAdding(false)} />}
    </Box>
  );
}
