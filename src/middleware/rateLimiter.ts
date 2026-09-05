import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import {
  buildTrustedPeers,
  resolveClientIp,
  toRateLimitKey,
} from '../utils/clientIp.js';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const ipCache = new Map<string, RateLimitRecord>();
const LIMIT_WINDOW_MS = config.rateLimit.windowMs;
const MAX_REQUESTS_PER_WINDOW = config.rateLimit.max;
const MAX_TRACKED_CLIENTS = 10_000;

function pruneExpired(now: number): void {
  for (const [key, record] of ipCache.entries()) {
    if (now > record.resetTime) ipCache.delete(key);
  }
}

const trustedPeers = buildTrustedPeers(config.trustedProxies);

/**
 * Forwarding headers are believed only when the socket peer is a trusted proxy;
 * see utils/clientIp.ts. IPv6 callers are bucketed by /64, since one user is
 * normally allocated the whole block.
 */
function getClientKey(req: Request): string {
  const address = resolveClientIp(req, {
    source: config.clientIpSource,
    trustedPeers,
  });

  return address === 'unknown' ? 'unknown' : toRateLimitKey(address);
}

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientKey(req);
  const now = Date.now();

  const record = ipCache.get(ip);

  if (!record || now > record.resetTime) {
    if (!record && ipCache.size >= MAX_TRACKED_CLIENTS) {
      pruneExpired(now);
      if (ipCache.size >= MAX_TRACKED_CLIENTS) {
        logger.warn('RATE_LIMITER', `Tracking cache full (${ipCache.size}); rejecting new client ${ip}.`);
        res.setHeader('Retry-After', String(Math.ceil(LIMIT_WINDOW_MS / 1000)));
        res.status(429).json({
          success: false,
          error: 'Server is busy. Please try again in a minute.',
        });
        return;
      }
    }

    ipCache.set(ip, {
      count: 1,
      resetTime: now + LIMIT_WINDOW_MS,
    });
    next();
    return;
  }

  record.count += 1;

  if (record.count > MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
    logger.warn('RATE_LIMITER', `IP ${ip} exceeded rate limit. Requests: ${record.count}`);
    res.setHeader('Retry-After', String(retryAfterSeconds));
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
  pruneExpired(Date.now());
}, 5 * 60 * 1000).unref(); // every 5 minutes; unref'd so it never delays shutdown

/** Clear all tracked clients. Intended for test isolation. */
export function resetRateLimiter(): void {
  ipCache.clear();
}
