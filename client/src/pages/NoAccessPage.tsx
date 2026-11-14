import { Box, Typography } from '@mui/material';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { useMe } from '../auth/useAuth';

/** Landing page for a role that has no screens yet. */
export default function NoAccessPage() {
  const { data: user } = useMe();
  return (
    <Box sx={{ py: 10, textAlign: 'center', px: 2 }}>
      <LockOutlined sx={{ fontSize: 48, color: 'text.secondary' }} aria-hidden />
      <Typography variant="h5" sx={{ mt: 2 }}>
        No screens yet
      </Typography>
      <Typography sx={{ color: 'text.secondary', mt: 1, maxWidth: 440, mx: 'auto' }}>
        Your role{user ? ` (${user.roleName})` : ''} has no permissions yet. Ask MD/Admin to give it access under
        Administration → Roles & Permissions.
      </Typography>
    </Box>
  );
}
