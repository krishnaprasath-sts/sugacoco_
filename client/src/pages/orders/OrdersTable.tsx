import { Link as RouterLink, useNavigate } from 'react-router';
import {
  Card,
  CardActionArea,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { OrderListRow } from '../../api/orders';
import { formatDate, formatDateTime, formatMoney } from '../../lib/format';
import StatusChip from '../../components/StatusChip';

type Props = { orders: OrderListRow[]; loading?: boolean; showValue?: boolean; showOwner?: boolean };

/** Orders as a table on desktop and cards on phones. Rows open the order. */
export default function OrdersTable({ orders, loading, showValue = true, showOwner = false }: Props) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const navigate = useNavigate();
  const hasValue = showValue && orders.some((o) => o.totalValue !== undefined);

  if (!isDesktop) {
    return (
      <Stack spacing={1.5}>
        {loading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rounded" height={110} />)}
        {orders.map((o) => (
          <Card key={o.id}>
            <CardActionArea component={RouterLink} to={`/orders/${o.id}`} sx={{ p: 2 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>{o.orderNo}</Typography>
                {hasValue && <Typography sx={{ fontWeight: 600 }}>{formatMoney(o.totalValue, o.currency)}</Typography>}
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {o.customerName} · PI no: {o.piNumber}
              </Typography>
              <Stack direction="row" sx={{ mt: 1, justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <StatusChip status={o.status} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {formatDate(o.piDate)}
                </Typography>
              </Stack>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
    );
  }

  return (
    <Card>
      <TableContainer>
        <Table aria-label="Orders">
          <TableHead>
            <TableRow>
              <TableCell>Order / PI</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>PI date</TableCell>
              {hasValue && <TableCell align="right">Value</TableCell>}
              <TableCell>Status</TableCell>
              <TableCell>Last update</TableCell>
              {showOwner && <TableCell>Sales</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton />
                  </TableCell>
                </TableRow>
              ))}
            {orders.map((o) => (
              <TableRow key={o.id} hover onClick={() => navigate(`/orders/${o.id}`)} sx={{ cursor: 'pointer' }}>
                <TableCell>
                  <Typography
                    component={RouterLink}
                    to={`/orders/${o.id}`}
                    onClick={(e) => e.stopPropagation()}
                    sx={{ fontWeight: 600, fontSize: 14, color: 'primary.dark', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                  >
                    {o.orderNo}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {o.piNumber}
                  </Typography>
                </TableCell>
                <TableCell>{o.customerName}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(o.piDate)}</TableCell>
                {hasValue && (
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {formatMoney(o.totalValue, o.currency)}
                  </TableCell>
                )}
                <TableCell>
                  <StatusChip status={o.status} />
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{formatDateTime(o.statusChangedAt)}</TableCell>
                {showOwner && <TableCell>{o.createdByName}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}
