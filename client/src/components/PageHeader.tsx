import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import { Box, Button, Stack, Typography } from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';

type Props = {
  title: ReactNode;
  /** Small grey line above the title, e.g. the section name ("Customer Details"). */
  overline?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** onClick (e.g. navigate(-1)) overrides the link target. */
  back?: { to: string; label: string; onClick?: () => void };
};

export default function PageHeader({ title, overline, subtitle, actions, back }: Props) {
  return (
    <Box sx={{ mb: 2.5 }}>
      {back && (
        <Button
          component={RouterLink}
          to={back.to}
          onClick={back.onClick ? (e: React.MouseEvent) => { e.preventDefault(); back.onClick!(); } : undefined}
          startIcon={<ArrowBack />}
          size="small"
          color="inherit"
          sx={{ mb: 1, ml: -1.5, minHeight: 32 }}
        >
          {back.label}
        </Button>
      )}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}
      >
        <Box sx={{ minWidth: 0 }}>
          {overline && <Typography sx={{ color: 'text.secondary', fontSize: 12.5, mb: 0.25 }}>{overline}</Typography>}
          <Typography variant="h5" component="h1" sx={{ wordBreak: 'break-word' }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography component="div" sx={{ color: 'text.secondary', mt: 0.25, fontSize: 13 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && (
          <Stack direction="row" useFlexGap spacing={1} sx={{ flexShrink: 0, flexWrap: 'wrap', '& > *': { minHeight: 36 } }}>
            {actions}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
