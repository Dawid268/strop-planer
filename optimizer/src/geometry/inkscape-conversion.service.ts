import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

@Injectable()
export class InkscapeConversionService {
  private readonly logger = new Logger(InkscapeConversionService.name);

  public async convertPdfPageToSvg(
    pdfPath: string,
    outputPath: string,
    pageNumber: number = 1,
  ): Promise<void> {
    try {
      // Inkscape 1.0+ command line syntax
      // Added --export-plain-svg for cleaner output easier to parse
      const command = `inkscape --pages=${pageNumber} --export-type=svg --export-plain-svg --export-filename="${outputPath}" "${pdfPath}"`;

      this.logger.log(`Converting page ${pageNumber}: ${command}`);
      const { stderr } = await execAsync(command, { timeout: 60000 }); // 60s timeout
      if (stderr) {
        this.logger.warn(`Inkscape stderr (page ${pageNumber}): ${stderr}`);
      }
    } catch (error) {
      this.logger.error(
        `Inkscape conversion failed for ${pdfPath} page ${pageNumber}`,
        error,
      );
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Inkscape conversion failed: ${msg}`);
    }
  }

  public async convertPdfToSvg(
    pdfPath: string,
    documentId: string,
  ): Promise<string[]> {
    // Determine output directory (e.g., adjacent to uploads or in a temp folder)
    // For now, let's keep it in a 'converted' folder in the upload dir parent or temp
    // Using a path relative to the input file or a centralized temp dir
    const uploadDir = path.dirname(pdfPath);
    const outputDir = path.join(uploadDir, 'converted', documentId);

    await fs.mkdir(outputDir, { recursive: true });

    const pageCount = await this.getPageCount(pdfPath);
    const svgFiles: string[] = [];

    // For the initial implementation, we might only interest in the first page if it's a floor plan
    // But evaluating all pages is Safer.
    // However, existing Logic expects a SINGLE SVG path.
    // processExtraction in GeometryService expects a single SVG.
    // We will extract all, but return the first one for now or handle multi-page logic later.

    for (let page = 1; page <= pageCount; page++) {
      const fileName = `page-${page}.svg`;
      const outputFile = path.join(outputDir, fileName);
      await this.convertPdfPageToSvg(pdfPath, outputFile, page);
      svgFiles.push(outputFile);
    }

    return svgFiles;
  }

  private async getPageCount(pdfPath: string): Promise<number> {
    try {
      const { stdout } = await execAsync(`pdfinfo "${pdfPath}" | grep Pages`);
      const match = stdout.match(/Pages:\s+(\d+)/);
      return match ? parseInt(match[1], 10) : 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `Could not determine page count for ${pdfPath}, defaulting to 1. Error: ${msg}`,
      );
      return 1;
    }
  }
}
