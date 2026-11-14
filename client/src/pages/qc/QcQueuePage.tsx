import { useUrlPage, useUrlState } from '../../lib/useUrlState';
import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router';
import { Box, Button, Card, CardContent, Chip, Grid, InputAdornment, Skeleton, Stack, TextField, Typography } from '@mui/material';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import HourglassEmptyOutlined from '@mui/icons-material/HourglassEmptyOutlined';
import PrecisionManufacturingOutlined from '@mui/icons-material/PrecisionManufacturingOutlined';
import LocalShippingOutlined from '@mui/icons-material/LocalShippingOutlined';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined';
import PhotoLibraryOutlined from '@mui/icons-material/PhotoLibraryOutlined';
import { useMe } from '../../auth/useAuth';
import { QUALITY_LABEL, SOURCING_LABEL, useQcQueue, useQcSent, type QcQueueRow } from '../../api/qc';
import { useDebounced } from '../../lib/useDebounced';
import { usePageSize } from '../../lib/pageSize';
import { QC_STATUS_LABEL } from '../../workflow/statuses';
import { formatDate, formatDateTime } from '../../lib/format';
import PageHeader from '../../components/PageHeader';
import ListPagination from '../../components/ListPagination';
import { usePaged } from '../../lib/usePaged';
import StatCard from '../../components/StatCard';
import StatusChip from '../../components/StatusChip';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';

const today = () => new Date().toLocaleDateString('en-CA');
const isOverdue = (r: QcQueueRow) => !!r.expectedReadyDate && r.expectedReadyDate < today();

/** Search box + filtered list for the QC lists (data is already in the browser). */
function useSearch(rows: QcQueueRow[]) {
  const [search, setSearch] = useUrlState('q');
  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q
        ? rows.filter((r) => [r.orderNo, r.piNumber, r.customerName, r.products].some((v) => v?.toLowerCase().includes(q)))
        : rows,
    [rows, q],
  );
  return { q, filtered, box: <SearchBox value={search} onChange={setSearch} /> };
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TextField
      size="small"
      placeholder="Search order no, PI no, customer or product"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{ mb: 2, maxWidth: { md: 420 } }}
      slotProps={{
        htmlInput: { 'aria-label': 'Search orders' },
        input: { startAdornment: <InputAdornment position="start"><SearchOutlined fontSize="small" /></InputAdornment> },
      }}
    />
  );
}

function NoMatch() {
  return (
    <Card>
      <EmptyState icon={<SearchOutlined />} title="No matching orders" text="Try another order no, PI no, customer or product." />
    </Card>
  );
}

