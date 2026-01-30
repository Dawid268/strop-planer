import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),

  DATABASE_PATH: Joi.string().default('./data/szalunki.db'),

  CORS_ORIGINS: Joi.string().default(
    'http://localhost:4200,http://localhost:3000',
  ),

  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),

  UPLOADS_PATH: Joi.string().default('./uploads'),
}).unknown(true);

export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  JWT_SECRET: string;
  JWT_EXPIRY: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRY: string;
  DATABASE_PATH: string;
  CORS_ORIGINS: string;
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  UPLOADS_PATH: string;
}
