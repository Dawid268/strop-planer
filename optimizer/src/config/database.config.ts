import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { EnvironmentVariables } from './env.validation';

export const getDatabaseConfig = (
  configService: ConfigService<EnvironmentVariables>,
): TypeOrmModuleOptions => {
  const databasePath =
    configService.get<string>('DATABASE_PATH') ?? './data/szalunki.db';
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  return {
    type: 'better-sqlite3',
    database: join(process.cwd(), databasePath),
    entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
    synchronize: !isProduction,
    logging: isProduction ? ['error', 'warn'] : ['error', 'warn', 'query'],
  };
};
