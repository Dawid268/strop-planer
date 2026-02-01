import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  BadRequestException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtGuard } from '../auth/guards';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { FormworkService } from './formwork.service';
import type {
  FormworkLayout,
  FormworkCalculationParams,
  OptimizationResult,
} from './interfaces/formwork.interface';
import { SlabData } from '../slab/interfaces/slab.interface';
import { SlabDataDto } from '../slab/dto/slab.dto';
import { FORMWORK_SYSTEMS_LIST } from '@common/constants';

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

class CalculateRequestDto {
  @ValidateNested()
  @Type(() => SlabDataDto)
  public slabData!: SlabDataDto;

  @ValidateNested()
  @Type(() => CalculateFormworkDto)
  public params!: CalculateFormworkDto;
}

@ApiTags('Formwork')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller({ version: '1', path: 'formwork' })
export class FormworkController {
  private readonly layouts: Map<string, FormworkLayout> = new Map();

  public constructor(private readonly formworkService: FormworkService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpointu Formwork' })
  public getStatus(): { status: string; systems: readonly string[] } {
    return {
      status: 'ok',
      systems: FORMWORK_SYSTEMS_LIST,
    };
  }

  @Post('calculate')
  @ApiOperation({ summary: 'Oblicz szalunek dla stropu' })
  public async calculateFormwork(
    @Body() body: CalculateRequestDto,
  ): Promise<FormworkLayout> {
    const { slabData, params } = body;

    if (!slabData || !params) {
      throw new BadRequestException(
        'Wymagane dane stropu i parametry obliczeń',
      );
    }

    const slab = slabData as unknown as SlabData;

    const layout = await this.formworkService.calculateFormwork(slab, params);

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
  public async optimizeFormwork(
    @Param('layoutId') layoutId: string,
  ): Promise<OptimizationResult> {
    const layout = this.layouts.get(layoutId);

    if (!layout) {
      throw new NotFoundException(`Layout ${layoutId} nie znaleziony`);
    }

    return this.formworkService.optimize(layout);
  }

  @Get('layout/:layoutId')
  @ApiOperation({ summary: 'Pobierz zapisany układ szalunku' })
  public getLayout(@Param('layoutId') layoutId: string): FormworkLayout {
    const layout = this.layouts.get(layoutId);

    if (!layout) {
      throw new NotFoundException(`Layout ${layoutId} nie znaleziony`);
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
