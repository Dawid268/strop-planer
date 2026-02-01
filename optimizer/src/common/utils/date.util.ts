/**
 * Utility functions for date handling
 */

/**
 * Get current timestamp in ISO format
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Get current Unix timestamp in seconds
 */
export function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get current Unix timestamp in milliseconds
 */
export function nowUnixMs(): number {
  return Date.now();
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms < 3600000)
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/**
 * Calculate elapsed time from start timestamp
 */
export function elapsed(startMs: number): number {
  return Date.now() - startMs;
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Date | string | number): boolean {
  const d = new Date(date);
  return d.getTime() < Date.now();
}

/**
 * Check if a date is in the future
 */
export function isFuture(date: Date | string | number): boolean {
  const d = new Date(date);
  return d.getTime() > Date.now();
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
