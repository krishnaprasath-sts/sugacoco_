import { useEffect, useState } from 'react';
import { useUrlPage, useUrlState } from '../../lib/useUrlState';
import { Box, Card, InputAdornment, MenuItem, Stack, TextField } from '@mui/material';
import Search from '@mui/icons-material/Search';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import { useOrders } from '../../api/orders';
import { useDebounced } from '../../lib/useDebounced';
import { STATUS, type OrderStatus } from '../../workflow/statuses';
import PageHeader from '../../components/PageHeader';
import { usePageSize } from '../../lib/pageSize';
import ListPagination from '../../components/ListPagination';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import OrdersTable from './OrdersTable';


type Props = {
  overline: string;
  title: string;
  subtitle?: string;
  /** Fixed status filter (e.g. closed orders). Without it, a status dropdown is shown. */
  statuses?: OrderStatus[];
};

/** Searchable list of all orders (MD/Admin, Accounts). */
export default function OrdersListPage({ overline, title, subtitle, statuses }: Props) {
  const [urlQ, setUrlQ] = useUrlState('q');
  const [q, setQ] = useState(urlQ);
  const [statusParam, setStatusParam] = useUrlState('status');
  const status = (STATUS[statusParam as OrderStatus] ? statusParam : '') as OrderStatus | '';
  const [page, setPage] = useUrlPage();
  const query = useDebounced(q);
  useEffect(() => {
    if (query !== urlQ) setUrlQ(query, { resetPage: true });
  }, [query, urlQ, setUrlQ]);
  const filter = statuses ?? (status ? [status] : []);
  const [pageSize] = usePageSize();
  const { data, isPending, error, refetch } = useOrders({ q: query, status: filter, page, pageSize });

  return (
    <Box>
      <PageHeader overline={overline} title={title} subtitle={subtitle} />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          placeholder="Search order no, PI no or customer"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          size="small"
          sx={{ maxWidth: { md: 380 } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }, htmlInput: { 'aria-label': 'Search orders' } }}
        />
        {!statuses && (
          <TextField
            select
            fullWidth={false}
            size="small"
            value={status}
            onChange={(e) => setStatusParam(e.target.value, { resetPage: true })}
            sx={{ width: { xs: '100%', md: 300 } }}
            slotProps={{ select: { displayEmpty: true }, htmlInput: { 'aria-label': 'Filter by status' } }}
          >
            <MenuItem value="">All statuses</MenuItem>
            {(Object.keys(STATUS) as OrderStatus[]).map((s) => (
              <MenuItem key={s} value={s}>
                {STATUS[s].label}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Stack>
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !isPending && data?.orders.length === 0 ? (
        <Card>
          <EmptyState icon={<ReceiptLongOutlined />} title="No orders match" />
        </Card>
      ) : (
        <OrdersTable orders={data?.orders ?? []} loading={isPending} showOwner />
      )}
      <ListPagination page={page} pageSize={pageSize} total={data?.total ?? 0} onChange={setPage} noun="orders" />
    </Box>
  );
}
