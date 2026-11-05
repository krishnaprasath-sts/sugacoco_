import { Navigate, Outlet, useLocation } from 'react-router';
import { Box, CircularProgress } from '@mui/material';
import { useMe } from '../auth/useAuth';
import { can, type Permission } from '../auth/roles';
import ForbiddenPage from '../pages/ForbiddenPage';

/** Redirects to /login when logged out. With `perms`, shows 403 unless the role has any of them (the API checks again). */
export default function RequireAuth({ perms }: { perms?: Permission[] }) {
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
  if (perms && !can(user, ...perms)) return <ForbiddenPage />;
  return <Outlet />;
}
