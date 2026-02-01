import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { getCorrelationId } from '@common/middleware/correlation-id.middleware';
import { nowIso } from '@common/utils';

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  correlationId: string;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Transform interceptor that wraps all responses in a standard format
 * Includes correlation ID for request tracking
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const correlationId = getCorrelationId(request);

    return next.handle().pipe(
      map((data: T) => ({
        success: true,
        data,
        timestamp: nowIso(),
        correlationId,
      })),
    );
  }
}

/**
 * Helper to create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  correlationId: string,
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    timestamp: nowIso(),
    correlationId,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
