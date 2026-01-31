import {
  Controller,
  Post,
  Get,
  Param,
  UploadedFile,
  UseInterceptors,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { diskStorage } from 'multer';
import { DxfConversionService, DxfData } from './dxf-conversion.service';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FLOOR_PLAN_CONSTANTS } from './constants/floor-plan.constants';

@ApiTags('Floor Plans DXF')
@Controller('floor-plans-dxf')
export class FloorPlanDxfController {
  constructor(private readonly dxfConversionService: DxfConversionService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload floor plan (PDF or DXF) and convert/parse' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'File processed successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid file format or processing error',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: FLOOR_PLAN_CONSTANTS.UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const documentId = uuidv4();
          const ext = path.extname(file.originalname);
          cb(null, `${documentId}${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() as
          | '.dxf'
          | '.pdf';
        if (!FLOOR_PLAN_CONSTANTS.ALLOWED_EXTENSIONS.includes(ext)) {
          return cb(new Error('Only PDF or DXF files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  public async uploadFloorPlan(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ documentId: string; data: DxfData }> {
    return this.dxfConversionService.processUploadedFile(file);
  }

  @Get(':documentId')
  @ApiOperation({ summary: 'Get parsed floor plan data' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Data retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Data not found',
  })
  public async getFloorPlanData(
    @Param('documentId') documentId: string,
  ): Promise<DxfData> {
    return this.dxfConversionService.getFloorPlanData(documentId);
  }

  @Get(':documentId/raw')
  @ApiOperation({ summary: 'Get raw DXF content' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'DXF retrieved successfully',
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'DXF not found' })
  public async getRawDxf(
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ): Promise<void> {
    const dxfContent =
      await this.dxfConversionService.getRawDxfContent(documentId);
    res.setHeader('Content-Type', 'application/dxf');
    res.send(dxfContent);
  }
}
