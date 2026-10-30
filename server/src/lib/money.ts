/**
 * Money helpers. Values are rounded to 2 decimals the same way everywhere,
 * so the server's numbers always match what the form showed.
 */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function lineTotal(quantity: number, unitPrice: number): number {
  return round2(quantity * unitPrice);
}

export function sum(values: number[]): number {
  return round2(values.reduce((a, b) => a + b, 0));
}

/** Advance amount from total and percent. */
export function advanceFromPercent(total: number, percent: number): number {
  return round2((total * percent) / 100);
}

/** Two amounts are equal to the cent. */
export function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

/** Fixed 2-decimal string for DECIMAL columns. */
export const toDecimal = (v: number) => v.toFixed(2);

/** All amounts are in Indian Rupees (client request). Add codes here to allow more. */
export const CURRENCIES = ['INR'] as const;
