/**
 * Application-wide constants
 * Centralized configuration values for the entire NestJS application
 */

// ============================================================================
// API Configuration
// ============================================================================

export const API_CONFIG = {
  PREFIX: 'api',
  VERSION: '1',
  DOCS_PATH: 'api/docs',
} as const;

export const APP_CONFIG = {
  NAME: 'Szalunki Optimizer API',
  VERSION: '1.0.0',
  DEFAULT_PORT: 3000,
  DEFAULT_ENV: 'development',
} as const;

// ============================================================================
// Health Check
// ============================================================================

export const HEALTH_STATUS = {
  OK: 'ok',
  ERROR: 'error',
  DEGRADED: 'degraded',
} as const;

// ============================================================================
// JWT Configuration
// ============================================================================

export const JWT_CONFIG = {
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY: '7d',
  DEFAULT_SECRET: 'change-this-in-production', // Should be overridden by env
} as const;

// ============================================================================
// Pagination
// ============================================================================

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

// ============================================================================
// File Upload
// ============================================================================

export const FILE_UPLOAD = {
  MAX_FILES: 20,
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_PDF_MIMES: ['application/pdf'],
  ALLOWED_DXF_EXTENSIONS: ['.dxf'],
} as const;

// ============================================================================
// Timeouts
// ============================================================================

export const TIMEOUTS = {
  INKSCAPE_CONVERSION: 60000, // 60 seconds
  PYTHON_SCRIPT: 30000, // 30 seconds
  DATABASE_QUERY: 30000, // 30 seconds
} as const;
