/** MD/Admin screens: overview, pending actions, cancellations. */
import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Skeleton,
  Stack,
  TextField,
  InputAdornment,
  Typography,
} from '@mui/material';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import HourglassEmptyOutlined from '@mui/icons-material/HourglassEmptyOutlined';
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import BlockOutlined from '@mui/icons-material/BlockOutlined';
import { useMe } from '../../auth/useAuth';
import { ROLE_LABEL, type Role } from '../../auth/roles';
import { useMemo, useState } from 'react';
import { useAdminSummary, useCancellations, usePendingActions } from '../../api/stages';
import ListPagination from '../../components/ListPagination';
import { usePaged } from '../../lib/usePaged';
import { usePageSize } from '../../lib/pageSize';
import { useOrders } from '../../api/orders';
import { STATUS, type OrderStatus } from '../../workflow/statuses';
import { formatDateTime, formatMoney } from '../../lib/format';
import PageHeader from '../../components/PageHeader';
import { useMoneySummary } from '../../api/notifications';
import { BarList, DonutChart, SERIES, type Slice } from '../../components/Charts';
import StatCard from '../../components/StatCard';
import StatusChip from '../../components/StatusChip';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import OrdersTable from '../orders/OrdersTable';
import ResponsiveTable, { OrderLink } from '../../components/ResponsiveTable';

/** "Latest activity" table on the overview. Hidden for now; set to true to show it again. */
const SHOW_LATEST_ACTIVITY = false;

const DEPTS: Role[] = ['SALES', 'ACCOUNTS', 'QC', 'PACKAGING', 'DOCUMENTATION'];
const PAYMENT_STAGES: OrderStatus[] = ['AWAITING_ADVANCE_VERIFICATION', 'AWAITING_BALANCE_VERIFICATION'];
const PRODUCTION_STAGES: OrderStatus[] = ['AWAITING_QC', 'QC_IN_PROGRESS', 'WAITING_FOR_MATERIALS', 'AWAITING_QUALITY_CHECK', 'AWAITING_PACKAGING', 'PACKAGING_IN_PROGRESS', 'PACKAGING_ON_HOLD', 'PACKAGING_ISSUE'];
const SHIPPING_STAGES: OrderStatus[] = ['READY_FOR_DOCUMENTATION', 'DOCUMENTATION_IN_PROGRESS', 'BALANCE_REJECTED', 'AWAITING_DOCUMENT_RELEASE'];
// Whole rupees so big numbers fit; exact paise are on the order pages.
const rupees = (v?: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v ?? 0));
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
const sumOf =(counts: Partial<Record<OrderStatus, number>>, statuses: OrderStatus[]) => statuses.reduce((n, s) => n + (counts[s] ?? 0), 0);

