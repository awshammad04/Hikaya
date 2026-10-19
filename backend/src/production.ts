import { timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export function aiServiceUrl(): string {
  return (
    process.env.AI_SERVICE_URL ||
    (process.env.AI_SERVICE_HOSTPORT
      ? `http://${process.env.AI_SERVICE_HOSTPORT}`
      : 'http://localhost:8001')
  ).replace(/\/+$/, '');
}

export function requireProductionConfig(): void {
  if (process.env.NODE_ENV !== 'production') return;
  for (const key of [
    'DATABASE_URL',
    'HIKAYA_INTERNAL_TOKEN',
    'AI_INTERNAL_TOKEN',
  ]) {
    if (!process.env[key]) throw new Error(`${key} is required in production.`);
  }
  if (!process.env.AI_SERVICE_URL && !process.env.AI_SERVICE_HOSTPORT)
    throw new Error('AI service address is required.');
}

export function internalAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (process.env.NODE_ENV !== 'production' || req.path === '/api/v1/health')
    return next();
  const expected = Buffer.from(process.env.HIKAYA_INTERNAL_TOKEN || '');
  const supplied = Buffer.from(req.get('x-hikaya-internal-token') || '');
  if (
    !expected.length ||
    supplied.length !== expected.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  next();
}
