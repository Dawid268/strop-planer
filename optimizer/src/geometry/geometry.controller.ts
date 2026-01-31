import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { GeometryService } from './geometry.service';
import { ExtractGeometryDto } from './dto/extract-geometry.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Geometry')
@Controller('geometry')
export class GeometryController {
  private readonly logger = new Logger(GeometryController.name);

  constructor(private readonly geometryService: GeometryService) {}

  @Post('extract')
  @ApiOperation({ summary: 'Start geometry extraction from PDF' })
  @ApiResponse({ status: 201, description: 'Extraction job started' })
  startExtraction(@Body() dto: ExtractGeometryDto): { jobId: string } {
    this.logger.log(
      `Received extraction request for: ${dto.pdfPath} (Project: ${dto.projectId})`,
    );

    try {
      const job = this.geometryService.startExtraction(
        dto.pdfPath,
        dto.projectId,
      );
      this.logger.log(`Started job: ${job.jobId}`);
      return job;
    } catch (error) {
      this.logger.error('Failed to start extraction', error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get status of extraction job' })
  @ApiResponse({ status: 200, description: 'Job status returned' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  getStatus(@Param('id') id: string) {
    this.logger.debug(`Checking status for job: ${id}`);
    const job = this.geometryService.getJobStatus(id);
    if (!job) {
      this.logger.warn(`Job not found: ${id}`);
      throw new NotFoundException(`Job ${id} not found`);
    }
    return job;
  }
}
