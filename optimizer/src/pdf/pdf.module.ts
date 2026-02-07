import { Module, forwardRef } from '@nestjs/common';
import { PdfService } from '@/pdf/pdf.service';
import { PdfController } from '@/pdf/pdf.controller';
import { FloorPlanModule } from '@/floor-plan/floor-plan.module';
import { ProjectsModule } from '@/projects/projects.module';

@Module({
  imports: [forwardRef(() => ProjectsModule), FloorPlanModule],
  providers: [PdfService],
  controllers: [PdfController],
  exports: [PdfService],
})
export class PdfModule {}
