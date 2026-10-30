import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import { Box, Button, Card, CardContent, Divider, Stack, Typography } from '@mui/material';
import type { OrderStatus } from '../workflow/statuses';
import StatusChip from './StatusChip';

export type Meta = { label: string; value: ReactNode; tone?: 'error' | 'warning' | 'success' };

type Props = {
  row: { id: number; orderNo: string; piNumber: string; customerName: string; status: OrderStatus; products?: string | null };
  meta: Meta[];
  chips?: ReactNode;
  action: { label: string; primary?: boolean };
  highlight?: boolean;
};

/** One order in a department queue: identity + action on top, key facts in a row underneath. */
export default function StageOrderCard({ row, meta, chips, action, highlight }: Props) {
  return (
    <Card sx={highlight ? { border: '2px solid', borderColor: 'error.main' } : undefined}>
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
              <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{row.orderNo}</Typography>
              <StatusChip status={row.status} />
              {chips}
            </Stack>
            <Typography sx={{ color: 'text.secondary' }}>
              {row.customerName} · PI no: {row.piNumber}
            </Typography>
            {row.products && (
              <Typography variant="body2" sx={{ mt: 0.25 }}>
                {row.products}
              </Typography>
            )}
          </Box>
          <Button
            variant={action.primary ? 'contained' : 'outlined'}
            component={RouterLink}
            to={`/orders/${row.id}`}
            sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {action.label}
          </Button>
        </Stack>
        {meta.length > 0 && (
          <>
            <Divider sx={{ my: 1.75 }} />
            <Stack direction="row" sx={{ flexWrap: 'wrap', columnGap: 4, rowGap: 1.25 }}>
              {meta.map((m) => (
                <Box key={m.label}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {m.label}
                  </Typography>
                  <Typography sx={{ fontWeight: 600, color: m.tone ? `${m.tone}.main` : 'text.primary' }}>{m.value}</Typography>
                </Box>
              ))}
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
  );
}
