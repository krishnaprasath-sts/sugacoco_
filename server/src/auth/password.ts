/**
 * Password hashing with Node's native scrypt (runs on the libuv thread pool, so logins never block the server).
 * Old bcrypt hashes ($2a/$2b...) still verify and are upgraded to scrypt on the next successful login.
 * Format: scrypt$N$r$p$<salt b64>$<hash b64>
 */
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import bcrypt from 'bcryptjs';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, keylen: number, opts: crypto.ScryptOptions) => Promise<Buffer>;
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith('$2')) return bcrypt.compare(password, stored);
  const [kind, n, r, p, salt, hash] = stored.split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** True for old bcrypt hashes or weaker scrypt settings. */
export function needsRehash(stored: string): boolean {
  if (!stored.startsWith('scrypt$')) return true;
  return Number(stored.split('$')[1]) < N;
}

/** Fixed hash used when the email doesn't exist, so response time doesn't reveal valid emails. */
export const DUMMY_HASH_PROMISE = hashPassword('not-a-real-password');
