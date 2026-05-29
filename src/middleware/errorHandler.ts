import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const isOperational = error instanceof AppError ? error.isOperational : false;

  logger.error(
    'ERROR_HANDLER',
    `Unhandled error encountered on ${req.method} ${req.originalUrl}: ${error.message}`,
    error
  );

  res.status(statusCode).json({
    success: false,
    error: {
      message: isOperational || process.env.NODE_ENV !== 'production' 
        ? error.message 
        : 'An unexpected internal error occurred on the message relay service.',
      ...(process.env.NODE_ENV !== 'production' ? { stack: error.stack } : {}),
    },
  });
}