function QueueCard({ row, done }: { row: QcQueueRow; done?: boolean }) {
  const overdue = !done && isOverdue(row);
  return (
    <Card sx={overdue ? { borderColor: 'error.main', borderWidth: 2 } : undefined}>
      <CardContent>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 125px 150px 180px 200px' },
            gap: 2,
            alignItems: { lg: 'center' },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
              <Typography sx={{ fontWeight: 700 }}>{row.orderNo}</Typography>
              <StatusChip status={row.status} />
              {row.qcStatus === 'ON_HOLD' && <Chip size="small" color="warning" label={QC_STATUS_LABEL.ON_HOLD} />}
            </Stack>
            <Typography sx={{ color: 'text.secondary' }}>
              {row.customerName} · PI no: {row.piNumber}
            </Typography>
            {row.products && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {row.products}
              </Typography>
            )}
          </Box>

          {/* On lg+ `contents` lets the 3 meta boxes sit directly in the parent's fixed columns so every card aligns vertically. */}
          <Box
            sx={{
              display: { xs: 'grid', lg: 'contents' },
              gridTemplateColumns: { xs: 'repeat(auto-fit, minmax(140px, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Expected ready
              </Typography>
              <Typography sx={{ fontWeight: 600, color: overdue ? 'error.main' : 'text.primary' }}>
                {formatDate(row.expectedReadyDate, 'Not set')}
                {overdue && ' · overdue'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Sourcing / Quality
              </Typography>
              <Typography>
                {row.sourcingStatus ? SOURCING_LABEL[row.sourcingStatus] : '—'} / {row.qualityCheckStatus ? QUALITY_LABEL[row.qualityCheckStatus] : '—'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Last update
              </Typography>
              <Typography sx={{ whiteSpace: { lg: 'nowrap' } }}>{formatDateTime(row.statusChangedAt)}</Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: { xs: 'space-between', lg: 'flex-end' } }}>
            <Chip size="small" variant="outlined" icon={<PhotoLibraryOutlined />} label={`${row.mediaCount} photo${row.mediaCount === 1 ? '' : 's'}`} />
            <Button variant={done ? 'outlined' : 'contained'} component={RouterLink} to={`/orders/${row.id}`} sx={{ whiteSpace: 'nowrap' }}>
              {done ? 'View' : row.status === 'AWAITING_QC' ? 'Start' : 'Update'}
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}

/** QC home: counts by stage and the next few orders due. */
export default function QcDashboardPage() {
  const { data: me } = useMe();
  const { data, isPending, error, refetch } = useQcQueue();
  const active = data?.active ?? [];
  const dueNext = active.slice(0, 5); // list is already sorted by earliest ready date
  const count = (pred: (r: QcQueueRow) => boolean) => active.filter(pred).length;

  return (
    <Box>
      <PageHeader overline={`Welcome back, ${me?.name ?? ''}`} title="Dashboard" subtitle="Payment-confirmed orders waiting on QC / Production." />

      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {[
          { label: 'Not started', color: 'violet' as const, icon: <HourglassEmptyOutlined />, value: count((r) => r.status === 'AWAITING_QC') },
          { label: 'In production', color: 'teal' as const, icon: <PrecisionManufacturingOutlined />, value: count((r) => r.status === 'QC_IN_PROGRESS') },
          { label: 'Waiting for materials', color: 'olive' as const, icon: <LocalShippingOutlined />, value: count((r) => r.status === 'WAITING_FOR_MATERIALS') },
          { label: 'Quality check', color: 'green' as const, icon: <FactCheckOutlined />, value: count((r) => r.status === 'AWAITING_QUALITY_CHECK') },
          { label: 'Overdue', color: 'pink' as const, icon: <EventBusyOutlined />, value: count(isOverdue) },
        ].map((t) => (
          <Grid key={t.label} size={{ xs: 6, sm: 4, lg: 'grow' }}>
            <StatCard label={t.label} value={t.value} icon={t.icon} color={t.color} loading={isPending} />
          </Grid>
        ))}
      </Grid>

      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="h6" component="h2">
          Due next
        </Typography>
        {active.length > dueNext.length && (
          <Button component={RouterLink} to="/qc/queue" size="small">
            View all {active.length} →
          </Button>
        )}
      </Stack>
      <Stack spacing={1.5}>
        {isPending && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rounded" height={110} />)}
        {!error && !isPending && active.length === 0 && (
          <Card>
            <EmptyState icon={<PrecisionManufacturingOutlined />} title="No orders in QC" text="Orders appear here once Accounts approves the advance payment." />
          </Card>
        )}
        {dueNext.map((r) => (
          <QueueCard key={r.id} row={r} />
        ))}
      </Stack>
    </Box>
  );
}

/** Every order currently with QC / Production. */
export function QcQueueListPage() {
  const { data, isPending, error, refetch } = useQcQueue();
  const active = useMemo(() => data?.active ?? [], [data]);
  const { q, filtered, box } = useSearch(active);
  const activePaged = usePaged(filtered, undefined, q);

  return (
    <Box>
      <PageHeader
        overline="QC / Production"
        title={`In QC / Production${data ? ` (${active.length})` : ''}`}
        subtitle="Payment-confirmed orders. Earliest ready date first."
      />
      {box}
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      <ListPagination page={activePaged.page} pageSize={activePaged.pageSize} total={activePaged.total} onChange={activePaged.setPage} noun="orders" placement="top" />
      <Stack spacing={1.5}>
        {isPending && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rounded" height={110} />)}
        {!error && !isPending && active.length === 0 && (
          <Card>
            <EmptyState icon={<PrecisionManufacturingOutlined />} title="No orders in QC" text="Orders appear here once Accounts approves the advance payment." />
          </Card>
        )}
        {!error && !isPending && active.length > 0 && filtered.length === 0 && <NoMatch />}
        {activePaged.pageItems.map((r) => (
          <QueueCard key={r.id} row={r} />
        ))}
        <ListPagination page={activePaged.page} pageSize={activePaged.pageSize} total={activePaged.total} onChange={activePaged.setPage} noun="orders" />
      </Stack>

    </Box>
  );
}

/** Every order QC handed to Packaging (searched on the server, so older orders are found too). */
export function QcSentPage() {
  const [search, setSearch] = useUrlState('q');
  const [page, setPage] = useUrlPage();
  const [pageSize] = usePageSize();
  const q = useDebounced(search.trim());
  const { data, isPending, error, refetch } = useQcSent(page, pageSize, q);
  const rows = data?.orders ?? [];

  return (
    <Box>
      <PageHeader
        overline="QC / Production"
        title="Sent to Packaging"
        subtitle="Orders you finished and handed to Packaging, newest first. You can still add container and loading images to them."
      />
      <SearchBox
        value={search}
        onChange={(v) => setSearch(v, { resetPage: true })}
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      <ListPagination page={page} pageSize={pageSize} total={data?.total ?? 0} onChange={setPage} noun="orders" placement="top" />
      <Stack spacing={1.5}>
        {isPending && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rounded" height={110} />)}
        {!error && !isPending && rows.length === 0 &&
          (q ? (
            <NoMatch />
          ) : (
            <Card>
              <EmptyState icon={<LocalShippingOutlined />} title="Nothing sent yet" text="Orders show here once you mark them ready for packaging." />
            </Card>
          ))}
        {rows.map((r) => (
          <QueueCard key={r.id} row={r} done />
        ))}
        <ListPagination page={page} pageSize={pageSize} total={data?.total ?? 0} onChange={setPage} noun="orders" />
      </Stack>
    </Box>
  );
}
