/** Reports (orders, customer balances) with Excel / PDF / CSV download, and the audit log. */
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router';
import {
  Box,
  Card,
  CardContent,
  Grid,
  MenuItem,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import DownloadMenu from '../../components/DownloadMenu';
import ResponsiveTable, { OrderLink } from '../../components/ResponsiveTable';
import FilterAltOutlined from '@mui/icons-material/FilterAltOutlined';
import { useAuditLog, useCustomersReport, useOrdersReport } from '../../api/stages';
import ListPagination from '../../components/ListPagination';
import { usePaged } from '../../lib/usePaged';
import { usePageSize } from '../../lib/pageSize';
import type { OrderStatus } from '../../workflow/statuses';
import { ROLE_LABEL } from '../../auth/roles';
import { formatDate, formatDateTime, formatMoney } from '../../lib/format';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import { useDebounced } from '../../lib/useDebounced';
import StatusChip from '../../components/StatusChip';

const PRESETS: Record<string, { label: string; statuses: OrderStatus[] }> = {
  all: { label: 'All orders', statuses: [] },
  advance: { label: 'Advance verification pending', statuses: ['AWAITING_ADVANCE_VERIFICATION', 'ADVANCE_REJECTED'] },
  balance: { label: 'Balance verification pending', statuses: ['AWAITING_BALANCE_VERIFICATION', 'BALANCE_REJECTED'] },
  qc: { label: 'In QC / production', statuses: ['AWAITING_QC', 'QC_IN_PROGRESS', 'WAITING_FOR_MATERIALS', 'AWAITING_QUALITY_CHECK'] },
  packaging: { label: 'In packaging', statuses: ['AWAITING_PACKAGING', 'PACKAGING_IN_PROGRESS', 'PACKAGING_ON_HOLD', 'PACKAGING_ISSUE'] },
  docs: { label: 'Awaiting documentation', statuses: ['READY_FOR_DOCUMENTATION', 'DOCUMENTATION_IN_PROGRESS', 'AWAITING_DOCUMENT_RELEASE'] },
  final: { label: 'Awaiting final verification', statuses: ['AWAITING_FINAL_VERIFICATION'] },
  closed: { label: 'Completed', statuses: ['CLOSED'] },
  cancelled: { label: 'Cancelled', statuses: ['CANCELLED'] },
};

function OrdersReport() {
  const [preset, setPreset] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = usePageSize();
  // Filters without the page: used for downloads and to reset the page when filters change.
  const filterQs = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (PRESETS[preset].statuses.length) p.set('status', PRESETS[preset].statuses.join(','));
    return p.toString();
  }, [preset, from, to]);
  useEffect(() => setPage(1), [filterQs]);
  const qs = `${filterQs}${filterQs ? '&' : ''}page=${page}&pageSize=${pageSize}`;
  const { data, isPending, error, refetch } = useOrdersReport(qs);
  const rows = data?.orders ?? [];
  // Totals come from the server for the whole filter (cancelled orders excluded), not just this page.
  const totals = data?.totals ?? [];

  return (
    <>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
            <FilterAltOutlined sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1">Search filters</Typography>
          </Stack>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField select label="Report" value={preset} onChange={(e) => setPreset(e.target.value)}>
                {Object.entries(PRESETS).map(([k, p]) => <MenuItem key={k} value={k}>{p.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField label="PI date from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <TextField label="PI date to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }} sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <DownloadMenu fullWidth href={`/api/reports/orders${filterQs ? `?${filterQs}` : ''}`} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 2 }}>
        <Typography><strong>{data?.total ?? 0}</strong> orders</Typography>
        {totals.map((t) => (
          <Typography key={t.currency}>
            Value <strong>{formatMoney(t.totalValue, t.currency)}</strong> · received <strong>{formatMoney(t.received, t.currency)}</strong> · outstanding <strong>{formatMoney(t.outstanding, t.currency)}</strong>
          </Typography>
        ))}
      </Stack>

      <Card>
        {error ? <ErrorState error={error} onRetry={() => refetch()} compact /> : isPending ? <Skeleton height={160} /> : !rows.length ? <EmptyState title="No orders for these filters" /> : (
          <ResponsiveTable
            ariaLabel="Order report"
            minWidth={980}
            rows={rows}
            rowKey={(r) => r.id}
            columns={[
              { label: 'Order / PI', mobile: 'title', render: (r) => <OrderLink id={r.id} no={r.orderNo} pi={r.piNumber} /> },
              { label: 'PI date', nowrap: true, render: (r) => formatDate(r.piDate) },
              { label: 'Customer', mobile: 'sub', render: (r) => r.customerName },
              { label: 'Status', mobile: 'full', render: (r) => <StatusChip status={r.status} /> },
              { label: 'Value', align: 'right', nowrap: true, mobile: 'end', render: (r) => formatMoney(r.totalValue, r.currency) },
              { label: 'Received', align: 'right', nowrap: true, render: (r) => formatMoney(r.received, r.currency) },
              {
                label: 'Outstanding',
                align: 'right',
                nowrap: true,
                render: (r) => <Box component="span" sx={{ fontWeight: 600, color: Number(r.outstanding) > 0 ? 'warning.main' : 'text.primary' }}>{formatMoney(r.outstanding, r.currency)}</Box>,
              },
              { label: 'Sales', render: (r) => r.salesName },
            ]}
          />
        )}
      </Card>
      <ListPagination page={page} pageSize={pageSize} total={data?.total ?? 0} onChange={setPage} noun="orders" />
    </>
  );
}

