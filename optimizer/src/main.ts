import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { TransformInterceptor } from '@common/interceptors/transform.interceptor';
import { getCorsConfig, EnvironmentVariables } from '@config/index';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService<EnvironmentVariables>);
  const logger = app.get<LoggerService>(WINSTON_MODULE_NEST_PROVIDER);

  app.useLogger(logger);

  app.setGlobalPrefix('api');

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
    .setTitle('Szalunki Optimizer API')
    .setDescription(
      `
## API do optymalizacji szalunków stropowych

### Funkcjonalności:
- **Parsowanie PDF** - ekstrakcja danych stropu z projektów konstrukcyjnych
- **Obliczenia szalunkowe** - dobór paneli, podpór i dźwigarów
- **Optymalizacja** - redukcja kosztów i czasu montażu
- **Porównanie systemów** - PERI, DOKA, ULMA, MEVA

### Workflow:
1. Wgraj PDF z projektem stropu \`POST /pdf/upload\`
2. Oblicz układ szalunku \`POST /formwork/calculate\`
3. Zoptymalizuj rozwiązanie \`POST /formwork/optimize/{layoutId}\`
    `,
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Auth', 'Autentykacja i autoryzacja')
    .addTag('PDF', 'Parsowanie projektów konstrukcyjnych')
    .addTag('Formwork', 'Obliczenia i optymalizacja szalunków')
    .addTag('Slab', 'Dane stropów')
    .addTag('Projects', 'Zarządzanie projektami')
    .addTag('Inventory', 'Magazyn elementów')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Szalunki Optimizer API',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: `
      .swagger-ui .topbar { background-color: #1a1a2e; }
      .swagger-ui .info .title { color: #16213e; }
    `,
  });

  app.enableShutdownHooks();

  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port);

  const env = configService.get<string>('NODE_ENV') ?? 'development';
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
