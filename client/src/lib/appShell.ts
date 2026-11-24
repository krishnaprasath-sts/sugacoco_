/**
 * "App shell": the static build can carry a ready-made copy of the sign-in page inside index.html
 * (made by scripts/prerender-shell.mjs). The browser shows it at once, while the app's JavaScript is
 * still loading; the real page then takes its place. These helpers do that hand-over.
 * Builds without the shell (dev, plain `npm run build`) simply find nothing to do.
 */

const SESSION_FLAG = 'sugacoco.session';

/** Remembered in the browser so signed-in people don't see the sign-in copy flash by on the next visit. */
export function markSignedIn(signedIn: boolean) {
  try {
    if (signedIn) localStorage.setItem(SESSION_FLAG, '1');
    else localStorage.removeItem(SESSION_FLAG);
  } catch {
    /* storage unavailable */
  }
}

/** What the person already typed into the static copy, so nothing is lost at hand-over. */
export function shellValue(type: 'email' | 'password'): string {
  return document.querySelector<HTMLInputElement>(`#app-shell input[type="${type}"]`)?.value ?? '';
}

/**
 * Removes the static copy and shows the real app. Safe to call more than once.
 * Returns whether the copy was on screen and which of its fields had the cursor.
 */
export function revealApp(): { wasShown: boolean; focused: 'email' | 'password' | null } {
  const root = document.documentElement;
  const shell = document.getElementById('app-shell');
  const wasShown = !!shell && root.classList.contains('shell-on');
  const active = document.activeElement;
  const focused = shell && active instanceof HTMLInputElement && shell.contains(active) ? (active.type === 'password' ? 'password' : 'email') : null;
  root.classList.remove('shell-on');
  shell?.remove();
  document.getElementById('app-shell-css')?.remove();
  return { wasShown, focused };
}
