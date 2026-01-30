import { ConfigService } from '@nestjs/config';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { EnvironmentVariables } from './env.validation';

export const getCorsConfig = (
  configService: ConfigService<EnvironmentVariables>,
): CorsOptions => {
  const originsString =
    configService.get<string>('CORS_ORIGINS') ??
    'http://localhost:4200,http://localhost:3000';
  const origins = originsString.split(',').map((origin) => origin.trim());

  return {
    origin: origins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  };
};
