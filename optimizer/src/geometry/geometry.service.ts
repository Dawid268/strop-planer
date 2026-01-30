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

interface GeometryExtractionResult {
  polygons?: Array<{ points: Array<{ x: number; y: number }> }>;
  error?: string;
  [key: string]: unknown;
}

@Injectable()
export class GeometryService {
  private readonly logger = new Logger(GeometryService.name);
  private readonly scriptsPath = path.join(process.cwd(), 'src/scripts');

  private jobs = new Map<string, Job>();

  constructor(
    @InjectRepository(FormworkProjectEntity)
    private readonly projectRepository: Repository<FormworkProjectEntity>,
    private readonly inkscapeService: InkscapeConversionService,
  ) {}

  public startExtraction(
    pdfPath: string,
    projectId?: string,
  ): { jobId: string } {
    const jobId = Math.random().toString(36).substring(7);
    this.jobs.set(jobId, {
      id: jobId,
      status: 'pending',
      message: 'Starting extraction...',
      createdAt: new Date(),
    });

    void this.processExtraction(jobId, pdfPath, projectId).catch((err) => {
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

    let pdfAbsPath = pdfPath;

    // Handle web-style absolute paths (/uploads/...) or relative paths
    if (pdfPath.startsWith('/uploads')) {
      pdfAbsPath = path.join(process.cwd(), pdfPath.substring(1));
    } else if (!path.isAbsolute(pdfPath)) {
      pdfAbsPath = path.join(process.cwd(), pdfPath);
    }

    this.logger.log(
      `Resolved absolute path: ${pdfAbsPath} (cwd: ${process.cwd()})`,
    );

    // Check if exists
    if (!fs.existsSync(pdfAbsPath)) {
      this.logger.error(`PDF not found at ${pdfAbsPath}`);
      this.updateJob(jobId, {
        status: 'failed',
        message: 'PDF file not found',
      });
      return;
    }

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
      const scriptPath = path.join(this.scriptsPath, 'extract_geometry.py');
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
        const result = JSON.parse(stdout) as GeometryExtractionResult;

        if (projectId) {
          try {
            if (result && result.polygons) {
              const publicDir = path.join(process.cwd(), 'uploads/converted');
              if (!fs.existsSync(publicDir)) {
                fs.mkdirSync(publicDir, { recursive: true });
              }
              const publicFileName = `${projectId}.svg`;
              const publicPath = path.join(publicDir, publicFileName);
              fs.copyFileSync(validSvgPath, publicPath);
              const svgUrl = `/uploads/converted/${publicFileName}`;

              const layerId = `layer-vectors-${Date.now()}`;
              const editorData = {
                tabs: [
                  {
                    id: `tab-${Date.now()}`,
                    name: 'Strona 1',
                    active: true,
                    layers: [
                      {
                        id: layerId,
                        name: 'Wektory (AI)',
                        shapes: result.polygons.map((poly, idx) => ({
                          id: `ai-poly-${Date.now()}-${idx}`,
                          type: 'polygon',
                          points: Array.isArray(poly)
                            ? poly
                            : poly.points || poly,
                          x: 0,
                          y: 0,
                        })),
                        isVisible: true,
                        isLocked: false,
                        opacity: 1,
                        color: '#9c27b0',
                        type: 'ai_vectors',
                      },
                      {
                        id: `layer-user-${Date.now()}`,
                        name: 'Warstwa użytkownika',
                        shapes: [],
                        isVisible: true,
                        isLocked: false,
                        opacity: 1,
                        color: '#2196f3',
                        type: 'user',
                      },
                    ],
                  },
                ],
              };

              await this.projectRepository.update(projectId, {
                extractedSlabGeometry: JSON.stringify(result),
                editorData: JSON.stringify(editorData),
                svgPath: svgUrl,
              });
              this.logger.log(`Extracted ${result.polygons?.length} polygons.`);
              if (result.polygons?.length > 0) {
                this.logger.log(
                  `First Polygon Preview: ${JSON.stringify(result.polygons[0])}`,
                );
              }
              this.logger.log(`Updated project ${projectId} with geometry`);

              this.updateJob(jobId, {
                status: 'completed',
                result,
                message: 'Extraction successful',
              });
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
              this.updateJob(jobId, {
                status: 'completed',
                result,
                message: 'Extraction completed (no polygons)',
              });
            }
          } catch (dbError) {
            this.logger.error(
              `Failed to save geometry to project ${projectId}`,
              dbError,
            );
            this.updateJob(jobId, {
              status: 'failed',
              message: 'Failed to save geometry to database',
            });
          }
        } else {
          this.updateJob(jobId, {
            status: 'completed',
            result,
            message: 'Extraction successful (no project to save)',
          });
        }
      } catch {
        this.logger.error('Failed to parse Python output', stdout);
        this.updateJob(jobId, {
          status: 'failed',
          message: 'Invalid output from geometry script',
        });
      }
    } catch (error) {
      this.logger.error('Extraction failed', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.updateJob(jobId, {
        status: 'failed',
        message: `Extraction failed: ${errorMessage}`,
      });
    } finally {
      // Cleanup SVG? Keep for debug?
      // fs.unlinkSync(svgPath);
    }
  }

  // No legacy methods
}

export interface Job {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
  result?: unknown;
  error?: string;
  createdAt: Date;
}
