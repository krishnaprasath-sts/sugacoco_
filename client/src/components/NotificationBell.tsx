import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Badge, Box, Button, Divider, IconButton, Popover, Stack, Tooltip, Typography } from '@mui/material';
import NotificationsNoneOutlined from '@mui/icons-material/NotificationsNoneOutlined';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { useDismissNotification, useMarkRead, useNotifications, type Notification } from '../api/notifications';
import { formatDateTime } from '../lib/format';

/** Bell in the top bar: new work and status changes for the signed-in person. Checks every 30 s. */
export default function NotificationBell() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { data } = useNotifications();
  const markRead = useMarkRead();
  const dismiss = useDismissNotification();
  const navigate = useNavigate();
  const unread = data?.unread ?? 0;
  const items = data?.notifications ?? [];

  const open = (n: Notification) => {
    if (!n.readAt) markRead.mutate(n.id);
    setAnchor(null);
    if (n.link) navigate(n.link);
  };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          onClick={(e) => {
            e.currentTarget.blur(); // the popover hides the page from screen readers; focus must not stay behind it
            setAnchor(e.currentTarget);
          }}
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          sx={{ width: 38, height: 38, borderRadius: '10px', color: 'text.primary', '&:hover': { bgcolor: 'transparent', color: 'primary.main' } }}
        >
          <Badge badgeContent={unread} color="error" max={99}>
            <NotificationsNoneOutlined sx={{ fontSize: 21 }} />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { mt: '6px', width: { xs: 'calc(100vw - 24px)', sm: 380 }, maxHeight: 480, display: 'flex', flexDirection: 'column', border: '1px solid #ECEAF2', boxShadow: '0 12px 32px rgba(31,16,56,0.14)' },
          },
        }}
      >
        <Stack direction="row" sx={{ px: 2, py: 1.25, alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography sx={{ fontWeight: 700 }}>Notifications</Typography>
          <Stack direction="row" spacing={0.5}>
            {unread > 0 && (
              <Button size="small" onClick={() => markRead.mutate('all')} disabled={markRead.isPending}>
                Mark all read
              </Button>
            )}
            {items.length > 0 && (
              <Button size="small" color="error" onClick={() => dismiss.mutate('all')} disabled={dismiss.isPending}>
                Clear all
              </Button>
            )}
          </Stack>
        </Stack>
        <Divider />
        <Box sx={{ overflowY: 'auto' }} role="list">
          {!items.length && (
            <Typography variant="body2" sx={{ color: 'text.secondary', p: 3, textAlign: 'center' }}>
              No notifications yet. You'll see new work and order updates here.
            </Typography>
          )}
          {items.map((n) => (
            <Box
              key={n.id}
              role="listitem"
              sx={{
                position: 'relative',
                borderBottom: '1px solid #F0EDF5',
                bgcolor: n.readAt ? 'transparent' : '#F7F1FA',
                '&:hover': { bgcolor: '#F1F0F6' },
                '&:hover .dismiss, & .dismiss:focus-visible': { opacity: 1 },
              }}
            >
              <Box
                component="button"
                onClick={() => open(n)}
                sx={{
                  display: 'flex',
                  gap: 1.25,
                  width: '100%',
                  textAlign: 'left',
                  border: 0,
                  bgcolor: 'transparent',
                  pl: 2,
                  pr: 5,
                  py: 1.25,
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'inherit',
                  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
                }}
              >
                <Box sx={{ width: 8, height: 8, mt: '6px', borderRadius: '50%', flexShrink: 0, bgcolor: n.readAt ? 'transparent' : 'primary.main' }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: n.readAt ? 500 : 700, fontSize: 13.5 }}>{n.title}</Typography>
                  {n.message && (
                    <Typography variant="body2" sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {n.message}
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: 11.5, color: 'text.disabled', mt: 0.25 }}>{formatDateTime(n.createdAt)}</Typography>
                </Box>
              </Box>
              <IconButton
                className="dismiss"
                size="small"
                aria-label={`Remove notification: ${n.title}`}
                onClick={() => dismiss.mutate(n.id)}
                sx={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  color: 'text.secondary',
                  opacity: { xs: 1, md: 0.55 },
                  transition: 'opacity 150ms ease',
                  '&:hover': { color: 'error.main', bgcolor: 'rgba(220,38,38,0.08)' },
                }}
              >
                <CloseRounded sx={{ fontSize: 17 }} />
              </IconButton>
            </Box>
          ))}
        </Box>
      </Popover>
    </>
  );
}
