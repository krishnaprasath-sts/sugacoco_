import { Navigate, Outlet, useLocation } from 'react-router';
import { Box, CircularProgress } from '@mui/material';
import { useMe } from '../auth/useAuth';
import type { Role } from '../auth/roles';
import ForbiddenPage from '../pages/ForbiddenPage';

/** Redirects to /login when logged out. With `roles`, shows 403 for other roles. */
export default function RequireAuth({ roles }: { roles?: Role[] }) {
  const { data: user, isPending } = useMe();
  const location = useLocation();

  if (isPending) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress aria-label="Loading" />
      </Box>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <ForbiddenPage />;
  return <Outlet />;
}
