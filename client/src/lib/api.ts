/** Small fetch wrapper. All API calls go through here. */
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

  const res = await fetch(`/api${path}`, { ...init, headers, credentials: 'include' });
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;

  if (!res.ok) throw new ApiError(res.status, data?.message ?? res.statusText, data?.details);
  return data as T;
}
