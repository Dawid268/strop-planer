import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExtractGeometryDto {
  @ApiProperty({
    description: 'Path to the PDF file (relative to uploads or absolute)',
    example: '/uploads/projects/strop-dev.pdf',
  })
  @IsString()
  pdfPath!: string;

  @ApiProperty({
    description: 'Optional Project ID to link the extracted geometry to',
    example: 'proj_123456',
    required: false,
  })
  @IsOptional()
  @IsString()
  projectId?: string;
}
