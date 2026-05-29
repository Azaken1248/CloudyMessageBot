import dotenv from 'dotenv';
import path from 'path';
import { logger } from './utils/logger.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

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

export function checkConfig() {
  logger.info('CONFIG', '--- Config Verification ---');
  logger.info('CONFIG', `Port: ${config.port}`);
  logger.info('CONFIG', `CORS Client URL: ${config.clientUrl}`);

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
    logger.info('CONFIG', `SMTP User: ${config.smtp.user}`);
  }

  if (!config.artistEmail) {
    logger.warn('CONFIG', 'ARTIST_EMAIL is missing. Email forwarding will be disabled.');
  } else {
    logger.info('CONFIG', `Artist Email Address: ${config.artistEmail}`);
  }
  logger.info('CONFIG', '---------------------------');
}
