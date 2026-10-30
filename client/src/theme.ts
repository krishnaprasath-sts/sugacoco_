import { createTheme } from '@mui/material/styles';

// Style follows the Chola CRM reference (client request, 2026-10-28). Rules: design-system/sugacoco/MASTER.md.

export const BRAND = {
  plum: '#6B2170', // primary buttons, table headers, avatar
  plumDark: '#4A1650',
  violet: '#7C5CE6', // active nav pill end
  sidebarTop: '#4B1863',
  sidebarBottom: '#2A1036',
};
export const SIDEBAR_GRADIENT = `linear-gradient(180deg, ${BRAND.sidebarTop} 0%, ${BRAND.sidebarBottom} 100%)`;
export const ACTIVE_PILL = `linear-gradient(90deg, #8E3FB0 0%, ${BRAND.violet} 100%)`;

/** Gradient fills for dashboard stat cards (white text on all of them passes contrast). */
export const STAT_GRADIENTS = {
  green: 'linear-gradient(135deg, #3BAA4A 0%, #23893A 100%)',
  olive: 'linear-gradient(135deg, #9A9A2A 0%, #6E6E1A 100%)',
  pink: 'linear-gradient(135deg, #E02E7A 0%, #B8175C 100%)',
  violet: 'linear-gradient(135deg, #8B45E0 0%, #6A28C4 100%)',
  teal: 'linear-gradient(135deg, #17A79A 0%, #0E7F74 100%)',
} as const;
export type StatColor = keyof typeof STAT_GRADIENTS;

/** Phone widths (below MUI's `sm` breakpoint). */
const PHONE = '@media (max-width:599.95px)';
const SOFT_SHADOW ='0 6px 20px rgba(31, 16, 56, 0.06)';
const RADIUS = { sm: 8, md: 12, lg: 18 };

