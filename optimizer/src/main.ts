import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, LoggerService, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { TransformInterceptor } from '@common/interceptors/transform.interceptor';
import { getCorsConfig, EnvironmentVariables } from '@config/index';
import { API_CONFIG, APP_CONFIG } from '@common/constants';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService<EnvironmentVariables>);
  const logger = app.get<LoggerService>(WINSTON_MODULE_NEST_PROVIDER);

  app.useLogger(logger);

  app.setGlobalPrefix(API_CONFIG.PREFIX);

  // Enable URI-based API versioning: /api/v1/...
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: API_CONFIG.VERSION,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const corsConfig = getCorsConfig(configService);
  app.enableCors(corsConfig);

  const swaggerConfig = new DocumentBuilder()
    .setTitle(APP_CONFIG.NAME)
    .setDescription(
      `
## API do optymalizacji szalunków stropowych

### Funkcjonalności:
- **Parsowanie PDF** - ekstrakcja danych stropu z projektów konstrukcyjnych
- **Obliczenia szalunkowe** - dobór paneli, podpór i dźwigarów
- **Optymalizacja** - redukcja kosztów i czasu montażu
- **Porównanie systemów** - PERI, DOKA, ULMA, MEVA

### Workflow:
1. Wgraj PDF z projektem stropu \`POST /api/v1/pdf/upload\`
2. Oblicz układ szalunku \`POST /api/v1/formwork/calculate\`
3. Zoptymalizuj rozwiązanie \`POST /api/v1/formwork/optimize/{layoutId}\`
    `,
    )
    .setVersion(APP_CONFIG.VERSION)
    .addBearerAuth()
    .addTag('Auth', 'Autentykacja i autoryzacja')
    .addTag('PDF', 'Parsowanie projektów konstrukcyjnych')
    .addTag('Formwork', 'Obliczenia i optymalizacja szalunków')
    .addTag('Slab', 'Dane stropów')
    .addTag('Projects', 'Zarządzanie projektami')
    .addTag('Inventory', 'Magazyn elementów')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(API_CONFIG.DOCS_PATH, app, document, {
    customSiteTitle: APP_CONFIG.NAME,
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: `
      .swagger-ui .topbar { background-color: #1a1a2e; }
      .swagger-ui .info .title { color: #16213e; }
    `,
  });

  app.enableShutdownHooks();

  const port = configService.get<number>('PORT') ?? APP_CONFIG.DEFAULT_PORT;
  await app.listen(port);

  const env = configService.get<string>('NODE_ENV') ?? APP_CONFIG.DEFAULT_ENV;
  logger.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   🏗️  SZALUNKI OPTIMIZER API                              ║
  ║                                                           ║
  ║   Server:  http://localhost:${port}                         ║
  ║   Swagger: http://localhost:${port}/api/docs                ║
  ║   Environment: ${env}                        ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `);
}

void bootstrap();
