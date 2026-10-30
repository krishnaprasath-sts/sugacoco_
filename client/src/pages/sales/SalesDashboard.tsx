import { Link as RouterLink } from 'react-router';
import { Box, Button, Card, Grid, Stack, Typography } from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import ErrorOutline from '@mui/icons-material/ErrorOutlined';
import AccountBalanceOutlined from '@mui/icons-material/AccountBalanceOutlined';
import PrecisionManufacturingOutlined from '@mui/icons-material/PrecisionManufacturingOutlined';
import LocalShippingOutlined from '@mui/icons-material/LocalShippingOutlined';
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined';
import { useOrders, useOrderSummary } from '../../api/orders';
import { useMe } from '../../auth/useAuth';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import StatCard from '../../components/StatCard';
import type { StatColor } from '../../theme';
import OrdersTable from '../orders/OrdersTable';
import { SALES_FILTERS } from './MyOrdersPage';

const TILES: { key: string; label: string; color: StatColor; icon: React.ReactNode }[] = [
  { key: 'action', label: 'Rejected · needs action', color: 'pink', icon: <ErrorOutline /> },
  { key: 'accounts', label: 'With Accounts', color: 'violet', icon: <AccountBalanceOutlined /> },
  { key: 'production', label: 'Production & packaging', color: 'olive', icon: <PrecisionManufacturingOutlined /> },
  { key: 'shipping', label: 'Shipping & documents', color: 'teal', icon: <LocalShippingOutlined /> },
  { key: 'closed', label: 'Completed', color: 'green', icon: <TaskAltOutlined /> },
];

export default function SalesDashboard() {
  const { data: me } = useMe();
  const summary = useOrderSummary(true);
  const action = useOrders({ mine: true, status: SALES_FILTERS.action.statuses, pageSize: 10 });
  const recent = useOrders({ mine: true, pageSize: 8 });
  const counts = summary.data?.counts ?? {};
  const count = (key: string) => SALES_FILTERS[key].statuses.reduce((n, s) => n + (counts[s] ?? 0), 0);

  return (
    <Box>
      <PageHeader
        overline={`Welcome back, ${me?.name ?? ''}`}
        title="Dashboard"
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} component={RouterLink} to="/sales/orders/new">
            Create order
          </Button>
        }
      />

      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {TILES.map((t) => (
          <Grid key={t.key} size={{ xs: 6, sm: 4, lg: 'grow' }}>
            <StatCard
              label={t.label}
              value={count(t.key)}
              icon={t.icon}
              color={t.color}
              to={`/sales/orders?filter=${t.key}`}
              loading={summary.isPending}
            />
          </Grid>
        ))}
      </Grid>

      {(action.data?.orders.length ?? 0) > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
            Needs your action
          </Typography>
          <OrdersTable orders={action.data!.orders} />
        </Box>
      )}

      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mb: 1.5 }}>
        <Typography variant="h6" component="h2">
          Recent orders
        </Typography>
        <Button component={RouterLink} to="/sales/orders">
          View all
        </Button>
      </Stack>
      {recent.error ? (
        <ErrorState error={recent.error} onRetry={() => recent.refetch()} />
      ) : !recent.isPending && recent.data?.orders.length === 0 ? (
        <Card>
          <EmptyState
            title="No orders yet"
            text="When a customer approves a PI, register it here."
            action={
              <Button variant="contained" component={RouterLink} to="/sales/orders/new">
                Create your first order
              </Button>
            }
          />
        </Card>
      ) : (
        <OrdersTable orders={recent.data?.orders ?? []} loading={recent.isPending} />
      )}
    </Box>
  );
}
