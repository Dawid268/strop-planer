import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryItemEntity } from './entities/inventory-item.entity';
import { InventoryRepository } from './repositories/inventory.repository';
import { InventoryProfile } from './profiles/inventory.profile';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryItemEntity])],
  providers: [InventoryService, InventoryRepository, InventoryProfile],
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}
