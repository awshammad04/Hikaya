import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../database/entities/account.entity';

/**
 * Session cookie helpers.
 *
 * The browser only ever talks to the frontend origin, whose `/api/v1` bridge
 * forwards cookies here, so a host-only, HttpOnly, SameSite=Lax cookie is all
 * that is needed: scripts cannot read it and other sites cannot send it.
 */
export const SESSION_COOKIE = 'hikaya_session';
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function cookie(value: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export const sessionCookie = (token: string) =>
  cookie(token, SESSION_TTL_SECONDS);
export const clearedSessionCookie = () => cookie('', 0);

/** Client address for throttling; the frontend bridge sets X-Forwarded-For. */
export function clientAddress(req: Request): string {
  const forwarded = req.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.ip || 'unknown';
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

/** The signed-in user; only meaningful behind SessionGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user as User,
);
