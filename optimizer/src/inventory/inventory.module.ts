import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from '@/inventory/inventory.service';
import { InventoryController } from '@/inventory/inventory.controller';
import { InventoryItemEntity } from '@/inventory/entities/inventory-item.entity';
import { InventoryRepository } from '@/inventory/repositories/inventory.repository';
import { InventoryProfile } from '@/inventory/profiles/inventory.profile';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryItemEntity])],
  providers: [InventoryService, InventoryRepository, InventoryProfile],
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}
