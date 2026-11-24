import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ThemeModeProvider } from './ThemeContext';
import { ToastProvider } from './components/useToast';
import { ApiError } from './lib/api';
import { installSelectGuard } from './lib/selectGuard';
import { markSignedIn, revealApp } from './lib/appShell';

installSelectGuard();
// Safety net: never leave the static sign-in copy (lib/appShell) covering the app.
setTimeout(revealApp, 10000);

/**
 * Session ended (expired, password reset, user deactivated): clear the cached user so
 * RequireAuth sends the person to the login page instead of showing failing screens.
 */
function onAuthError(err: unknown) {
  if (err instanceof ApiError && err.status === 401) {
    const me = queryClient.getQueryData(['auth', 'me']);
    markSignedIn(false);
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
      <ThemeModeProvider>
        <ToastProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </ThemeModeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
