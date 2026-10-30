/** Shared input rules so every route validates dates and amounts the same way. */
import { z } from 'zod';

/** Real calendar date "YYYY-MM-DD" (rejects 2026-02-31 etc.). */
export function isRealDate(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y >= 2000 && y <= 2100;
}

export const requiredDate = (msg = 'Enter a valid date') =>
  z.string({ error: msg }).refine(isRealDate, msg);

/** Optional date: '' / null / undefined → null. */
export const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => v || null)
  .refine((v) => v === null || isRealDate(v), 'Enter a valid date');

const decimals = (v: number, places: number) => Math.abs(Math.round(v * 10 ** places) - v * 10 ** places) < 1e-6;

/** Largest amount we accept (₹1 lakh crore). Keeps far inside DECIMAL(15,2). */
export const MAX_AMOUNT = 1e12;

export const amount = (msg: string, { allowZero = false } = {}) =>
  z.coerce
    .number({ error: msg })
    .refine(Number.isFinite, msg)
    .refine((v) => (allowZero ? v >= 0 : v > 0), allowZero ? 'Cannot be negative' : msg)
    .refine((v) => v <= MAX_AMOUNT, 'Amount is too large')
    .refine((v) => decimals(v, 2), 'Use at most 2 decimals');

export const quantity = (msg: string) =>
  z.coerce
    .number({ error: msg })
    .refine((v) => Number.isFinite(v) && v > 0, msg)
    .refine((v) => v <= 1e9, 'Quantity is too large')
    .refine((v) => decimals(v, 3), 'Use at most 3 decimals');

export const unitPrice = (msg: string) =>
  z.coerce
    .number({ error: msg })
    .refine((v) => Number.isFinite(v) && v >= 0, 'Price cannot be negative')
    .refine((v) => v <= MAX_AMOUNT, 'Price is too large')
    .refine((v) => decimals(v, 4), 'Use at most 4 decimals');
