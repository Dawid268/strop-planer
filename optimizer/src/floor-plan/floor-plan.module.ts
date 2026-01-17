import { Module } from '@nestjs/common';
import { FloorPlanDxfController } from './floor-plan-dxf.controller';
import { DxfConversionService } from './dxf-conversion.service';

@Module({
  controllers: [FloorPlanDxfController],
  providers: [DxfConversionService],
  exports: [DxfConversionService],
})
export class FloorPlanModule {}
