import { createTheme, type Theme } from '@mui/material/styles';

// Style follows the Chola CRM reference (client request, 2026-10-28). Rules: design-system/sugacoco/MASTER.md.

export const BRAND = {
  plum: '#6B2170', // primary buttons, table headers, avatar
  plumDark: '#4A1650',
  plumLight: '#8E3FB0',
  violet: '#7C5CE6', // active nav pill end
  sidebarTop: '#4B1863',
  sidebarBottom: '#2A1036',
  // Dark mode obsidian accents
  darkPrimary: '#B559C0',
  darkPrimaryDark: '#93399E',
  darkPrimaryLight: '#CA7CD4',
  darkBg: '#0F0A16',
  darkPaper: '#181124',
  darkDivider: '#2D223B',
  darkBorder: '#2E223D',
};
export const SIDEBAR_GRADIENT = `linear-gradient(180deg, ${BRAND.sidebarTop} 0%, ${BRAND.sidebarBottom} 100%)`;
export const ACTIVE_PILL = `linear-gradient(90deg, #8E3FB0 0%, ${BRAND.violet} 100%)`;

/** Gradient fills for dashboard stat cards. White text passes contrast (4.5:1) on every stop, light end included. */
export const STAT_GRADIENTS = {
  green: 'linear-gradient(135deg, #2A8538 0%, #1F6F2E 100%)',
  olive: 'linear-gradient(135deg, #76761E 0%, #5C5C14 100%)',
  pink: 'linear-gradient(135deg, #C8246B 0%, #A3154F 100%)',
  violet: 'linear-gradient(135deg, #8B45E0 0%, #6A28C4 100%)',
  teal: 'linear-gradient(135deg, #0F7F75 0%, #0B655C 100%)',
} as const;

/** Dark mode: filled plum for buttons, chips and the current page number (white text on #B559C0 is too faint). */
const DARK_FILL = '#9D45A9';
const DARK_FILL_HOVER = '#8A3896';

/** Order-number links: deep plum on light backgrounds, light plum on dark ones. */
export const ORDER_LINK_COLOR = (t: Theme) => (t.palette.mode === 'dark' ? t.palette.primary.light : t.palette.primary.dark);
export type StatColor = keyof typeof STAT_GRADIENTS;

/** Phone widths (below MUI's `sm` breakpoint). */
const PHONE = '@media (max-width:599.95px)';
const RADIUS = { sm: 8, md: 12, lg: 18 };

export type ThemeMode = 'light' | 'dark';

