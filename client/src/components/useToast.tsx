import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Alert, Box, Button, Dialog, Snackbar, Stack, Typography } from '@mui/material';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import HelpOutlineRounded from '@mui/icons-material/HelpOutlineRounded';

type Toast = { message: string; severity: 'success' | 'error' | 'info' | 'warning' };

export type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  /** Text of the confirm button. Default: OK. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button and warning icon, for delete / deactivate / remove. */
  danger?: boolean;
};

const ToastContext = createContext<(message: string, severity?: Toast['severity']) => void>(() => {});
const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(async () => false);

// Top right, just under the 64px top bar so the notification bell stays visible.
const ANCHOR = { vertical: 'top', horizontal: 'right' } as const;
const POSITION_SX = { top: { xs: 72, sm: 80 }, right: { xs: 12, sm: 24 }, left: { xs: 12, sm: 'auto' } };
const CARD_RADIUS = '18px';
const CARD_SHADOW = '0 18px 40px rgba(31, 16, 56, 0.18)';

/**
 * App-wide toast messages (rounded card, top right) and confirm boxes (rounded card, centre of the screen).
 *   const toast = useToast();     toast('Saved')
 *   const confirm = useConfirm(); if (await confirm({ title: 'Delete X?', danger: true })) ...
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback((message: string, severity: Toast['severity'] = 'success') => setToast({ message, severity }), []);

  // `ask` keeps the last question so its text stays visible while the box fades out.
  const [ask, setAsk] = useState<ConfirmOptions | null>(null);
  const [asking, setAsking] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const confirm = useCallback((options: ConfirmOptions) => {
    resolver.current?.(false); // a new question replaces an unanswered one
    setAsk(options);
    setAsking(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);
  const answer = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setAsking(false);
  };

  return (
    <ToastContext.Provider value={show}>
      <ConfirmContext.Provider value={confirm}>
        {children}

        <Snackbar
          open={!!toast && !asking}
          autoHideDuration={toast?.severity === 'error' ? 8000 : 4000}
          onClose={(_, reason) => reason !== 'clickaway' && setToast(null)}
          anchorOrigin={ANCHOR}
          sx={POSITION_SX}
        >
          <Alert
            severity={toast?.severity}
            variant="filled"
            onClose={() => setToast(null)}
            sx={{ maxWidth: 420, borderRadius: CARD_RADIUS, boxShadow: CARD_SHADOW, alignItems: 'center', px: 2, py: 1 }}
          >
            {toast?.message}
          </Alert>
        </Snackbar>

        {/* Centre of the screen, page dimmed behind. Escape or a click outside = Cancel. */}
        <Dialog
          open={asking}
          onClose={() => answer(false)}
          aria-labelledby="confirm-title"
          aria-describedby={ask?.message ? 'confirm-message' : undefined}
          slotProps={{
            paper: {
              role: 'alertdialog',
              sx: {
                width: { xs: 'calc(100% - 32px)', sm: 400 },
                m: 2,
                borderRadius: CARD_RADIUS,
                boxShadow: CARD_SHADOW,
                border: '1px solid',
                borderColor: ask?.danger ? '#F7C9C9' : '#E6DDF0',
                borderTop: '4px solid',
                borderTopColor: ask?.danger ? 'error.main' : 'primary.main',
              },
            },
          }}
        >
          <Box sx={{ p: 2.5 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
              <Box
                sx={{
                  flexShrink: 0,
                  width: 36,
                  height: 36,
                  borderRadius: '12px',
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: ask?.danger ? '#FDECEC' : '#F3ECF7',
                  color: ask?.danger ? 'error.main' : 'primary.main',
                }}
              >
                {ask?.danger ? <WarningAmberRounded /> : <HelpOutlineRounded />}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography id="confirm-title" sx={{ fontWeight: 700, fontSize: 14.5, wordBreak: 'break-word' }}>
                  {ask?.title}
                </Typography>
                {ask?.message && (
                  <Typography id="confirm-message" variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    {ask.message}
                  </Typography>
                )}
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 2 }}>
                  {/* Focus starts on Cancel, so a stray Enter never deletes anything. */}
                  <Button size="small" color="inherit" variant="outlined" onClick={() => answer(false)} autoFocus>
                    {ask?.cancelLabel ?? 'Cancel'}
                  </Button>
                  <Button size="small" variant="contained" color={ask?.danger ? 'error' : 'primary'} onClick={() => answer(true)}>
                    {ask?.confirmLabel ?? 'OK'}
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Dialog>
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
export const useConfirm = () => useContext(ConfirmContext);
