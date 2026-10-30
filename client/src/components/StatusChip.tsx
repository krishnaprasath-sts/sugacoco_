import { Chip } from '@mui/material';
import { STATUS, type OrderStatus } from '../workflow/statuses';

export default function StatusChip({ status, size = 'small' }: { status: OrderStatus; size?: 'small' | 'medium' }) {
  const s = STATUS[status];
  return <Chip label={s.label} color={s.color} size={size} variant={status === 'CLOSED' ? 'filled' : 'outlined'} />;
}
