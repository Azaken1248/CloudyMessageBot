import http from 'http';
import app from './app.js';
import { config, checkConfig } from './config.js';
import { discordService } from './services/discordService.js';
import { emailService } from './services/emailService.js';
import { logger } from './utils/logger.js';

checkConfig();

let server: http.Server;

async function bootstrap() {
  // Initialize notification channels
  await discordService.initialize();
  await emailService.initialize();

  server = app.listen(config.port, () => {
    logger.info('SERVER', `Cloudy Message Relay server successfully running on port ${config.port}`);
    logger.info('SERVER', `Active deployment environment: ${config.nodeEnv}`);
  });

  // Handle unhandled promise rejections globally
  process.on('unhandledRejection', (reason) => {
    logger.error('SERVER', 'Unhandled Promise Rejection caught:', reason);
  });

  // Handle uncaught exceptions globally
  process.on('uncaughtException', (error) => {
    logger.error('SERVER', 'Uncaught Exception caught! Initiating emergency shutdown...', error);
    gracefulShutdown(1);
  });

  // Process termination signals
  process.on('SIGTERM', () => {
    logger.info('SERVER', 'SIGTERM signal received. Initiating graceful shutdown...');
    gracefulShutdown(0);
  });

  process.on('SIGINT', () => {
    logger.info('SERVER', 'SIGINT signal received. Initiating graceful shutdown...');
    gracefulShutdown(0);
  });
}

function gracefulShutdown(exitCode: number) {
  logger.info('SERVER', 'Shutting down HTTP server listener...');

  if (server) {
    server.close(async () => {
      logger.info('SERVER', 'HTTP server connection listener closed.');

      try {
        // Disconnect integration services
        await discordService.shutdown();
        emailService.shutdown();

        logger.info('SERVER', 'Graceful shutdown completed successfully.');
        process.exit(exitCode);
      } catch (error) {
        logger.error('SERVER', 'Error encountered during shutdown sequence:', error);
        process.exit(1);
      }
    });

    // Enforce hard shutdown timeout if connections are hung
    setTimeout(() => {
      logger.warn('SERVER', 'Graceful shutdown timed out. Enforcing immediate process termination.');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(exitCode);
  }
}

bootstrap().catch((error) => {
  logger.error('SERVER', 'Fatal error occurred during bootstrap sequence:', error);
  process.exit(1);
});
