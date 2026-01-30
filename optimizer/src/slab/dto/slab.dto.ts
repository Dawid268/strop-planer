import { AutoMap } from '@automapper/classes';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SlabDimensionsDto {
  @AutoMap()
  @ApiProperty()
  @IsNumber()
  @Min(0)
  length!: number;

  @AutoMap()
  @ApiProperty()
  @IsNumber()
  @Min(0)
  width!: number;

  @AutoMap()
  @ApiProperty()
  @IsNumber()
  @Min(0)
  thickness!: number;

  @AutoMap()
  @ApiProperty()
  @IsNumber()
  @Min(0)
  area!: number;
}

export class BeamSectionDto {
  @AutoMap()
  @ApiProperty()
  @IsNumber()
  @Min(0)
  width!: number;

  @AutoMap()
  @ApiProperty()
  @IsNumber()
  @Min(0)
  height!: number;
}

export class BeamDataDto {
  @AutoMap()
  @ApiProperty()
  @IsString()
  symbol!: string;

  @AutoMap()
  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantity!: number;

  @AutoMap()
  @ApiProperty()
  @IsNumber()
  @Min(0)
  mainRebarDiameter!: number;

  @AutoMap()
  @ApiProperty()
  @IsNumber()
  @Min(0)
  stirrupDiameter!: number;

  @AutoMap()
  @ApiProperty()
  @IsNumber()
  @Min(0)
  totalLength!: number;

  @AutoMap()
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  span?: number;

  @AutoMap(() => BeamSectionDto)
  @ApiPropertyOptional({ type: BeamSectionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BeamSectionDto)
  section?: BeamSectionDto;
}

export class ReinforcementDataDto {
  @AutoMap()
  @ApiProperty()
  @IsString()
  elementId!: string;

  @AutoMap()
  @ApiProperty({ enum: ['wieniec', 'belka', 'strop', 'slup', 'nadproze'] })
  @IsEnum(['wieniec', 'belka', 'strop', 'slup', 'nadproze'])
  elementType!: 'wieniec' | 'belka' | 'strop' | 'slup' | 'nadproze';

  @AutoMap()
  @ApiProperty()
  @IsNumber()
  @Min(0)
  diameter!: number;

  @AutoMap()
  @ApiProperty()
  @IsNumber()
  @Min(0)
  length!: number;

  @AutoMap()
  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantity!: number;

  @AutoMap()
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalMass?: number;
}

export class AxesDto {
  @AutoMap()
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  horizontal!: string[];

  @AutoMap()
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  vertical!: string[];
}

export class SlabDataDto {
  @AutoMap()
  @ApiProperty()
  @IsString()
  id!: string;

  @AutoMap(() => SlabDimensionsDto)
  @ApiProperty({ type: SlabDimensionsDto })
  @ValidateNested()
  @Type(() => SlabDimensionsDto)
  dimensions!: SlabDimensionsDto;

  @AutoMap()
  @ApiProperty({
    enum: ['monolityczny', 'teriva', 'filigran', 'zerowiec', 'inny'],
  })
  @IsEnum(['monolityczny', 'teriva', 'filigran', 'zerowiec', 'inny'])
  type!: 'monolityczny' | 'teriva' | 'filigran' | 'zerowiec' | 'inny';

  @AutoMap(() => [BeamDataDto])
  @ApiProperty({ type: [BeamDataDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BeamDataDto)
  beams!: BeamDataDto[];

  @AutoMap(() => [ReinforcementDataDto])
  @ApiProperty({ type: [ReinforcementDataDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReinforcementDataDto)
  reinforcement!: ReinforcementDataDto[];

  @AutoMap(() => AxesDto)
  @ApiProperty({ type: AxesDto })
  @ValidateNested()
  @Type(() => AxesDto)
  axes!: AxesDto;

  @AutoMap()
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  concreteClass?: string;

  @AutoMap()
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  steelClass?: string;

  @AutoMap()
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notes?: string[];
}
