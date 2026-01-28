import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: 'Budynek A - Parter' })
  @IsString()
  public name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public description?: string;

  @ApiProperty({ example: 12.5, description: 'Długość stropu w metrach' })
  @IsNumber()
  @Min(1)
  @Max(100)
  public slabLength!: number;

  @ApiProperty({ example: 8.0, description: 'Szerokość stropu w metrach' })
  @IsNumber()
  @Min(1)
  @Max(100)
  public slabWidth!: number;

  @ApiProperty({ example: 0.25, description: 'Grubość stropu w metrach' })
  @IsNumber()
  @Min(0.1)
  @Max(1)
  public slabThickness!: number;

  @ApiProperty({ example: 3.0, description: 'Wysokość kondygnacji w metrach' })
  @IsNumber()
  @Min(2)
  @Max(10)
  public floorHeight!: number;

  @ApiPropertyOptional({ example: 'monolityczny' })
  @IsOptional()
  @IsString()
  public slabType?: string;

  @ApiPropertyOptional({ example: 'PERI_SKYDECK' })
  @IsString()
  public formworkSystem?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public sourcePdfPath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public extractedPdfData?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public extractedSlabGeometry?: string; // JSON string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public dxfPath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public geoJsonPath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public svgPath?: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['draft', 'calculated', 'optimized', 'sent', 'completed'])
  public status?: 'draft' | 'calculated' | 'optimized' | 'sent' | 'completed';

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  public slabLength?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  public slabWidth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  public slabThickness?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  public floorHeight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public slabType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public formworkSystem?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public calculationResult?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public optimizationResult?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public extractedSlabGeometry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public geoJsonPath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public svgPath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public dxfPath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public sourcePdfPath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public extractedPdfData?: string;
}

export class ProjectResponseDto {
  public id!: string;
  public name!: string;
  public description?: string;
  public status!: string;
  public slabLength!: number;
  public slabWidth!: number;
  public slabThickness!: number;
  public floorHeight!: number;
  public slabType!: string;
  public formworkSystem?: string;
  public slabArea!: number;
  public createdAt!: Date;
  public updatedAt!: Date;
}
