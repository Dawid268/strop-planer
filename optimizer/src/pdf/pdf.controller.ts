import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  HttpException,
  HttpStatus,
  Get,
  Param,
  Inject,
  forwardRef,
  Req,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { PdfService, BatchUploadResult } from './pdf.service';
import { ExtractedPdfData } from '../slab/interfaces/slab.interface';
import { DxfConversionService } from '../floor-plan/dxf-conversion.service';
import { ProjectsService } from '../projects/projects.service';
import * as path from 'path';
import * as fs from 'fs/promises';

@ApiTags('PDF')
@Controller('pdf')
export class PdfController {
  public constructor(
    private readonly pdfService: PdfService,
    private readonly dxfConversionService: DxfConversionService,
    @Inject(forwardRef(() => ProjectsService))
    private readonly projectsService: ProjectsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpointu PDF' })
  public getStatus(): { status: string; message: string } {
    return {
      status: 'ok',
      message: 'PDF Service is running',
    };
  }

  @Post('upload/:projectId')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Wgraj plik PDF do projektu i konwertuj na DXF' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Plik PDF',
        },
      },
    },
  })
  public async uploadPdfForProject(
    @UploadedFile() file: Express.Multer.File,
    @Param('projectId') projectId: string,
    @Req() req: any,
  ): Promise<any> {
    if (!file) throw new HttpException('Brak pliku', HttpStatus.BAD_REQUEST);

    try {
      // 1. Parse/Save PDF (Legacy parsing + Save to disk)
      const pdfData = await this.pdfService.parsePdf(
        file.buffer,
        file.originalname,
      );

      // pdfData.sourceFile is relative path like '/uploads/timestamp_name.pdf'
      const absolutePdfPath = path.join(process.cwd(), pdfData.sourceFile);

      // 2. Prepare paths
      const documentId = path.parse(absolutePdfPath).name;
      const uploadDir = path.dirname(absolutePdfPath);
      const dxfFileName = `${documentId}.dxf`;
      const jsonFileName = `${documentId}.json`;

      const dxfPathAbs = path.join(uploadDir, dxfFileName);
      const jsonPathAbs = path.join(uploadDir, jsonFileName);

      const dxfPathRel = `/uploads/${dxfFileName}`;
      const jsonPathRel = `/uploads/${jsonFileName}`;

      // 3. Convert PDF -> DXF (Inkscape)
      await this.dxfConversionService.convertPdfToDxf(
        absolutePdfPath,
        dxfPathAbs,
      );

      // 4. Parse DXF -> JSON
      const jsonData = await this.dxfConversionService.parseDxfFile(dxfPathAbs);
      await fs.writeFile(jsonPathAbs, JSON.stringify(jsonData, null, 2));

      // 5. Update Project in DB (Only if not a temporary ID)
      if (projectId && !projectId.startsWith('temp_')) {
        try {
          await this.projectsService.updateArtifactPaths(projectId, {
            sourcePdfPath: pdfData.sourceFile,
            dxfPath: dxfPathRel,
            geoJsonPath: jsonPathRel,
          });
        } catch (err) {
          console.warn(
            `Could not update artifacts for project ${projectId} (might be temp or missing):`,
            err,
          );
        }
      } else {
        console.log(
          `Skipping DB update for temporary project ID: ${projectId}`,
        );
      }

      return {
        success: true,
        paths: {
          pdf: pdfData.sourceFile,
          dxf: dxfPathRel,
          json: jsonPathRel,
        },
        data: jsonData,
      };
    } catch (e: any) {
      console.error('PDF Upload Error:', e);
      throw new HttpException(
        e.message || 'Conversion failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  public async uploadPdf(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ExtractedPdfData> {
    if (!file) {
      throw new HttpException('Nie przesłano pliku', HttpStatus.BAD_REQUEST);
    }

    if (file.mimetype !== 'application/pdf') {
      throw new HttpException(
        'Plik musi być w formacie PDF',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.pdfService.parsePdf(file.buffer, file.originalname);
    } catch {
      throw new HttpException(
        'Błąd podczas parsowania PDF',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('upload-batch')
  @UseInterceptors(FilesInterceptor('files', 20)) // Max 20 files
  @ApiOperation({
    summary: 'Wgraj wiele plików PDF - system rozpozna typy rysunków',
    description:
      'Automatycznie rozpoznaje typy rysunków (strop, konstrukcja, zbrojenie, etc.) i rekomenduje przydatne do szalunków',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Pliki PDF z projektem (max 20 plików)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Lista rozpoznanych plików z typami',
  })
  @ApiResponse({
    status: 400,
    description: 'Brak plików lub nieprawidłowy format',
  })
  public async uploadBatch(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<BatchUploadResult> {
    if (!files || files.length === 0) {
      throw new HttpException(
        'Nie przesłano żadnych plików',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Filter only PDFs
    const pdfFiles = files.filter(
      (f) =>
        f.mimetype === 'application/pdf' ||
        f.originalname.toLowerCase().endsWith('.pdf'),
    );

    if (pdfFiles.length === 0) {
      throw new HttpException(
        'Nie znaleziono plików PDF. Akceptowane formaty: PDF',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const filesToParse = pdfFiles.map((f) => ({
        buffer: f.buffer,
        filename: f.originalname,
      }));

      return await this.pdfService.parseBatch(filesToParse);
    } catch {
      throw new HttpException(
        'Błąd podczas przetwarzania plików',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
