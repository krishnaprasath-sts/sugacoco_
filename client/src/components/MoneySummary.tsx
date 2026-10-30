import { Grid } from '@mui/material';
import TodayOutlined from '@mui/icons-material/TodayOutlined';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import HourglassEmptyOutlined from '@mui/icons-material/HourglassEmptyOutlined';
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import LocalShippingOutlined from '@mui/icons-material/LocalShippingOutlined';
import { useMoneySummary } from '../api/notifications';
import StatCard from './StatCard';

// Whole rupees on the tiles so big numbers fit; exact paise are on the order pages.
const rupees = (v?: string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v ?? 0));
const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** Received today / this month, waiting for verification, still to collect. Accounts and MD/Admin. */
export default function MoneySummary({ pendingLink }: { pendingLink?: string }) {
  const { data, isPending } = useMoneySummary();
  const pendingAmount = Number(data?.pendingAdvance.amount ?? 0) + Number(data?.pendingBalance.amount ?? 0);
  const pendingCount = (data?.pendingAdvance.count ?? 0) + (data?.pendingBalance.count ?? 0);
  const tiles = [
    { label: 'Received today', color: 'green' as const, icon: <TodayOutlined />, value: rupees(data?.receivedToday.amount), hint: n(data?.receivedToday.count ?? 0, 'payment') },
    { label: 'Received this month', color: 'teal' as const, icon: <CalendarMonthOutlined />, value: rupees(data?.receivedMonth.amount), hint: n(data?.receivedMonth.count ?? 0, 'payment') },
    {
      label: 'Waiting for verification',
      color: 'pink' as const,
      icon: <HourglassEmptyOutlined />,
      value: rupees(String(pendingAmount)),
      hint: `${n(data?.pendingAdvance.count ?? 0, 'advance', 'advances')} · ${n(data?.pendingBalance.count ?? 0, 'balance', 'balances')}`,
      to: pendingCount ? pendingLink : undefined,
    },
    { label: 'Balance to collect', color: 'olive' as const, icon: <LocalShippingOutlined />, value: rupees(data?.balanceDue.amount), hint: `Loaded · ${n(data?.balanceDue.count ?? 0, 'order')}` },
    { label: 'Total outstanding', color: 'violet' as const, icon: <AccountBalanceWalletOutlined />, value: rupees(data?.outstanding.amount), hint: `Open orders · ${n(data?.outstanding.count ?? 0, 'order')}` },
  ];
  return (
    <Grid container spacing={2.5} sx={{ mb: 3 }}>
      {tiles.map((t) => (
        <Grid key={t.label} size={{ xs: 12, sm: 6, lg: 'grow' }}>
          <StatCard {...t} loading={isPending} />
        </Grid>
      ))}
    </Grid>
  );
}
