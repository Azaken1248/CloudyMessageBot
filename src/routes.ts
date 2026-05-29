import { Router } from 'express';
import { handleMessageRelay } from './controllers/messageController.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { discordService } from './services/discordService.js';
import { emailService } from './services/emailService.js';

const router = Router();

router.post('/messages', rateLimiter, handleMessageRelay);

router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      channels: {
        discord: {
          configured: discordService.isEnabled(),
          active: discordService.isClientReady(),
        },
        email: {
          configured: emailService.isEnabled(),
          active: emailService.isEnabled(),
        },
      },
    },
  });
});

export { router as relayRouter };
