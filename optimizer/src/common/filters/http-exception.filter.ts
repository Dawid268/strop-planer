import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError, ValidationError } from '@shared/errors/app-error';
import { getCorrelationId } from '@common/middleware/correlation-id.middleware';
import { nowIso } from '@common/utils';

/**
 * Standard error response structure
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    timestamp: string;
    correlationId: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Global exception filter that handles all exceptions
 * and returns standardized error responses
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const correlationId = getCorrelationId(request);

    const appError = this.normalizeException(exception);

    this.logException(appError, exception, correlationId, request);

    const errorResponse = this.buildErrorResponse(appError, correlationId);

    response.status(appError.statusCode).json(errorResponse);
  }

  /**
   * Normalize any exception into AppError
   */
  private normalizeException(exception: unknown): AppError {
    if (exception instanceof AppError) {
      return exception;
    }

    if (exception instanceof BadRequestException) {
      return this.handleValidationException(exception);
    }

    if (exception instanceof HttpException) {
      return new AppError(
        this.getErrorCode(exception.getStatus()),
        exception.message,
        exception.getStatus(),
        this.getUserMessage(exception.getStatus()),
      );
    }

    return new AppError(
      'INTERNAL_SERVER_ERROR',
      exception instanceof Error ? exception.message : 'Unknown error',
      HttpStatus.INTERNAL_SERVER_ERROR,
      'An unexpected error occurred',
    );
  }

  /**
   * Handle class-validator validation exceptions
   */
  private handleValidationException(exception: BadRequestException): AppError {
    const response = exception.getResponse();

    if (typeof response === 'object' && response !== null) {
      const resp = response as Record<string, unknown>;
      const messages = resp['message'];

      if (Array.isArray(messages)) {
        const fields: Record<string, string> = {};
        messages.forEach((msg: string) => {
          const [field] = msg.split(' ');
          fields[field] = msg;
        });
        return new ValidationError('Validation failed', fields);
      }
    }

    return new AppError(
      'VALIDATION_ERROR',
      exception.message,
      HttpStatus.BAD_REQUEST,
      'Invalid input provided',
    );
  }

  /**
   * Get error code from HTTP status
   */
  private getErrorCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };
    return codes[status] || 'UNKNOWN_ERROR';
  }

  /**
   * Get user-friendly message from HTTP status
   */
  private getUserMessage(status: number): string {
    const messages: Record<number, string> = {
      400: 'Invalid request',
      401: 'Authentication required',
      403: 'Access denied',
      404: 'Resource not found',
      409: 'Resource conflict',
      422: 'Invalid data provided',
      429: 'Too many requests, please try again later',
      500: 'An unexpected error occurred',
      502: 'Service temporarily unavailable',
      503: 'Service temporarily unavailable',
    };
    return messages[status] || 'An error occurred';
  }

  /**
   * Log exception with appropriate level
   */
  private logException(
    appError: AppError,
    originalException: unknown,
    correlationId: string,
    request: Request,
  ): void {
    const logContext = {
      correlationId,
      code: appError.code,
      message: appError.message,
      statusCode: appError.statusCode,
      path: request.url,
      method: request.method,
    };

    if (appError.statusCode >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error('Exception caught', {
        ...logContext,
        stack:
          originalException instanceof Error ? originalException.stack : null,
        context: appError.context,
      });
    } else if (appError.statusCode >= Number(HttpStatus.BAD_REQUEST)) {
      this.logger.warn('Client error', logContext);
    }
  }

  /**
   * Build standardized error response
   */
  private buildErrorResponse(
    appError: AppError,
    correlationId: string,
  ): ErrorResponse {
    return {
      success: false,
      error: {
        code: appError.code,
        message: appError.userMessage,
        timestamp: nowIso(),
        correlationId,
        ...(appError.context && { details: appError.context }),
      },
    };
  }
}
