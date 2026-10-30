import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import NotificationBell from '../components/NotificationBell';
import {
  AppBar,
  Avatar,
  Box,
  ButtonBase,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import HamburgerIcon from '../components/HamburgerIcon';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import { useLogout, useMe } from '../auth/useAuth';
import { ROLE_LABEL } from '../auth/roles';
import { NAV, type NavItem } from '../nav/navConfig';
import Logo from '../components/Logo';
import { ACTIVE_PILL, BRAND, SIDEBAR_GRADIENT } from '../theme';

const DRAWER_WIDTH = 236;
/** Sidebar open/close timing, shared by the sidebar, top bar and content so they move together. */
const SLIDE = '260ms cubic-bezier(0.4, 0, 0.2, 1)';
const COLLAPSE_KEY = 'sugacoco.sidebarCollapsed';

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Live date-time pill in the top bar. */
function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const text = `${now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })} · ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  return (
    <Box
      sx={{
        display: { xs: 'none', md: 'block' },
        px: 2,
        py: 0.75,
        borderRadius: 999,
        bgcolor: '#F1F0F6',
        color: 'text.primary',
        fontSize: 12.5,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </Box>
  );
}

export default function AppLayout() {
  const theme = useTheme();
  // noSsr: read the real screen size on the first render (otherwise the sidebar slides in over the page).
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;
  const items = NAV[user.role];
  // Longest matching path wins, so /sales/orders/new doesn't also highlight /sales/orders.
  const under = (p: string) => location.pathname === p || location.pathname.startsWith(p + '/');
  const activePath =
    items
      .map((i) => i.path)
      .filter(under)
      .sort((a, b) => b.length - a.length)[0] ?? items.find((i) => i.also?.some(under))?.path;
  const showSidebar = isDesktop && !collapsed;

  // Group menu items by section (Home, Administration), keeping order.
  const sections = items.reduce<{ title: string; items: NavItem[] }[]>((acc, item) => {
    const title = item.section ?? 'Home';
    const last = acc[acc.length - 1];
    if (last?.title === title) last.items.push(item);
    else acc.push({ title, items: [item] });
    return acc;
  }, []);

  function toggleMenu() {
    if (!isDesktop) {
      // Drop focus from the button first; the drawer hides the page from screen readers while open.
      (document.activeElement as HTMLElement | null)?.blur();
      setMobileOpen(true);
      return;
    }
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* storage unavailable: keep in memory only */
      }
      return !c;
    });
  }

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', background: SIDEBAR_GRADIENT, color: '#FFFFFF' }}>
      <Box sx={{ px: 2.5, pt: 2.5, pb: 1, display: 'flex', justifyContent: 'center' }}>
        <Logo height={56} />
      </Box>

      <Box component="nav" aria-label="Main" sx={{ flex: 1, overflowY: 'auto', px: 1.75, pb: 2 }}>
        {sections.map((section) => (
          <List
            key={section.title}
            disablePadding
            sx={{ mt: 1.75 }}
            subheader={
              <ListSubheader
                disableSticky
                sx={{
                  bgcolor: 'transparent',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  lineHeight: '28px',
                  px: 1.5,
                  mb: 0.5,
                }}
              >
                {section.title}
              </ListSubheader>
            }
          >
            {section.items.map((item) => (
              <ListItemButton
                key={item.path}
                component={NavLink}
                to={item.path}
                end
                selected={item.path === activePath}
                onClick={() => setMobileOpen(false)}
                sx={{
                  borderRadius: '12px',
                  mb: 0.375,
                  minHeight: 40,
                  px: 1.5,
                  color: 'rgba(255,255,255,0.9)',
                  '& .MuiListItemIcon-root': { color: 'rgba(255,255,255,0.85)', minWidth: 34, '& svg': { fontSize: 20 } },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                  '&.Mui-selected, &.Mui-selected:hover': {
                    background: ACTIVE_PILL,
                    color: '#FFFFFF',
                    boxShadow: '0 8px 20px rgba(124, 92, 230, 0.35)',
                  },
                  '&.Mui-selected .MuiListItemIcon-root': { color: '#FFFFFF' },
                  '&.Mui-focusVisible': { outline: '2px solid #FFFFFF', outlineOffset: 2 },
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontWeight: 500, fontSize: 13.5 } } }} />
              </ListItemButton>
            ))}
          </List>
        ))}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mx: 2.25 }} />
      <Typography sx={{ px: 3, py: 1.75, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Sugacoco · {ROLE_LABEL[user.role]}</Typography>
    </Box>
  );

  async function onLogout() {
    setMenuAnchor(null);
    await logout.mutateAsync().catch(() => undefined);
    navigate('/login', { replace: true });
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh' }}>
      <AppBar
        position="fixed"
        // mui-fixed: MUI pads this bar too when a menu/dialog hides the scrollbar, so it doesn't jump.
        className="mui-fixed"
        sx={{
          width: { md: showSidebar ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%' },
          ml: { md: showSidebar ? `${DRAWER_WIDTH}px` : 0 },
          bgcolor: 'background.paper',
          borderBottom: '1px solid #ECEAF2',
          transition: `width ${SLIDE}, margin-left ${SLIDE}`,
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: { xs: 56, md: 64 }, px: { xs: 2, md: 3 } }}>
          <IconButton
            onClick={toggleMenu}
            aria-label={isDesktop ? (collapsed ? 'Show menu' : 'Hide menu') : 'Open menu'}
            sx={{
              width: 38,
              height: 38,
              borderRadius: '10px',
              color: 'text.primary',
              '&:hover': { bgcolor: 'transparent', color: 'primary.main' },
              '&:hover .hamburger-mid': { width: '100%' },
            }}
          >
            {/* Client preference. Desktop: ☰ while the sidebar shows, ✕ while hidden. Mobile: ☰ while closed, ✕ while open. */}
            <HamburgerIcon open={isDesktop ? collapsed : mobileOpen} />
          </IconButton>
          {/* Phones: logo instead of a second page title (each page shows its own heading). */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, flexGrow: 1, alignItems: 'center' }}>
            <Logo height={36} />
          </Box>
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
            <Clock />
          </Box>

          <NotificationBell />
          <ButtonBase
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            aria-label="Account menu"
            sx={{ borderRadius: 999, gap: 1.5, pl: { md: 1.5 }, py: 0.5 }}
          >
            <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.2 }}>{user.name}</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{ROLE_LABEL[user.role]}</Typography>
            </Box>
            <Avatar
              sx={{
                width: 38,
                height: 38,
                bgcolor: BRAND.plum,
                fontSize: 14,
                fontWeight: 700,
                boxShadow: '0 6px 16px rgba(107,33,112,0.35)',
              }}
            >
              {initials(user.name)}
            </Avatar>
          </ButtonBase>
          <Menu
            anchorEl={menuAnchor}
            open={!!menuAnchor}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <Box sx={{ px: 2, py: 1, minWidth: 220 }}>
              <Typography sx={{ fontWeight: 600 }}>{user.name}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {user.email}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={onLogout} sx={{ minHeight: 38 }}>
              <ListItemIcon>
                <LogoutOutlined fontSize="small" />
              </ListItemIcon>
              Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="aside" sx={{ width: { md: showSidebar ? DRAWER_WIDTH : 0 }, flexShrink: { md: 0 }, transition: `width ${SLIDE}` }}>
        {isDesktop ? (
          // Stays mounted and slides out of view when hidden, so open/close animates.
          <Drawer
            variant="permanent"
            open
            aria-hidden={!showSidebar}
            inert={!showSidebar}
            slotProps={{
              paper: {
                sx: {
                  width: DRAWER_WIDTH,
                  border: 'none',
                  borderRadius: 0,
                  transform: showSidebar ? 'translateX(0)' : `translateX(-${DRAWER_WIDTH}px)`,
                  transition: `transform ${SLIDE}`,
                },
              },
            }}
          >
            {drawer}
          </Drawer>
        ) : (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            slotProps={{ paper: { sx: { width: DRAWER_WIDTH, borderRadius: 0 } } }}
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, md: 3 } }}>
        <Toolbar sx={{ minHeight: { xs: 56, md: 64 } }} />
        {/* Page code loads on demand; keep the sidebar and top bar visible meanwhile. */}
        <Suspense fallback={<Box sx={{ py: 10, display: 'grid', placeItems: 'center' }}><CircularProgress aria-label="Loading" /></Box>}>
          {/* New key per page: each screen fades in when you move to it. */}
          <Box
            key={location.pathname}
            sx={{
              animation: 'pageIn 280ms cubic-bezier(0.2, 0, 0, 1) both',
              '@keyframes pageIn': {
                from: { opacity: 0, transform: 'translateY(8px)' },
                to: { opacity: 1, transform: 'none' },
              },
            }}
          >
            <Outlet />
          </Box>
        </Suspense>
      </Box>
    </Box>
  );
}
