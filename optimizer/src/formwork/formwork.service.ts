/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import { Injectable, Logger } from '@nestjs/common';

import {
  FormworkLayout,
  FormworkElement,
  FormworkPanel,
  FormworkProp,
  FormworkBeam,
  FormworkSystemType,
  FormworkCalculationParams,
  OptimizationResult,
} from './interfaces/formwork.interface';
import { SlabData } from '../slab/interfaces/slab.interface';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryItemEntity } from '../inventory/entities/inventory-item.entity';
import {
  FORMWORK_SYSTEMS,
  PROP_CONFIG,
  BEAM_CONFIG,
  AUXILIARY_CONFIG,
  COST_CONFIG,
  OPTIMIZATION_THRESHOLDS,
  ALTERNATIVE_SYSTEMS,
} from '@common/constants';

@Injectable()
export class FormworkService {
  private readonly logger = new Logger(FormworkService.name);

  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * Oblicza wymagany układ szalunku dla danego stropu
   */
  public async calculateFormwork(
    slabData: SlabData & { points?: Array<{ x: number; y: number }> },
    params: FormworkCalculationParams,
  ): Promise<FormworkLayout> {
    const system = params.preferredSystem ?? FORMWORK_SYSTEMS.PERI_SKYDECK;

    // Pobierz elementy z magazynu
    const inventoryItems = await this.inventoryService.findAll({
      system,
      isActive: true,
      minQuantity: 1,
    });

    const catalog = {
      panels: inventoryItems
        .filter((i: InventoryItemEntity) => i.type === 'panel')
        .map((i: InventoryItemEntity) => this.mapInventoryToPanel(i)),
      props: inventoryItems
        .filter((i: InventoryItemEntity) => i.type === 'prop')
        .map((i: InventoryItemEntity) => this.mapInventoryToProp(i)),
      beams: inventoryItems
        .filter((i: InventoryItemEntity) => i.type === 'beam')
        .map((i: InventoryItemEntity) => this.mapInventoryToBeam(i)),
    };

    this.logger.log(
      `Calculating formwork for slab: ${slabData.id}, system: ${system}`,
    );

    const elements: FormworkElement[] = [];
    let totalWeight = 0;
    let estimatedCost = 0;

    // 1. Oblicz liczbę paneli
    let panelResult;
    const slabArea =
      slabData.dimensions.area ||
      slabData.dimensions.length * slabData.dimensions.width;

    if (slabData.points && slabData.points.length > 2) {
      // Użyj algorytmu geometrycznego (Polygon)
      this.logger.log('Using Polygon Optimization Algorithm');
      panelResult = this.calculatePanelsForPolygon(
        slabData.points,
        catalog.panels,
        inventoryItems.filter((i) => i.type === 'panel'), // Przekaż oryginalne itemy do sprawdzania ilości
      );
    } else {
      // Fallback do prostokąta
      this.logger.log('Using Box Optimization Algorithm');
      panelResult = this.calculatePanels(slabArea, catalog.panels);
    }

    elements.push(...panelResult.elements);
    totalWeight += panelResult.totalWeight;
    estimatedCost += panelResult.totalCost;

    // 2. Oblicz liczbę podpór (stojaków)
    const propResult = this.calculateProps(
      slabArea,
      params.floorHeight,
      params.slabThickness,
      catalog.props,
    );
    elements.push(...propResult.elements);
    totalWeight += propResult.totalWeight;

    // 3. Oblicz dźwigary jeśli wymagane
    if (params.includeBeams) {
      const beamResult = this.calculateBeams(
        slabData.dimensions.length,
        slabData.dimensions.width,
        catalog.beams,
      );
      elements.push(...beamResult.elements);
      totalWeight += beamResult.totalWeight;
    }

    // 4. Dodaj elementy pomocnicze
    const auxiliaryElements = this.calculateAuxiliaryElements(elements);
    elements.push(...auxiliaryElements);

    const assemblyTime = this.estimateAssemblyTime(slabArea, elements.length);

    return {
      id: `FORMWORK_${slabData.id}_${Date.now()}`,
      projectName: `Szalowanie stropu ${slabData.id}`,
      system,
      slabArea,
      floorHeight: params.floorHeight,
      elements,
      totalWeight,
      estimatedCost,
      estimatedAssemblyTime: assemblyTime,
    };
  }

