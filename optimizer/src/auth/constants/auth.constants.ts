export const AUTH_CONSTANTS = {
  STRATEGIES: {
    JWT: 'jwt',
    JWT_REFRESH: 'jwt-refresh',
  },
  CONFIG: {
    JWT_SECRET: 'JWT_SECRET',
    JWT_ACCESS_EXPIRES: 'JWT_ACCESS_EXPIRES',
    JWT_REFRESH_EXPIRES: 'JWT_REFRESH_EXPIRES',
  },
} as const;
