/**
 * Authentication constants
 */
export const AUTH_CONSTANTS = {
  STRATEGIES: {
    JWT: 'jwt',
    JWT_REFRESH: 'jwt-refresh',
    LOCAL: 'local',
  },
  CONFIG: {
    JWT_SECRET: 'JWT_SECRET',
    JWT_ACCESS_EXPIRES: 'JWT_ACCESS_EXPIRES',
    JWT_REFRESH_EXPIRES: 'JWT_REFRESH_EXPIRES',
  },
  DEFAULTS: {
    JWT_SECRET: 'change-this-in-production',
    ACCESS_TOKEN_EXPIRY: '15m',
    REFRESH_TOKEN_EXPIRY: '7d',
    BCRYPT_SALT_ROUNDS: 10,
  },
  ROLES: {
    ADMIN: 'admin',
    USER: 'user',
  },
} as const;

export type UserRole =
  (typeof AUTH_CONSTANTS.ROLES)[keyof typeof AUTH_CONSTANTS.ROLES];
