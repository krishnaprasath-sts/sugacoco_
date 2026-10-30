import jwt from 'jsonwebtoken';
import type { CookieOptions } from 'express';
import { env, isProd } from '../config/env.js';

export const AUTH_COOKIE = 'sugacoco_session';
const MAX_AGE_HOURS = 10;

export type TokenData = { userId: number; tokenVersion: number };

export function signToken({ userId, tokenVersion }: TokenData): string {
  return jwt.sign({ sub: String(userId), tv: tokenVersion }, env.jwtSecret, { expiresIn: `${MAX_AGE_HOURS}h` });
}

/** Returns the token data, or null if the token is missing/invalid/expired. */
export function verifyToken(token: string | undefined): TokenData | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (typeof payload !== 'object') return null;
    const userId = Number(payload.sub);
    const tokenVersion = Number(payload.tv);
    if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(tokenVersion)) return null;
    return { userId, tokenVersion };
  } catch {
    return null;
  }
}

// httpOnly: JavaScript in the browser cannot read the token.
export const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
  maxAge: MAX_AGE_HOURS * 60 * 60 * 1000,
};
