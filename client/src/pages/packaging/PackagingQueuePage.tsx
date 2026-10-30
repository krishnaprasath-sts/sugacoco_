import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { Box, Button, Card, Chip, Grid, InputAdornment, Skeleton, Stack, TextField, Typography } from '@mui/material';
import HourglassEmptyOutlined from '@mui/icons-material/HourglassEmptyOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import PauseCircleOutline from '@mui/icons-material/PauseCircleOutlined';
import ReportProblemOutlined from '@mui/icons-material/ReportProblemOutlined';
import LocalShippingOutlined from '@mui/icons-material/LocalShippingOutlined';
import PhotoLibraryOutlined from '@mui/icons-material/PhotoLibraryOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { useMe } from '../../auth/useAuth';
import { usePackagingQueue } from '../../api/stages';
import { formatDate, formatDateTime } from '../../lib/format';
import PageHeader from '../../components/PageHeader';
import ListPagination from '../../components/ListPagination';
import { usePaged } from '../../lib/usePaged';
import StatCard from '../../components/StatCard';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import StageOrderCard from '../../components/StageOrderCard';

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'PACKAGING_ISSUE', label: 'Issue / rework' },
  { key: 'AWAITING_PACKAGING', label: 'Not started' },
  { key: 'PACKAGING_IN_PROGRESS', label: 'In progress' },
  { key: 'PACKAGING_ON_HOLD', label: 'On hold' },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

/** Whole days since the order reached its current packaging status. */
const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso.replace(' ', 'T') + 'Z').getTime()) / 86_400_000));

export default function PackagingQueuePage() {
  const { data: me } = useMe();
  const { data, isPending, error, refetch } = usePackagingQueue();
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [search, setSearch] = useState('');
  const all = useMemo(() => data?.active ?? [], [data]);
  const n = (s: string) => all.filter((r) => r.status === s).length;

  // Issues first (they block shipping), then oldest first.
  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all
      .filter((r) => filter === 'ALL' || r.status === filter)
      .filter((r) => !term || [r.orderNo, r.piNumber, r.customerName, r.products].some((v) => v?.toLowerCase().includes(term)))
      .sort((a, b) => Number(b.status === 'PACKAGING_ISSUE') - Number(a.status === 'PACKAGING_ISSUE'));
  }, [all, filter, search]);
  const paged = usePaged(shown, undefined, `${filter}|${search}`);
  const sentTotal = data?.sentTotal ?? 0;

  return (
    <Box>
      <PageHeader overline={`Welcome back, ${me?.name ?? ''}`} title="Packaging Queue" subtitle="Orders passed by QC. Issues first, then oldest first." />
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {[
          { label: 'Not started', color: 'violet' as const, icon: <HourglassEmptyOutlined />, value: n('AWAITING_PACKAGING') },
          { label: 'In progress', color: 'teal' as const, icon: <Inventory2Outlined />, value: n('PACKAGING_IN_PROGRESS') },
          { label: 'On hold', color: 'olive' as const, icon: <PauseCircleOutline />, value: n('PACKAGING_ON_HOLD') },
          { label: 'Issue / rework', color: 'pink' as const, icon: <ReportProblemOutlined />, value: n('PACKAGING_ISSUE') },
          { label: 'Sent to documentation', color: 'green' as const, icon: <LocalShippingOutlined />, value: sentTotal, to: '/packaging/sent', hint: 'View all' },
        ].map((t) => (
          <Grid key={t.label} size={{ xs: 6, sm: 4, lg: 'grow' }}>
            <StatCard {...t} loading={isPending} />
          </Grid>
        ))}
      </Grid>
      {error && <ErrorState error={error} onRetry={() => refetch()} />}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2, alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }} role="group" aria-label="Filter by packaging status">
          {FILTERS.map((f) => {
            const count = f.key === 'ALL' ? all.length : n(f.key);
            const on = filter === f.key;
            return (
              <Chip
                key={f.key}
                label={`${f.label} (${count})`}
                color={on ? 'primary' : f.key === 'PACKAGING_ISSUE' && count ? 'error' : 'default'}
                variant={on ? 'filled' : 'outlined'}
                onClick={() => setFilter(f.key)}
                aria-pressed={on}
              />
            );
          })}
        </Stack>
        <TextField
          size="small"
          placeholder="Search order, PI, customer or product"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: { xs: '100%', md: 320 } }}
          slotProps={{
            htmlInput: { 'aria-label': 'Search packaging queue' },
            input: { startAdornment: <InputAdornment position="start"><SearchOutlined fontSize="small" /></InputAdornment> },
          }}
        />
      </Stack>

      <Stack spacing={1.5} sx={{ mb: 4 }}>
        {isPending && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} variant="rounded" height={110} />)}
        {!error && !isPending && !shown.length && (
          <Card>
            <EmptyState
              icon={<Inventory2Outlined />}
              title={all.length ? 'No orders match' : 'Nothing to pack'}
              text={all.length ? 'Try another filter or search.' : 'Orders appear here when QC marks them ready.'}
            />
          </Card>
        )}
        {paged.pageItems.map((r) => {
          const days = daysSince(r.statusChangedAt);
          return (
            <StageOrderCard
              key={r.id}
              row={r}
              highlight={r.status === 'PACKAGING_ISSUE'}
              chips={<Chip size="small" variant="outlined" icon={<PhotoLibraryOutlined />} label={`${r.mediaCount ?? 0} photos`} />}
              meta={[
                { label: 'QC ready date', value: formatDate(r.expectedReadyDate, '—') },
                { label: 'Packed so far', value: r.quantityPacked ? Number(r.quantityPacked) : '—' },
                { label: 'In this status', value: days === 0 ? 'Today' : `${days} day${days > 1 ? 's' : ''}`, tone: days >= 3 ? 'warning' : undefined },
                { label: 'Last update', value: formatDateTime(r.statusChangedAt) },
              ]}
              action={{ label: r.status === 'AWAITING_PACKAGING' ? 'Start packing' : 'Update', primary: true }}
            />
          );
        })}
        <ListPagination page={paged.page} pageSize={paged.pageSize} total={paged.total} onChange={paged.setPage} noun="orders" />
      </Stack>

      {(data?.sentToDocumentation.length ?? 0) > 0 && (
        <>
          <Stack direction="row" sx={{ mb: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" component="h2">
              Recently sent to Documentation
            </Typography>
            <Button component={RouterLink} to="/packaging/sent" size="small" variant="outlined">
              View all ({sentTotal})
            </Button>
          </Stack>
          <Stack spacing={1.5}>
            {data!.sentToDocumentation.slice(0, 3).map((r) => (
              <StageOrderCard key={r.id} row={r} meta={[{ label: 'Last update', value: formatDateTime(r.statusChangedAt) }]} action={{ label: 'View' }} />
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}
