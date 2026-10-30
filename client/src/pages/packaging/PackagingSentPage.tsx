import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  Box,
  Button,
  Card,
  Chip,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import LocalShippingOutlined from '@mui/icons-material/LocalShippingOutlined';
import PhotoLibraryOutlined from '@mui/icons-material/PhotoLibraryOutlined';
import { usePackagingSent } from '../../api/stages';
import { useDebounced } from '../../lib/useDebounced';
import { usePageSize } from '../../lib/pageSize';
import { formatDateTime } from '../../lib/format';
import { isLocked } from '../../workflow/statuses';
import PageHeader from '../../components/PageHeader';
import ResponsiveTable, { OrderLink } from '../../components/ResponsiveTable';
import ListPagination from '../../components/ListPagination';
import StatusChip from '../../components/StatusChip';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';

/** Orders Packaging finished: when they went to Documentation and what stage they are at now. */
export default function PackagingSentPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = usePageSize();
  const q = useDebounced(search.trim());
  const { data, isPending, error, refetch } = usePackagingSent(page, pageSize, q);
  const rows = data?.orders ?? [];

  return (
    <Box>
      <PageHeader
        overline="Packaging"
        title="Sent to Documentation"
        subtitle="Orders you packed and handed over. Open one to see its progress or add more packaging photos and documents."
      />
      <TextField
        size="small"
        placeholder="Search order no, PI no or customer"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        sx={{ mb: 2, maxWidth: { md: 420 } }}
        slotProps={{
          htmlInput: { 'aria-label': 'Search sent orders' },
          input: { startAdornment: <InputAdornment position="start"><SearchOutlined fontSize="small" /></InputAdornment> },
        }}
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {!error && (
        <Card>
          <ResponsiveTable
            ariaLabel="Orders sent to Documentation"
            size="small"
            loading={isPending}
            rows={rows}
            rowKey={(r) => r.id}
            columns={[
              { label: 'Order', mobile: 'title', render: (r) => <OrderLink id={r.id} no={r.orderNo} pi={`PI ${r.piNumber}`} link={false} /> },
              {
                label: 'Customer / products',
                mobile: 'sub',
                cellSx: { maxWidth: 320 },
                render: (r) => (
                  <>
                    <Typography sx={{ color: 'text.primary' }}>{r.customerName}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>{r.products ?? '—'}</Typography>
                  </>
                ),
              },
              {
                label: 'Packed',
                nowrap: true,
                render: (r) => (
                  <>
                    <Typography>{r.quantityPacked ? `${Number(r.quantityPacked)} ${r.quantityUnit ?? ''}` : '—'}</Typography>
                    <Chip size="small" variant="outlined" icon={<PhotoLibraryOutlined />} label={`${r.mediaCount ?? 0} files`} sx={{ mt: 0.5 }} />
                  </>
                ),
              },
              { label: 'Sent to Documentation', render: (r) => formatDateTime(r.sentAt), nowrap: true },
              { label: 'Stage now', mobile: 'full', render: (r) => <StatusChip status={r.status} /> },
              {
                label: 'Action',
                align: 'right',
                mobile: 'full',
                hideMobileLabel: true,
                render: (r) => {
                  const canAdd = !isLocked(r.status);
                  return (
                    <Button
                      size="small"
                      variant={canAdd ? 'contained' : 'outlined'}
                      component={RouterLink}
                      to={`/orders/${r.id}${canAdd ? '#documents' : ''}`}
                      sx={{ whiteSpace: 'nowrap', width: { xs: '100%', md: 'auto' }, mt: { xs: 0.5, md: 0 } }}
                    >
                      {canAdd ? 'View / add files' : 'View'}
                    </Button>
                  );
                },
              },
            ]}
          />
          {!isPending && !rows.length && (
            <EmptyState
              icon={<LocalShippingOutlined />}
              title={q ? 'No matching orders' : 'Nothing sent yet'}
              text={q ? 'Try another order no, PI no or customer name.' : 'Orders show here once you mark packaging Completed.'}
            />
          )}
          <ListPagination page={page} pageSize={pageSize} total={data?.total ?? 0} onChange={setPage} noun="orders" inset />
        </Card>
      )}
      <Stack direction="row" sx={{ mt: 2 }}>
        <Button component={RouterLink} to="/packaging" variant="text">← Back to Packaging Queue</Button>
      </Stack>
    </Box>
  );
}
