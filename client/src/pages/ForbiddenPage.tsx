import { Link as RouterLink } from 'react-router';
import { Box, Button, Typography } from '@mui/material';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { useMe } from '../auth/useAuth';
import { homePath } from '../nav/navConfig';

export default function ForbiddenPage() {
  const { data: user } = useMe();
  return (
    <Box sx={{ py: 10, textAlign: 'center', px: 2 }}>
      <LockOutlined sx={{ fontSize: 48, color: 'text.secondary' }} aria-hidden />
      <Typography variant="h5" sx={{ mt: 2 }}>
        You don't have access to this page
      </Typography>
      <Typography sx={{ color: 'text.secondary', mt: 1, mb: 3 }}>
        Your role does not include this screen. Ask MD/Admin if you need it.
      </Typography>
      <Button component={RouterLink} to={homePath(user)} variant="contained">
        Go to my dashboard
      </Button>
    </Box>
  );
}
