import { Link as RouterLink } from 'react-router';
import { Box, Button, Card, CardContent, Chip, Grid, Skeleton, Stack, Typography } from '@mui/material';
import HourglassEmptyOutlined from '@mui/icons-material/HourglassEmptyOutlined';
import PrecisionManufacturingOutlined from '@mui/icons-material/PrecisionManufacturingOutlined';
import LocalShippingOutlined from '@mui/icons-material/LocalShippingOutlined';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined';
import PhotoLibraryOutlined from '@mui/icons-material/PhotoLibraryOutlined';
import { useMe } from '../../auth/useAuth';
import { QUALITY_LABEL, SOURCING_LABEL, useQcQueue, type QcQueueRow } from '../../api/qc';
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

function QueueCard({ row, done }: { row: QcQueueRow; done?: boolean }) {
  const overdue = !done && isOverdue(row);
  return (
    <Card sx={overdue ? { borderColor: 'error.main', borderWidth: 2 } : undefined}>
      <CardContent>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
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

          <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
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
            <Box sx={{ minWidth: 150 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Last update
              </Typography>
              <Typography>{formatDateTime(row.statusChangedAt)}</Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: { xs: 'space-between', md: 'flex-end' } }}>
            <Chip size="small" variant="outlined" icon={<PhotoLibraryOutlined />} label={`${row.mediaCount} photo${row.mediaCount === 1 ? '' : 's'}`} />
            <Button variant={done ? 'outlined' : 'contained'} component={RouterLink} to={`/orders/${row.id}`} sx={{ whiteSpace: 'nowrap' }}>
              {done ? 'View' : row.status === 'AWAITING_QC' ? 'Start' : 'Update'}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function QcQueuePage() {
  const { data: me } = useMe();
  const { data, isPending, error, refetch } = useQcQueue();
  const active = data?.active ?? [];
  const activePaged = usePaged(active);
  const sentPaged = usePaged(data?.sentToPackaging, 5);
  const count = (pred: (r: QcQueueRow) => boolean) => active.filter(pred).length;

  return (
    <Box>
      <PageHeader overline={`Welcome back, ${me?.name ?? ''}`} title="QC Work Queue" subtitle="Payment-confirmed orders. Earliest ready date first." />

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

      <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
        In QC / Production ({active.length})
      </Typography>
      <Stack spacing={1.5} sx={{ mb: 4 }}>
        {isPending && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rounded" height={110} />)}
        {!error && !isPending && active.length === 0 && (
          <Card>
            <EmptyState icon={<PrecisionManufacturingOutlined />} title="No orders in QC" text="Orders appear here once Accounts approves the advance payment." />
          </Card>
        )}
        {activePaged.pageItems.map((r) => (
          <QueueCard key={r.id} row={r} />
        ))}
        <ListPagination page={activePaged.page} pageSize={activePaged.pageSize} total={activePaged.total} onChange={activePaged.setPage} noun="orders" />
      </Stack>

      {(data?.sentToPackaging.length ?? 0) > 0 && (
        <>
          <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
            Recently sent to Packaging
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
            You can still add container and loading images to these orders.
          </Typography>
          <Stack spacing={1.5}>
            {sentPaged.pageItems.map((r) => (
              <QueueCard key={r.id} row={r} done />
            ))}
        <ListPagination page={sentPaged.page} pageSize={sentPaged.pageSize} total={sentPaged.total} onChange={sentPaged.setPage} noun="orders" sizeSelector={false} />
          </Stack>
        </>
      )}
    </Box>
  );
}
