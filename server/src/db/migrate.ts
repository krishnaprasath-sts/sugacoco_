/**
 * Simple SQL migration runner.
 * Runs every file in server/migrations (sorted by name) that has not run yet,
 * and records it in the schema_migrations table.
 * Add new changes as a new numbered file, e.g. 002_customers.sql. Never edit an applied file.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// Works from both src/db (tsx) and dist/db (built).
const migrationsDir = path.resolve(here, '../../migrations');

async function main() {
  const base = {
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
  };

  // Create the database if missing (dev). On hosting the panel usually creates it.
  const admin = await mysql.createConnection(base);
  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${env.db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await admin.end();

  const conn = await mysql.createConnection({ ...base, database: env.db.name });
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

  const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name as string));

  const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  let count = 0;

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    console.log(`Applying ${file} ...`);
    await conn.query(sql);
    await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
    count++;
  }

  console.log(count ? `Done. ${count} migration(s) applied.` : 'Database is up to date.');
  await conn.end();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
