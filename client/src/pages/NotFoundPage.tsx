import { Link as RouterLink } from 'react-router';
import { Box, Button, Typography } from '@mui/material';
import { useMe } from '../auth/useAuth';
import { homePath } from '../nav/navConfig';

export default function NotFoundPage() {
  const { data: user } = useMe();
  return (
    <Box sx={{ py: 10, textAlign: 'center', px: 2 }}>
      <Typography variant="h5" component="h1">
        Page not found
      </Typography>
      <Typography sx={{ color: 'text.secondary', mt: 1, mb: 3 }}>
        The link may be wrong or the page was moved.
      </Typography>
      <Button component={RouterLink} to={homePath(user)} variant="contained">
        Go to my dashboard
      </Button>
    </Box>
  );
}
