import dotenv from 'dotenv';
import path from 'path';
import { logger } from './utils/logger.js';
import type { ClientIpSource } from './utils/clientIp.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * How many proxy hops sit in front of this app, for Express's X-Forwarded-For
 * handling. With `n` hops it reads the entry the nearest trusted proxy appended
 * and ignores anything the client prepended itself.
 *
 * In the Cloudflare Tunnel deployment this is only a fallback: the rate limiter
 * prefers `CF-Connecting-IP`, which the Cloudflare edge always overwrites. This
 * setting matters when running without the tunnel, or if some other middleware
 * comes to depend on `req.ip`.
 *
 * Too high (or `true`) trusts a client-supplied header and makes per-IP limiting
 * spoofable; too low buckets every visitor under the proxy's own address.
 */
function parseTrustProxy(raw: string | undefined): number | false {
  const normalized = (raw ?? '').trim().toLowerCase();
  if (normalized === '') return 1;
  if (normalized === 'false' || normalized === '0') return false;

  const hops = Number.parseInt(normalized, 10);
  return Number.isFinite(hops) && hops > 0 ? hops : 1;
}

function parseClientIpSource(raw: string | undefined): ClientIpSource {
  const normalized = (raw ?? '').trim().toLowerCase();
  return normalized === 'cloudflare' || normalized === 'xff' || normalized === 'socket'
    ? normalized
    : 'auto';
}

export const config = {
  port: parseInt(process.env.PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),

  // Which forwarding header may be believed, and which peers may set it.
  // Defaults suit the Cloudflare Tunnel deployment (cloudflared connects over
  // loopback) and stay correct if the topology changes.
  clientIpSource: parseClientIpSource(process.env.CLIENT_IP_SOURCE),
  trustedProxies: process.env.TRUSTED_PROXIES?.trim() || 'loopback',

  // Tunable so a deployment can adjust throughput without a code change, and so
  // the test suite is not throttled by its own request volume.
  rateLimit: {
    windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: Number.parseInt(process.env.RATE_LIMIT_MAX || '5', 10),
  },

  discord: {
    token: process.env.DISCORD_BOT_TOKEN || '',
    channelId: process.env.DISCORD_NOTIFICATION_CHANNEL_ID || '',
    artistUserId: process.env.DISCORD_ARTIST_USER_ID || '',
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '"Cloudy Portfolio Relayer" <noreply@example.com>',
  },

  artistEmail: process.env.ARTIST_EMAIL || '',
};

/** `someone@example.com` -> `s*****e@example.com`; enough to identify a misconfiguration. */
function maskEmail(value: string): string {
  const at = value.lastIndexOf('@');
  if (at < 1) return '***';

  const local = value.slice(0, at);
  const domain = value.slice(at);
  if (local.length <= 2) return `${local[0]}***${domain}`;

  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 5))}${local[local.length - 1]}${domain}`;
}

export function checkConfig() {
  logger.info('CONFIG', '--- Config Verification ---');
  logger.info('CONFIG', `Port: ${config.port}`);
  logger.info('CONFIG', `CORS Client URL: ${config.clientUrl}`);
  logger.info('CONFIG', `Client IP source: ${config.clientIpSource} (trusted peers: ${config.trustedProxies})`);
  logger.info('CONFIG', `Trust proxy hops: ${config.trustProxy}`);

  if (config.trustProxy === false) {
    logger.warn('CONFIG', 'TRUST_PROXY=false — rate limiting will key on the direct socket address.');
  }

  if (!config.discord.token) {
    logger.warn('CONFIG', 'DISCORD_BOT_TOKEN is missing. Discord relaying will be disabled.');
  } else {
    logger.info('CONFIG', 'Discord Bot Token: Configured');
  }

  if (!config.discord.channelId) {
    logger.warn('CONFIG', 'DISCORD_NOTIFICATION_CHANNEL_ID is missing. Discord channel messages will be disabled.');
  } else {
    logger.info('CONFIG', `Discord Channel ID: ${config.discord.channelId}`);
  }

  if (!config.smtp.user || !config.smtp.pass) {
    logger.warn('CONFIG', 'SMTP user or password missing. Email relaying will be disabled.');
  } else {
    // Addresses are masked: these lines exist to confirm configuration is
    // present, which does not require writing the account itself into logs
    // that are aggregated and retained.
    logger.info('CONFIG', `SMTP User: ${maskEmail(config.smtp.user)}`);
  }

  if (!config.artistEmail) {
    logger.warn('CONFIG', 'ARTIST_EMAIL is missing. Email forwarding will be disabled.');
  } else {
    logger.info('CONFIG', `Artist Email Address: ${maskEmail(config.artistEmail)}`);
  }
  logger.info('CONFIG', '---------------------------');
}
