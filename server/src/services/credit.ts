/**
 * Customer credit ledger maths, in one place.
 * Available = verified WITHHELD − verified APPLIED − verified REFUND
 * (optionally also minus PENDING APPLIED, so two requests can't use the same money).
 */
import type { RowDataPacket } from 'mysql2';
import type { Pool, PoolConnection } from 'mysql2/promise';

export const AVAILABLE_SQL = (alias = 'cc', includePending = false) => `
  COALESCE(SUM(CASE WHEN ${alias}.entry_type = 'WITHHELD' AND ${alias}.status = 'VERIFIED' THEN ${alias}.amount ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN ${alias}.entry_type IN ('APPLIED','REFUND') AND ${alias}.status IN (${includePending ? "'VERIFIED','PENDING'" : "'VERIFIED'"}) THEN ${alias}.amount ELSE 0 END), 0)`;

/** Available credit for one customer + currency. Pass a transaction connection and lock=true to hold the rows. */
export async function availableCredit(db: Pool | PoolConnection, customerId: number, currency: string, opts: { includePending?: boolean; lock?: boolean } = {}) {
  const [[row]] = await db.query<RowDataPacket[]>(
    `SELECT ${AVAILABLE_SQL('cc', opts.includePending)} AS available
     FROM customer_credits cc WHERE cc.customer_id = ? AND cc.currency = ? ${opts.lock ? 'FOR UPDATE' : ''}`,
    [customerId, currency],
  );
  return Number(row.available);
}
