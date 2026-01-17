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
import type { InventoryItem } from '../inventory/interfaces/inventory.interface';

@Injectable()
export class FormworkService {
  private readonly logger = new Logger(FormworkService.name);

  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * Oblicza wymagany układ szalunku dla danego stropu
   */
  public calculateFormwork(
    slabData: SlabData & { points?: Array<{ x: number; y: number }> },
    params: FormworkCalculationParams,
  ): FormworkLayout {
    const system = params.preferredSystem || 'PERI_SKYDECK';

    // Pobierz elementy z magazynu
    const inventoryItems = this.inventoryService.findAll({
      system,
      isActive: true,
      minQuantity: 1,
    });

    const catalog = {
      panels: inventoryItems
        .filter((i) => i.type === 'panel')
        .map(this.mapInventoryToPanel),
      props: inventoryItems
        .filter((i) => i.type === 'prop')
        .map(this.mapInventoryToProp),
      beams: inventoryItems
        .filter((i) => i.type === 'beam')
        .map(this.mapInventoryToBeam),
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

  // Helper mappings
  private mapInventoryToPanel(item: InventoryItem): FormworkPanel {
    return {
      id: item.catalogCode,
      system: item.system as any,
      length: item.dimensions.length || 0,
      width: item.dimensions.width || 0,
      area: (item.dimensions.length! * item.dimensions.width!) / 10000,
      loadCapacity: item.loadCapacity!,
      weight: item.weight,
      dailyRentCost: item.dailyRentPrice,
    };
  }

  private mapInventoryToProp(item: InventoryItem): FormworkProp {
    // Parsowanie zakresu wysokości z nazwy lub użycie custom fields jeśli by były
    // Tutaj prosta heurystyka
    return {
      type: 'eurostempel',
      minHeight: 200,
      maxHeight: item.dimensions.height || 350,
      loadCapacity: item.loadCapacity!,
      weight: item.weight,
    };
  }

  private mapInventoryToBeam(item: InventoryItem): FormworkBeam {
    return {
      type: 'H20',
      length: item.dimensions.length || 240,
      supportSpacing: 150,
      bendingCapacity: 6.0,
    };
  }

  /**
   * Calculates panels using a grid layout strategy on the polygon
   */
  private calculatePanelsForPolygon(
    points: Array<{ x: number; y: number }>,
    availablePanels: FormworkPanel[],
    inventoryState: InventoryItem[],
  ): { elements: FormworkElement[]; totalWeight: number; totalCost: number } {
    const elements: FormworkElement[] = [];
    let totalWeight = 0;
    let totalCost = 0;

    // 1. Sort panels by size (largest first)
    const sortedPanels = [...availablePanels].sort((a, b) => b.area - a.area);
    if (sortedPanels.length === 0) return { elements, totalWeight, totalCost };

    // 2. Identify Bounding Box
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // 3. Grid Strategy
    // We try to place the largest possible panel at every grid position within the bounds
    // This is a simplified "Packing" algorithm.
    // For a real production system, we would need a proper nesting library.
    // Here we use a 50cm grid step (common module)

    const GRID_STEP = 50; // cm
    const placedRects: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
    }> = [];

    // Temporary inventory tracker
    const inventoryCounts = new Map<string, number>();
    inventoryState.forEach((i) =>
      inventoryCounts.set(i.catalogCode, i.quantityAvailable),
    );

    // Iterate through the bounding box
    for (let y = minY; y < maxY; y += GRID_STEP) {
      for (let x = minX; x < maxX; x += GRID_STEP) {
        // Skip if this spot is already covered by a placed panel
        if (
          placedRects.some(
            (r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h,
          )
        ) {
          continue;
        }

        // Try to place the largest panel that fits
        for (const panel of sortedPanels) {
          const w = panel.length; // Assume oriented horizontally first
          const h = panel.width;

          // Check available inventory
          const currentStock = inventoryCounts.get(panel.id) || 0;
          if (currentStock <= 0) continue;

          // Check if panel fits inside polygon (all 4 corners)
          // And doesn't overlap others
          if (
            this.isRectInPolygon(x, y, w, h, points) &&
            !this.isOverlapping(x, y, w, h, placedRects)
          ) {
            // PLACED!
            elements.push({
              elementType: 'panel',
              name: panel.id,
              quantity: 1,
              positionX: x / 100, // Convert cm to m for API
              positionY: y / 100,
              details: panel,
            });

            placedRects.push({ x, y, w, h });
            inventoryCounts.set(panel.id, currentStock - 1);
            totalWeight += panel.weight;
            totalCost += (panel.dailyRentCost || 0) * 30;
            break; // Move to next grid pos
          }
        }
      }
    }

    return {
      elements, // Return individual placed elements with positions
      totalWeight,
      totalCost,
    };
  }

  private isRectInPolygon(
    x: number,
    y: number,
    w: number,
    h: number,
    poly: Array<{ x: number; y: number }>,
  ): boolean {
    // Check all 4 corners
    return (
      this.isPointInPolygon(x, y, poly) &&
      this.isPointInPolygon(x + w, y, poly) &&
      this.isPointInPolygon(x, y + h, poly) &&
      this.isPointInPolygon(x + w, y + h, poly)
    );
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
        totalCost += count * (panel.dailyRentCost || 2) * 30; // koszt miesięczny
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
      totalCost += additionalCount * (smallestPanel.dailyRentCost || 2) * 30;
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
    const suitableProp =
      availableProps.find(
        (p) => p.minHeight <= requiredHeight && p.maxHeight >= requiredHeight,
      ) || availableProps[0];

    // Standardowy rozstaw podpór: 1.0-1.5m w obu kierunkach
    const propSpacing = 1.2; // m
    const propsPerM2 = 1 / (propSpacing * propSpacing);
    const propCount = Math.ceil(area * propsPerM2);

    elements.push({
      elementType: 'prop',
      name: `Stojak ${suitableProp.type} ${suitableProp.minHeight}-${suitableProp.maxHeight}`,
      quantity: propCount,
      details: suitableProp,
    });

    totalWeight = propCount * suitableProp.weight;

    // Dodaj trójnogi dla stabilizacji (co 4 stojaki)
    const tripodCount = Math.ceil(propCount / 4);
    elements.push({
      elementType: 'tripod',
      name: 'Trójnóg stabilizujący',
      quantity: tripodCount,
      details: { weight: 5 },
    });

    totalWeight += tripodCount * 5;

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

    // Dźwigary główne (wzdłuż krótszego wymiaru)
    const primaryBeam = availableBeams[0];
    const primarySpacing = 0.5; // m
    const primaryCount = Math.ceil(length / primarySpacing);

    elements.push({
      elementType: 'beam',
      name: `Dźwigar ${primaryBeam.type} L=${primaryBeam.length}cm (główny)`,
      quantity: primaryCount,
      details: primaryBeam,
    });

    totalWeight += primaryCount * (primaryBeam.length / 100) * 3.5; // ~3.5 kg/m dla H20

    // Dźwigary pomocnicze (prostopadle)
    const secondarySpacing = 0.75; // m
    const secondaryCount = Math.ceil(width / secondarySpacing);

    elements.push({
      elementType: 'beam',
      name: `Dźwigar ${primaryBeam.type} L=${primaryBeam.length}cm (pomocniczy)`,
      quantity: secondaryCount,
      details: primaryBeam,
    });

    totalWeight += secondaryCount * (primaryBeam.length / 100) * 3.5;

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
        details: { weight: 2.5 },
      });

      // Głowice krzyżowe (dla dźwigarów)
      auxiliary.push({
        elementType: 'head',
        name: 'Głowica krzyżowa',
        quantity: Math.ceil(propElement.quantity / 2),
        details: { weight: 1.8 },
      });
    }

