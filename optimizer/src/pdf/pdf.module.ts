import { Module, forwardRef } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PdfController } from './pdf.controller';
import { GeometryModule } from '../geometry/geometry.module';
import { FloorPlanModule } from '../floor-plan/floor-plan.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [GeometryModule, forwardRef(() => ProjectsModule), FloorPlanModule],
  providers: [PdfService],
  controllers: [PdfController],
  exports: [PdfService],
})
export class PdfModule {}
