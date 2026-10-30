import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import ConstructionOutlined from '@mui/icons-material/ConstructionOutlined';
import type { NavItem } from '../nav/navConfig';

/** Stand-in for screens not built yet. Replaced phase by phase. */
export default function PlaceholderPage({ item }: { item: NavItem }) {
  return (
    <Box>
      <Typography variant="h5" component="h1">
        {item.label}
      </Typography>
      <Typography sx={{ color: 'text.secondary', mt: 0.5, mb: 3 }}>{item.description}</Typography>
      <Card>
        <CardContent sx={{ py: 6, textAlign: 'center' }}>
          <ConstructionOutlined sx={{ fontSize: 40, color: 'text.secondary' }} aria-hidden />
          <Typography variant="subtitle1" sx={{ mt: 1 }}>
            This screen is not built yet
          </Typography>
          <Chip label={`Planned in Phase ${item.phase}`} size="small" sx={{ mt: 1.5 }} />
        </CardContent>
      </Card>
    </Box>
  );
}
