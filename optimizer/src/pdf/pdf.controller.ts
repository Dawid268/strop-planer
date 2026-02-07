import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
  Get,
  Param,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { JwtGuard } from '@/auth/guards';
import { GetCurrentUserId } from '@/common/decorators';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { PdfService, BatchUploadResult } from '@/pdf/pdf.service';
import { ExtractedPdfData } from '@/slab/interfaces/slab.interface';
import {
  DxfConversionService,
  DxfData,
} from '@/floor-plan/dxf-conversion.service';
import { ProjectsService } from '@/projects/projects.service';
import * as path from 'path';
import * as fs from 'fs/promises';

interface PdfUploadResponse {
  success: boolean;
  paths: {
    pdf: string;
    dxf: string;
    json: string;
  };
  data: DxfData;
}

@ApiTags('PDF')
@Controller({ version: '1', path: 'pdf' })
export class PdfController {
  private readonly logger = new Logger(PdfController.name);

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
  @UseGuards(JwtGuard)
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
    @GetCurrentUserId() userId: string,
  ): Promise<PdfUploadResponse> {
    if (!file) throw new BadRequestException('Brak pliku');

    try {
      // 1. Parse/Save PDF (Legacy parsing + Save to disk)
      const pdfData = await this.pdfService.parsePdf(
        file.buffer,
        file.originalname,
      );

      // pdfData.sourceFile is like '/uploads/timestamp_name.pdf' – normalize so path.join does not treat it as absolute
      const sourcePath = pdfData.sourceFile.startsWith('/')
        ? pdfData.sourceFile.slice(1)
        : pdfData.sourceFile;
      const absolutePdfPath = path.join(process.cwd(), sourcePath);

      // 2. Prepare paths (DXF in uploads/, JSON in uploads/converted/ so GET floor-plans-dxf finds it)
      const documentId = path.parse(absolutePdfPath).name;
      const uploadDir = path.dirname(absolutePdfPath);
      const convertedDir = path.join(process.cwd(), 'uploads', 'converted');
      const dxfFileName = `${documentId}.dxf`;
      const jsonFileName = `${documentId}.json`;

      const dxfPathAbs = path.join(uploadDir, dxfFileName);
      await fs.mkdir(convertedDir, { recursive: true });
      const jsonPathAbs = path.join(convertedDir, jsonFileName);

      const dxfPathRel = `/uploads/${dxfFileName}`;
      const jsonPathRel = `/uploads/converted/${jsonFileName}`;

      // 3 & 4. Convert PDF -> DXF and parse to JSON with retry (max 3 attempts: 1 + 2 retries)
      const MAX_ATTEMPTS = 3;
      const RETRY_DELAY_MS = 1500;
      let jsonData: DxfData | undefined;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          this.logger.log(
            `PDF→DXF conversion attempt ${attempt}/${MAX_ATTEMPTS} for ${absolutePdfPath}`,
          );
          await this.dxfConversionService.convertPdfToDxf(
            absolutePdfPath,
            dxfPathAbs,
          );
          jsonData = await this.dxfConversionService.parseDxfFile(dxfPathAbs);
          await fs.writeFile(jsonPathAbs, JSON.stringify(jsonData, null, 2));
          break;
        } catch (err) {
          if (attempt === MAX_ATTEMPTS) throw err;
          this.logger.warn(
            `Conversion attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS}ms...`,
            err,
          );
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }

      if (jsonData === undefined) {
        throw new InternalServerErrorException(
          'Conversion failed after retries',
        );
      }

      // 5. Update Project in DB (Only if not a temporary ID)
      if (projectId && !projectId.startsWith('temp_')) {
        try {
          await this.projectsService.updateArtifactPaths(
            projectId,
            {
              sourcePdfPath: pdfData.sourceFile,
              dxfPath: dxfPathRel,
              geoJsonPath: jsonPathRel,
            },
            userId,
          );
        } catch (err) {
          this.logger.warn(
            `Could not update artifacts for project ${projectId} (might be temp or missing):`,
            err,
          );
        }
      } else {
        this.logger.log(
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
    } catch (e: unknown) {
      this.logger.error('PDF Upload Error:', e);
      const message = e instanceof Error ? e.message : 'Conversion failed';
      throw new InternalServerErrorException(message);
    }
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  public async uploadPdf(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ExtractedPdfData> {
    if (!file) {
      throw new BadRequestException('Nie przesłano pliku');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Plik musi być w formacie PDF');
    }

    try {
      return await this.pdfService.parsePdf(file.buffer, file.originalname);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Błąd podczas parsowania PDF';
      throw new InternalServerErrorException(message);
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
      throw new BadRequestException('Nie przesłano żadnych plików');
    }

    // Filter only PDFs
    const pdfFiles = files.filter(
      (f) =>
        f.mimetype === 'application/pdf' ||
        f.originalname.toLowerCase().endsWith('.pdf'),
    );

    if (pdfFiles.length === 0) {
      throw new BadRequestException(
        'Nie znaleziono plików PDF. Akceptowane formaty: PDF',
      );
    }

    try {
      const filesToParse = pdfFiles.map((f) => ({
        buffer: f.buffer,
        filename: f.originalname,
      }));

      return await this.pdfService.parseBatch(filesToParse);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Błąd podczas przetwarzania plików';
      this.logger.error(`Batch upload failed`, err);
      throw new InternalServerErrorException(message);
    }
  }
}