export function AdminOverviewPage() {
  const { data: me } = useMe();
  const { data, isPending, error, refetch } = useAdminSummary();
  const { data: money, isPending: moneyPending } = useMoneySummary();
  const recent = useOrders({ pageSize: 8 }, { enabled: SHOW_LATEST_ACTIVITY });
  const c = data?.counts ?? {};
  const open = Object.entries(c).filter(([s]) => s !== 'CLOSED' && s !== 'CANCELLED').reduce((n, [, v]) => n + (v ?? 0), 0);
  const pendingAmount = Number(money?.pendingAdvance.amount ?? 0) + Number(money?.pendingBalance.amount ?? 0);
  const pendingCount = (money?.pendingAdvance.count ?? 0) + (money?.pendingBalance.count ?? 0);

  const payments = sumOf(c, PAYMENT_STAGES);
  const production = sumOf(c, PRODUCTION_STAGES);
  const shipping = sumOf(c, SHIPPING_STAGES);
  const stages: Slice[] = [
    { label: 'Payments to verify', value: payments, color: SERIES[4] },
    { label: 'In QC & packaging', value: production, color: SERIES[1] },
    { label: 'Shipping & documents', value: shipping, color: SERIES[5] },
    { label: 'Other open stages', value: Math.max(0, open - payments - production - shipping), color: SERIES[3] },
    { label: 'Completed', value: c.CLOSED ?? 0, color: '#15803D' },
  ];

  return (
    <Box>
      <PageHeader overline={`Welcome back, ${me?.name ?? ''}`} title="Overview" />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {/* Only the headline numbers as tiles; the breakdowns are charts below. */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {[
          { label: 'Open orders', color: 'violet' as const, icon: <ReceiptLongOutlined />, value: open, to: '/admin/orders', loading: isPending },
          { label: 'Received this month', color: 'green' as const, icon: <CalendarMonthOutlined />, value: rupees(money?.receivedMonth.amount), hint: plural(money?.receivedMonth.count ?? 0, 'payment'), loading: moneyPending },
          { label: 'Waiting for verification', color: 'pink' as const, icon: <HourglassEmptyOutlined />, value: rupees(String(pendingAmount)), hint: `${plural(pendingCount, 'payment')} with Accounts`, to: '/admin/pending', loading: moneyPending },
          { label: 'Total outstanding', color: 'teal' as const, icon: <AccountBalanceWalletOutlined />, value: rupees(money?.outstanding.amount), hint: `${plural(money?.outstanding.count ?? 0, 'open order')}`, loading: moneyPending },
        ].map((t) => (
          <Grid key={t.label} size={{ xs: 6, lg: 3 }}>
            <StatCard {...t} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>Orders by stage</Typography>
              <DonutChart loading={isPending} data={stages} centerLabel="Orders" />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>Money in and due (₹)</Typography>
              <BarList
                loading={moneyPending}
                color="#1baf7a"
                data={[
                  { label: 'Received today', value: Number(money?.receivedToday.amount ?? 0), display: rupees(money?.receivedToday.amount), hint: plural(money?.receivedToday.count ?? 0, 'payment') },
                  { label: 'Received this month', value: Number(money?.receivedMonth.amount ?? 0), display: rupees(money?.receivedMonth.amount), hint: plural(money?.receivedMonth.count ?? 0, 'payment') },
                  { label: 'Waiting for verification', value: pendingAmount, display: rupees(String(pendingAmount)), hint: `${plural(money?.pendingAdvance.count ?? 0, 'advance')} · ${plural(money?.pendingBalance.count ?? 0, 'balance')}` },
                  { label: 'Balance to collect (loaded)', value: Number(money?.balanceDue.amount ?? 0), display: rupees(money?.balanceDue.amount), hint: plural(money?.balanceDue.count ?? 0, 'order') },
                  { label: 'Total outstanding', value: Number(money?.outstanding.amount ?? 0), display: rupees(money?.outstanding.amount), hint: plural(money?.outstanding.count ?? 0, 'open order') },
                ]}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>Waiting on each department</Typography>
              <BarList
                loading={isPending}
                data={DEPTS.map((d) => ({ label: ROLE_LABEL[d], value: data?.pendingByDept[d] ?? 0, hint: plural(data?.pendingByDept[d] ?? 0, 'order') }))}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>Open orders: payments & outstanding</Typography>
              {isPending ? <Skeleton height={100} /> : !data?.money.length ? (
                <Typography sx={{ color: 'text.secondary' }}>No orders yet.</Typography>
              ) : (
                <Stack spacing={2}>
                  {data.money.map((m) => {
                    const pct = Number(m.totalValue) ? (Number(m.received) / Number(m.totalValue)) * 100 : 0;
                    return (
                      <Box key={m.currency}>
                        <Grid container spacing={2}>
                          {[
                            ['Order value (after credit)', m.totalValue],
                            ['Received', m.received],
                            ['Outstanding', m.outstanding],
                          ].map(([l, v]) => (
                            <Grid key={l} size={4}>
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{l}</Typography>
                              <Typography sx={{ fontWeight: 700, fontSize: { xs: 15, sm: 18 } }}>{formatMoney(v, m.currency)}</Typography>
                            </Grid>
                          ))}
                        </Grid>
                        <LinearProgress variant="determinate" value={Math.min(100, pct)} color="success" sx={{ height: 8, borderRadius: 4, mt: 1, bgcolor: '#F1F0F6' }} aria-label={`${Math.round(pct)}% received`} />
                        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>{Math.round(pct)}% received across {m.orders} open orders</Typography>
                      </Box>
                    );
                  })}
                  {data.pendingVerification.map((p) => (
                    <Typography key={`${p.currency}-${p.type}`} variant="body2">
                      {p.n} {p.type.toLowerCase()} payment{p.n > 1 ? 's' : ''} ({formatMoney(p.amount, p.currency)}) waiting for Accounts
                    </Typography>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {SHOW_LATEST_ACTIVITY && (
        <>
          <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>Latest activity</Typography>
          <OrdersTable orders={recent.data?.orders ?? []} loading={recent.isPending} showOwner />
        </>
      )}
    </Box>
  );
}

const waited = (h: number) => {
  if (h < 1) return 'Under 1 hour';
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''}`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''}${h % 24 ? ` ${h % 24} h` : ''}`;
};
const LATE_HOURS = 72;

/** One list of every open order: who must act, what stage, how long it has waited. Longest wait first. */
export function PendingActionsPage() {
  const { data, isPending, error, refetch } = usePendingActions();
  const all = useMemo(() => [...(data?.orders ?? [])].sort((a, b) => b.hoursWaiting - a.hoursWaiting), [data]);
  const [dept, setDept] = useState<Role | 'ALL'>('ALL');
  const [lateOnly, setLateOnly] = useState(false);
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const shown = all.filter(
    (o) =>
      (dept === 'ALL' || o.owner === dept) &&
      (!lateOnly || o.hoursWaiting >= LATE_HOURS) &&
      (!term || [o.orderNo, o.piNumber, o.customerName].some((v) => v?.toLowerCase().includes(term))),
  );
  const { pageItems, page, setPage, total, pageSize } = usePaged(shown, undefined, `${dept}|${lateOnly}|${term}`);
  const count = (d: Role) => all.filter((o) => o.owner === d).length;
  const late = all.filter((o) => o.hoursWaiting >= LATE_HOURS).length;

  return (
    <Box>
      <PageHeader overline="MD / Admin" title="Pending Actions" subtitle="Open orders and which team must act next. Longest wait on top." />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2, alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }} role="group" aria-label="Filter by team">
          <Chip label={`All (${all.length})`} color={dept === 'ALL' ? 'primary' : 'default'} variant={dept === 'ALL' ? 'filled' : 'outlined'} onClick={() => setDept('ALL')} aria-pressed={dept === 'ALL'} />
          {DEPTS.map((d) => (
            <Chip key={d} label={`${ROLE_LABEL[d]} (${count(d)})`} color={dept === d ? 'primary' : 'default'} variant={dept === d ? 'filled' : 'outlined'} onClick={() => setDept(d)} aria-pressed={dept === d} />
          ))}
          <Chip
            label={`Late, 3+ days (${late})`}
            color={lateOnly ? 'error' : late ? 'error' : 'default'}
            variant={lateOnly ? 'filled' : 'outlined'}
            onClick={() => setLateOnly((v) => !v)}
            aria-pressed={lateOnly}
          />
        </Stack>
        <TextField
          size="small"
          placeholder="Search order, PI or customer"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: { xs: '100%', md: 280 } }}
          slotProps={{
            htmlInput: { 'aria-label': 'Search pending orders' },
            input: { startAdornment: <InputAdornment position="start"><SearchOutlined fontSize="small" /></InputAdornment> },
          }}
        />
      </Stack>

      <Card>
        <ResponsiveTable
          ariaLabel="Pending orders"
          minWidth={640}
          loading={isPending}
          rows={pageItems}
          rowKey={(o) => o.id}
          columns={[
            { label: 'Order', mobile: 'title', render: (o) => <OrderLink id={o.id} no={o.orderNo} pi={`PI ${o.piNumber}`} /> },
            { label: 'Customer', mobile: 'sub', render: (o) => o.customerName },
            { label: 'Who must act', nowrap: true, cellSx: { fontWeight: 600 }, render: (o) => <Box component="span" sx={{ fontWeight: 600 }}>{o.owner ? ROLE_LABEL[o.owner] : '—'}</Box> },
            { label: 'Stage', mobile: 'full', render: (o) => <StatusChip status={o.status} /> },
            {
              label: 'Waiting',
              align: 'right',
              nowrap: true,
              mobile: 'end',
              render: (o) => (
                <Typography component="span" sx={{ fontWeight: 600, fontSize: 13.5, color: o.hoursWaiting >= LATE_HOURS ? 'error.main' : o.hoursWaiting >= 24 ? 'warning.dark' : 'text.primary' }}>
                  {waited(o.hoursWaiting)}
                </Typography>
              ),
            },
          ]}
        />
        {!isPending && !error && !shown.length && (
          <EmptyState title={all.length ? 'No orders match' : 'No open orders'} text={all.length ? 'Try another team, or clear the search.' : 'Every order is closed or cancelled.'} />
        )}
        <ListPagination page={page} pageSize={pageSize} total={total} onChange={setPage} noun="orders" inset />
      </Card>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
        Waiting time: black under 1 day, orange 1–3 days, red 3+ days.
      </Typography>
    </Box>
  );
}

export function CancellationsPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = usePageSize();
  const { data, isPending, error, refetch } = useCancellations(page, pageSize);
  return (
    <Box>
      <PageHeader overline="MD / Admin" title="Cancellations" subtitle="Cancelled orders / PIs. Open an order and use Cancel order to add one." />
      <Card>
        {error ? <ErrorState error={error} onRetry={() => refetch()} compact /> : isPending ? <Skeleton height={120} /> : !data?.cancellations.length ? (
          <EmptyState icon={<BlockOutlined />} title="No cancelled orders" />
        ) : (
          <ResponsiveTable
            ariaLabel="Cancelled orders"
            minWidth={820}
            rows={data.cancellations}
            rowKey={(c) => c.id}
            columns={[
              { label: 'Order / PI', mobile: 'title', render: (c) => <OrderLink id={c.orderId} no={c.orderNo} pi={c.piNumber} /> },
              { label: 'Customer', mobile: 'sub', render: (c) => c.customerName },
              { label: 'Value', align: 'right', nowrap: true, mobile: 'end', render: (c) => formatMoney(c.totalValue, c.currency) },
              { label: 'Stage when cancelled', render: (c) => STATUS[c.statusBefore].label },
              { label: 'Reason', mobile: 'full', cellSx: { maxWidth: 300 }, render: (c) => c.reason },
              {
                label: 'Cancelled',
                nowrap: true,
                render: (c) => (
                  <>
                    {c.cancelledByName}
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>{formatDateTime(c.cancelledAt)}</Typography>
                  </>
                ),
              },
            ]}
          />
        )}
      </Card>
      <ListPagination page={page} pageSize={pageSize} total={data?.total ?? 0} onChange={setPage} noun="cancellations" />
    </Box>
  );
}
