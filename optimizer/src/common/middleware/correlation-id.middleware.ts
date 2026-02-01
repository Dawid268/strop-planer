import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { generateCorrelationId } from '@common/utils';

/**
 * Header name for correlation ID
 */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Correlation ID middleware
 * Adds a unique correlation ID to each request for tracking across services
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  public use(req: Request, res: Response, next: NextFunction): void {
    // Use existing correlation ID from header or generate new one
    const correlationId =
      (req.headers[CORRELATION_ID_HEADER] as string) || generateCorrelationId();

    // Attach to request for use in handlers
    req.headers[CORRELATION_ID_HEADER] = correlationId;

    // Add to response headers for client tracking
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}

/**
 * Helper to get correlation ID from request
 */
export function getCorrelationId(req: Request): string {
  return (req.headers[CORRELATION_ID_HEADER] as string) || 'unknown';
}
