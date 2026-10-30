/** Dev only: one test login per role. Password for all: Sugacoco@123 */
import { isProd } from '../config/env.js';
import { pool } from './pool.js';
import { upsertUser } from './create-user.js';

const PASSWORD = 'Sugacoco@123';
const users = [
  ['Sales User', 'sales@sugacoco.test', 'SALES'],
  ['Accounts User', 'accounts@sugacoco.test', 'ACCOUNTS'],
  ['QC User', 'qc@sugacoco.test', 'QC'],
  ['Packaging User', 'packaging@sugacoco.test', 'PACKAGING'],
  ['Documentation User', 'docs@sugacoco.test', 'DOCUMENTATION'],
  ['MD Admin', 'admin@sugacoco.test', 'ADMIN'],
] as const;

async function main() {
  if (isProd) throw new Error('seed-dev must not run in production');
  for (const [name, email, role] of users) {
    await upsertUser(name, email, role, PASSWORD);
    console.log(`${role.padEnd(14)} ${email}`);
  }
  console.log(`Password for all: ${PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
