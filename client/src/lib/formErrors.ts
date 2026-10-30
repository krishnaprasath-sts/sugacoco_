import { ApiError } from './api';

/** Field errors from a 400/409 API response, keyed by field name. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (error instanceof ApiError) {
    return (error.details as { fields?: Record<string, string> } | undefined)?.fields ?? {};
  }
  return {};
}

/** A message for errors that are not tied to one field. */
export function formError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError) return Object.keys(fieldErrors(error)).length ? null : error.message;
  return 'Cannot reach the server. Check your connection and try again.';
}
