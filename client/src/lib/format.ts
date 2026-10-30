/** API dates are UTC strings like "2026-10-28 07:56:49". Show them in the viewer's local time. */
export function formatDateTime(value: string | null | undefined, empty = '—') {
  if (!value) return empty;
  const d = new Date(value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Plain dates (DATE columns, "2026-10-28") have no time zone; show as-is. */
export function formatDate(value: string | null | undefined, empty = '—') {
  if (!value) return empty;
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || y < 1900 || !m || !d) return empty;
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Money from the API comes as a string (exact DECIMAL). Indian format: ₹1,23,456.00 */
export function formatMoney(value: string | number | null | undefined, currency = 'INR') {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(value));
}
