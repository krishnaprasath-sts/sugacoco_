import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import EditOutlined from '@mui/icons-material/EditOutlined';
import LinkOutlined from '@mui/icons-material/LinkOutlined';
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { useOrder, type OrderDetail, type Payment } from '../../api/orders';
import { useMe } from '../../auth/useAuth';
import { ROLE_HOME, ROLE_LABEL } from '../../auth/roles';
import { STATUS, PACKAGING_STATUS_LABEL, QC_STATUS_LABEL, isLocked } from '../../workflow/statuses';
import { formatDate, formatDateTime, formatMoney } from '../../lib/format';
import { formError } from '../../lib/formErrors';
import StatusChip from '../../components/StatusChip';
import PageHeader from '../../components/PageHeader';
import DocumentsCard from './DocumentsCard';
import PdfDownloadButton from './PdfDownloadButton';
import RecordAdvanceDialog from './RecordAdvanceDialog';
import VerifyPaymentCard from './VerifyPaymentCard';
import QcUpdateCard from './QcUpdateCard';
import QcHistoryCard from './QcHistoryCard';
import {
  ApplyCreditButton,
  BillReleaseCard,
  CancelOrderButton,
  ClosureCard,
  ConfirmNoPaymentCard,
  ContainersCard,
  PackagingHistoryCard,
  PackagingUpdateCard,
  TrackingLinkCard,
} from './StageCards';

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
      <Typography sx={{ color: 'text.secondary' }}>{label}</Typography>
      <Typography component="div" sx={{ textAlign: 'right', fontWeight: 500 }}>
        {value ?? '—'}
      </Typography>
    </Stack>
  );
}

const PAYMENT_CHIP: Record<Payment['status'], { label: string; color: 'warning' | 'success' | 'error' }> = {
  PENDING: { label: 'Waiting for Accounts', color: 'warning' },
  APPROVED: { label: 'Verified', color: 'success' },
  REJECTED: { label: 'Rejected', color: 'error' },
};

