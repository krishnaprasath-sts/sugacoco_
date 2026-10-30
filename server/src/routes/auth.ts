import { Router } from 'express';
import { DUMMY_HASH_PROMISE, hashPassword, needsRehash, verifyPassword } from '../auth/password.js';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { AUTH_COOKIE, cookieOptions, signToken } from '../auth/token.js';
import { findUserByEmail, toAuthUser } from '../auth/users.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { parse } from '../middleware/validate.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string({ error: 'Enter your email' }).trim().toLowerCase().min(1, 'Enter your email'),
  password: z.string({ error: 'Enter your password' }).min(1, 'Enter your password'),
});


const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  // Only failed attempts count, so many staff on one office network are not blocked.
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);

  const row = await findUserByEmail(email);
  const ok = await verifyPassword(password, row?.password_hash ?? (await DUMMY_HASH_PROMISE));
  if (!row || !ok || !row.is_active) {
    throw new HttpError(401, 'Invalid email or password');
  }

  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [row.id]);
  // Upgrade old bcrypt hashes to scrypt now that we know the password (same password, faster non-blocking check).
  if (needsRehash(row.password_hash)) {
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(password), row.id]);
  }
  res.cookie(AUTH_COOKIE, signToken({ userId: row.id, tokenVersion: row.token_version }), cookieOptions);
  res.json({ user: toAuthUser(row) });
});

authRouter.post('/logout', (_req, res) => {
  const { maxAge: _maxAge, ...clearOptions } = cookieOptions;
  res.clearCookie(AUTH_COOKIE, clearOptions);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
