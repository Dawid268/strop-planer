import { Module } from '@nestjs/common';
import { SlabService } from './slab.service';
import { SlabController } from './slab.controller';

@Module({
  providers: [SlabService],
  controllers: [SlabController]
})
export class SlabModule {}
