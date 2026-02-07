/**
 * Standard API response wrapper from backend TransformInterceptor.
 * All responses are wrapped in this structure.
 */
export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data: T;
  readonly timestamp: string;
  readonly correlationId: string;
}

/**
 * Paginated response structure returned by controllers.
 * This is wrapped inside ApiResponse.data for paginated endpoints.
 */
export interface PaginatedData<T> {
  readonly data: T[];
  readonly meta: PaginationMeta;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}
