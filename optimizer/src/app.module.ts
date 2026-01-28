import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PdfModule } from './pdf/pdf.module';
import { FormworkModule } from './formwork/formwork.module';
import { SlabModule } from './slab/slab.module';
import { InventoryModule } from './inventory/inventory.module';
import { InventoryItemEntity } from './inventory/entities/inventory-item.entity';
import { UserEntity } from './inventory/entities/user.entity';
import { FormworkProjectEntity } from './inventory/entities/formwork-project.entity';
import {
  CustomerEntity,
  RentalEntity,
  RentalItemEntity,
} from './inventory/entities/customer.entity';
import { CustomersModule } from './customers/customers.module';
import { RentalsModule } from './rentals/rentals.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { FloorPlanModule } from './floor-plan/floor-plan.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: join(process.cwd(), 'data', 'szalunki.db'),
      entities: [
        InventoryItemEntity,
        UserEntity,
        FormworkProjectEntity,
        CustomerEntity,
        RentalEntity,
        RentalItemEntity,
      ],
      synchronize: true, // Tylko dla MVP - w produkcji użyć migracji
      logging: ['error', 'warn'],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    PdfModule,
    FormworkModule,
    SlabModule,
    InventoryModule,
    CustomersModule,
    RentalsModule,
    RentalsModule,
    AuthModule,
    ProjectsModule,
    FloorPlanModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
