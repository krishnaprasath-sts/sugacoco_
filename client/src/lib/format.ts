// Formatters are created once and reused: building an Intl formatter is slow, and lists format hundreds of values.
const DATE_TIME = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const DATE = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const MONEY = new Map<string, Intl.NumberFormat>();

/** API dates are UTC strings like "2026-10-28 07:56:49". Show them in the viewer's local time. */
export function formatDateTime(value: string | null | undefined, empty = '—') {
  if (!value) return empty;
  const d = new Date(value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  return DATE_TIME.format(d);
}

/** Plain dates (DATE columns, "2026-10-28") have no time zone; show as-is. */
export function formatDate(value: string | null | undefined, empty = '—') {
  if (!value) return empty;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || y < 1900 || !m || !d) return empty;
  return DATE.format(new Date(y, m - 1, d));
}

/** Money from the API comes as a string (exact DECIMAL). Indian format: ₹1,23,456.00 */
export function formatMoney(value: string | number | null | undefined, currency = 'INR') {
  if (value === null || value === undefined || value === '') return '—';
  let f = MONEY.get(currency);
  if (!f) {
    f = new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 });
    MONEY.set(currency, f);
  }
  return f.format(Number(value));
}
