import { useState } from 'react';
import { Box, Card, Stack, Typography } from '@mui/material';
import ListPagination from '../../components/ListPagination';
import { usePageSize } from '../../lib/pageSize';
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined';
import { useOrders } from '../../api/orders';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import OrdersTable from '../orders/OrdersTable';

function Section({ title, hint, statuses }: { title: string; hint: string; statuses: Parameters<typeof useOrders>[0]['status'] }) {
  const [page, setPage] = useState(1);
  const [pageSize] = usePageSize();
  const { data, isPending, error, refetch } = useOrders({ status: statuses, page, pageSize });
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" component="h2">
        {title} ({data?.total ?? 0})
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
        {hint}
      </Typography>
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !isPending && !data?.orders.length ? (
        <Card>
          <EmptyState icon={<PaymentsOutlined />} title="Nothing here" />
        </Card>
      ) : (
        <OrdersTable orders={data?.orders ?? []} loading={isPending} showOwner />
      )}
      <ListPagination page={page} pageSize={pageSize} total={data?.total ?? 0} onChange={setPage} noun="orders" />
    </Box>
  );
}

export default function BalancePaymentsPage() {
  return (
    <Stack>
      <PageHeader overline="Payments" title="Balance Payments" subtitle="Record the balance after loading. Gate-in happens only after Accounts approves it." />
      <Section title="Balance rejected · needs your action" hint="Accounts rejected the balance. Open the order, check the reason, and record the payment again." statuses={['BALANCE_REJECTED']} />
      <Section title="Loading in progress" hint="Record the balance once Documentation has loaded every container. The order page shows when it is ready." statuses={['DOCUMENTATION_IN_PROGRESS']} />
      <Section title="With Accounts" hint="Balance recorded, waiting for Accounts to verify." statuses={['AWAITING_BALANCE_VERIFICATION']} />
    </Stack>
  );
}
