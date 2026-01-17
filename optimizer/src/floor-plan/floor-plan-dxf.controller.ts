import {
  Controller,
  Post,
  Get,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Res,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { diskStorage } from 'multer';
import { DxfConversionService, DxfData } from './dxf-conversion.service';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';

@Controller('api/floor-plans-dxf')
export class FloorPlanDxfController {
  private readonly logger = new Logger(FloorPlanDxfController.name);

  constructor(private readonly dxfConversionService: DxfConversionService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const documentId = uuidv4();
          const ext = path.extname(file.originalname);
          cb(null, `${documentId}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedTypes = [
          'application/pdf',
          'image/vnd.dxf',
          'application/dxf',
        ];
        // Check extensions too because mime types for DXF vary wildy
        const ext = path.extname(file.originalname).toLowerCase();

        if (
          !allowedTypes.includes(file.mimetype) &&
          ext !== '.dxf' &&
          ext !== '.pdf'
        ) {
          return cb(
            new BadRequestException('Only PDF or DXF files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  public async uploadFloorPlan(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ documentId: string; data: DxfData }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const documentId = path.parse(file.filename).name;
    const ext = path.extname(file.filename).toLowerCase();
    this.logger.log(`Processing upload: ${file.filename} (ID: ${documentId})`);

    try {
      let dxfData: DxfData;

      if (ext === '.pdf') {
        // Konwertuj PDF -> DXF
        const dxfPath = path.join('./uploads', `${documentId}.dxf`);
        await this.dxfConversionService.convertPdfToDxf(file.path, dxfPath);
        dxfData = await this.dxfConversionService.parseDxfFile(dxfPath);
      } else {
        // Bezpośrednio parsuj DXF
        dxfData = await this.dxfConversionService.parseDxfFile(file.path);
      }

      // Zapisz sparsowane dane jako JSON
      const jsonPath = path.join('./uploads', `${documentId}.json`); // Reuse uploads or new 'converted' dir?
      // Use 'converted' dir to match previous pattern, BUT controller code above used uploads for destination
      // Let's create 'converted' subdir
      await fs.mkdir('./uploads/converted', { recursive: true });
      const finalJsonPath = path.join(
        './uploads/converted',
        `${documentId}.json`,
      );

      await fs.writeFile(finalJsonPath, JSON.stringify(dxfData, null, 2));

      return { documentId, data: dxfData };
    } catch (error: any) {
      this.logger.error(`Processing failed for ${documentId}`, error.stack);
      throw new BadRequestException(`Processing failed: ${error.message}`);
    }
  }

  @Get(':documentId')
  public async getFloorPlanData(
    @Param('documentId') documentId: string,
  ): Promise<DxfData> {
    const jsonPath = path.join('./uploads/converted', `${documentId}.json`);

    try {
      const jsonContent = await fs.readFile(jsonPath, 'utf-8');
      return JSON.parse(jsonContent);
    } catch (error) {
      throw new BadRequestException('Floor plan data not found');
    }
  }

  @Get(':documentId/raw')
  public async getRawDxf(
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ): Promise<void> {
    // Determine path. If uploaded as DXF, it's in uploads/{id}.dxf
    // If converted from PDF, we saved it as uploads/{id}.dxf in convertPdfToDxf call?
    // In upload handler: path.join('./uploads', `${documentId}.dxf`);
    // So yes, it should always be there.
    const dxfPath = path.join('./uploads', `${documentId}.dxf`);

    try {
      // Check if file exists
      await fs.access(dxfPath);

      const dxfContent = await fs.readFile(dxfPath, 'utf-8');
      res.setHeader('Content-Type', 'application/dxf');
      res.send(dxfContent);
    } catch (error) {
      // Fallback: maybe original was uploaded as .dxf but with uuid?
      // Multer saves as {uuid}.{ext}
      // If uploading .dxf, file is {uuid}.dxf.
      // If uploading .pdf, file is {uuid}.pdf, and we generated {uuid}.dxf.
      throw new BadRequestException('DXF file not found');
    }
  }
}
