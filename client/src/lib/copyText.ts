/**
 * Copy text to the clipboard. The modern clipboard API only works on https or localhost,
 * so when the app is opened by network address (http://192.168.x.x) fall back to the
 * older select-and-copy method, which still works there.
 */
export async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the fallback
    }
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '0';
  area.style.opacity = '0';
  document.body.appendChild(area);
  const active = document.activeElement as HTMLElement | null;
  area.focus();
  area.select();
  area.setSelectionRange(0, text.length); // iOS
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(area);
  active?.focus?.();
  return ok;
}
