/** Same rounding as server/src/lib/money.ts so the form shows exactly what will be saved. */
export const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
export const lineTotal = (qty: number, price: number) => round2(qty * price);
export const sum = (values: number[]) => round2(values.reduce((a, b) => a + b, 0));
export const advanceFromPercent = (total: number, percent: number) => round2((total * percent) / 100);

/** Parse a number typed by the user ("1,250.50" → 1250.5). Returns NaN when empty or invalid. */
export function parseNum(value: string): number {
  const cleaned = value.replace(/,/g, '').trim();
  if (cleaned === '') return NaN;
  return Number(cleaned);
}

/** All amounts are in Indian Rupees (client request). */
export const CURRENCIES = ['INR'] as const;
