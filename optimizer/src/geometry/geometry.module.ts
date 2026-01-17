import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormworkProjectEntity } from '../inventory/entities/formwork-project.entity';
import { GeometryService } from './geometry.service';
import { GeometryController } from './geometry.controller';
import { InkscapeConversionService } from './inkscape-conversion.service';

@Module({
  imports: [TypeOrmModule.forFeature([FormworkProjectEntity])],
  controllers: [GeometryController],
  providers: [GeometryService, InkscapeConversionService],
  exports: [GeometryService],
})
export class GeometryModule {}
