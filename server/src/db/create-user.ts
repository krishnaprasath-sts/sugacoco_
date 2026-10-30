/**
 * Create or update a user from the command line.
 *   npm run user:create -- --name "MD" --email md@sugacoco.com --role ADMIN --password "Secret@123"
 * Re-running with the same email updates name, role and password.
 */
import { parseArgs } from 'node:util';
import { hashPassword } from '../auth/password.js';
import { pool } from './pool.js';
import { ROLES, isRole } from '../auth/roles.js';

export async function upsertUser(name: string, email: string, role: string, password: string) {
  if (!isRole(role)) throw new Error(`Role must be one of: ${ROLES.join(', ')}`);
  if (password.length < 8) throw new Error('Password must be at least 8 characters');

  const hash = await hashPassword(password);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role_id)
     VALUES (?, ?, ?, (SELECT id FROM roles WHERE code = ?))
     ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash),
       role_id = VALUES(role_id), is_active = 1`,
    [name, email.trim().toLowerCase(), hash, role],
  );
}

const isMain = process.argv[1]?.replace(/\\/g, '/').match(/create-user\.(ts|js)$/);
if (isMain) {
  const { values } = parseArgs({
    options: {
      name: { type: 'string' },
      email: { type: 'string' },
      role: { type: 'string' },
      password: { type: 'string' },
    },
  });
  const { name, email, role, password } = values;
  if (!name || !email || !role || !password) {
    console.error('Usage: npm run user:create -- --name "Name" --email a@b.com --role ADMIN --password "..."');
    process.exit(1);
  }
  upsertUser(name, email, role.toUpperCase(), password)
    .then(() => console.log(`User saved: ${email} (${role.toUpperCase()})`))
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