export const theme = createTheme({
  palette: {
    primary: { main: BRAND.plum, dark: BRAND.plumDark, light: '#8E3FB0', contrastText: '#FFFFFF' },
    secondary: { main: BRAND.violet, contrastText: '#FFFFFF' },
    error: { main: '#DC2626' },
    warning: { main: '#B45309' },
    info: { main: '#2563EB' },
    success: { main: '#15803D' },
    background: { default: '#F4F5FA', paper: '#FFFFFF' },
    text: { primary: '#111827', secondary: '#4B5563' },
    divider: '#ECEAF2',
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
          // Phones/tablets: keep 44px touch targets (desktop stays compact).
          '@media (pointer: coarse)': { minHeight: 44 },
          variants: [
            {
              props: { variant: 'contained', color: 'primary' },
              style: { boxShadow: '0 8px 20px rgba(107, 33, 112, 0.28)', '&:hover': { boxShadow: '0 8px 24px rgba(107, 33, 112, 0.36)' } },
            },
            {
              props: { variant: 'outlined', color: 'primary' },
              style: { borderColor: '#DDD6E8', color: '#111827', '&:hover': { borderColor: BRAND.plum, backgroundColor: 'rgba(107,33,112,0.04)' } },
            },
          ],
        },
      },
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: RADIUS.sm, '@media (pointer: coarse)': { minWidth: 44, minHeight: 44 } } } },
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { rounded: { borderRadius: RADIUS.lg } } },
    MuiCard: {
      defaultProps: { variant: 'elevation' },
      styleOverrides: { root: { borderRadius: RADIUS.lg, boxShadow: SOFT_SHADOW, border: '1px solid #F0EDF5' } },
    },
    MuiCardContent: { styleOverrides: { root: { padding: 18, '&:last-child': { paddingBottom: 18 } } } },
    MuiCardActionArea: { styleOverrides: { root: { borderRadius: RADIUS.lg } } },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: RADIUS.lg,
          boxShadow: '0 24px 60px rgba(31,16,56,0.18)',
          // Phones: use nearly the whole screen instead of a narrow box with wide margins.
          [PHONE]: { margin: 12, width: 'calc(100% - 24px)', maxWidth: 'calc(100% - 24px) !important', maxHeight: 'calc(100% - 24px)' },
        },
      },
    },
    MuiDialogTitle: { styleOverrides: { root: { fontSize: '1.05rem', fontWeight: 700, [PHONE]: { paddingLeft: 16, paddingRight: 16 } } } },
    MuiDialogContent: { styleOverrides: { root: { [PHONE]: { paddingLeft: 16, paddingRight: 16 } } } },
    // Phones: buttons share the row (wrapping if needed) so each is a big, easy tap target.
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
    // Long lists (24 audit actions) scroll inside the menu instead of covering the page.
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: RADIUS.md, marginTop: 4, maxHeight: 320, border: '1px solid #ECEAF2', boxShadow: '0 12px 32px rgba(31,16,56,0.14)' },
      },
    },

    // Labels sit above inputs (Chola style) instead of floating inside the border.
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
            color: '#111827',
            whiteSpace: 'normal',
            overflow: 'visible',
          },
          '&.Mui-focused': { color: BRAND.plum },
          '&.Mui-error': { color: '#DC2626' },
        },
        asterisk: { color: '#DC2626' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: RADIUS.md,
          backgroundColor: '#FFFFFF',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E3DFEA', top: 0 },
          '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#C9BFD8' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: BRAND.plum, borderWidth: 1.5 },
          'label + &': { marginTop: 0 },
        },
        input: { paddingTop: 9.5, paddingBottom: 9.5, fontSize: '0.875rem' },
      },
    },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 4 } } },
    // Paper elevation is 0 app-wide, so the suggestion popup needs its own border + shadow.
    MuiAutocomplete: {
      styleOverrides: {
        inputRoot: { paddingTop: 2, paddingBottom: 2 },
        paper: { marginTop: 4, borderRadius: RADIUS.md, border: '1px solid #ECEAF2', boxShadow: '0 12px 32px rgba(31,16,56,0.14)' },
        listbox: { maxHeight: 300, paddingTop: 4, paddingBottom: 4 },
        option: { fontSize: '0.875rem', minHeight: '36px !important' },
        noOptions: { fontSize: '0.84rem' },
        loading: { fontSize: '0.84rem' },
      },
    },
    // displayEmpty: show "All actions" / "None" (value "") instead of a blank box.
    // Menu opens fully BELOW the box. If it covered the box, releasing the click that
    // opened it would land on an option and select it straight away.
    MuiSelect: {
      defaultProps: {
        displayEmpty: true,
        MenuProps: { anchorOrigin: { vertical: 'bottom', horizontal: 'left' }, transformOrigin: { vertical: 'top', horizontal: 'left' } },
      },
      styleOverrides: { select: { paddingTop: 9.5, paddingBottom: 9.5, fontSize: '0.875rem' } } },
    MuiMenuItem: { styleOverrides: { root: { fontSize: '0.875rem', minHeight: 36 } } },

    // Tables: plum header with white text, rounded top corners.
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: BRAND.plum,
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
    MuiTableRow: { styleOverrides: { root: { '&.MuiTableRow-hover:hover': { backgroundColor: '#FAF7FC' } } } },
    MuiTableCell: { styleOverrides: { root: { borderColor: '#F0EDF5', fontSize: '0.84rem', padding: '10px 14px' }, sizeSmall: { padding: '7px 12px' } } },

    MuiChip: { styleOverrides: { root: { borderRadius: 999, fontWeight: 500 }, sizeSmall: { height: 22, fontSize: '0.72rem' } } },
    MuiToggleButton: { styleOverrides: { root: { borderRadius: 999, textTransform: 'none', fontWeight: 600 } } },
    MuiToggleButtonGroup: { styleOverrides: { root: { borderRadius: 999, backgroundColor: '#FFFFFF' } } },
    MuiSkeleton: { styleOverrides: { rounded: { borderRadius: RADIUS.lg } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, minHeight: 42, fontSize: '0.85rem' } } },
    MuiTabs: { styleOverrides: { root: { minHeight: 42 } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: RADIUS.md, fontSize: '0.84rem', paddingTop: 2, paddingBottom: 2 } } },
    MuiAppBar: { defaultProps: { elevation: 0, color: 'inherit' } },
    MuiCssBaseline: {
      styleOverrides: {
        body: { fontVariantNumeric: 'tabular-nums' },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': { transitionDuration: '0.01ms !important', animationDuration: '0.01ms !important' },
        },
      },
    },
  },
});