    return auxiliary;
  }

  /**
   * Szacuje czas montażu
   */
  private estimateAssemblyTime(area: number, elementCount: number): number {
    // Średni czas: 0.3 roboczogodziny na m² + 0.05 na element
    return area * 0.3 + elementCount * 0.05;
  }

  /**
   * Optymalizuje układ szalunku
   */
  public optimize(layout: FormworkLayout): OptimizationResult {
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
          30;
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
      recommendations: this.generateRecommendations(layout, optimizedLayout),
      alternatives: this.generateAlternatives(layout),
    };
  }

  /**
   * Generuje rekomendacje optymalizacyjne
   */
  private generateRecommendations(
    original: FormworkLayout,
    optimized: FormworkLayout,
  ): string[] {
    const recommendations: string[] = [];

    // Sprawdź czy można użyć większych paneli
    const smallPanelCount = original.elements
      .filter((e) => e.elementType === 'panel')
      .reduce((sum, e) => {
        const panel = e.details as FormworkPanel;
        return panel.area < 0.75 ? sum + e.quantity : sum;
      }, 0);

    if (smallPanelCount > 10) {
      recommendations.push(
        `Rozważ zastąpienie ${smallPanelCount} małych paneli większymi formatami dla szybszego montażu`,
      );
    }

    // Sprawdź gęstość podpór
    const propElement = original.elements.find((e) => e.elementType === 'prop');
    if (propElement) {
      const propDensity = propElement.quantity / original.slabArea;
      if (propDensity > 1.2) {
        recommendations.push(
          'Gęstość podpór powyżej 1.2/m² - sprawdź możliwość zwiększenia rozstawu',
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
  private generateAlternatives(original: FormworkLayout): FormworkLayout[] {
    const alternatives: FormworkLayout[] = [];

    // Alternatywa z innym systemem
    const alternativeSystems: FormworkSystemType[] = [
      'DOKA_DOKAFLEX',
      'ULMA_ENKOFLEX',
    ];

    for (const altSystem of alternativeSystems) {
      if (altSystem !== original.system) {
        const altLayout = this.recalculateWithSystem(original, altSystem);
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
  private recalculateWithSystem(
    original: FormworkLayout,
    newSystem: FormworkSystemType,
  ): FormworkLayout | null {
    const inventoryItems = this.inventoryService.findAll({
      system: newSystem,
      isActive: true,
      minQuantity: 1,
    });

    if (inventoryItems.length === 0) {
      return null;
    }

    const panels = inventoryItems
      .filter((i) => i.type === 'panel')
      .map(this.mapInventoryToPanel);

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
