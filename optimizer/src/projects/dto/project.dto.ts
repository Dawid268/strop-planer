import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ExtractedPdfData } from '@/slab/interfaces/slab.interface';
import { SlabType } from '@/slab/enums/slab.enums';
import {
  FormworkLayout,
  OptimizationResult,
} from '@/formwork/interfaces/formwork.interface';
import {
  EditorData,
  ExtractedSlabGeometry,
} from '@/projects/interfaces/project.interface';
import { PROJECT_STATUS, ProjectStatusType } from '@common/constants';
import { FORMWORK_SYSTEMS, FormworkSystemType } from '@common/constants';

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

  @ApiPropertyOptional({
    example: 'monolityczny',
    enum: SlabType,
    description: 'Typ stropu',
  })
  @IsOptional()
  @IsEnum(SlabType)
  @Transform(({ value }) => (value === '' ? undefined : value))
  public slabType?: SlabType;

  @ApiPropertyOptional({
    example: 'PERI_SKYDECK',
    enum: Object.values(FORMWORK_SYSTEMS),
    description: 'System szalunkowy',
  })
  @IsOptional()
  @IsEnum(FORMWORK_SYSTEMS)
  @Transform(({ value }) => (value === '' ? undefined : value))
  public formworkSystem?: FormworkSystemType;

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

  @ApiPropertyOptional({
    enum: Object.values(PROJECT_STATUS),
    description: 'Status projektu',
  })
  @IsOptional()
  @IsEnum(PROJECT_STATUS)
  @Transform(({ value }) => (value === '' ? undefined : value))
  public status?: ProjectStatusType;

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

  @ApiPropertyOptional({ enum: SlabType })
  @IsOptional()
  @IsEnum(SlabType)
  @Transform(({ value }) => (value === '' ? undefined : value))
  public slabType?: SlabType;

  @ApiPropertyOptional({ enum: Object.values(FORMWORK_SYSTEMS) })
  @IsOptional()
  @IsEnum(FORMWORK_SYSTEMS)
  @Transform(({ value }) => (value === '' ? undefined : value))
  public formworkSystem?: FormworkSystemType;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public editorData?: string;
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
  public calculationResult?: FormworkLayout;
  public optimizationResult?: OptimizationResult;
  public extractedPdfData?: ExtractedPdfData;
  public extractedSlabGeometry?: ExtractedSlabGeometry;
  public editorData?: EditorData;
  @ApiPropertyOptional()
  public sourcePdfPath?: string;

  @ApiPropertyOptional()
  public geoJsonPath?: string;

  @ApiPropertyOptional()
  public svgPath?: string;

  @ApiPropertyOptional()
  public dxfPath?: string;

  /** Status ekstrakcji geometrii: pending | processing | completed | failed */
  @ApiPropertyOptional()
  public extractionStatus?: string;

  /** Aktualna / ostatnia numer próby ekstrakcji (1..N) */
  @ApiPropertyOptional()
  public extractionAttempts?: number;

  /** Ostatni komunikat z joba (błąd lub status) */
  @ApiPropertyOptional()
  public extractionMessage?: string;

  public createdAt!: Date;
  public updatedAt!: Date;
}
