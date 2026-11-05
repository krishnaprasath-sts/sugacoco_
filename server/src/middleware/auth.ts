import type { RequestHandler } from 'express';
import { AUTH_COOKIE, verifyToken } from '../auth/token.js';
import { can, findActiveUserById, toAuthUser, type AuthUser } from '../auth/users.js';
import type { Permission } from '../auth/permissions.js';
import { HttpError } from './error.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Checks the session cookie and loads the user from the DB on every request,
 * so a deactivated user, changed role or changed role permissions take effect immediately.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = verifyToken(req.cookies?.[AUTH_COOKIE]);
  if (!token) throw new HttpError(401, 'Please log in');

  const row = await findActiveUserById(token.userId);
  // Version mismatch = password was reset or account was deactivated after this login.
  if (!row || row.token_version !== token.tokenVersion) throw new HttpError(401, 'Please log in');

  req.user = toAuthUser(row);
  next();
};

/**
 * Use after requireAuth. Passes if the user's role has ANY of the given permissions.
 * Example: router.post('/', requirePermission('payments.verify'), handler)
 */
export function requirePermission(...anyOf: Permission[]): RequestHandler {
  return (req, _res, next) => {
    if (!can(req.user, ...anyOf)) {
      throw new HttpError(403, 'You do not have permission for this action');
    }
    next();
  };
}
