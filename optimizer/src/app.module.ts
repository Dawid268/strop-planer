import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { WinstonModule } from 'nest-winston';
import { AutomapperModule } from '@automapper/nestjs';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { classes } from '@automapper/classes';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { join } from 'path';

import { envValidationSchema, getDatabaseConfig } from '@config/index';
import { CorrelationIdMiddleware } from '@common/middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PdfModule } from './pdf/pdf.module';
import { FormworkModule } from './formwork/formwork.module';
import { SlabModule } from './slab/slab.module';
import { InventoryModule } from './inventory/inventory.module';
import { CustomersModule } from './customers/customers.module';
import { RentalsModule } from './rentals/rentals.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { FloorPlanModule } from './floor-plan/floor-plan.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),
    // Security: Rate limiting - 100 requests per 60 seconds per IP
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 10, // 10 requests per second
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
      {
        name: 'long',
        ttl: 3600000, // 1 hour
        limit: 1000, // 1000 requests per hour
      },
    ]),
    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logLevel = configService.get<string>('LOG_LEVEL') ?? 'info';
        return {
          transports: [
            new winston.transports.Console({
              level: logLevel,
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.ms(),
                winston.format.colorize(),
                winston.format.printf((info) => {
                  const { timestamp, level, message, context, ms } = info;
                  const ctx = typeof context === 'string' ? context : 'App';
                  const ts = typeof timestamp === 'string' ? timestamp : '';
                  const lvl = typeof level === 'string' ? level : '';
                  const msg = typeof message === 'string' ? message : '';
                  const msec = typeof ms === 'string' ? ms : '';
                  return `[Nest] ${ts} ${lvl} [${ctx}] ${msg} ${msec}`;
                }),
              ),
            }),
            new winston.transports.DailyRotateFile({
              filename: 'logs/application-%DATE%.log',
              datePattern: 'YYYY-MM-DD',
              zippedArchive: true,
              maxSize: '20m',
              maxFiles: '14d',
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
              ),
            }),
          ],
        };
      },
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    ServeStaticModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          rootPath: join(
            process.cwd(),
            configService.get('UPLOADS_PATH', './uploads'),
          ),
          serveRoot: '/uploads',
        },
      ],
    }),
    PdfModule,
    FormworkModule,
    SlabModule,
    InventoryModule,
    CustomersModule,
    RentalsModule,
    AuthModule,
    ProjectsModule,
    FloorPlanModule,
    AutomapperModule.forRoot({
      strategyInitializer: classes(),
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Configure middleware for all routes
   */
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
