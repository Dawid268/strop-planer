import { randomUUID } from 'crypto';

/**
 * Utility functions for UUID generation and validation
 */

/**
 * Generate a new UUID v4
 */
export function generateUuid(): string {
  return randomUUID();
}

/**
 * Generate a short correlation ID (12 chars)
 * More readable in logs while still unique enough
 */
export function generateCorrelationId(): string {
  return randomUUID().replace(/-/g, '').substring(0, 12);
}

/**
 * Validate UUID v4 format
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Extract ID from various formats (uuid, prefixed id, etc)
 */
export function extractId(input: string): string | null {
  if (!input) return null;

  // Already a valid UUID
  if (isValidUuid(input)) return input;

  // Prefixed ID like "project_123e4567..."
  const parts = input.split('_');
  if (parts.length === 2 && isValidUuid(parts[1])) {
    return parts[1];
  }

  return null;
}
