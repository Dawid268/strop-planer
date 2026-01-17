import {
  IsString,
  IsUUID,
  IsDateString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export type RentalStatus =
  | 'draft'
  | 'active'
  | 'partially_returned'
  | 'completed'
  | 'cancelled';

export class CreateRentalItemDto {
  @IsUUID()
  public inventoryItemId!: string;

  @IsNumber()
  @Min(1)
  public quantity!: number;
}

export class CreateRentalDto {
  @IsUUID()
  public customerId!: string;

  @IsDateString()
  public startDate!: string;

  @IsDateString()
  public expectedEndDate!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRentalItemDto)
  public items!: CreateRentalItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  public depositAmount?: number;

  @IsOptional()
  @IsString()
  public deliveryAddress?: string;

  @IsOptional()
  @IsString()
  public notes?: string;

  @IsOptional()
  @IsUUID()
  public projectId?: string;
}

export class ReturnItemsDto {
  @IsUUID()
  public rentalItemId!: string;

  @IsNumber()
  @Min(1)
  public quantity!: number;

  @IsOptional()
  @IsString()
  public notes?: string;
}

export class UpdateRentalDto {
  @IsOptional()
  @IsDateString()
  public expectedEndDate?: string;

  @IsOptional()
  @IsEnum(['draft', 'active', 'partially_returned', 'completed', 'cancelled'])
  public status?: RentalStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  public depositAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  public totalPaid?: number;

  @IsOptional()
  @IsString()
  public deliveryAddress?: string;

  @IsOptional()
  @IsString()
  public notes?: string;
}

export interface RentalItemResponseDto {
  readonly id: string;
  readonly inventoryItemId: string;
  readonly itemName: string;
  readonly itemCatalogCode: string;
  readonly itemType: string;
  readonly itemSystem: string;
  readonly dimensionLength: number | null;
  readonly dimensionWidth: number | null;
  readonly dimensionHeight: number | null;
  readonly quantity: number;
  readonly dailyPricePerUnit: number;
  readonly returnedQuantity: number;
  readonly returnedAt: Date | null;
  readonly returnNotes: string | null;
}

export interface RentalResponseDto {
  readonly id: string;
  readonly orderNumber: string;
  readonly customerId: string;
  readonly customerName: string;
  readonly startDate: Date;
  readonly expectedEndDate: Date;
  readonly actualEndDate: Date | null;
  readonly status: RentalStatus;
  readonly totalDailyRate: number;
  readonly depositAmount: number;
  readonly totalPaid: number;
  readonly deliveryAddress: string | null;
  readonly notes: string | null;
  readonly items: ReadonlyArray<RentalItemResponseDto>;
  readonly projectId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly daysRented: number;
  readonly estimatedTotalCost: number;
}

export interface RentalSummaryDto {
  readonly activeRentals: number;
  readonly totalItemsRented: number;
  readonly totalDailyRevenue: number;
  readonly overdueRentals: number;
}
