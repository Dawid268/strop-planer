import { Module } from '@nestjs/common';
import { SlabService } from '@/slab/slab.service';
import { SlabController } from '@/slab/slab.controller';
import { SlabProfile } from '@/slab/profiles/slab.profile';

@Module({
  providers: [SlabService, SlabProfile],
  controllers: [SlabController],
})
export class SlabModule {}
