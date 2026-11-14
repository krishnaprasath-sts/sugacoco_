/** Sales-wise and product-wise reports: one row per sales person / product, with Excel / PDF / CSV download. */
import { useMemo, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Box, Card, CardContent, Grid, MenuItem, Skeleton, Stack, TextField, Typography } from '@mui/material';
import FilterAltOutlined from '@mui/icons-material/FilterAltOutlined';
import { api } from '../../lib/api';
import { useUrlState } from '../../lib/useUrlState';
import { useOnChange, usePaged } from '../../lib/usePaged';
import { formatMoney } from '../../lib/format';
import PageHeader from '../../components/PageHeader';
import DownloadMenu from '../../components/DownloadMenu';
import ResponsiveTable from '../../components/ResponsiveTable';
import ListPagination from '../../components/ListPagination';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';

type SalesRow = {
  salesId: number;
  salesName: string;
  currency: string;
  orders: number;
  customers: number;
  open: number;
  closed: number;
  totalValue: string;
  received: string;
  outstanding: string;
  averageOrder: string;
};
type SalesTotal = { currency: string; orders: number; totalValue: string; received: string; outstanding: string };

type ProductRow = {
  productId: number | null;
  productName: string;
  unit: string;
  currency: string;
  orders: number;
  customers: number;
  quantity: string;
  quantityMt: string;
  totalValue: string;
  averagePrice: string;
};

const SCOPES = [
  { value: 'all', label: 'Open and closed orders' },
  { value: 'open', label: 'Open orders only' },
  { value: 'closed', label: 'Closed orders only' },
];

const qty = (v: string) => Number(v).toLocaleString('en-IN', { maximumFractionDigits: 3 });
const pct = (part: string, whole: number) => (whole > 0 ? `${((Number(part) / whole) * 100).toFixed(1)}%` : '—');

/** Date range + open/closed filter, kept in the URL so Back returns to the same report. */
function useGroupedFilters(path: string) {
  const [from, setFrom] = useUrlState('from');
  const [to, setTo] = useUrlState('to');
  const [scope, setScope] = useUrlState('scope', 'all');
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (scope !== 'all') p.set('scope', scope);
    return p.toString();
  }, [from, to, scope]);
  const filters = (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          <FilterAltOutlined sx={{ color: 'primary.main' }} />
          <Typography variant="subtitle1">Search filters</Typography>
        </Stack>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField select label="Orders" value={scope} onChange={(e) => setScope(e.target.value, { resetPage: true })}>
              {SCOPES.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <TextField label="PI date from" type="date" value={from} onChange={(e) => setFrom(e.target.value, { resetPage: true })} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <TextField label="PI date to" type="date" value={to} onChange={(e) => setTo(e.target.value, { resetPage: true })} />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }} sx={{ display: 'flex', alignItems: 'flex-end' }}>
            <DownloadMenu fullWidth href={`/api/reports/${path}${qs ? `?${qs}` : ''}`} />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
  return { qs, filters };
}

function ReportShell(props: { title: string; subtitle: string; path: string; children: (qs: string) => ReactNode }) {
  const { qs, filters } = useGroupedFilters(props.path);
  return (
    <Box>
      <PageHeader overline="Reports" title={props.title} subtitle={props.subtitle} />
      {filters}
      {props.children(qs)}
    </Box>
  );
}

// ───────────── Sales-wise ─────────────

export function SalesWiseReportPage() {
  return (
    <ReportShell
      title="Sales-wise Report"
      subtitle="Orders, value and collections per sales person. Cancelled orders are not counted."
      path="sales"
    >
      {(qs) => <SalesTable qs={qs} />}
    </ReportShell>
  );
}

