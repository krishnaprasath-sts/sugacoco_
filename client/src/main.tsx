import '@fontsource-variable/dm-sans';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { theme } from './theme';
import App from './App';
import { ToastProvider } from './components/useToast';
import { ApiError } from './lib/api';

/**
 * Session ended (expired, password reset, user deactivated): clear the cached user so
 * RequireAuth sends the person to the login page instead of showing failing screens.
 */
function onAuthError(err: unknown) {
  if (err instanceof ApiError && err.status === 401) {
    const me = queryClient.getQueryData(['auth', 'me']);
    if (me) {
      queryClient.clear();
      queryClient.setQueryData(['auth', 'me'], null);
    }
  }
}

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onAuthError }),
  mutationCache: new MutationCache({ onError: onAuthError }),
  defaultOptions: {
    queries: {
      // Don't retry "no access" / "not found" style errors; retry network hiccups once.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ToastProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
