import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Prefiks API
  app.setGlobalPrefix('api');

  // Włącz walidację
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Włącz CORS
  app.enableCors({
    origin: ['http://localhost:4200', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  // Konfiguracja Swagger
  const config = new DocumentBuilder()
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
    .addTag('PDF', 'Parsowanie projektów konstrukcyjnych')
    .addTag('Formwork', 'Obliczenia i optymalizacja szalunków')
    .addTag('Slab', 'Dane stropów')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    customSiteTitle: 'Szalunki Optimizer API',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: `
      .swagger-ui .topbar { background-color: #1a1a2e; }
      .swagger-ui .info .title { color: #16213e; }
    `,
  });

  const port = process.env['PORT'] || 3000;
  await app.listen(port);

  console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   🏗️  SZALUNKI OPTIMIZER API                              ║
  ║                                                           ║
  ║   Server:  http://localhost:${port}                         ║
  ║   Swagger: http://localhost:${port}/api                     ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `);
}

bootstrap();
