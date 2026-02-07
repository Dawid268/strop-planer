import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsService } from '@/projects/projects.service';
import { ProjectsController } from '@/projects/projects.controller';
import { FormworkProjectEntity } from '@/inventory/entities/formwork-project.entity';
import { FormworkModule } from '@/formwork/formwork.module';
import { FloorPlanModule } from '@/floor-plan/floor-plan.module';

import { FabricConverterService } from '@/projects/fabric-converter.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FormworkProjectEntity]),
    forwardRef(() => FormworkModule),
    FloorPlanModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService, FabricConverterService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
