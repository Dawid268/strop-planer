import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AppError } from '@shared/errors/app-error';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let appError: AppError;

    if (exception instanceof AppError) {
      appError = exception;
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      appError = new AppError(
        'HTTP_EXCEPTION',
        exception.message,
        status,
        'Request failed',
      );
    } else {
      appError = new AppError(
        'INTERNAL_SERVER_ERROR',
        exception instanceof Error ? exception.message : 'Unknown error',
        500,
        'Something went wrong',
      );
    }

    if (appError.statusCode === Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error('Exception caught', {
        code: appError.code,
        message: appError.message,
        statusCode: appError.statusCode,
        stack: exception instanceof Error ? exception.stack : null,
      });
    } else {
      this.logger.warn(
        `Exception caught: ${appError.code} - ${appError.message}`,
      );
    }

    response.status(appError.statusCode).json({
      success: false,
      error: {
        code: appError.code,
        message: appError.userMessage,
        timestamp: new Date().toISOString(),
        context: appError.context,
      },
    });
  }
}
