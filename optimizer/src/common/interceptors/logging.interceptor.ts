import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { getCorrelationId } from '@common/middleware/correlation-id.middleware';
import { elapsed } from '@common/utils';

/**
 * Logging interceptor that logs request/response details with timing
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const method = request.method;
    const url = request.url;
    const correlationId = getCorrelationId(request);
    const userAgent = request.headers['user-agent'] || 'unknown';
    const ip = request.ip || request.socket?.remoteAddress || 'unknown';
    const startTime = Date.now();
    const bodyString = JSON.stringify(request.body ?? {});

    // Log incoming request
    this.logger.log({
      message: 'Incoming request',
      correlationId,
      method,
      url,
      ip,
      userAgent: userAgent.substring(0, 100),
      bodySize: bodyString.length,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = elapsed(startTime);
          const statusCode = response.statusCode;

          this.logger.log({
            message: 'Request completed',
            correlationId,
            method,
            url,
            statusCode,
            duration: `${duration}ms`,
          });
        },
        error: (error: Error) => {
          const duration = elapsed(startTime);

          this.logger.error({
            message: 'Request failed',
            correlationId,
            method,
            url,
            error: error.message,
            duration: `${duration}ms`,
          });
        },
      }),
    );
  }
}