function SalesTable({ qs }: { qs: string }) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['reports', 'sales', qs],
    placeholderData: keepPreviousData,
    queryFn: () => api<{ rows: SalesRow[]; totals: SalesTotal[] }>(`/reports/sales${qs ? `?${qs}` : ''}`),
  });
  const paged = usePaged(data?.rows);
  useOnChange(qs, () => paged.setPage(1));
  const totalFor = (cur: string) => Number(data?.totals.find((t) => t.currency === cur)?.totalValue ?? 0);

  return (
    <>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 2 }}>
        <Typography>
          <strong>{new Set(data?.rows.map((r) => r.salesId)).size}</strong> sales people
        </Typography>
        {data?.totals.map((t) => (
          <Typography key={t.currency}>
            <strong>{t.orders}</strong> orders · value <strong>{formatMoney(t.totalValue, t.currency)}</strong> · received{' '}
            <strong>{formatMoney(t.received, t.currency)}</strong> · outstanding <strong>{formatMoney(t.outstanding, t.currency)}</strong>
          </Typography>
        ))}
      </Stack>
      <ListPagination page={paged.page} pageSize={paged.pageSize} total={paged.total} onChange={paged.setPage} noun="rows" placement="top" />
      <Card>
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} compact />
        ) : isPending ? (
          <Skeleton height={160} />
        ) : !data?.rows.length ? (
          <EmptyState title="No orders for these filters" />
        ) : (
          <ResponsiveTable
            ariaLabel="Sales-wise report"
            minWidth={980}
            rows={paged.pageItems}
            rowKey={(r) => `${r.salesId}-${r.currency}`}
            columns={[
              { label: 'Sales person', mobile: 'title', cellSx: { fontWeight: 600 }, render: (r) => r.salesName },
              { label: 'Orders', align: 'right', render: (r) => r.orders },
              { label: 'Open / closed', align: 'right', mobile: 'sub', render: (r) => `${r.open} open · ${r.closed} closed` },
              { label: 'Customers', align: 'right', render: (r) => r.customers },
              { label: 'Order value', align: 'right', nowrap: true, mobile: 'end', render: (r) => formatMoney(r.totalValue, r.currency) },
              { label: 'Share', align: 'right', render: (r) => pct(r.totalValue, totalFor(r.currency)) },
              { label: 'Average order', align: 'right', nowrap: true, render: (r) => formatMoney(r.averageOrder, r.currency) },
              { label: 'Received', align: 'right', nowrap: true, render: (r) => formatMoney(r.received, r.currency) },
              {
                label: 'Outstanding',
                align: 'right',
                nowrap: true,
                render: (r) => (
                  <Box component="span" sx={{ fontWeight: 600, color: Number(r.outstanding) > 0 ? 'warning.main' : 'text.primary' }}>
                    {formatMoney(r.outstanding, r.currency)}
                  </Box>
                ),
              },
            ]}
          />
        )}
      </Card>
      <ListPagination page={paged.page} pageSize={paged.pageSize} total={paged.total} onChange={paged.setPage} noun="rows" />
    </>
  );
}

// ───────────── Product-wise ─────────────

export function ProductWiseReportPage() {
  return (
    <ReportShell
      title="Product-wise Report"
      subtitle="Quantity and value sold per product. Cancelled orders are not counted."
      path="products"
    >
      {(qs) => <ProductTable qs={qs} />}
    </ReportShell>
  );
}

function ProductTable({ qs }: { qs: string }) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['reports', 'products', qs],
    placeholderData: keepPreviousData,
    queryFn: () => api<{ rows: ProductRow[] }>(`/reports/products${qs ? `?${qs}` : ''}`),
  });
  const paged = usePaged(data?.rows);
  useOnChange(qs, () => paged.setPage(1));
  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of data?.rows ?? []) map.set(r.currency, (map.get(r.currency) ?? 0) + Number(r.totalValue));
    return map;
  }, [data]);

  return (
    <>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 2 }}>
        <Typography>
          <strong>{new Set(data?.rows.map((r) => r.productName.toLowerCase())).size}</strong> products
        </Typography>
        {[...totals].map(([cur, v]) => (
          <Typography key={cur}>
            Total value <strong>{formatMoney(v, cur)}</strong>
          </Typography>
        ))}
      </Stack>
      <ListPagination page={paged.page} pageSize={paged.pageSize} total={paged.total} onChange={paged.setPage} noun="products" placement="top" />
      <Card>
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} compact />
        ) : isPending ? (
          <Skeleton height={160} />
        ) : !data?.rows.length ? (
          <EmptyState title="No products sold for these filters" />
        ) : (
          <ResponsiveTable
            ariaLabel="Product-wise report"
            minWidth={900}
            rows={paged.pageItems}
            rowKey={(r) => `${r.productId ?? r.productName}-${r.unit}-${r.currency}`}
            columns={[
              { label: 'Product', mobile: 'title', cellSx: { fontWeight: 600 }, render: (r) => r.productName },
              { label: 'Orders', align: 'right', mobile: 'sub', render: (r) => r.orders },
              { label: 'Customers', align: 'right', render: (r) => r.customers },
              { label: 'Quantity', align: 'right', nowrap: true, render: (r) => `${qty(r.quantity)} ${r.unit}` },
              ...(data.rows.some((r) => Number(r.quantityMt) > 0 && r.unit !== 'MT')
                ? [{ label: 'Quantity (MT)', align: 'right' as const, nowrap: true, render: (r: ProductRow) => (Number(r.quantityMt) > 0 ? qty(r.quantityMt) : '—') }]
                : []),
              { label: 'Value', align: 'right', nowrap: true, mobile: 'end', render: (r) => formatMoney(r.totalValue, r.currency) },
              { label: 'Share', align: 'right', render: (r) => pct(r.totalValue, totals.get(r.currency) ?? 0) },
              { label: 'Average price', align: 'right', nowrap: true, render: (r) => `${formatMoney(r.averagePrice, r.currency)} / ${r.unit}` },
            ]}
          />
        )}
      </Card>
      <ListPagination page={paged.page} pageSize={paged.pageSize} total={paged.total} onChange={paged.setPage} noun="products" />
    </>
  );
}
