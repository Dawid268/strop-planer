import * as fs from 'fs';
import * as path from 'path';

import { RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Params } from 'nestjs-pino';
import { IncomingMessage, ServerResponse } from 'http';

import { CORRELATION_ID_HEADER } from '@common/middleware/correlation-id.middleware';

const LOG_FILE = 'app.log';

/**
 * Resolve logs directory: always optimizer/logs/ (relative to app root).
 * Uses __dirname so it works regardless of process.cwd() (e.g. when run from monorepo root).
 * Compiled: dist/config/logger.config.js -> app root = dist/../ = optimizer.
 */
function getLogsDir(): string {
  const appRoot = path.resolve(__dirname, '..', '..');
  const logDir = path.join(appRoot, 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  return logDir;
}

/**
 * Get Pino logger configuration
 * Provides structured JSON logging with request tracing.
 * Logs are written to both console and to files in logs/ (app.log).
 */
export const getLoggerConfig = (configService: ConfigService): Params => {
  const isProduction = configService.get('NODE_ENV') === 'production';
  const logLevel = configService.get<string>('LOG_LEVEL') ?? 'info';
  const logDir = getLogsDir();
  const logFilePath = path.resolve(logDir, LOG_FILE);
  try {
    fs.appendFileSync(logFilePath, '', 'utf8');
  } catch {
    // ignore if already exists or first write
  }

  const consoleTarget = isProduction
    ? { target: 'pino/file', options: { destination: 1 } }
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          levelFirst: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          destination: 1,
        },
      };

  const fileTarget = {
    target: 'pino/file',
    options: { destination: logFilePath, mkdir: true },
  };

  return {
    // Use new path-to-regexp syntax to avoid deprecation warnings
    forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
    pinoHttp: {
      level: logLevel,

      // Log to console and to file
      transport: {
        targets: [consoleTarget, fileTarget],
      },

      // Use correlation ID as request ID
      genReqId: (req: IncomingMessage) => {
        const correlationId = req.headers[CORRELATION_ID_HEADER] as
          | string
          | undefined;
        return correlationId ?? crypto.randomUUID();
      },

      // Custom log level based on response status
      customLogLevel: (
        _req: IncomingMessage,
        res: ServerResponse,
        err?: Error,
      ) => {
        if (res.statusCode >= 500 || err) {
          return 'error';
        }
        if (res.statusCode >= 400) {
          return 'warn';
        }
        return 'info';
      },

      // Customize success message
      customSuccessMessage: (req: IncomingMessage) => {
        return `${req.method} ${req.url} completed`;
      },

      // Customize error message
      customErrorMessage: (
        req: IncomingMessage,
        _res: ServerResponse,
        err: Error,
      ) => {
        return `${req.method} ${req.url} failed: ${err.message}`;
      },

      // Redact sensitive data
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.passwordHash',
          'req.body.refreshToken',
          'res.headers["set-cookie"]',
        ],
        remove: true,
      },

      // Auto logging configuration
      autoLogging: {
        ignore: (req: IncomingMessage) => {
          // Ignore health checks and static files
          const ignorePaths = ['/health', '/api/docs', '/favicon.ico'];
          return ignorePaths.some((p) => req.url?.startsWith(p));
        },
      },

      // Custom attribute keys for better structure
      customAttributeKeys: {
        req: 'request',
        res: 'response',
        err: 'error',
        responseTime: 'duration',
      },

      // Quiet mode for auto-logged requests
      quietReqLogger: true,
    },
  };
};