export default function OrderDetailPage() {
  const id = Number(useParams().id);
  const validId = Number.isInteger(id) && id > 0;
  const { data, isPending, error, refetch } = useOrder(validId ? id : 0);
  const { data: me } = useMe();
  const navigate = useNavigate();
  const [recording, setRecording] = useState<'ADVANCE' | 'BALANCE' | null>(null);
  // Links like /orders/5#documents jump to that card once the order has loaded.
  const loaded = !!data;
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (loaded && hash) setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [loaded]);
  const home = me ? ROLE_HOME[me.role] : '/';

  if (!validId) {
    return (
      <Alert severity="warning" action={<Button color="inherit" size="small" component={RouterLink} to={home}>Go to my dashboard</Button>}>
        This order link is not valid.
      </Alert>
    );
  }
  if (error) {
    return (
      <Alert
        severity="error"
        action={
          <Stack direction="row" spacing={1}>
            <Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>
            <Button color="inherit" size="small" component={RouterLink} to={home}>Dashboard</Button>
          </Stack>
        }
      >
        {formError(error)}
      </Alert>
    );
  }
  if (isPending || !data) return <Skeleton variant="rounded" height={420} />;

  const { order, customer, items, history, permissions } = data;
  const status = STATUS[order.status];
  const locked = isLocked(order.status);
  // Came here from another screen in the app? "Back" returns there (keeps filters/search). Otherwise go to the role's list.
  const cameFromApp = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
  const roleBack =
    me?.role === 'SALES'
      ? { to: '/sales/orders', label: 'My orders' }
      : me?.role === 'ACCOUNTS'
        ? { to: '/accounts', label: 'Verification queue' }
        : me?.role === 'QC'
          ? { to: '/qc', label: 'QC work queue' }
          : me?.role === 'PACKAGING'
            ? { to: '/packaging', label: 'Packaging queue' }
            : me?.role === 'DOCUMENTATION'
              ? { to: '/documentation', label: 'Documentation queue' }
              : me?.role === 'ADMIN'
                ? { to: '/admin/orders', label: 'All orders' }
                : { to: home, label: 'Back' };
  const back = cameFromApp ? { to: roleBack.to, label: 'Back', onClick: () => navigate(-1) } : roleBack;
  const actionCardFirst =
    !!permissions.verifyPaymentId ||
    !!permissions.confirmNoPaymentType ||
    permissions.canUpdateQc ||
    permissions.canUpdatePackaging ||
    permissions.canRelease ||
    permissions.canClose;
  // Latest rejection, shown to Sales so they know what to fix.
  const rejected = order.status === 'ADVANCE_REJECTED' || order.status === 'BALANCE_REJECTED';
  const lastRejection = rejected ? data.payments.find((p) => p.status === 'REJECTED') : undefined;

  return (
    <Box sx={order.status === 'CANCELLED' ? { '& .MuiCard-root': { bgcolor: 'action.hover' } } : undefined}>
      <PageHeader
        back={back}
        title={
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
            <span>{order.orderNo}</span>
            <StatusChip status={order.status} size="medium" />
          </Stack>
        }
        subtitle={`PI no: ${order.piNumber} · ${customer.companyName}`}
        actions={
          permissions.canEdit || permissions.canCancel || permissions.canManageTracking || permissions.canViewPricing ? (
            <>
              {permissions.canViewPricing && <PdfDownloadButton orderId={order.id} />}
              {permissions.canManageTracking && (
                <Button
                  variant="outlined"
                  startIcon={<LinkOutlined />}
                  onClick={() => document.getElementById('tracking-link')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Customer link
                </Button>
              )}
              {permissions.canEdit && (
                <Button variant="outlined" startIcon={<EditOutlined />} component={RouterLink} to={`/sales/orders/${order.id}/edit`}>
                  Edit order
                </Button>
              )}
              <CancelOrderButton detail={data} />
            </>
          ) : undefined
        }
      />

      {locked && (
        <Alert severity={order.status === 'CANCELLED' ? 'warning' : 'success'} icon={<LockOutlined />} sx={{ mb: 2 }}>
          {order.status === 'CANCELLED'
            ? `Cancelled by ${data.cancellation?.cancelledByName ?? 'MD/Admin'}${data.cancellation ? ` on ${formatDateTime(data.cancellation.cancelledAt)}` : ''}. Reason: ${data.cancellation?.reason ?? '—'}. The order is read-only for everyone.`
            : `Closed${order.closedAt ? ` on ${formatDateTime(order.closedAt)}` : ''}. The order is read-only.`}
        </Alert>
      )}
      {rejected && me?.role === 'SALES' ? (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            permissions.canRecordAdvance || permissions.canRecordBalance ? (
              <Button color="inherit" size="small" onClick={() => setRecording(order.status === 'BALANCE_REJECTED' ? 'BALANCE' : 'ADVANCE')} sx={{ whiteSpace: 'nowrap' }}>
                Record again
              </Button>
            ) : undefined
          }
        >
          <strong>Accounts rejected the payment.</strong>{' '}
          {lastRejection?.verificationRemarks ? `Reason: ${lastRejection.verificationRemarks.replace(/[.\s]+$/, '')}. ` : ''}
          Check with the customer, correct the order if needed, then record the payment again.
        </Alert>
      ) : (
        !locked &&
        status.owner && (
          <Alert severity={status.color === 'error' ? 'error' : 'info'} sx={{ mb: 2 }}>
            {status.owner === me?.role ? 'Waiting for your action. ' : `Waiting for ${ROLE_LABEL[status.owner]}. `}
            Current stage: {status.label}.
          </Alert>
        )
      )}

      {/* Desktop: main + histories on the left, summary column on the right.
          Phones: action card (if any) → main → summary → histories, so key facts come before long history. */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          alignItems: 'start',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 2fr) minmax(0, 1fr)' },
          // Row 1 hugs its content; row 2 takes the rest, so a tall right column never opens a gap on the left.
          gridTemplateRows: { md: 'auto 1fr' },
          gridTemplateAreas: {
            xs: actionCardFirst ? '"side" "main" "hist"' : '"main" "side" "hist"',
            md: '"main side" "hist side"',
          },
        }}
      >
        <Stack spacing={2} sx={{ gridArea: 'main', minWidth: 0 }}>
          <ProductsCard items={items} currency={order.currency} showPricing={permissions.canViewPricing} total={order.totalValue} />
          <ContainersCard detail={data} />
          {!permissions.canRelease && <BillReleaseCard detail={data} />}
          <DocumentsCard detail={data} />
        </Stack>
        <Stack spacing={2} sx={{ gridArea: 'hist', minWidth: 0 }}>
          <PackagingHistoryCard updates={data.packagingUpdates} />
          <QcHistoryCard updates={data.qcUpdates} />
          <HistoryCard history={history} />
        </Stack>

        <Box sx={{ gridArea: 'side', minWidth: 0, gridRow: { md: 'span 2' } }}>
          <Stack spacing={2}>
            {permissions.verifyPaymentId && <VerifyPaymentCard key={permissions.verifyPaymentId} detail={data} />}
            {permissions.confirmNoPaymentType && <ConfirmNoPaymentCard detail={data} />}
            {permissions.canUpdateQc && <QcUpdateCard key={data.qcUpdates[0]?.id ?? 0} detail={data} />}
            {permissions.canUpdatePackaging && <PackagingUpdateCard key={data.packagingUpdates[0]?.id ?? 0} detail={data} />}
            {permissions.canRelease && <BillReleaseCard detail={data} />}
            <ClosureCard detail={data} />
            <TrackingLinkCard detail={data} />
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Order
                </Typography>
                <Stack spacing={1.25}>
                  <Info label="PI date" value={formatDate(order.piDate)} />
                  <Info label="Registered by" value={order.createdByName} />
                  <Info label="Registered on" value={formatDateTime(order.createdAt)} />
                  {order.qcStatus && <Info label="QC status" value={QC_STATUS_LABEL[order.qcStatus]} />}
                  {order.expectedReadyDate && <Info label="Expected ready" value={formatDate(order.expectedReadyDate)} />}
                  {order.packagingStatus && <Info label="Packaging" value={PACKAGING_STATUS_LABEL[order.packagingStatus]} />}
                </Stack>
                {order.remarks && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Remarks
                    </Typography>
                    <Typography sx={{ whiteSpace: 'pre-line' }}>{order.remarks}</Typography>
                  </>
                )}
              </CardContent>
            </Card>

            {permissions.canViewPricing && <PaymentCard detail={data} onRecord={setRecording} />}

            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Customer
                </Typography>
                <Typography sx={{ fontWeight: 600 }}>{customer.companyName}</Typography>
                <Typography sx={{ color: 'text.secondary' }}>
                  {[customer.contactPerson, [customer.city, customer.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                </Typography>
                {(customer.email || customer.phone) && (
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, wordBreak: 'break-all' }}>
                    {[customer.email, customer.phone].filter(Boolean).join(' · ')}
                  </Typography>
                )}
                {me?.role === 'SALES' && (
                  <Button component={RouterLink} to={`/sales/customers/${customer.id}`} size="small" sx={{ mt: 1, ml: -1 }}>
                    Customer history
                  </Button>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </Box>

      {recording && <RecordAdvanceDialog detail={data} type={recording} onClose={() => setRecording(null)} />}
    </Box>
  );
}

function ProductsCard({ items, currency, showPricing, total }: { items: OrderDetail['items']; currency: string; showPricing: boolean; total?: string }) {
  const qty = (v: string) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 });
  return (
    <Card>
      <CardContent sx={{ pb: 1 }}>
        <Typography variant="subtitle1">Products</Typography>
      </CardContent>
      {/* Phones: stacked list so prices are never hidden off-screen */}
      <Stack divider={<Divider />} sx={{ display: { xs: 'flex', sm: 'none' }, px: 2, pb: 2 }}>
        {items.map((i) => (
          <Box key={i.id} sx={{ py: 1.5 }}>
            <Typography sx={{ fontWeight: 600 }}>{i.productName}</Typography>
            {i.specification && (
              <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-line' }}>
                {i.specification}
              </Typography>
            )}
            <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.5, gap: 1 }}>
              <Typography variant="body2">
                {qty(i.quantity)} {i.unit}
                {i.quantityMt && i.unit !== 'MT' ? ` (${qty(i.quantityMt)} MT)` : ''}
                {showPricing && ` × ${formatMoney(i.unitPrice, currency)}`}
              </Typography>
              {showPricing && <Typography sx={{ fontWeight: 600 }}>{formatMoney(i.lineTotal, currency)}</Typography>}
            </Stack>
          </Box>
        ))}
        {showPricing && (
          <Stack direction="row" sx={{ justifyContent: 'space-between', pt: 1.5 }}>
            <Typography sx={{ fontWeight: 600 }}>Order total</Typography>
            <Typography sx={{ fontWeight: 700 }}>{formatMoney(total, currency)}</Typography>
          </Stack>
        )}
      </Stack>
      <TableContainer sx={{ display: { xs: 'none', sm: 'block' } }}>
        <Table size="small" sx={{ minWidth: showPricing ? 600 : 420 }} aria-label="Products">
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell align="right">Quantity</TableCell>
              {showPricing && <TableCell align="right">Unit price</TableCell>}
              {showPricing && <TableCell align="right">Total</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((i) => (
              <TableRow key={i.id}>
                <TableCell>
                  <Typography sx={{ fontWeight: 500, fontSize: 14 }}>{i.productName}</Typography>
                  {i.specification && (
                    <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-line' }}>
                      {i.specification}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {qty(i.quantity)} {i.unit}
                  {i.quantityMt && i.unit !== 'MT' && (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {qty(i.quantityMt)} MT
                    </Typography>
                  )}
                </TableCell>
                {showPricing && <TableCell align="right">{formatMoney(i.unitPrice, currency)}</TableCell>}
                {showPricing && <TableCell align="right">{formatMoney(i.lineTotal, currency)}</TableCell>}
              </TableRow>
            ))}
            {showPricing && (
              <TableRow sx={{ '& td': { borderBottom: 0 } }}>
                <TableCell colSpan={3} align="right" sx={{ fontWeight: 600 }}>
                  Order total
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  {formatMoney(total, currency)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}

function PaymentCard({ detail, onRecord }: { detail: OrderDetail; onRecord: (type: 'ADVANCE' | 'BALANCE') => void }) {
  const { order, payments, permissions } = detail;
  const m = (v?: string | null) => formatMoney(v, order.currency);
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          Payment
        </Typography>
        <Stack spacing={1.25}>
          <Info label="Order total" value={m(order.totalValue)} />
          <Info label={`Advance (${Number(order.advancePercent)}%)`} value={m(order.advanceAmount)} />
          {Number(order.creditAppliedAmount ?? 0) > 0 && <Info label="Customer credit used" value={m(order.creditAppliedAmount)} />}
          <Info label="Balance receivable" value={m(order.balanceAmount)} />
        </Stack>
        {detail.credits.filter((c) => c.status === 'PENDING').map((c) => (
          <Alert key={c.id} severity="info" sx={{ mt: 1.5 }}>
            Credit use of {m(c.amount)} is waiting for Accounts.
          </Alert>
        ))}
        {order.paymentTerms && (
          <>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
              Payment terms
            </Typography>
            <Typography sx={{ whiteSpace: 'pre-line' }}>{order.paymentTerms}</Typography>
          </>
        )}

        <ApplyCreditButton detail={detail} />
        <Divider sx={{ my: 2 }} />
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, mb: 1 }}>
          Payments received
        </Typography>
        {payments.length === 0 && <Typography sx={{ color: 'text.secondary' }}>No payment recorded yet.</Typography>}
        <Stack spacing={1.5}>
          {payments.map((p) => (
            <Box key={p.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '14px', p: 1.5 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography sx={{ fontWeight: 600 }}>
                  {p.paymentType === 'ADVANCE' ? 'Advance' : 'Balance'} · {formatMoney(p.amount, p.currency)}
                </Typography>
                <Chip size="small" variant="outlined" label={PAYMENT_CHIP[p.status].label} color={PAYMENT_CHIP[p.status].color} />
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {[p.paymentDate && `Paid ${formatDate(p.paymentDate)}`, p.bankReference && `Ref ${p.bankReference}`, p.payerBank]
                  .filter(Boolean)
                  .join(' · ') || 'No bank details'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Recorded by {p.recordedByName}, {formatDateTime(p.recordedAt)}
              </Typography>
              {p.decision && (
                <Alert severity={p.status === 'REJECTED' ? 'error' : 'success'} sx={{ mt: 1 }}>
                  {p.status === 'REJECTED' ? 'Rejected' : 'Verified'} by {p.verifiedByName}, {formatDateTime(p.verifiedAt)}
                  {p.amountReceived && ` · Bank credit ${formatMoney(p.amountReceived, p.currency)}`}
                  {p.bankCreditDate && ` on ${formatDate(p.bankCreditDate)}`}
                  {p.bankCreditReference && ` · Ref ${p.bankCreditReference}`}
                  {p.verificationRemarks && (
                    <>
                      <br />
                      {p.verificationRemarks}
                    </>
                  )}
                </Alert>
              )}
            </Box>
          ))}
        </Stack>
        {permissions.canRecordAdvance && (
          <Button variant="contained" startIcon={<PaymentsOutlined />} onClick={() => onRecord('ADVANCE')} fullWidth sx={{ mt: 2, minHeight: 38 }}>
            {payments.some((p) => p.paymentType === 'ADVANCE' && p.status === 'REJECTED') ? 'Record advance payment again' : 'Record advance payment'}
          </Button>
        )}
        {permissions.canRecordBalance && (
          <Button variant="contained" startIcon={<PaymentsOutlined />} onClick={() => onRecord('BALANCE')} fullWidth sx={{ mt: 2, minHeight: 38 }}>
            {payments.some((p) => p.paymentType === 'BALANCE' && p.status === 'REJECTED') ? 'Record balance payment again' : 'Record balance payment'}
          </Button>
        )}
        {permissions.balanceWaitingForLoading && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Balance payment can be recorded once Documentation records loading for all containers.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

const HISTORY_PREVIEW = 5;
function HistoryCard({ history }: { history: OrderDetail['history'] }) {
  const [showAll, setShowAll] = useState(false);
  const newestFirst = [...history].reverse();
  const visible = showAll ? newestFirst : newestFirst.slice(0, HISTORY_PREVIEW);
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          Status history
        </Typography>
        <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {visible.map((h, i) => (
            <Box component="li" key={h.id} sx={{ display: 'flex', gap: 1.5, pb: i === visible.length - 1 ? 0 : 2, position: 'relative' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 0.75 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: i === 0 ? 'primary.main' : 'divider', flexShrink: 0 }} />
                {i < visible.length - 1 && <Box sx={{ width: 2, flex: 1, bgcolor: 'divider', mt: 0.5 }} />}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{STATUS[h.toStatus].label}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {h.changedByName} ({ROLE_LABEL[h.changedByRole]}) · {formatDateTime(h.changedAt)}
                </Typography>
                {h.remarks && <Typography variant="body2" sx={{ mt: 0.25 }}>{h.remarks}</Typography>}
              </Box>
            </Box>
          ))}
        </Box>
        {newestFirst.length > HISTORY_PREVIEW && (
          <Button size="small" onClick={() => setShowAll((v) => !v)} sx={{ mt: 1.5, ml: -1 }}>
            {showAll ? 'Show latest only' : `Show all ${newestFirst.length} changes`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
