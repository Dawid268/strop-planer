import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import type {
  InventoryItem,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  InventoryFilter,
  InventorySummary,
} from './interfaces/inventory.interface';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  public constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({ summary: 'Lista wszystkich elementów magazynowych' })
  @ApiQuery({ name: 'type', required: false, description: 'Filtr po typie' })
  @ApiQuery({
    name: 'system',
    required: false,
    description: 'Filtr po systemie',
  })
  @ApiQuery({
    name: 'manufacturer',
    required: false,
    description: 'Filtr po producencie',
  })
  public findAll(
    @Query('type') type?: InventoryItem['type'],
    @Query('system') system?: string,
    @Query('manufacturer') manufacturer?: string,
  ): InventoryItem[] {
    const filter: InventoryFilter = {};
    if (type) filter.type = type;
    if (system) filter.system = system;
    if (manufacturer) filter.manufacturer = manufacturer;

    return this.inventoryService.findAll(
      Object.keys(filter).length > 0 ? filter : undefined,
    );
  }

  @Get('summary')
  @ApiOperation({ summary: 'Podsumowanie stanu magazynowego' })
  public getSummary(): InventorySummary {
    return this.inventoryService.getSummary();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Pobierz element po ID' })
  public findOne(@Param('id') id: string): InventoryItem {
    return this.inventoryService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Dodaj nowy element do magazynu' })
  @ApiResponse({ status: 201, description: 'Element utworzony' })
  public create(@Body() dto: CreateInventoryItemDto): InventoryItem {
    return this.inventoryService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Aktualizuj element magazynowy' })
  public update(
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto,
  ): InventoryItem {
    return this.inventoryService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Usuń element z magazynu' })
  public delete(@Param('id') id: string): { message: string } {
    this.inventoryService.delete(id);
    return { message: `Element ${id} usunięty` };
  }

  @Post(':id/reserve')
  @ApiOperation({ summary: 'Zarezerwuj elementy' })
  public reserve(
    @Param('id') id: string,
    @Body('quantity') quantity: number,
  ): InventoryItem {
    if (!quantity || quantity <= 0) {
      throw new HttpException(
        'Ilość musi być większa od 0',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return this.inventoryService.reserve(id, quantity);
    } catch (error) {
      throw new HttpException((error as Error).message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':id/release')
  @ApiOperation({ summary: 'Zwolnij rezerwację' })
  public release(
    @Param('id') id: string,
    @Body('quantity') quantity: number,
  ): InventoryItem {
    if (!quantity || quantity <= 0) {
      throw new HttpException(
        'Ilość musi być większa od 0',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return this.inventoryService.release(id, quantity);
    } catch (error) {
      throw new HttpException((error as Error).message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('available/for-project')
  @ApiOperation({ summary: 'Pobierz elementy dostępne dla projektu' })
  @ApiQuery({
    name: 'panelArea',
    type: Number,
    description: 'Wymagana powierzchnia paneli [m²]',
  })
  @ApiQuery({
    name: 'props',
    type: Number,
    description: 'Wymagana liczba podpór',
  })
  @ApiQuery({
    name: 'system',
    required: false,
    description: 'Preferowany system',
  })
  public getAvailableForProject(
    @Query('panelArea') panelArea: number,
    @Query('props') props: number,
    @Query('system') system?: string,
  ): InventoryItem[] {
    return this.inventoryService.getAvailableForProject(
      panelArea,
      props,
      system,
    );
  }
}
