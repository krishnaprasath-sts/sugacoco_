/** Small fetch wrapper. All API calls go through here. */

/**
 * Where the API lives. Empty (default) = same address as the website: the dev proxy, or one Node app serving both.
 * Set VITE_API_URL at build time (e.g. https://api.example.com) when the website and the API are on different domains.
 */
const API_ORIGIN = String(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

/** Full address of an API path, for fetch and for plain links (downloads, files): apiUrl('/orders/5/pdf/pi'). */
export const apiUrl = (path: string) => `${API_ORIGIN}/api${path}`;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  const res = await fetch(apiUrl(path), { ...init, headers, credentials: 'include' });
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;

  if (!res.ok) throw new ApiError(res.status, data?.message ?? res.statusText, data?.details);
  return data as T;
}
