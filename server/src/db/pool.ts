import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  connectionLimit: 20,
  maxIdle: 10,
  // Return DECIMAL as string so money values never lose precision.
  decimalNumbers: false,
  dateStrings: true,
  timezone: 'Z',
});

// Store and read all times in UTC, whatever the server's local time zone is (XAMPP = IST, Webuzo may be UTC).
// The browser converts to local time for display.
// Strict mode: invalid dates/out-of-range numbers raise an error instead of being silently stored (e.g. 0000-00-00).
pool.pool.on('connection', (conn) => {
  conn.query(
    "SET time_zone = '+00:00', sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'",
  );
});

/**
 * Run several queries in one transaction.
 * Use for workflow steps: status change + status history + audit log must save together.
 */
export async function withTransaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