function CustomersReport() {
  const { data, isPending, error, refetch } = useCustomersReport();
  const paged = usePaged(data?.customers);
  return (
    <>
      <Stack direction="row" sx={{ justifyContent: 'flex-end', mb: 2 }}>
        <DownloadMenu href="/api/reports/customers" />
      </Stack>
      <Card>
        {error ? <ErrorState error={error} onRetry={() => refetch()} compact /> : isPending ? <Skeleton height={160} /> : !data?.customers.length ? <EmptyState title="No customer orders yet" /> : (
          <ResponsiveTable
            ariaLabel="Customer balances"
            minWidth={900}
            rows={paged.pageItems}
            rowKey={(c) => `${c.customerId}-${c.currency}`}
            columns={[
              { label: 'Customer', mobile: 'title', cellSx: { fontWeight: 600 }, render: (c) => c.customerName },
              { label: 'Orders', align: 'right', render: (c) => c.orders },
              { label: 'Open / closed', align: 'right', render: (c) => `${c.open} / ${c.closed}` },
              { label: 'Order value', align: 'right', nowrap: true, render: (c) => formatMoney(c.totalValue, c.currency) },
              { label: 'Received', align: 'right', nowrap: true, render: (c) => formatMoney(c.received, c.currency) },
              {
                label: 'Outstanding',
                align: 'right',
                nowrap: true,
                mobile: 'end',
                render: (c) => <Box component="span" sx={{ fontWeight: 600, color: Number(c.outstanding) > 0 ? 'warning.main' : 'text.primary' }}>{formatMoney(c.outstanding, c.currency)}</Box>,
              },
              { label: 'Credit available', align: 'right', nowrap: true, render: (c) => formatMoney(c.creditAvailable, c.currency) },
              { label: 'Refunded', align: 'right', nowrap: true, render: (c) => formatMoney(c.refunded, c.currency) },
            ]}
          />
        )}
      </Card>
      <ListPagination page={paged.page} pageSize={paged.pageSize} total={paged.total} onChange={paged.setPage} noun="customers" />
    </>
  );
}

