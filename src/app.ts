import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { relayRouter } from './routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

const app = express();

app.disable('x-powered-by');

app.use(
  cors({
    origin: [config.clientUrl, 'http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  })
);

app.use(express.json({ limit: '10kb' }));

app.use((req, _res, next) => {
  logger.debug('HTTP', `Incoming request: ${req.method} ${req.originalUrl} from IP: ${req.ip}`);
  next();
});

// Mount application API routes
app.use('/api', relayRouter);

// Catch-all route for unmatched paths (404)
app.use((req, res) => {
  logger.warn('HTTP', `Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: {
      message: `The requested path '${req.originalUrl}' does not exist on this server.`,
    },
  });
});

// Centralized error handling middleware
app.use(errorHandler);

export default app;
