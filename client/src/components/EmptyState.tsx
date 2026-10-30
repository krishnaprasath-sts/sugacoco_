import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

export default function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <Box sx={{ py: 6, px: 2, textAlign: 'center' }}>
      {icon && <Box sx={{ color: 'text.secondary', '& svg': { fontSize: 40 } }}>{icon}</Box>}
      <Typography variant="subtitle1" sx={{ mt: 1 }}>
        {title}
      </Typography>
      {text && <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>{text}</Typography>}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}
