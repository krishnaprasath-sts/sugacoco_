import { Box } from '@mui/material';

/** Three-bar menu icon that morphs into an X when `open`. Middle bar shortens on hover. */
export default function HamburgerIcon({ open }: { open: boolean }) {
  const bar = {
    position: 'absolute',
    left: 0,
    height: '2px',
    borderRadius: '2px',
    bgcolor: 'currentColor',
    transition: 'transform 300ms cubic-bezier(0.65, 0, 0.35, 1), opacity 200ms ease, width 250ms ease, top 300ms cubic-bezier(0.65, 0, 0.35, 1)',
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  } as const;
  return (
    <Box
      aria-hidden
      className="hamburger"
      sx={{ position: 'relative', width: 20, height: 14, display: 'block' }}
    >
      <Box sx={{ ...bar, width: '100%', top: open ? 6 : 0, transform: open ? 'rotate(45deg)' : 'none' }} />
      <Box
        className="hamburger-mid"
        sx={{ ...bar, width: open ? '100%' : '70%', top: 6, opacity: open ? 0 : 1, transform: open ? 'translateX(-8px)' : 'none' }}
      />
      <Box sx={{ ...bar, width: '100%', top: open ? 6 : 12, transform: open ? 'rotate(-45deg)' : 'none' }} />
    </Box>
  );
}
