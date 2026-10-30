import { useEffect, useState } from 'react';
import { useUrlPage, useUrlState } from '../../lib/useUrlState';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { Box, Button, Card, InputAdornment, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import Search from '@mui/icons-material/Search';
import AddCircleOutline from '@mui/icons-material/AddCircleOutlineOutlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import { useOrders } from '../../api/orders';
import { useDebounced } from '../../lib/useDebounced';
import type { OrderStatus } from '../../workflow/statuses';
import PageHeader from '../../components/PageHeader';
import { usePageSize } from '../../lib/pageSize';
import ListPagination from '../../components/ListPagination';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import OrdersTable from '../orders/OrdersTable';


/** Status filter groups that make sense to Sales. */
export const SALES_FILTERS: Record<string, { label: string; statuses: OrderStatus[] }> = {
  all: { label: 'All statuses', statuses: [] },
  action: { label: 'Needs my action (rejected)', statuses: ['ADVANCE_REJECTED', 'BALANCE_REJECTED'] },
  loading: { label: 'Loading · balance due next', statuses: ['DOCUMENTATION_IN_PROGRESS'] },
  accounts: { label: 'With Accounts', statuses: ['AWAITING_ADVANCE_VERIFICATION', 'AWAITING_BALANCE_VERIFICATION', 'AWAITING_FINAL_VERIFICATION'] },
  production: {
    label: 'Production & packaging',
    statuses: ['AWAITING_QC', 'QC_IN_PROGRESS', 'WAITING_FOR_MATERIALS', 'AWAITING_QUALITY_CHECK', 'AWAITING_PACKAGING', 'PACKAGING_IN_PROGRESS', 'PACKAGING_ON_HOLD', 'PACKAGING_ISSUE'],
  },
  shipping: { label: 'Shipping & documents', statuses: ['READY_FOR_DOCUMENTATION', 'DOCUMENTATION_IN_PROGRESS', 'AWAITING_DOCUMENT_RELEASE'] },
  closed: { label: 'Closed', statuses: ['CLOSED'] },
  cancelled: { label: 'Cancelled', statuses: ['CANCELLED'] },
};

export default function MyOrdersPage() {
  const [params, setParams] = useSearchParams();
  const filter = params.get('filter') && SALES_FILTERS[params.get('filter')!] ? params.get('filter')! : 'all';
  const scope = params.get('scope') === 'all' ? 'all' : 'mine';
  // Search and page live in the URL so they survive opening an order and coming back.
  const [urlQ, setUrlQ] = useUrlState('q');
  const [q, setQ] = useState(urlQ);
  const [page, setPage] = useUrlPage();
  const query = useDebounced(q);
  useEffect(() => {
    if (query !== urlQ) setUrlQ(query, { resetPage: true });
  }, [query, urlQ, setUrlQ]);
  const [pageSize] = usePageSize();
  const { data, isPending, error, refetch } = useOrders({ q: query, status: SALES_FILTERS[filter].statuses, mine: scope === 'mine', page, pageSize });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    next.delete('page');
    setParams(next, { replace: true });
  };

  return (
    <Box>
      <PageHeader
        overline="Orders"
        title="Manage Orders"
        subtitle="Every order you registered and where it is now."
        actions={
          <Button variant="contained" startIcon={<AddCircleOutline />} component={RouterLink} to="/sales/orders/new">
            Create order
          </Button>
        }
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2, alignItems: { md: 'center' } }}>
        <TextField
          placeholder="Search order no, PI no or customer"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          size="small"
          sx={{ flex: 1, maxWidth: { md: 380 } }}
          slotProps={{
            input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> },
            htmlInput: { 'aria-label': 'Search orders' },
          }}
        />
        <TextField select fullWidth={false} size="small" value={filter} onChange={(e) => setParam('filter', e.target.value)} sx={{ width: { xs: '100%', md: 240 }, flexShrink: 0 }} slotProps={{ htmlInput: { 'aria-label': 'Filter by status' } }}>
          {Object.entries(SALES_FILTERS).map(([key, f]) => (
            <MenuItem key={key} value={key}>
              {f.label}
            </MenuItem>
          ))}
        </TextField>
        <ToggleButtonGroup exclusive size="small" sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', md: 'auto' }, '& .MuiToggleButton-root': { flex: { xs: 1, md: 'none' }, whiteSpace: 'nowrap', minHeight: 38, px: 2.5 } }} value={scope} onChange={(_, v) => v && setParam('scope', v)} aria-label="Whose orders">
          <ToggleButton value="mine" sx={{ px: 2 }}>
            My orders
          </ToggleButton>
          <ToggleButton value="all" sx={{ px: 2 }}>
            All Sales
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !isPending && data?.orders.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ReceiptLongOutlined />}
            title={query || filter !== 'all' ? 'No orders match these filters' : 'No orders yet'}
            text={query || filter !== 'all' ? undefined : 'Create an order when the customer approves a PI.'}
          />
        </Card>
      ) : (
        <OrdersTable orders={data?.orders ?? []} loading={isPending} showOwner={scope === 'all'} />
      )}

      <ListPagination page={page} pageSize={pageSize} total={data?.total ?? 0} onChange={setPage} noun="orders" />
    </Box>
  );
}
