import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormworkProjectEntity } from '../inventory/entities/formwork-project.entity';
import { InkscapeConversionService } from './inkscape-conversion.service';

const execAsync = promisify(exec);

@Injectable()
export class GeometryService {
  private readonly logger = new Logger(GeometryService.name);
  private readonly scriptsPath = path.join(__dirname, '../../src/scripts'); // Adjust based on build path

  private jobs = new Map<string, Job>();

  constructor(
    @InjectRepository(FormworkProjectEntity)
    private readonly projectRepository: Repository<FormworkProjectEntity>,
    private readonly inkscapeService: InkscapeConversionService,
  ) {}

  async startExtraction(
    pdfPath: string,
    projectId?: string,
  ): Promise<{ jobId: string }> {
    const jobId = Math.random().toString(36).substring(7);
    this.jobs.set(jobId, {
      id: jobId,
      status: 'pending',
      message: 'Starting extraction...',
      createdAt: new Date(),
    });

    // Start background process without awaiting
    this.processExtraction(jobId, pdfPath, projectId).catch((err) => {
      this.logger.error(`Background processing failed for job ${jobId}`, err);
    });

    return { jobId };
  }

  getJobStatus(jobId: string): Job | null {
    return this.jobs.get(jobId) || null;
  }

  private updateJob(jobId: string, update: Partial<Job>) {
    const job = this.jobs.get(jobId);
    if (job) {
      this.jobs.set(jobId, { ...job, ...update });
    }
  }

  private async processExtraction(
    jobId: string,
    pdfPath: string,
    projectId?: string,
  ) {
    this.updateJob(jobId, {
      status: 'processing',
      message: 'Validating PDF path...',
    });

    const isAbsolute = path.isAbsolute(pdfPath);
    let pdfAbsPath = pdfPath;

    if (!isAbsolute) {
      // Assume web-style relative path
      const relativePath = pdfPath.startsWith('/')
        ? pdfPath.substring(1)
        : pdfPath;
      pdfAbsPath = path.join(process.cwd(), relativePath);
    }

    // Check if exists
    if (!fs.existsSync(pdfAbsPath)) {
      this.logger.error(`PDF not found at ${pdfAbsPath}`);
      this.updateJob(jobId, {
        status: 'failed',
        message: 'PDF file not found',
      });
      return;
    }

    const svgPath = pdfAbsPath.replace('.pdf', '.svg');

    try {
      // 1. Convert PDF to SVG using InkscapeConversionService
      this.updateJob(jobId, {
        status: 'processing',
        message: 'Converting PDF to Vector Format (Inkscape)...',
      });

      // We process only the first page for now, or use the multi-page logic if needed.
      // The current Python script expects a single SVG file.
      // So let's convert just page 1 or the whole thing and take the first one.
      // For simplicity/compatibility, let's keep replacing .pdf with .svg in the same location if possible,
      // OR use the service's output.

      // Using the service:
      // It returns an array of paths.
      const svgs = await this.inkscapeService.convertPdfToSvg(
        pdfAbsPath,
        jobId,
      );
      if (!svgs.length) throw new Error('No SVG generated');
      const validSvgPath = svgs[0]; // Take the first page

      this.logger.log(`Converted PDF to SVG: ${validSvgPath}`);

      // 2. Run Python script
      this.updateJob(jobId, {
        status: 'processing',
        message: 'Analyzing Geometry (Python)...',
      });
      const scriptPath =
        '/run/media/dawid/Linux_Projekty/szalunki-optimizer/src/scripts/extract_geometry.py';
      // Python script expects SVG path
      const pythonCmd = `python3 "${scriptPath}" "${validSvgPath}"`;
      this.logger.log(`Executing: ${pythonCmd}`);
      const { stdout, stderr } = await execAsync(pythonCmd, {
        maxBuffer: 50 * 1024 * 1024,
      });

      if (stderr) {
        this.logger.warn(`Python stderr: ${stderr}`);
      }

      this.updateJob(jobId, {
        status: 'processing',
        message: 'Parsing results...',
      });
      try {
        const result = JSON.parse(stdout);
        this.updateJob(jobId, {
          status: 'completed',
          result,
          message: 'Extraction successful',
        });

        if (projectId) {
          try {
            if (result && result.polygons) {
              // COPY SVG to uploads
              const publicDir = path.join(process.cwd(), 'uploads/converted');
              if (!fs.existsSync(publicDir)) {
                fs.mkdirSync(publicDir, { recursive: true });
              }
              const publicFileName = `${projectId}.svg`;
              const publicPath = path.join(publicDir, publicFileName);
              fs.copyFileSync(validSvgPath, publicPath);
              const svgUrl = `/uploads/converted/${publicFileName}`;

              await this.projectRepository.update(projectId, {
                extractedSlabGeometry: JSON.stringify(result),
                svgPath: svgUrl,
              });
              this.logger.log(`Extracted ${result.polygons?.length} polygons.`);
              if (result.polygons?.length > 0) {
                this.logger.log(
                  `First Polygon Preview: ${JSON.stringify(result.polygons[0])}`,
                );
              }
              this.logger.log(`Updated project ${projectId} with geometry`);
            } else if (result && result.error) {
              this.logger.warn(`Python script returned error: ${result.error}`);
              this.updateJob(jobId, {
                status: 'failed',
                message: result.error,
              });
            } else {
              this.logger.warn(
                `Invalid result format: ${JSON.stringify(result)}`,
              );
            }
          } catch (dbError) {
            this.logger.error(
              `Failed to save geometry to project ${projectId}`,
              dbError,
            );
          }
        }
      } catch (e) {
        this.logger.error('Failed to parse Python output', stdout);
        this.updateJob(jobId, {
          status: 'failed',
          message: 'Invalid output from geometry script',
        });
      }
    } catch (error) {
      this.logger.error('Extraction failed', error);
      this.updateJob(jobId, {
        status: 'failed',
        message: `Extraction failed: ${error.message}`,
      });
    } finally {
      // Cleanup SVG? Keep for debug?
      // fs.unlinkSync(svgPath);
    }
  }

  // Legacy/synchronous method (deprecate or remove?)
  // For now we assume controller calls startExtraction
  async extractFromPdf(pdfPath: string): Promise<any> {
    throw new Error('Use startExtraction via API');
  }
}

export interface Job {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
  result?: any;
  error?: string;
  createdAt: Date;
}
