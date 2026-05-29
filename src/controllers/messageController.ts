import type { Request, Response, NextFunction } from 'express';
import { ValidationError, RelayError } from '../errors/AppError.js';
import { discordService } from '../services/discordService.js';
import { emailService } from '../services/emailService.js';
import { logger } from '../utils/logger.js';
import type { RelayMessage } from '../types/index.js';

export async function handleMessageRelay(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    logger.info('API', `Received contact form relay request from IP: ${req.ip}`);
    logger.debug('API', 'Request body payload:', req.body);

    const { name, email, discordId, preferredContact, subject, message } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new ValidationError('Name field is required and must be a valid string.');
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      throw new ValidationError('Message field is required and must be a valid string.');
    }

    const cleanEmail = (email || '').trim();
    const cleanDiscordId = (discordId || '').trim();

    if (!cleanEmail && !cleanDiscordId) {
      throw new ValidationError(
        'You must provide at least one contact channel: a valid Email address or a Discord ID.'
      );
    }

    const payload: RelayMessage = {
      name: name.trim(),
      email: cleanEmail,
      discordId: cleanDiscordId,
      preferredContact: (preferredContact || 'Either').trim(),
      subject: (subject || '').trim(),
      message: message.trim(),
    };

    const hasDiscord = discordService.isEnabled();
    const hasEmail = emailService.isEnabled();

    if (!hasDiscord && !hasEmail) {
      logger.error('API', 'Neither Discord nor Email relayer integrations are configured.');
      throw new RelayError(
        'The message relay service is currently offline. Please configure environment credentials.'
      );
    }

    const results = {
      discord: false,
      email: false,
    };

    const dispatches: Promise<void>[] = [];

    if (hasDiscord) {
      dispatches.push(
        discordService.sendRelay(payload).then((ok) => {
          results.discord = ok;
        })
      );
    }

    if (hasEmail) {
      dispatches.push(
        emailService.sendRelay(payload).then((ok) => {
          results.email = ok;
        })
      );
    }

    await Promise.all(dispatches);

    logger.info(
      'API',
      `Message processed. Dispatch results: [Discord: ${results.discord}] [Email: ${results.email}]`
    );

    if (!results.discord && !results.email) {
      throw new RelayError(
        'Failed to deliver message to any notification channels. Please try again later.'
      );
    }

    res.status(200).json({
      success: true,
      data: {
        message: 'Your message has been relayed successfully.',
        channels: results,
      },
    });
  } catch (error) {
    next(error);
  }
}