export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'customers' ? 'customers' : 'orders';
  return (
    <Box>
      <PageHeader overline="Reports" title={tab === 'orders' ? 'Order Report' : 'Customer Balances'} subtitle="Every filter is optional. Download as Excel, PDF or CSV." />
      <Tabs value={tab} onChange={(_, v) => setParams({ tab: v }, { replace: true })} sx={{ mb: 2 }}>
        <Tab value="orders" label="Orders" />
        <Tab value="customers" label="Customer balances" />
      </Tabs>
      {tab === 'orders' ? <OrdersReport /> : <CustomersReport />}
    </Box>
  );
}

const pretty = (a: string) => a.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function Changes({ value }: { value: unknown }) {
  if (!value) return <>—</>;
  let obj: Record<string, unknown>;
  try {
    obj = (typeof value === 'string' ? JSON.parse(value) : value) as Record<string, unknown>;
  } catch {
    return <>{String(value).slice(0, 120)}</>;
  }
  if (!obj || typeof obj !== 'object') return <>{String(obj)}</>;
  const parts = Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object' || Array.isArray(v))
    .slice(0, 6)
    .map(([k, v]) => (Array.isArray(v) && v.length === 2 && typeof v[0] !== 'object' ? `${k}: ${v[0] ?? '—'} → ${v[1] ?? '—'}` : `${k}: ${Array.isArray(v) ? `${v.length} items` : String(v)}`));
  return <>{parts.join(' · ') || '—'}</>;
}

export function AuditLogPage() {
  const [action, setAction] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const orderNoQuery = useDebounced(orderNo.trim());
  const [page, setPage] = useState(1);
  const [pageSize] = usePageSize();
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...(action ? { action } : {}), ...(orderNoQuery ? { orderNo: orderNoQuery } : {}) }).toString();
  const { data, isPending, error, refetch } = useAuditLog(qs);

  return (
    <Box>
      <PageHeader overline="Administration" title="Audit Log" subtitle="Every change, approval, rejection, cancellation and closure, with who and when." />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField select fullWidth={false} size="small" label="Action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} sx={{ width: { xs: '100%', md: 320 } }}>
          <MenuItem value="">All actions</MenuItem>
          {/* While a new page loads, keep the chosen action in the list so the box doesn't go blank. */}
          {(data?.actions ?? (action ? [action] : [])).map((a) => <MenuItem key={a} value={a}>{pretty(a)}</MenuItem>)}
        </TextField>
        <TextField fullWidth={false} size="small" label="Order no." value={orderNo} onChange={(e) => { setOrderNo(e.target.value); setPage(1); }} sx={{ width: { xs: '100%', md: 240 } }} />
      </Stack>
      <Card>
        {error ? <ErrorState error={error} onRetry={() => refetch()} compact /> : isPending ? <Skeleton height={200} /> : !data?.entries.length ? <EmptyState title="No entries" /> : (
          <ResponsiveTable
            ariaLabel="Audit log"
            size="small"
            minWidth={980}
            rows={data.entries}
            rowKey={(e) => e.id}
            columns={[
              { label: 'When', nowrap: true, mobile: 'sub', render: (e) => formatDateTime(e.createdAt) },
              {
                label: 'Who',
                render: (e) => (
                  <>
                    {e.userName ?? 'System'}
                    {e.userRole && <Typography variant="body2" sx={{ color: 'text.secondary' }}>{ROLE_LABEL[e.userRole]}</Typography>}
                  </>
                ),
              },
              { label: 'Action', mobile: 'title', render: (e) => pretty(e.action) },
              {
                label: 'Order',
                render: (e) => (e.orderId ? <Typography component={RouterLink} to={`/orders/${e.orderId}`} variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>{e.orderNo}</Typography> : '—'),
              },
              { label: 'Details', mobile: 'full', cellSx: { maxWidth: 420, fontSize: 13, color: 'text.secondary' }, render: (e) => <Changes value={e.changes} /> },
            ]}
          />
        )}
      </Card>
      <ListPagination page={page} pageSize={pageSize} total={data?.total ?? 0} onChange={setPage} noun="changes" />
    </Box>
  );
}
