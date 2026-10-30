import { useSearchParams } from 'react-router';
import { Alert, Box, Card, Grid, Skeleton, Stack, Tab, Tabs } from '@mui/material';
import PlaylistAddOutlined from '@mui/icons-material/PlaylistAddOutlined';
import LocalShippingOutlined from '@mui/icons-material/LocalShippingOutlined';
import AccountBalanceOutlined from '@mui/icons-material/AccountBalanceOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import { useMe } from '../../auth/useAuth';
import { useDocumentationQueue, type StageRow } from '../../api/stages';
import { formatDateTime } from '../../lib/format';
import type { OrderStatus } from '../../workflow/statuses';
import PageHeader from '../../components/PageHeader';
import ListPagination from '../../components/ListPagination';
import { usePaged } from '../../lib/usePaged';
import StatCard from '../../components/StatCard';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import StageOrderCard from '../../components/StageOrderCard';

const GROUPS: { key: string; label: string; statuses: OrderStatus[]; empty: string }[] = [
  { key: 'start', label: 'To start', statuses: ['READY_FOR_DOCUMENTATION'], empty: 'No packed orders waiting for booking.' },
  { key: 'loading', label: 'Booking & loading', statuses: ['DOCUMENTATION_IN_PROGRESS'], empty: 'No orders being loaded.' },
  { key: 'balance', label: 'Waiting for balance', statuses: ['AWAITING_BALANCE_VERIFICATION', 'BALANCE_REJECTED'], empty: 'No orders waiting for balance payment.' },
  { key: 'release', label: 'Gate-in & release', statuses: ['AWAITING_DOCUMENT_RELEASE'], empty: 'No orders ready for gate-in and document release.' },
];

/** `defaultTab` lets the "Bill Release" menu item open the release tab directly. */
export default function DocumentationQueuePage({ defaultTab = 'start' }: { defaultTab?: string }) {
  const { data: me } = useMe();
  const [params, setParams] = useSearchParams();
  const tab = GROUPS.some((g) => g.key === params.get('tab')) ? params.get('tab')! : defaultTab;
  const { data, isPending, error, refetch } = useDocumentationQueue();
  const orders = data?.orders ?? [];
  const inGroup = (key: string) => orders.filter((o) => GROUPS.find((g) => g.key === key)!.statuses.includes(o.status));
  const group = GROUPS.find((g) => g.key === tab)!;
  const tabPaged = usePaged(inGroup(tab), undefined, tab);

  const meta = (r: StageRow) => [
    { label: 'Containers', value: r.containerCount ?? 0 },
    { label: 'Loaded', value: `${r.loadedCount ?? 0}/${r.containerCount ?? 0}` },
    { label: 'Gate-in', value: `${r.gatedCount ?? 0}/${r.containerCount ?? 0}` },
    { label: 'Released docs', value: r.releasedCount ?? 0 },
    { label: 'Last update', value: formatDateTime(r.statusChangedAt) },
  ];

  return (
    <Box>
      <PageHeader overline={`Welcome back, ${me?.name ?? ''}`} title={defaultTab === 'release' ? 'Bill Release' : 'Documentation Queue'} subtitle="Container booking, loading, gate-in and document release." />
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {[
          { key: 'start', color: 'violet' as const, icon: <PlaylistAddOutlined /> },
          { key: 'loading', color: 'teal' as const, icon: <LocalShippingOutlined /> },
          { key: 'balance', color: 'olive' as const, icon: <AccountBalanceOutlined /> },
          { key: 'release', color: 'pink' as const, icon: <DescriptionOutlined /> },
        ].map((t) => (
          <Grid key={t.key} size={{ xs: 6, md: 3 }}>
            <StatCard label={GROUPS.find((g) => g.key === t.key)!.label} value={inGroup(t.key).length} icon={t.icon} color={t.color} loading={isPending} to={`?tab=${t.key}`} />
          </Grid>
        ))}
      </Grid>
      <Tabs value={tab} onChange={(_, v) => setParams({ tab: v }, { replace: true })} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 2 }}>
        {GROUPS.map((g) => (
          <Tab key={g.key} value={g.key} label={`${g.label} (${inGroup(g.key).length})`} />
        ))}
      </Tabs>
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {tab === 'balance' && <Alert severity="info" sx={{ mb: 2 }}>Gate-in opens once Accounts approves the balance payment.</Alert>}
      <Stack spacing={1.5}>
        {isPending && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} variant="rounded" height={110} />)}
        {!error && !isPending && !inGroup(tab).length && (
          <Card>
            <EmptyState icon={<LocalShippingOutlined />} title={group.empty} />
          </Card>
        )}
        {tabPaged.pageItems.map((r) => (
          <StageOrderCard
            key={r.id}
            row={r}
            meta={meta(r)}
            action={{ label: tab === 'start' ? 'Book container' : tab === 'balance' ? 'View' : 'Open', primary: tab !== 'balance' }}
          />
        ))}
        <ListPagination page={tabPaged.page} pageSize={tabPaged.pageSize} total={tabPaged.total} onChange={tabPaged.setPage} noun="orders" />
      </Stack>
    </Box>
  );
}
