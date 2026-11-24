import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useLogin, useMe } from '../auth/useAuth';
import type { User } from '../auth/roles';
import { homePath, navFor } from '../nav/navConfig';
import { ApiError } from '../lib/api';
import { revealApp, shellValue } from '../lib/appShell';
import Logo from '../components/Logo';
import { SIDEBAR_GRADIENT } from '../theme';

const STAGES = ['PI registration', 'Payment verification', 'QC & production', 'Packaging', 'Container & documents', 'Final closure'];

export default function LoginPage() {
  const { data: user } = useMe();
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  // Start from anything typed into the static copy of this page (see lib/appShell).
  const [email, setEmail] = useState(() => shellValue('email'));
  const [password, setPassword] = useState(() => shellValue('password'));
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const { wasShown, focused } = revealApp();
    // The copy had the cursor in a field; keep it there (the hidden app could not take focus itself).
    if (wasShown) (focused === 'password' ? passwordRef : emailRef).current?.focus({ preventScroll: true });
  }, []);
  const [showPassword, setShowPassword] = useState(false);

  const from = (location.state as { from?: string } | null)?.from;
  // Return to the page they came from only if this user may open it (another user may sign in on the same PC).
  const target = (u: User) =>
    from && (from.startsWith('/orders/') || navFor(u).some((i) => from === i.path || from.startsWith(i.path + '/'))) ? from : homePath(u);
  if (user) return <Navigate to={target(user)} replace />;

  const error = login.error instanceof ApiError ? login.error : null;
  const fieldErrors = (error?.details as { fields?: Record<string, string> } | undefined)?.fields ?? {};

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate(
      { email, password },
      { onSuccess: ({ user }) => navigate(target(user), { replace: true }) },
    );
  }

  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '5fr 6fr' } }}>
      {/* Brand panel: desktop only */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: SIDEBAR_GRADIENT,
          color: 'common.white',
          p: 6,
          pb: 5,
          position: 'relative',
          overflow: 'hidden',
          borderTopRightRadius: 48,
          borderBottomRightRadius: 48,
          '& > *': { position: 'relative', zIndex: 1 },
        }}
      >
        {/* Decorative circles */}
        <Box aria-hidden sx={{ position: 'absolute !important', zIndex: '0 !important', width: 420, height: 420, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)', top: -160, right: -140 }} />
        <Box aria-hidden sx={{ position: 'absolute !important', zIndex: '0 !important', width: 300, height: 300, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(142,63,176,0.55), rgba(124,92,230,0.35))', bottom: -110, left: -90 }} />
        <Logo width={150} />
        <Box>
          <Typography variant="h4" component="p" sx={{ maxWidth: 420 }}>
            Every order, from PI to closure, in one place.
          </Typography>
          <Stack component="ol" spacing={1.5} sx={{ mt: 4, p: 0, listStyle: 'none' }}>
            {STAGES.map((stage, i) => (
              <Stack component="li" key={stage} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: '1px solid rgba(255,255,255,0.4)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                  aria-hidden
                >
                  {i + 1}
                </Box>
                <Typography sx={{ opacity: 0.9 }}>{stage}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          Sugacoco internal system
        </Typography>
      </Box>

      {/* Form column. On phones the plum design fills the whole screen and the form floats on it as a card. */}
      <Box
        component="main"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: { xs: 'center', md: 'flex-start' },
          minWidth: 0,
          minHeight: { xs: '100dvh', md: 'auto' },
          background: { xs: SIDEBAR_GRADIENT, md: 'none' },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box aria-hidden sx={{ display: { md: 'none' }, position: 'absolute', width: 300, height: 300, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)', top: -120, right: -100 }} />
        <Box aria-hidden sx={{ display: { md: 'none' }, position: 'absolute', width: 260, height: 260, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(142,63,176,0.55), rgba(124,92,230,0.35))', bottom: -100, left: -90 }} />
        <Box
          sx={{
            display: { xs: 'flex', md: 'none' },
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            color: 'common.white',
            px: 3,
            pt: 5,
            position: 'relative',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Logo width={150} />
          </Box>
          <Typography sx={{ mt: 2.5, fontSize: 15, opacity: 0.9, maxWidth: 280 }}>
            Every order, from PI to closure, in one place.
          </Typography>
        </Box>

      <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', px: 2, pt: { xs: 0, md: 6 }, pb: 6, position: 'relative' }}>
        <Box
          component="form"
          onSubmit={onSubmit}
          noValidate
          sx={{
            width: '100%',
            maxWidth: 400,
            mt: { xs: 4, md: 0 },
            px: { xs: 3, md: 0 },
            py: { xs: 4.5, md: 0 },
            bgcolor: { xs: 'background.paper', md: 'transparent' },
            borderRadius: { xs: '18px', md: 0 },
            boxShadow: { xs: '0 20px 48px rgba(20,6,30,0.35)', md: 'none' },
            position: 'relative',
          }}
        >
          <Typography variant="h5" component="h1">
            Sign in
          </Typography>
          <Typography sx={{ color: 'text.secondary', mt: 0.5, mb: 3 }}>
            Use the account given by your administrator.
          </Typography>

          {error && !Object.keys(fieldErrors).length && (
            <Alert severity="error" sx={{ mb: 2 }} role="alert">
              {error.message}
            </Alert>
          )}
          {login.error && !error && (
            <Alert severity="error" sx={{ mb: 2 }} role="alert">
              Cannot reach the server. Check your connection and try again.
            </Alert>
          )}

          <Stack spacing={2.5}>
            <TextField
              label="Email"
              type="email"
              autoComplete="username"
              autoFocus
              required
              inputRef={emailRef}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={!!fieldErrors.email}
              helperText={fieldErrors.email}
            />
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              inputRef={passwordRef}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={!!fieldErrors.password}
              helperText={fieldErrors.password}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((v) => !v)}
                        edge="end"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <VisibilityOff sx={{ fontSize: 20 }} /> : <Visibility sx={{ fontSize: 20 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button type="submit" variant="contained" size="large" loading={login.isPending} sx={{ minHeight: 48 }}>
              Sign in
            </Button>
          </Stack>
        </Box>
      </Box>
        <Typography variant="body2" sx={{ display: { md: 'none' }, color: 'common.white', opacity: 0.7, textAlign: 'center', pb: 3, position: 'relative' }}>
          Sugacoco internal system
        </Typography>
      </Box>
    </Box>
  );
}
