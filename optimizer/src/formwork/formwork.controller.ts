import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FormworkService } from './formwork.service';
import type {
  FormworkLayout,
  FormworkCalculationParams,
  OptimizationResult,
} from './interfaces/formwork.interface';
import type { SlabData } from '../slab/interfaces/slab.interface';

class DimensionsDto {
  @IsNumber()
  length!: number;

  @IsNumber()
  width!: number;

  @IsNumber()
  thickness!: number;

  @IsNumber()
  area!: number;
}

class AxesDto {
  @IsArray()
  @IsString({ each: true })
  horizontal!: string[];

  @IsArray()
  @IsString({ each: true })
  vertical!: string[];
}

class PointDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

class CalculateFormworkDto implements FormworkCalculationParams {
  @IsNumber()
  public slabArea!: number;

  @IsNumber()
  public slabThickness!: number;

  @IsNumber()
  public floorHeight!: number;

  @IsOptional()
  @IsString()
  public preferredSystem?:
    | 'PERI_SKYDECK'
    | 'DOKA_DOKAFLEX'
    | 'ULMA_ENKOFLEX'
    | 'MEVA'
    | 'CUSTOM';

  @IsOptional()
  @IsNumber()
  public maxBudget?: number;

  @IsBoolean()
  public includeBeams!: boolean;

  @IsOptional()
  @IsNumber()
  public additionalLoad?: number;

  @IsOptional()
  @IsBoolean()
  public optimizeForWarehouse?: boolean;
}

class SlabDataDto {
  @IsString()
  public id!: string;

  @ValidateNested()
  @Type(() => DimensionsDto)
  public dimensions!: DimensionsDto;

  @IsString()
  public type!: 'monolityczny' | 'teriva' | 'filigran' | 'zerowiec' | 'inny';

  @IsArray()
  public beams!: any[];

  @IsArray()
  public reinforcement!: any[];

  @ValidateNested()
  @Type(() => AxesDto)
  public axes!: AxesDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PointDto)
  public points?: PointDto[];
}

class CalculateRequestDto {
  @ValidateNested()
  @Type(() => SlabDataDto)
  public slabData!: SlabDataDto;

  @ValidateNested()
  @Type(() => CalculateFormworkDto)
  public params!: CalculateFormworkDto;
}

@ApiTags('Formwork')
@Controller('formwork')
export class FormworkController {
  private readonly layouts: Map<string, FormworkLayout> = new Map();

  public constructor(private readonly formworkService: FormworkService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpointu Formwork' })
  public getStatus(): { status: string; systems: string[] } {
    return {
      status: 'ok',
      systems: ['PERI_SKYDECK', 'DOKA_DOKAFLEX', 'ULMA_ENKOFLEX', 'MEVA'],
    };
  }

  @Post('calculate')
  @ApiOperation({ summary: 'Oblicz układ szalunku dla stropu' })
  @ApiBody({ type: CalculateRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Obliczony układ szalunku',
  })
  public calculateFormwork(@Body() body: CalculateRequestDto): FormworkLayout {
    const { slabData, params } = body;

    if (!slabData || !params) {
      throw new HttpException(
        'Wymagane dane stropu i parametry obliczeń',
        HttpStatus.BAD_REQUEST,
      );
    }

    const layout = this.formworkService.calculateFormwork(
      slabData as unknown as SlabData,
      params,
    );

    // Zapisz layout do cache
    this.layouts.set(layout.id, layout);

    return layout;
  }

  @Post('optimize/:layoutId')
  @ApiOperation({ summary: 'Optymalizuj istniejący układ szalunku' })
  @ApiResponse({
    status: 200,
    description: 'Wynik optymalizacji',
  })
  public optimizeFormwork(
    @Param('layoutId') layoutId: string,
  ): OptimizationResult {
    const layout = this.layouts.get(layoutId);

    if (!layout) {
      throw new HttpException(
        `Layout ${layoutId} nie znaleziony`,
        HttpStatus.NOT_FOUND,
      );
    }

    return this.formworkService.optimize(layout);
  }

  @Get('layout/:layoutId')
  @ApiOperation({ summary: 'Pobierz zapisany układ szalunku' })
  public getLayout(@Param('layoutId') layoutId: string): FormworkLayout {
    const layout = this.layouts.get(layoutId);

    if (!layout) {
      throw new HttpException(
        `Layout ${layoutId} nie znaleziony`,
        HttpStatus.NOT_FOUND,
      );
    }

    return layout;
  }

  @Get('systems')
  @ApiOperation({ summary: 'Lista dostępnych systemów szalunkowych' })
  public getSystems(): {
    systems: Array<{
      id: string;
      name: string;
      manufacturer: string;
      description: string;
    }>;
  } {
    return {
      systems: [
        {
          id: 'PERI_SKYDECK',
          name: 'SKYDECK',
          manufacturer: 'PERI',
          description:
            'System aluminiowych paneli stropowych z głowicami opadającymi',
        },
        {
          id: 'DOKA_DOKAFLEX',
          name: 'Dokaflex',
          manufacturer: 'DOKA',
          description: 'System dźwigarowy z płytą sklejkową',
        },
        {
          id: 'ULMA_ENKOFLEX',
          name: 'ENKOFLEX',
          manufacturer: 'ULMA',
          description: 'Elastyczny system stropowy',
        },
        {
          id: 'MEVA',
          name: 'MEVA Deck',
          manufacturer: 'MEVA',
          description: 'System modułowy z panelami aluminiowymi',
        },
      ],
    };
  }
}
