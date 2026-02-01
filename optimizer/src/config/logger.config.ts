import { Params } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { IncomingMessage, ServerResponse } from 'http';
import { CORRELATION_ID_HEADER } from '@common/middleware/correlation-id.middleware';

/**
 * Get Pino logger configuration
 * Provides structured JSON logging with request tracing
 */
export const getLoggerConfig = (configService: ConfigService): Params => {
  const isProduction = configService.get('NODE_ENV') === 'production';
  const logLevel = configService.get<string>('LOG_LEVEL') ?? 'info';

  return {
    pinoHttp: {
      level: logLevel,

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

      // Pretty print in development
      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              levelFirst: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },

      // Auto logging configuration
      autoLogging: {
        ignore: (req: IncomingMessage) => {
          // Ignore health checks and static files
          const ignorePaths = ['/health', '/api/docs', '/favicon.ico'];
          return ignorePaths.some((path) => req.url?.startsWith(path));
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
