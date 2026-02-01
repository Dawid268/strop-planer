import { HttpStatus } from '@nestjs/common';

/**
 * Standard success response structure
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Create a success response
 */
export function success<T>(data: T, message?: string): SuccessResponse<T> {
  return {
    success: true,
    data,
    ...(message && { message }),
  };
}

/**
 * Create a created response (201)
 */
export function created<T>(
  data: T,
  message: string = 'Resource created successfully',
): SuccessResponse<T> {
  return success(data, message);
}

/**
 * Create an updated response
 */
export function updated<T>(
  data: T,
  message: string = 'Resource updated successfully',
): SuccessResponse<T> {
  return success(data, message);
}

/**
 * Create a deleted response
 */
export function deleted(
  message: string = 'Resource deleted successfully',
): SuccessResponse<{ deleted: true }> {
  return success({ deleted: true }, message);
}

/**
 * HTTP status codes with descriptions
 */
export const HTTP_STATUS = {
  OK: HttpStatus.OK,
  CREATED: HttpStatus.CREATED,
  NO_CONTENT: HttpStatus.NO_CONTENT,
  BAD_REQUEST: HttpStatus.BAD_REQUEST,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  UNPROCESSABLE_ENTITY: HttpStatus.UNPROCESSABLE_ENTITY,
  TOO_MANY_REQUESTS: HttpStatus.TOO_MANY_REQUESTS,
  INTERNAL_SERVER_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
} as const;
