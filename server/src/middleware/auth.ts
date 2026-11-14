import type { Request, RequestHandler } from 'express';
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
  const user = await sessionUser(req);
  if (!user) throw new HttpError(401, 'Please log in');
  req.user = user;
  next();
};

/** The signed-in user from the session cookie, or null if there is no valid session. */
export async function sessionUser(req: Request): Promise<AuthUser | null> {
  const token = verifyToken(req.cookies?.[AUTH_COOKIE]);
  if (!token) return null;
  const row = await findActiveUserById(token.userId);
  // Version mismatch = password was reset or account was deactivated after this login.
  if (!row || row.token_version !== token.tokenVersion) return null;
  return toAuthUser(row);
}

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
