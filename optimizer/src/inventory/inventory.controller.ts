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
  BadRequestException,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

import { InventoryService } from '@/inventory/inventory.service';
import { JwtGuard } from '@/auth/guards';
import {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  InventoryFilterDto,
  InventoryItemDto,
} from '@/inventory/dto/inventory.dto';
import { InventorySummary } from '@/inventory/interfaces/inventory.interface';
import {
  PaginationQueryDto,
  PaginatedResponse,
} from '@/common/dto/pagination.dto';

/**
 * Inventory Controller
 * Manages formwork equipment inventory (panels, props, beams)
 */
@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller({ version: '1', path: 'inventory' })
export class InventoryController {
  public constructor(private readonly inventoryService: InventoryService) {}

  /**
   * Get all inventory items with filtering and pagination
   */
  @Get()
  @ApiOperation({
    summary: 'Lista elementów magazynowych',
    description:
      'Zwraca paginowaną listę elementów magazynowych z opcjonalnym filtrowaniem.',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filtr po typie elementu (panel, prop, beam, accessory)',
    example: 'panel',
  })
  @ApiQuery({
    name: 'system',
    required: false,
    description: 'Filtr po systemie szalunkowym',
    example: 'PERI_SKYDECK',
  })
  @ApiQuery({
    name: 'manufacturer',
    required: false,
    description: 'Filtr po producencie',
    example: 'PERI',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numer strony (domyślnie: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Liczba elementów na stronę (domyślnie: 20)',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista elementów z paginacją',
    type: [InventoryItemDto],
  })
  @ApiResponse({ status: 401, description: 'Brak autoryzacji' })
  public async findAll(
    @Query() filter: InventoryFilterDto,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<InventoryItemDto>> {
    const { data, total } = await this.inventoryService.findAllPaginated(
      filter,
      pagination.page ?? 1,
      pagination.limit ?? 20,
    );
    const totalPages = Math.ceil(total / (pagination.limit ?? 20));

    return {
      data,
      meta: {
        total,
        page: pagination.page ?? 1,
        limit: pagination.limit ?? 20,
        totalPages,
        hasNextPage: (pagination.page ?? 1) < totalPages,
        hasPreviousPage: (pagination.page ?? 1) > 1,
      },
    };
  }

  /**
   * Get inventory summary statistics
   */
  @Get('summary')
  @ApiOperation({
    summary: 'Podsumowanie magazynu',
    description:
      'Zwraca zagregowane statystyki stanu magazynowego (ilości, wartości, dostępność).',
  })
  @ApiResponse({
    status: 200,
    description: 'Statystyki magazynowe',
    schema: {
      type: 'object',
      properties: {
        totalItems: { type: 'number', example: 1500 },
        totalValue: { type: 'number', example: 250000 },
        availableItems: { type: 'number', example: 1200 },
        reservedItems: { type: 'number', example: 300 },
        byType: {
          type: 'object',
          properties: {
            panels: { type: 'number', example: 500 },
            props: { type: 'number', example: 800 },
            beams: { type: 'number', example: 200 },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Brak autoryzacji' })
  public async getSummary(): Promise<InventorySummary> {
    return this.inventoryService.getSummary();
  }

  /**
   * Get available items for a project
   */
  @Get('available/for-project')
  @ApiOperation({
    summary: 'Elementy dostępne dla projektu',
    description:
      'Zwraca elementy magazynowe spełniające wymagania projektu (powierzchnia, liczba podpór).',
  })
  @ApiQuery({
    name: 'panelArea',
    type: Number,
    required: true,
    description: 'Wymagana powierzchnia paneli [m²]',
    example: 150,
  })
  @ApiQuery({
    name: 'props',
    type: Number,
    required: true,
    description: 'Wymagana liczba podpór',
    example: 45,
  })
  @ApiQuery({
    name: 'system',
    required: false,
    description: 'Preferowany system szalunkowy',
    example: 'PERI_SKYDECK',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista dostępnych elementów',
    type: [InventoryItemDto],
  })
  @ApiResponse({ status: 401, description: 'Brak autoryzacji' })
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

  /**
   * Get single inventory item by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Pobierz element',
    description: 'Zwraca szczegóły elementu magazynowego o podanym ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID elementu magazynowego',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Szczegóły elementu',
    type: InventoryItemDto,
  })
  @ApiResponse({ status: 401, description: 'Brak autoryzacji' })
  @ApiResponse({ status: 404, description: 'Element nie znaleziony' })
  public async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InventoryItemDto> {
    return this.inventoryService.findOne(id);
  }

  /**
   * Create new inventory item
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Dodaj element',
    description: 'Dodaje nowy element do magazynu.',
  })
  @ApiBody({ type: CreateInventoryItemDto })
  @ApiResponse({
    status: 201,
    description: 'Element utworzony',
    type: InventoryItemDto,
  })
  @ApiResponse({ status: 400, description: 'Błędne dane wejściowe' })
  @ApiResponse({ status: 401, description: 'Brak autoryzacji' })
  public async create(
    @Body() dto: CreateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    return this.inventoryService.create(dto);
  }

  /**
   * Update inventory item
   */
  @Put(':id')
  @ApiOperation({
    summary: 'Aktualizuj element',
    description: 'Aktualizuje dane elementu magazynowego.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID elementu do aktualizacji',
    type: String,
  })
  @ApiBody({ type: UpdateInventoryItemDto })
  @ApiResponse({
    status: 200,
    description: 'Element zaktualizowany',
    type: InventoryItemDto,
  })
  @ApiResponse({ status: 400, description: 'Błędne dane wejściowe' })
  @ApiResponse({ status: 401, description: 'Brak autoryzacji' })
  @ApiResponse({ status: 404, description: 'Element nie znaleziony' })
  public async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    return this.inventoryService.update(id, dto);
  }

  /**
   * Delete inventory item
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Usuń element',
    description: 'Usuwa element z magazynu.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID elementu do usunięcia',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Element usunięty',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Element 550e8400-... usunięty' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Brak autoryzacji' })
  @ApiResponse({ status: 404, description: 'Element nie znaleziony' })
  public async delete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.inventoryService.delete(id);
    return { message: `Element ${id} usunięty` };
  }

  /**
   * Reserve inventory items
   */
  @Post(':id/reserve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Zarezerwuj elementy',
    description:
      'Rezerwuje określoną ilość elementów dla projektu. Zmniejsza dostępną ilość.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID elementu do rezerwacji',
    type: String,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['quantity'],
      properties: {
        quantity: {
          type: 'number',
          description: 'Ilość do zarezerwowania',
          example: 10,
          minimum: 1,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Elementy zarezerwowane',
    type: InventoryItemDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Nieprawidłowa ilość lub brak dostępnych elementów',
  })
  @ApiResponse({ status: 401, description: 'Brak autoryzacji' })
  @ApiResponse({ status: 404, description: 'Element nie znaleziony' })
  public async reserve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('quantity') quantity: number,
  ): Promise<InventoryItemDto> {
    if (!quantity || quantity <= 0) {
      throw new BadRequestException('Ilość musi być większa od 0');
    }
    return this.inventoryService.reserve(id, quantity);
  }

  /**
   * Release reserved inventory items
   */
  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Zwolnij rezerwację',
    description: 'Zwalnia rezerwację elementów. Zwiększa dostępną ilość.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID elementu',
    type: String,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['quantity'],
      properties: {
        quantity: {
          type: 'number',
          description: 'Ilość do zwolnienia',
          example: 5,
          minimum: 1,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Rezerwacja zwolniona',
    type: InventoryItemDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Nieprawidłowa ilość',
  })
  @ApiResponse({ status: 401, description: 'Brak autoryzacji' })
  @ApiResponse({ status: 404, description: 'Element nie znaleziony' })
  public async release(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('quantity') quantity: number,
  ): Promise<InventoryItemDto> {
    if (!quantity || quantity <= 0) {
      throw new BadRequestException('Ilość musi być większa od 0');
    }
    return this.inventoryService.release(id, quantity);
  }
}
