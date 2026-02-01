/**
 * Utility functions for string manipulation
 */

/**
 * Convert string to slug format (lowercase, hyphens)
 */
export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Truncate string with ellipsis
 */
export function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  return input.substring(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter
 */
export function capitalize(input: string): string {
  if (!input) return input;
  return input.charAt(0).toUpperCase() + input.slice(1);
}

/**
 * Convert to camelCase
 */
export function toCamelCase(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char: string) => char.toUpperCase())
    .replace(/^./, (char) => char.toLowerCase());
}

/**
 * Convert to snake_case
 */
export function toSnakeCase(input: string): string {
  return input
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Mask sensitive data (show first and last 2 chars)
 */
export function maskSensitive(input: string, visibleChars: number = 2): string {
  if (input.length <= visibleChars * 2) return '*'.repeat(input.length);
  const first = input.substring(0, visibleChars);
  const last = input.substring(input.length - visibleChars);
  const masked = '*'.repeat(Math.min(input.length - visibleChars * 2, 10));
  return `${first}${masked}${last}`;
}

/**
 * Check if string is empty or whitespace only
 */
export function isBlank(input: string | null | undefined): boolean {
  return !input || input.trim().length === 0;
}

/**
 * Safely parse JSON with fallback
 */
export function safeJsonParse<T>(input: string, fallback: T): T {
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}
