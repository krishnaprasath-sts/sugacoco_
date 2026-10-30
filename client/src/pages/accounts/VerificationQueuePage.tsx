import { Link as RouterLink, useSearchParams } from 'react-router';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import HourglassEmptyOutlined from '@mui/icons-material/HourglassEmptyOutlined';
import ReceiptOutlined from '@mui/icons-material/ReceiptOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import { useVerificationQueue, type QueueRow } from '../../api/payments';
import { formatDate, formatDateTime, formatMoney } from '../../lib/format';
import PageHeader from '../../components/PageHeader';
import MoneySummary from '../../components/MoneySummary';
import ListPagination from '../../components/ListPagination';
import { usePaged } from '../../lib/usePaged';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';

const TABS = ['ready', 'waiting', 'recent'] as const;
type TabKey = (typeof TABS)[number];

function TypeChip({ type }: { type: 'ADVANCE' | 'BALANCE' }) {
  return <Chip size="small" label={type === 'ADVANCE' ? 'Advance' : 'Balance'} color={type === 'ADVANCE' ? 'primary' : 'secondary'} variant="outlined" />;
}

function QueueCard({ row }: { row: QueueRow }) {
  const reported = row.reportedAmount != null ? Number(row.reportedAmount) : null;
  const mismatch = reported != null && Math.abs(reported - Number(row.expectedAmount)) >= 0.005;
  return (
    <Card>
      <CardContent>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
              <Typography sx={{ fontWeight: 700 }}>{row.orderNo}</Typography>
              <TypeChip type={row.paymentType} />
            </Stack>
            <Typography sx={{ color: 'text.secondary' }}>
              {row.customerName} · PI no: {row.piNumber}
            </Typography>
          </Box>

          <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Expected
              </Typography>
              <Typography sx={{ fontWeight: 600 }}>{formatMoney(row.expectedAmount, row.currency)}</Typography>
            </Box>
            {row.paymentId ? (
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Reported by Sales
                </Typography>
                <Typography sx={{ fontWeight: 600, color: mismatch ? 'warning.main' : 'text.primary' }}>
                  {formatMoney(row.reportedAmount, row.currency)}
                </Typography>
              </Box>
            ) : null}
            <Box sx={{ minWidth: 140 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {row.paymentId ? 'Recorded' : 'Waiting since'}
              </Typography>
              <Typography>{formatDateTime(row.recordedAt ?? row.statusChangedAt)}</Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: { xs: 'space-between', md: 'flex-end' } }}>
            {row.paymentId && (
              <Stack spacing={0.5} sx={{ alignItems: { md: 'flex-end' } }}>
                {row.voucherCount > 0 ? (
                  <Chip size="small" icon={<ReceiptOutlined />} label={`${row.voucherCount} voucher${row.voucherCount > 1 ? 's' : ''}`} variant="outlined" />
                ) : (
                  <Chip size="small" icon={<WarningAmberOutlined />} label="No voucher" color="warning" variant="outlined" />
                )}
                {mismatch && <Chip size="small" label="Amount differs" color="warning" variant="outlined" />}
              </Stack>
            )}
            <Button
              variant={row.paymentId ? 'contained' : 'outlined'}
              component={RouterLink}
              to={`/orders/${row.id}`}
              sx={{ minHeight: 38, whiteSpace: 'nowrap' }}
            >
              {row.paymentId ? 'Verify' : 'View order'}
            </Button>
          </Stack>
        </Stack>
        {row.paymentId && (row.bankReference || row.paymentDate) && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
            {[row.paymentDate && `Paid ${formatDate(row.paymentDate)}`, row.bankReference && `Ref ${row.bankReference}`, row.recordedByName && `by ${row.recordedByName}`]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function VerificationQueuePage() {
  const [params, setParams] = useSearchParams();
  const tab: TabKey = TABS.includes(params.get('tab') as TabKey) ? (params.get('tab') as TabKey) : 'ready';
  const { data, isPending, error, refetch, dataUpdatedAt } = useVerificationQueue();
  const readyPaged = usePaged(data?.ready);
  const waitingPaged = usePaged(data?.waitingForSales);
  const recentPaged = usePaged(data?.recent);
  const now = new Date(dataUpdatedAt || Date.now());

  const counts = { ready: data?.ready.length ?? 0, waiting: data?.waitingForSales.length ?? 0 };

  return (
    <Box>
      <PageHeader
        overline="Accounts"
        title="Verification Queue"
        subtitle={`Check each payment against the company bank statement before approving. Oldest first. Updated ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.`}
      />
      <MoneySummary />

      <Tabs
        value={tab}
        onChange={(_, v) => setParams({ tab: v }, { replace: true })}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: 2, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600 } }}
      >
        <Tab
          value="ready"
          label={
            <Badge badgeContent={counts.ready} color="primary" sx={{ '& .MuiBadge-badge': { right: -14 } }}>
              <><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Ready to verify</Box><Box component="span" sx={{ display: { sm: 'none' } }}>To verify</Box></>
            </Badge>
          }
          sx={{ pr: 4 }}
        />
        <Tab
          value="waiting"
          label={
            <Badge badgeContent={counts.waiting} color="default" sx={{ '& .MuiBadge-badge': { right: -14, bgcolor: 'divider' } }}>
              <><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Waiting for Sales</Box><Box component="span" sx={{ display: { sm: 'none' } }}>Waiting</Box></>
            </Badge>
          }
          sx={{ pr: 4 }}
        />
        <Tab value="recent" label={<><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Recently verified</Box><Box component="span" sx={{ display: { sm: 'none' } }}>Recent</Box></>} />
      </Tabs>

      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {isPending && (
        <Stack spacing={1.5}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={110} />
          ))}
        </Stack>
      )}

      {data && tab === 'ready' && (
        <Stack spacing={1.5}>
          {data.ready.length === 0 ? (
            <Card>
              <EmptyState icon={<FactCheckOutlined />} title="Nothing to verify" text="New payments recorded by Sales will appear here." />
            </Card>
          ) : (
            <>
              {readyPaged.pageItems.map((r) => <QueueCard key={`${r.id}-${r.paymentId}`} row={r} />)}
              <ListPagination page={readyPaged.page} pageSize={readyPaged.pageSize} total={readyPaged.total} onChange={readyPaged.setPage} noun="payments" />
            </>
          )}
        </Stack>
      )}

      {data && tab === 'waiting' && (
        <Stack spacing={1.5}>
          <Alert severity="info">These orders are waiting for verification, but Sales has not recorded the customer's payment yet.</Alert>
          {data.waitingForSales.length === 0 ? (
            <Card>
              <EmptyState icon={<HourglassEmptyOutlined />} title="No orders waiting for Sales" />
            </Card>
          ) : (
            <>
              {waitingPaged.pageItems.map((r) => <QueueCard key={r.id} row={r} />)}
              <ListPagination page={waitingPaged.page} pageSize={waitingPaged.pageSize} total={waitingPaged.total} onChange={waitingPaged.setPage} noun="orders" />
            </>
          )}
        </Stack>
      )}

      {data && tab === 'recent' && (
        <Card>
          {data.recent.length === 0 ? (
            <EmptyState icon={<FactCheckOutlined />} title="No verifications yet" />
          ) : (
            <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
              {recentPaged.pageItems.map((v) => (
                <Stack
                  key={v.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{ px: 2.5, py: 1.75, justifyContent: 'space-between', alignItems: { sm: 'center' } }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
                      <Typography
                        component={RouterLink}
                        to={`/orders/${v.orderId}`}
                        sx={{ fontWeight: 700, color: 'primary.dark', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                      >
                        {v.orderNo}
                      </Typography>
                      <TypeChip type={v.paymentType} />
                      <Chip
                        size="small"
                        label={v.decision === 'APPROVED' ? 'Approved' : 'Rejected'}
                        color={v.decision === 'APPROVED' ? 'success' : 'error'}
                      />
                    </Stack>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {v.customerName} · {formatMoney(v.amount, v.currency)}
                      {v.remarks ? ` · ${v.remarks}` : ''}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                    {v.verifiedByName} · {formatDateTime(v.verifiedAt)}
                  </Typography>
                </Stack>
              ))}
        <ListPagination page={recentPaged.page} pageSize={recentPaged.pageSize} total={recentPaged.total} onChange={recentPaged.setPage} noun="verifications" inset />
            </Stack>
          )}
        </Card>
      )}
    </Box>
  );
}
