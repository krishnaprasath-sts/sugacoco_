import { IconButton, Tooltip } from '@mui/material';
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import { useThemeMode } from '../ThemeContext';

export default function ThemeToggle() {
  const { mode, toggleTheme } = useThemeMode();
  const isDark = mode === 'dark';

  return (
    <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        sx={{
          width: 38,
          height: 38,
          borderRadius: '10px',
          color: isDark ? '#FBBF24' : 'text.primary',
          transition: 'transform 180ms ease, color 150ms ease, background-color 150ms ease',
          '&:hover': {
            bgcolor: isDark ? 'rgba(251, 191, 36, 0.12)' : 'rgba(107, 33, 112, 0.06)',
            color: isDark ? '#FCD34D' : 'primary.main',
            transform: 'scale(1.08)',
          },
          '&:active': {
            transform: 'scale(0.92)',
          },
        }}
      >
        {isDark ? (
          // Sun: the usual pair of the moon shown in light mode, in the same outline style.
          <LightModeOutlined
            sx={{
              fontSize: 22,
              color: '#FBBF24',
              filter: 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.35))',
            }}
          />
        ) : (
          <DarkModeOutlined sx={{ fontSize: 21 }} />
        )}
      </IconButton>
    </Tooltip>
  );
}
