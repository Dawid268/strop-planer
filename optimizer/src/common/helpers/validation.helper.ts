import { BadRequestException } from '@nestjs/common';
import { isValidUuid } from '@common/utils';
import { NotFoundError, ValidationError } from '@shared/errors/app-error';

/**
 * Assert that a value is not null/undefined, throw NotFoundError if it is
 */
export function assertFound<T>(
  value: T | null | undefined,
  resourceName: string,
  resourceId: string,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundError(resourceName, resourceId);
  }
}

/**
 * Assert that a value exists, throw BadRequestException if it doesn't
 */
export function assertExists<T>(
  value: T | null | undefined,
  message: string,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new BadRequestException(message);
  }
}

/**
 * Assert that a condition is true, throw BadRequestException if it's not
 */
export function assertCondition(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
    throw new BadRequestException(message);
  }
}

/**
 * Assert that a string is a valid UUID
 */
export function assertValidUuid(
  value: string,
  fieldName: string = 'id',
): asserts value is string {
  if (!isValidUuid(value)) {
    throw new ValidationError(`Invalid ${fieldName} format`, {
      [fieldName]: `${fieldName} must be a valid UUID`,
    });
  }
}

/**
 * Assert that an array is not empty
 */
export function assertNotEmpty<T>(
  array: T[],
  message: string = 'Array cannot be empty',
): asserts array is [T, ...T[]] {
  if (!array || array.length === 0) {
    throw new BadRequestException(message);
  }
}

/**
 * Validate pagination parameters
 */
export function validatePagination(
  page: number,
  limit: number,
  maxLimit: number = 100,
): { page: number; limit: number; skip: number } {
  const validPage = Math.max(1, page);
  const validLimit = Math.min(Math.max(1, limit), maxLimit);
  const skip = (validPage - 1) * validLimit;

  return { page: validPage, limit: validLimit, skip };
}

/**
 * Validate and sanitize sort parameters
 */
export function validateSort<T extends string>(
  sortBy: string | undefined,
  allowedFields: T[],
  defaultField: T,
): T {
  if (!sortBy) return defaultField;

  const field = sortBy.replace(/^-/, '') as T;
  if (allowedFields.includes(field)) {
    return field;
  }

  return defaultField;
}

/**
 * Validate and sanitize sort order
 */
export function validateSortOrder(sortBy: string | undefined): 'ASC' | 'DESC' {
  if (!sortBy) return 'ASC';
  return sortBy.startsWith('-') ? 'DESC' : 'ASC';
}
