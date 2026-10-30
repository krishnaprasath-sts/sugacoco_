import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Alert, Snackbar } from '@mui/material';

type Toast = { message: string; severity: 'success' | 'error' | 'info' | 'warning' };
const ToastContext = createContext<(message: string, severity?: Toast['severity']) => void>(() => {});

/** App-wide toast messages: const toast = useToast(); toast('Saved'). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback((message: string, severity: Toast['severity'] = 'success') => setToast({ message, severity }), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <Snackbar
        open={!!toast}
        autoHideDuration={toast?.severity === 'error' ? 8000 : 4000}
        onClose={(_, reason) => reason !== 'clickaway' && setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast?.severity} variant="filled" onClose={() => setToast(null)} sx={{ maxWidth: 520 }}>
          {toast?.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
