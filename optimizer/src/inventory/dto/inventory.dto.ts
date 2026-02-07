import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsObject,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AutoMap } from '@automapper/classes';
import { ItemType, ItemCondition } from '@/inventory/enums/inventory.enums';

export class InventoryDimensionsDto {
  @AutoMap()
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  length?: number;

  @AutoMap()
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  width?: number;

  @AutoMap()
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  height?: number;
}

export class CreateInventoryItemDto {
  @AutoMap()
  @ApiProperty()
  @IsString()
  catalogCode!: string;

  @AutoMap()
  @ApiProperty()
  @IsString()
  name!: string;

  @AutoMap()
  @ApiProperty({
    enum: ItemType,
  })
  @IsEnum(ItemType)
  type!: ItemType;

  @AutoMap()
  @ApiProperty()
  @IsString()
  system!: string;

  @AutoMap()
  @ApiProperty()
  @IsString()
  manufacturer!: string;

  @AutoMap(() => InventoryDimensionsDto)
  @ApiPropertyOptional({ type: InventoryDimensionsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => InventoryDimensionsDto)
  dimensions?: InventoryDimensionsDto;

  @AutoMap()
  @ApiProperty()
  @IsNumber()
  @Min(0)
  quantityAvailable!: number;

  @AutoMap()
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  loadCapacity?: number;

  @AutoMap()
  @ApiProperty()
  @IsNumber()
  @Min(0)
  weight!: number;

  @AutoMap()
  @ApiProperty()
  @IsNumber()
  @Min(0)
  dailyRentPrice!: number;

  @AutoMap()
  @ApiProperty({ enum: ItemCondition })
  @IsEnum(ItemCondition)
  condition!: ItemCondition;

  @AutoMap()
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseLocation?: string;

  @AutoMap()
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateInventoryItemDto {
  @AutoMap()
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @AutoMap()
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityAvailable?: number;

  @AutoMap()
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityReserved?: number;

  @AutoMap()
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @AutoMap()
  @ApiPropertyOptional({ enum: ItemCondition })
  @IsOptional()
  @IsEnum(ItemCondition)
  condition?: ItemCondition;

  @AutoMap()
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class InventoryItemDto extends CreateInventoryItemDto {
  @AutoMap()
  @ApiProperty()
  isActive!: boolean;

  @AutoMap()
  @ApiProperty()
  quantityReserved!: number;

  @AutoMap()
  @ApiProperty()
  id!: string;

  @AutoMap()
  @ApiProperty()
  createdAt!: Date;

  @AutoMap()
  @ApiProperty()
  updatedAt!: Date;
}

export class InventoryFilterDto {
  @ApiPropertyOptional({
    enum: ItemType,
  })
  @IsOptional()
  @IsEnum(ItemType)
  type?: ItemType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  system?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  minQuantity?: number;

  @ApiPropertyOptional({ enum: ItemCondition })
  @IsOptional()
  @IsEnum(ItemCondition)
  condition?: ItemCondition;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}
