import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
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
import { AtGuard } from '../auth/auth.guard';
import {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  InventoryFilterDto,
  InventoryItemDto,
} from './dto/inventory.dto';
import { InventorySummary } from './interfaces/inventory.interface';
import { BadRequestException } from '@nestjs/common';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(AtGuard)
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
  public async findAll(
    @Query() filter: InventoryFilterDto,
  ): Promise<InventoryItemDto[]> {
    return this.inventoryService.findAll(filter);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Podsumowanie stanu magazynowego' })
  public async getSummary(): Promise<InventorySummary> {
    return this.inventoryService.getSummary();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Pobierz element po ID' })
  public async findOne(@Param('id') id: string): Promise<InventoryItemDto> {
    return this.inventoryService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Dodaj nowy element do magazynu' })
  @ApiResponse({ status: 201, description: 'Element utworzony' })
  public async create(
    @Body() dto: CreateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    return this.inventoryService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Aktualizuj element magazynowy' })
  public async update(
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    return this.inventoryService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Usuń element z magazynu' })
  public async delete(@Param('id') id: string): Promise<{ message: string }> {
    await this.inventoryService.delete(id);
    return { message: `Element ${id} usunięty` };
  }

  @Post(':id/reserve')
  @ApiOperation({ summary: 'Zarezerwuj elementy' })
  public async reserve(
    @Param('id') id: string,
    @Body('quantity') quantity: number,
  ): Promise<InventoryItemDto> {
    if (!quantity || quantity <= 0) {
      throw new BadRequestException('Ilość musi być większa od 0');
    }
    return this.inventoryService.reserve(id, quantity);
  }

  @Post(':id/release')
  @ApiOperation({ summary: 'Zwolnij rezerwację' })
  public async release(
    @Param('id') id: string,
    @Body('quantity') quantity: number,
  ): Promise<InventoryItemDto> {
    if (!quantity || quantity <= 0) {
      throw new BadRequestException('Ilość musi być większa od 0');
    }
    return this.inventoryService.release(id, quantity);
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
  public async getAvailableForProject(
    @Query('panelArea') panelArea: number,
    @Query('props') props: number,
    @Query('system') system?: string,
  ): Promise<InventoryItemDto[]> {
    return this.inventoryService.getAvailableForProject(
      panelArea,
      props,
      system,
    );
  }
}
