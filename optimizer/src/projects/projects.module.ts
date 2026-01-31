import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { FormworkProjectEntity } from '../inventory/entities/formwork-project.entity';
import { FormworkModule } from '../formwork/formwork.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FormworkProjectEntity]),
    forwardRef(() => FormworkModule),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