export function getTheme(mode: ThemeMode = 'light'): Theme {
  const isDark = mode === 'dark';
  // Lightweight shadows: fast GPU rendering without heavy blur lag
  const cardShadow = isDark
    ? '0 2px 8px rgba(0, 0, 0, 0.28)'
    : '0 6px 20px rgba(31, 16, 56, 0.06)';
  const dialogShadow = isDark
    ? '0 16px 36px rgba(0, 0, 0, 0.55)'
    : '0 24px 60px rgba(31, 16, 56, 0.18)';
  const popoverShadow = isDark
    ? '0 10px 24px rgba(0, 0, 0, 0.50)'
    : '0 12px 32px rgba(31, 16, 56, 0.14)';

  return createTheme({
    palette: {
      mode,
      primary: isDark
        ? { main: BRAND.darkPrimary, dark: BRAND.darkPrimaryDark, light: BRAND.darkPrimaryLight, contrastText: '#FFFFFF' }
        : { main: BRAND.plum, dark: BRAND.plumDark, light: BRAND.plumLight, contrastText: '#FFFFFF' },
      secondary: isDark
        ? { main: '#9F80F8', contrastText: '#FFFFFF' }
        : { main: BRAND.violet, contrastText: '#FFFFFF' },
      error: { main: isDark ? '#F87171' : '#DC2626' },
      warning: { main: isDark ? '#FBBF24' : '#B45309' },
      info: { main: isDark ? '#60A5FA' : '#2563EB' },
      success: { main: isDark ? '#34D399' : '#15803D' },
      background: {
        default: isDark ? BRAND.darkBg : '#F4F5FA',
        paper: isDark ? BRAND.darkPaper : '#FFFFFF',
      },
      text: {
        primary: isDark ? '#F3EEF8' : '#111827',
        secondary: isDark ? '#A69BB5' : '#4B5563',
      },
      divider: isDark ? BRAND.darkDivider : '#ECEAF2',
      action: {
        hover: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(107, 33, 112, 0.04)',
        selected: isDark ? 'rgba(181, 89, 192, 0.16)' : 'rgba(107, 33, 112, 0.08)',
      },
    },
    shape: { borderRadius: RADIUS.md },
    typography: {
      fontSize: 13,
      fontFamily: '"DM Sans Variable", "DM Sans", "Segoe UI", system-ui, sans-serif',
      h4: { fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontWeight: 700, letterSpacing: '-0.02em', fontSize: '1.35rem', [PHONE]: { fontSize: '1.2rem' } },
      h6: { fontWeight: 700, fontSize: '1.05rem' },
      subtitle1: { fontWeight: 700, fontSize: '0.95rem' },
      button: { textTransform: 'none', fontWeight: 600, fontSize: '0.85rem' },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 999,
            paddingInline: 16,
            minHeight: 36,
            transition: 'background-color 150ms ease, box-shadow 150ms ease, border-color 150ms ease, color 150ms ease, transform 150ms ease',
            '&:active': { transform: 'scale(0.98)' },
            '@media (pointer: coarse)': { minHeight: 44 },
            variants: [
              {
                props: { variant: 'contained', color: 'primary' },
                style: {
                  ...(isDark ? { backgroundColor: DARK_FILL } : {}),
                  boxShadow: isDark
                    ? '0 4px 14px rgba(181, 89, 192, 0.30)'
                    : '0 8px 20px rgba(107, 33, 112, 0.28)',
                  '&:hover': {
                    ...(isDark ? { backgroundColor: DARK_FILL_HOVER } : {}),
                    boxShadow: isDark
                      ? '0 6px 18px rgba(181, 89, 192, 0.40)'
                      : '0 10px 26px rgba(107, 33, 112, 0.38)',
                    transform: 'translateY(-1px)',
                  },
                  '&:active': {
                    transform: 'scale(0.98)',
                    boxShadow: isDark
                      ? '0 2px 8px rgba(181, 89, 192, 0.25)'
                      : '0 4px 12px rgba(107, 33, 112, 0.25)',
                  },
                },
              },
              {
                props: { variant: 'outlined', color: 'primary' },
                style: {
                  borderColor: isDark ? '#433059' : '#DDD6E8',
                  color: isDark ? '#F3EEF8' : '#111827',
                  '&:hover': {
                    borderColor: isDark ? BRAND.darkPrimary : BRAND.plum,
                    backgroundColor: isDark ? 'rgba(181, 89, 192, 0.12)' : 'rgba(107, 33, 112, 0.04)',
                    transform: 'translateY(-1px)',
                  },
                  '&:active': { transform: 'scale(0.98)' },
                },
              },
              // Dark mode: text buttons in the lighter plum so small labels stay readable on cards and dialogs.
              ...(isDark ? [{ props: { variant: 'text' as const, color: 'primary' as const }, style: { color: BRAND.darkPrimaryLight } }] : []),
            ],
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: RADIUS.sm,
            transition: 'background-color 150ms ease, color 150ms ease, transform 150ms ease',
            '&:hover': { transform: 'scale(1.06)' },
            '&:active': { transform: 'scale(0.94)' },
            '@media (pointer: coarse)': { minWidth: 44, minHeight: 44 },
          },
        },
      },
      MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { rounded: { borderRadius: RADIUS.lg } } },
      MuiCard: {
        defaultProps: { variant: 'elevation' },
        styleOverrides: {
          root: {
            borderRadius: RADIUS.lg,
            backgroundColor: isDark ? BRAND.darkPaper : '#FFFFFF',
            boxShadow: cardShadow,
            border: isDark ? `1px solid ${BRAND.darkBorder}` : '1px solid #F0EDF5',
            transition: 'box-shadow 180ms ease, transform 180ms ease, border-color 150ms ease',
            // Phones: ResponsiveTable draws every row as its own card, so the card around the list steps back.
            '&:has(> [data-row-cards])': {
              backgroundColor: 'transparent',
              boxShadow: 'none',
              border: 0,
              borderRadius: 0,
              overflow: 'visible',
              '& > .MuiCardContent-root': { paddingLeft: 0, paddingRight: 0, paddingTop: 0 },
            },
          },
        },
      },
      MuiCardContent: { styleOverrides: { root: { padding: 18, '&:last-child': { paddingBottom: 18 } } } },
      MuiCardActionArea: { styleOverrides: { root: { borderRadius: RADIUS.lg } } },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: RADIUS.lg,
            backgroundColor: isDark ? '#1C142A' : '#FFFFFF',
            boxShadow: dialogShadow,
            border: isDark ? `1px solid ${BRAND.darkBorder}` : 'none',
            [PHONE]: { margin: 12, width: 'calc(100% - 24px)', maxWidth: 'calc(100% - 24px) !important', maxHeight: 'calc(100% - 24px)' },
          },
        },
      },
      MuiDialogTitle: { styleOverrides: { root: { fontSize: '1.05rem', fontWeight: 700, [PHONE]: { paddingLeft: 16, paddingRight: 16 } } } },
      MuiDialogContent: { styleOverrides: { root: { [PHONE]: { paddingLeft: 16, paddingRight: 16 } } } },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            [PHONE]: {
              paddingLeft: '16px !important',
              paddingRight: '16px !important',
              flexWrap: 'wrap-reverse',
              gap: 8,
              '& > *': { flex: '1 1 auto' },
              '& > :not(style) ~ :not(style)': { marginLeft: 0 },
            },
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: RADIUS.md,
            marginTop: 4,
            maxHeight: 320,
            backgroundColor: isDark ? '#1C142A' : '#FFFFFF',
            border: isDark ? `1px solid ${BRAND.darkBorder}` : '1px solid #ECEAF2',
            boxShadow: popoverShadow,
          },
        },
      },

      MuiTextField: { defaultProps: { fullWidth: true, slotProps: { inputLabel: { shrink: true } } } },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            '&.MuiInputLabel-formControl': {
              position: 'static',
              transform: 'none',
              marginBottom: 4,
              fontSize: '0.8rem',
              fontWeight: 600,
              color: isDark ? '#E7DFEE' : '#111827',
              whiteSpace: 'normal',
              overflow: 'visible',
            },
            '&.Mui-focused': { color: isDark ? BRAND.darkPrimaryLight : BRAND.plum },
            '&.Mui-error': { color: isDark ? '#F87171' : '#DC2626' },
          },
          asterisk: { color: isDark ? '#F87171' : '#DC2626' },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: RADIUS.md,
            backgroundColor: isDark ? '#130C1C' : '#FFFFFF',
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: isDark ? '#382B4B' : '#E3DFEA',
              top: 0,
              transition: 'border-color 150ms ease',
            },
            '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: isDark ? '#6B5187' : '#C9BFD8' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: isDark ? BRAND.darkPrimary : BRAND.plum,
              borderWidth: 1.5,
            },
            '&.Mui-focused': {
              boxShadow: isDark
                ? '0 0 0 3px rgba(181, 89, 192, 0.20)'
                : '0 0 0 3px rgba(107, 33, 112, 0.10)',
            },
            'label + &': { marginTop: 0 },
          },
          input: { paddingTop: 9.5, paddingBottom: 9.5, fontSize: '0.875rem' },
        },
      },
      MuiFormHelperText: { styleOverrides: { root: { marginLeft: 4 } } },
      MuiAutocomplete: {
        styleOverrides: {
          inputRoot: { paddingTop: 2, paddingBottom: 2 },
          paper: {
            marginTop: 4,
            borderRadius: RADIUS.md,
            backgroundColor: isDark ? '#1C142A' : '#FFFFFF',
            border: isDark ? `1px solid ${BRAND.darkBorder}` : '1px solid #ECEAF2',
            boxShadow: popoverShadow,
          },
          listbox: { maxHeight: 300, paddingTop: 4, paddingBottom: 4 },
          option: { fontSize: '0.875rem', minHeight: '36px !important' },
          noOptions: { fontSize: '0.84rem' },
          loading: { fontSize: '0.84rem' },
        },
      },
      MuiSelect: {
        defaultProps: {
          displayEmpty: true,
          MenuProps: { anchorOrigin: { vertical: 'bottom', horizontal: 'left' }, transformOrigin: { vertical: 'top', horizontal: 'left' } },
        },
        styleOverrides: { select: { paddingTop: 9.5, paddingBottom: 9.5, fontSize: '0.875rem' } },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontSize: '0.875rem',
            minHeight: 36,
            transition: 'background-color 120ms ease',
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(107, 33, 112, 0.04)',
            },
            '&.Mui-selected': {
              backgroundColor: isDark ? 'rgba(181, 89, 192, 0.18)' : 'rgba(107, 33, 112, 0.08)',
              '&:hover': {
                backgroundColor: isDark ? 'rgba(181, 89, 192, 0.24)' : 'rgba(107, 33, 112, 0.12)',
              },
            },
          },
        },
      },

      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              backgroundColor: isDark ? '#381347' : BRAND.plum,
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '0.8rem',
              borderBottom: 'none',
              paddingTop: 10,
              paddingBottom: 10,
              whiteSpace: 'nowrap',
            },
            '& .MuiTableCell-head:first-of-type': { borderTopLeftRadius: RADIUS.md },
            '& .MuiTableCell-head:last-of-type': { borderTopRightRadius: RADIUS.md },
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color 120ms ease',
            '&.MuiTableRow-hover:hover': {
              backgroundColor: isDark ? '#231835' : '#FAF7FC',
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: isDark ? '#2B2039' : '#F0EDF5',
            fontSize: '0.84rem',
            padding: '10px 14px',
          },
          sizeSmall: { padding: '7px 12px' },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            fontWeight: 500,
            transition: 'background-color 150ms ease, color 150ms ease, box-shadow 150ms ease, transform 150ms ease',
            '&.MuiChip-clickable:hover': { transform: 'translateY(-1px)' },
            '&.MuiChip-clickable:active': { transform: 'scale(0.96)' },
            ...(isDark
              ? {
                  '&.MuiChip-filled.MuiChip-colorPrimary': { backgroundColor: DARK_FILL },
                  '&.MuiChip-filled.MuiChip-colorPrimary.MuiChip-clickable:hover': { backgroundColor: DARK_FILL_HOVER },
                }
              : {}),
          },
          sizeSmall: { height: 22, fontSize: '0.72rem' },
        },
      },
      MuiPaginationItem: {
        styleOverrides: {
          root: isDark
            ? {
                '&.Mui-selected.MuiPaginationItem-colorPrimary': { backgroundColor: DARK_FILL },
                '&.Mui-selected.MuiPaginationItem-colorPrimary:hover': { backgroundColor: DARK_FILL_HOVER },
              }
            : {},
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            textTransform: 'none',
            fontWeight: 600,
            transition: 'background-color 150ms ease, color 150ms ease',
          },
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            backgroundColor: isDark ? BRAND.darkPaper : '#FFFFFF',
          },
        },
      },
      MuiSkeleton: { styleOverrides: { rounded: { borderRadius: RADIUS.lg } } },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            minHeight: 42,
            fontSize: '0.85rem',
            transition: 'color 150ms ease, opacity 150ms ease',
          },
        },
      },
      MuiTabs: { styleOverrides: { root: { minHeight: 42 } } },
      MuiAlert: { styleOverrides: { root: { borderRadius: RADIUS.md, fontSize: '0.84rem', paddingTop: 2, paddingBottom: 2 } } },
      MuiAppBar: { defaultProps: { elevation: 0, color: 'inherit' } },
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            fontVariantNumeric: 'tabular-nums',
          },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': { transitionDuration: '0.01ms !important', animationDuration: '0.01ms !important' },
          },
        },
      },
    },
  });
}

// One theme object per mode, so createTheme is never called on re-render.
// The dark theme is built the first time it is needed, not at start-up for everyone.
export const LIGHT_THEME = getTheme('light');
let darkTheme: Theme | null = null;
export function themeFor(mode: ThemeMode): Theme {
  if (mode === 'light') return LIGHT_THEME;
  darkTheme ??= getTheme('dark');
  return darkTheme;
}
export const theme = LIGHT_THEME;
