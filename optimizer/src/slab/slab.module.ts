import { Module } from '@nestjs/common';
import { SlabService } from './slab.service';
import { SlabController } from './slab.controller';
import { SlabProfile } from './profiles/slab.profile';

@Module({
  providers: [SlabService, SlabProfile],
  controllers: [SlabController],
})
export class SlabModule {}
