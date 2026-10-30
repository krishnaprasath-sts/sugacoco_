import { Box, Card, Skeleton, Stack } from '@mui/material';
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined';
import { useFinalQueue } from '../../api/stages';
import { formatDateTime, formatMoney } from '../../lib/format';
import PageHeader from '../../components/PageHeader';
import ListPagination from '../../components/ListPagination';
import { usePaged } from '../../lib/usePaged';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import StageOrderCard from '../../components/StageOrderCard';

export default function FinalVerificationPage() {
  const { data, isPending, error, refetch } = useFinalQueue();
  const paged = usePaged(data?.orders);
  return (
    <Box>
      <PageHeader overline="Accounts" title="Final Verification" subtitle="Check payments, gate-in and document release, then close the order." />
      <Stack spacing={1.5}>
        {isPending && <Skeleton variant="rounded" height={110} />}
        {error && <ErrorState error={error} onRetry={() => refetch()} />}
        {!error && !isPending && !data?.orders.length && (
          <Card>
            <EmptyState icon={<TaskAltOutlined />} title="No orders waiting for closure" />
          </Card>
        )}
        {paged.pageItems.map((o) => {
          const outstanding = Number(o.totalValue) - Number(o.received);
          return (
            <StageOrderCard
              key={o.id}
              row={o}
              meta={[
                { label: 'Order total', value: formatMoney(o.totalValue, o.currency) },
                { label: 'Received', value: formatMoney(o.received, o.currency) },
                { label: 'Difference', value: formatMoney(outstanding, o.currency), tone: Math.abs(outstanding) >= 0.005 ? 'warning' : 'success' },
                { label: 'Waiting since', value: formatDateTime(o.statusChangedAt) },
              ]}
              action={{ label: 'Verify & close', primary: true }}
            />
          );
        })}
        <ListPagination page={paged.page} pageSize={paged.pageSize} total={paged.total} onChange={paged.setPage} noun="orders" />
      </Stack>
    </Box>
  );
}
