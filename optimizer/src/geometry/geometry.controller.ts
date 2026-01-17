import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { GeometryService } from './geometry.service';
import * as fs from 'fs';

@Controller('geometry')
export class GeometryController {
  private readonly logger = new Logger(GeometryController.name);

  constructor(private readonly geometryService: GeometryService) {}

  @Post('extract')
  async startExtraction(
    @Body('pdfPath') pdfPath: string,
    @Body('projectId') projectId?: string,
  ) {
    this.logger.log(
      `Received extraction request for: ${pdfPath} (Project: ${projectId})`,
    );
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      this.logger.error(`PDF path not found: ${pdfPath}`);
      throw new BadRequestException('Invalid PDF path');
    }
    const job = await this.geometryService.startExtraction(pdfPath, projectId);
    this.logger.log(`Started job: ${job.jobId}`);
    return job;
  }

  @Get('jobs/:id')
  getStatus(@Param('id') id: string) {
    this.logger.debug(`Checking status for job: ${id}`);
    const job = this.geometryService.getJobStatus(id);
    if (!job) {
      this.logger.warn(`Job not found: ${id}`);
      throw new BadRequestException('Job not found');
    }
    return job;
  }
}
import { Logger } from '@nestjs/common';
