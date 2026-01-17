import { Module } from '@nestjs/common';
import { FormworkService } from './formwork.service';
import { FormworkController } from './formwork.controller';

import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  providers: [FormworkService],
  controllers: [FormworkController],
  exports: [FormworkService],
})
export class FormworkModule {}
