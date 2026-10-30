import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import { Box, ButtonBase, Skeleton, Typography } from '@mui/material';
import { STAT_GRADIENTS, type StatColor } from '../theme';

type Props = {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  color: StatColor;
  to?: string;
  loading?: boolean;
  hint?: string;
};

/** Colourful gradient stat tile (Chola style): icon square, big number, label, decorative circle. */
export default function StatCard({ label, value, icon, color, to, loading, hint }: Props) {
  const body = (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        minHeight: { xs: 104, sm: 116 },
        p: { xs: 1.75, sm: 2 },
        borderRadius: '18px',
        background: STAT_GRADIENTS[color],
        color: '#FFFFFF',
        textAlign: 'left',
        boxShadow: '0 12px 28px rgba(31,16,56,0.12)',
        transition: 'transform 150ms ease, box-shadow 150ms ease',
        '&:hover': to ? { transform: 'translateY(-2px)', boxShadow: '0 16px 32px rgba(31,16,56,0.18)' } : undefined,
        // Decorative circle, top-right
        '&::after': {
          content: '""',
          position: 'absolute',
          width: 140,
          height: 140,
          borderRadius: '50%',
          top: -55,
          right: -40,
          background: 'rgba(255,255,255,0.13)',
        },
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '10px',
          bgcolor: 'rgba(255,255,255,0.22)',
          display: 'grid',
          placeItems: 'center',
          mb: 1,
          '& svg': { fontSize: 19 },
        }}
        aria-hidden
      >
        {icon}
      </Box>
      {loading ? (
        <Skeleton variant="text" width={60} sx={{ fontSize: 40, bgcolor: 'rgba(255,255,255,0.3)' }} />
      ) : (
        <Typography sx={{ fontSize: typeof value === 'string' && value.length > 8 ? { xs: 22, sm: 24 } : { xs: 24, sm: 28 }, fontWeight: 800, whiteSpace: 'nowrap', lineHeight: 1.1, letterSpacing: '-0.02em' }}>{value}</Typography>
      )}
      <Typography sx={{ fontSize: { xs: 12.5, sm: 13.5 }, fontWeight: 500, mt: 0.25 }}>{label}</Typography>
      {hint && <Typography sx={{ fontSize: 13, opacity: 0.85, mt: 0.25 }}>{hint}</Typography>}
    </Box>
  );

  if (!to) return body;
  return (
    <ButtonBase component={RouterLink} to={to} sx={{ display: 'block', width: '100%', height: '100%', borderRadius: '18px' }} aria-label={`${label}: ${value}`}>
      {body}
    </ButtonBase>
  );
}
