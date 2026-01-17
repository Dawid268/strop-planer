import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { seedDatabase } from './seed';

/**
 * Runner dla seed script
 * Uruchom: npx ts-node src/seed/run-seed.ts
 */
async function bootstrap() {
  console.log('🚀 Uruchamiam seed...');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });
  const dataSource = app.get(DataSource);

  try {
    await seedDatabase(dataSource);
  } catch (error) {
    console.error('❌ Błąd podczas seedowania:', error);
    process.exit(1);
  }

  await app.close();
  process.exit(0);
}

bootstrap();
