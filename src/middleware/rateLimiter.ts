import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const ipCache = new Map<string, RateLimitRecord>();
const LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  const record = ipCache.get(ip);

  if (!record || now > record.resetTime) {
    ipCache.set(ip, {
      count: 1,
      resetTime: now + LIMIT_WINDOW_MS,
    });
    next();
    return;
  }

  record.count += 1;

  if (record.count > MAX_REQUESTS_PER_WINDOW) {
    logger.warn('RATE_LIMITER', `IP ${ip} exceeded rate limit. Requests: ${record.count}`);
    res.status(429).json({
      success: false,
      error: 'Too many messages sent. Please wait a minute before trying again.',
    });
    return;
  }

  next();
}

// Clean up stale cache records periodically to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipCache.entries()) {
    if (now > record.resetTime) {
      ipCache.delete(ip);
    }
  }
}, 5 * 60 * 1000); // every 5 minutes