  private mapInventoryToPanel(item: InventoryItemEntity): FormworkPanel {
    return {
      id: item.catalogCode,
      system: item.system as FormworkSystemType,
      length: item.dimensionLength || 0,
      width: item.dimensionWidth || 0,
      area: ((item.dimensionLength || 0) * (item.dimensionWidth || 0)) / 10000,
      loadCapacity: item.loadCapacity!,
      weight: item.weight,
      dailyRentCost: item.dailyRentPrice,
    };
  }

  private mapInventoryToProp(item: InventoryItemEntity): FormworkProp {
    return {
      type: PROP_CONFIG.TYPE,
      minHeight: PROP_CONFIG.MIN_HEIGHT,
      maxHeight: item.dimensionHeight || 350,
      loadCapacity: item.loadCapacity!,
      weight: item.weight,
    };
  }

  private mapInventoryToBeam(item: InventoryItemEntity): FormworkBeam {
    return {
      type: BEAM_CONFIG.TYPE,
      length: item.dimensionLength || 240,
      supportSpacing: BEAM_CONFIG.SUPPORT_SPACING,
      bendingCapacity: BEAM_CONFIG.BENDING_CAPACITY,
    };
  }

  /**
   * Calculates panels using grid-based full coverage.
   * Panels are placed in a regular grid covering the entire slab.
   * Only 0° or 90° rotation is allowed.
   */
  private calculatePanelsForPolygon(
    points: Array<{ x: number; y: number }>,
    availablePanels: FormworkPanel[],
    inventoryState: InventoryItemEntity[],
  ): { elements: FormworkElement[]; totalWeight: number; totalCost: number } {
    if (availablePanels.length === 0)
      return { elements: [], totalWeight: 0, totalCost: 0 };

    // Use the largest panel for grid sizing
    const sortedPanels = [...availablePanels].sort((a, b) => b.area - a.area);
    const primaryPanel = sortedPanels[0];

    // Get bounding box
    const bbox = this.getBoundingBox(points);
    const slabWidth = bbox.maxX - bbox.minX;
    const slabHeight = bbox.maxY - bbox.minY;

    const elements: FormworkElement[] = [];
    let totalWeight = 0;
    let totalCost = 0;

    const placedRects: Array<{ x: number; y: number; w: number; h: number }> =
      [];
    const inventoryCounts = new Map<string, number>();
    inventoryState.forEach((i: InventoryItemEntity) =>
      inventoryCounts.set(i.catalogCode, i.quantityAvailable),
    );

    // Determine best panel orientation for this slab
    // Try to maximize coverage by aligning with longer slab dimension
    const panelW =
      slabWidth >= slabHeight ? primaryPanel.length : primaryPanel.width;
    const panelH =
      slabWidth >= slabHeight ? primaryPanel.width : primaryPanel.length;
    const rotation = slabWidth >= slabHeight ? 0 : 90;

    // Calculate number of panels needed
    const numCols = Math.ceil(slabWidth / panelW);
    const numRows = Math.ceil(slabHeight / panelH);

    // Place panels in grid
    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        const x = bbox.minX + col * panelW;
        const y = bbox.minY + row * panelH;
        const centerX = x + panelW / 2;
        const centerY = y + panelH / 2;

        // Check if panel center is inside the slab polygon
        if (!this.isPointInPolygon(centerX, centerY, points)) {
          continue;
        }

        // Check inventory
        const currentStock = inventoryCounts.get(primaryPanel.id) || 0;
        if (currentStock <= 0) continue;

        // Check overlap with already placed panels
        if (this.isOverlapping(x, y, panelW, panelH, placedRects)) {
          continue;
        }

        elements.push({
          elementType: 'panel',
          name: primaryPanel.id,
          quantity: 1,
          positionX: centerX / 100, // Convert to meters
          positionY: centerY / 100,
          rotation: rotation,
          details: primaryPanel,
        });

        placedRects.push({ x, y, w: panelW, h: panelH });
        inventoryCounts.set(primaryPanel.id, currentStock - 1);
        totalWeight += primaryPanel.weight;
        totalCost +=
          (primaryPanel.dailyRentCost || 0) * COST_CONFIG.DEFAULT_RENTAL_DAYS;
      }
    }

    return { elements, totalWeight, totalCost };
  }

  private getBoundingBox(points: Array<{ x: number; y: number }>) {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }

  private isPointInPolygon(
    x: number,
    y: number,
    poly: Array<{ x: number; y: number }>,
  ): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x,
        yi = poly[i].y;
      const xj = poly[j].x,
        yj = poly[j].y;

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private isOverlapping(
    x: number,
    y: number,
    w: number,
    h: number,
    others: Array<{ x: number; y: number; w: number; h: number }>,
  ): boolean {
    for (const other of others) {
      if (
        x < other.x + other.w &&
        x + w > other.x &&
        y < other.y + other.h &&
        y + h > other.y
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Oblicza optymalny układ paneli
   */
  private calculatePanels(
    area: number,
    availablePanels: FormworkPanel[],
  ): { elements: FormworkElement[]; totalWeight: number; totalCost: number } {
    const elements: FormworkElement[] = [];
    let remainingArea = area;
    let totalWeight = 0;
    let totalCost = 0;

    // Sortuj panele od największego do najmniejszego (algorytm zachłanny)
    const sortedPanels = [...availablePanels].sort((a, b) => b.area - a.area);

    for (const panel of sortedPanels) {
      const panelAreaM2 = panel.area;
      const count = Math.floor(remainingArea / panelAreaM2);

      if (count > 0) {
        elements.push({
          elementType: 'panel',
          name: panel.id,
          quantity: count,
          details: panel,
        });

        remainingArea -= count * panelAreaM2;
        totalWeight += count * panel.weight;
        totalCost +=
          count *
          (panel.dailyRentCost || COST_CONFIG.DEFAULT_DAILY_RENT_COST) *
          COST_CONFIG.DEFAULT_RENTAL_DAYS;
      }
    }

    // Dodaj panele wypełniające dla pozostałej powierzchni
    if (remainingArea > 0 && sortedPanels.length > 0) {
      const smallestPanel = sortedPanels[sortedPanels.length - 1];
      const additionalCount = Math.ceil(remainingArea / smallestPanel.area);

      const existingElement = elements.find((e) => e.name === smallestPanel.id);
      if (existingElement) {
        existingElement.quantity += additionalCount;
      } else {
        elements.push({
          elementType: 'panel',
          name: smallestPanel.id,
          quantity: additionalCount,
          details: smallestPanel,
        });
      }
      totalWeight += additionalCount * smallestPanel.weight;
      totalCost +=
        additionalCount *
        (smallestPanel.dailyRentCost || COST_CONFIG.DEFAULT_DAILY_RENT_COST) *
        COST_CONFIG.DEFAULT_RENTAL_DAYS;
    }

    return { elements, totalWeight, totalCost };
  }

  /**
   * Oblicza liczbę podpór
   */
  private calculateProps(
    area: number,
    floorHeight: number,
    slabThickness: number,
    availableProps: FormworkProp[],
  ): { elements: FormworkElement[]; totalWeight: number } {
    const elements: FormworkElement[] = [];
    let totalWeight = 0;

    // Dobierz stojak o odpowiedniej wysokości
    const requiredHeight = floorHeight - slabThickness;

    // Default prop when inventory is empty
    const defaultProp: FormworkProp = {
      type: 'eurostempel',
      minHeight: 200,
      maxHeight: 350,
      loadCapacity: 20000,
      weight: 15,
    };

    const suitableProp =
      availableProps.find(
        (p) => p.minHeight <= requiredHeight && p.maxHeight >= requiredHeight,
      ) ||
      availableProps[0] ||
      defaultProp;

    // Standardowy rozstaw podpór
    const propSpacing = PROP_CONFIG.DEFAULT_SPACING;
    const propsPerM2 = 1 / (propSpacing * propSpacing);
    const propCount = Math.ceil(area * propsPerM2);

    elements.push({
      elementType: 'prop',
      name: `Stojak ${suitableProp.type} ${suitableProp.minHeight}-${suitableProp.maxHeight}`,
      quantity: propCount,
      details: suitableProp,
    });

    totalWeight = propCount * suitableProp.weight;

    // Dodaj trójnogi dla stabilizacji
    const tripodCount = Math.ceil(propCount / PROP_CONFIG.TRIPOD_PROPS_COUNT);
    elements.push({
      elementType: 'tripod',
      name: 'Trójnóg stabilizujący',
      quantity: tripodCount,
      details: { weight: PROP_CONFIG.TRIPOD_WEIGHT },
    });

    totalWeight += tripodCount * PROP_CONFIG.TRIPOD_WEIGHT;

    return { elements, totalWeight };
  }

  /**
   * Oblicza dźwigary
   */
  private calculateBeams(
    length: number,
    width: number,
    availableBeams: FormworkBeam[],
  ): { elements: FormworkElement[]; totalWeight: number } {
    const elements: FormworkElement[] = [];
    let totalWeight = 0;

    // Default beam when inventory is empty
    const defaultBeam: FormworkBeam = {
      type: BEAM_CONFIG.TYPE,
      length: 240,
      supportSpacing: BEAM_CONFIG.SUPPORT_SPACING,
      bendingCapacity: BEAM_CONFIG.BENDING_CAPACITY,
    };

    // Dźwigary główne (wzdłuż krótszego wymiaru)
    const primaryBeam = availableBeams[0] || defaultBeam;
    const primarySpacing = BEAM_CONFIG.PRIMARY_SPACING;
    const primaryCount = Math.ceil(length / primarySpacing);

    elements.push({
      elementType: 'beam',
      name: `Dźwigar ${primaryBeam.type} L=${primaryBeam.length}cm (główny)`,
      quantity: primaryCount,
      details: primaryBeam,
    });

    totalWeight +=
      primaryCount * (primaryBeam.length / 100) * BEAM_CONFIG.WEIGHT_PER_METER;

    // Dźwigary pomocnicze (prostopadle)
    const secondarySpacing = BEAM_CONFIG.SECONDARY_SPACING;
    const secondaryCount = Math.ceil(width / secondarySpacing);

    elements.push({
      elementType: 'beam',
      name: `Dźwigar ${primaryBeam.type} L=${primaryBeam.length}cm (pomocniczy)`,
      quantity: secondaryCount,
      details: primaryBeam,
    });

    totalWeight +=
      secondaryCount *
      (primaryBeam.length / 100) *
      BEAM_CONFIG.WEIGHT_PER_METER;

    return { elements, totalWeight };
  }

  /**
   * Dodaje elementy pomocnicze
   */
  private calculateAuxiliaryElements(
    mainElements: FormworkElement[],
  ): FormworkElement[] {
    const auxiliary: FormworkElement[] = [];

    // Głowice opadające (1 na każdy stojak)
    const propElement = mainElements.find((e) => e.elementType === 'prop');
    if (propElement) {
      auxiliary.push({
        elementType: 'drophead',
        name: 'Głowica opadająca',
        quantity: propElement.quantity,
        details: { weight: AUXILIARY_CONFIG.DROPHEAD_WEIGHT },
      });

      // Głowice krzyżowe (dla dźwigarów)
      auxiliary.push({
        elementType: 'head',
        name: 'Głowica krzyżowa',
        quantity: Math.ceil(propElement.quantity / 2),
        details: { weight: AUXILIARY_CONFIG.HEAD_WEIGHT },
      });
    }

    return auxiliary;
  }

  /**
   * Szacuje czas montażu
   */
  private estimateAssemblyTime(area: number, elementCount: number): number {
    return (
      area * COST_CONFIG.LABOR_HOURS_PER_SQM +
      elementCount * COST_CONFIG.LABOR_HOURS_PER_ELEMENT
    );
  }

  /**
   * Optymalizuje układ szalunku
   */
  public async optimize(layout: FormworkLayout): Promise<OptimizationResult> {
    this.logger.log(`Optimizing formwork layout: ${layout.id}`);

    // Klon oryginalnego layoutu
    const optimizedElements: FormworkElement[] = [];
    let newTotalWeight = 0;
    let newCost = 0;

    // Optymalizacja 1: Konsolidacja typów paneli
    const panelGroups = new Map<string, FormworkElement>();
    for (const element of layout.elements) {
      if (element.elementType === 'panel') {
        const existing = panelGroups.get(element.name);
        if (existing) {
          existing.quantity += element.quantity;
        } else {
          panelGroups.set(element.name, { ...element });
        }
      } else {
        optimizedElements.push({ ...element });
      }
    }

    // Preferuj większe panele (mniejsza liczba elementów = szybszy montaż)
    const sortedPanels = Array.from(panelGroups.values()).sort((a, b) => {
      const aDetails = a.details as FormworkPanel;
      const bDetails = b.details as FormworkPanel;
      return bDetails.area - aDetails.area;
    });

    optimizedElements.push(...sortedPanels);

    // Przelicz wagę i koszty
    for (const element of optimizedElements) {
      if ('weight' in element.details) {
        newTotalWeight +=
          element.quantity * (element.details as { weight: number }).weight;
      }
      if ('dailyRentCost' in element.details) {
        newCost +=
          element.quantity *
          ((element.details as FormworkPanel).dailyRentCost || 0) *
          COST_CONFIG.DEFAULT_RENTAL_DAYS;
      }
    }

    const optimizedLayout: FormworkLayout = {
      ...layout,
      id: `${layout.id}_OPTIMIZED`,
      elements: optimizedElements,
      totalWeight: newTotalWeight,
      estimatedCost: newCost,
    };

    const originalElementCount = layout.elements.reduce(
      (sum, e) => sum + e.quantity,
      0,
    );
    const optimizedElementCount = optimizedElements.reduce(
      (sum, e) => sum + e.quantity,
      0,
    );

    return {
      originalLayout: layout,
      optimizedLayout,
      areaSavings: 0, // powierzchnia ta sama
      costSavings: layout.estimatedCost
        ? ((layout.estimatedCost - newCost) / layout.estimatedCost) * 100
        : 0,
      elementReduction:
        ((originalElementCount - optimizedElementCount) /
          originalElementCount) *
        100,
      recommendations: this.generateRecommendations(layout),
      alternatives: await this.generateAlternatives(layout),
    };
  }

  /**
   * Generuje rekomendacje optymalizacyjne
   */
  private generateRecommendations(original: FormworkLayout): string[] {
    const recommendations: string[] = [];

    // Sprawdź czy można użyć większych paneli
    const smallPanelCount = original.elements
      .filter((e) => e.elementType === 'panel')
      .reduce((sum, e) => {
        const panel = e.details as FormworkPanel;
        return panel.area < 0.75 ? sum + e.quantity : sum;
      }, 0);

    if (smallPanelCount > OPTIMIZATION_THRESHOLDS.SMALL_PANEL_COUNT) {
      recommendations.push(
        `Rozważ zastąpienie ${smallPanelCount} małych paneli większymi formatami dla szybszego montażu`,
      );
    }

    // Sprawdź gęstość podpór
    const propElement = original.elements.find((e) => e.elementType === 'prop');
    if (propElement) {
      const propDensity = propElement.quantity / original.slabArea;
      if (propDensity > OPTIMIZATION_THRESHOLDS.HIGH_PROP_DENSITY) {
        recommendations.push(
          `Gęstość podpór powyżej ${OPTIMIZATION_THRESHOLDS.HIGH_PROP_DENSITY}/m² - sprawdź możliwość zwiększenia rozstawu`,
        );
      }
    }

    // Rekomendacje dla belek
    if (!original.elements.some((e) => e.elementType === 'beam')) {
      recommendations.push(
        'Dodanie dźwigarów może zmniejszyć liczbę wymaganych podpór',
      );
    }

    // Standardowa rekomendacja
    recommendations.push(
      'Zweryfikuj obciążenia z projektantem konstrukcji przed wykonaniem',
    );

    return recommendations;
  }

  /**
   * Generuje alternatywne rozwiązania
   */
  private async generateAlternatives(
    original: FormworkLayout,
  ): Promise<FormworkLayout[]> {
    const alternatives: FormworkLayout[] = [];

    for (const altSystem of ALTERNATIVE_SYSTEMS) {
      if (altSystem !== original.system) {
        const altLayout = await this.recalculateWithSystem(original, altSystem);
        if (altLayout) {
          alternatives.push(altLayout);
        }
      }
    }

    return alternatives;
  }

  /**
   * Przelicza układ z innym systemem
   */
  private async recalculateWithSystem(
    original: FormworkLayout,
    newSystem: FormworkSystemType,
  ): Promise<FormworkLayout | null> {
    const inventoryItems = await this.inventoryService.findAll({
      system: newSystem,
      isActive: true,
      minQuantity: 1,
    });

    if (inventoryItems.length === 0) {
      return null;
    }

    const panels = inventoryItems
      .filter((i: InventoryItemEntity) => i.type === 'panel')
      .map((i: InventoryItemEntity) => this.mapInventoryToPanel(i));

    if (panels.length === 0) return null;

    const panelResult = this.calculatePanels(original.slabArea, panels);

    return {
      ...original,
      id: `${original.id}_${newSystem}`,
      system: newSystem,
      elements: panelResult.elements,
      totalWeight: panelResult.totalWeight,
      estimatedCost: panelResult.totalCost,
    };
  }
}
