import { Component, inject } from "@angular/core";
import { CommonModule, DecimalPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { AccordionModule } from "primeng/accordion";
import { ToggleSwitchModule } from "primeng/toggleswitch";
import { ButtonModule } from "primeng/button";
import { TooltipModule } from "primeng/tooltip";
import { EditorStore } from "../store/editor.store";
import type { LayerType } from "../models/editor.models";

@Component({
  selector: "app-editor-sidebar",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AccordionModule,
    ToggleSwitchModule,
    ButtonModule,
    TooltipModule,
    DecimalPipe,
  ],
  template: `
    <div
      class="editor-sidebar flex flex-column h-full bg-white border-left-1 border-100 overflow-y-auto w-full"
    >
      <p-accordion
        [multiple]="true"
        [value]="['layers', 'properties', 'catalog']"
        expandIcon="pi pi-chevron-down"
        collapseIcon="pi pi-chevron-up"
      >
        <!-- Layers Panel -->
        <p-accordion-panel value="layers">
          <p-accordion-header>
            <div class="flex align-items-center gap-2">
              <i class="pi pi-layers"></i>
              <span class="font-medium">Warstwy</span>
            </div>
          </p-accordion-header>
          <p-accordion-content>
            <div class="flex flex-column gap-1">
              @for (layer of store.layers(); track layer.name) {
                <div
                  class="flex align-items-center justify-content-between p-2 hover:bg-50 border-round transition-colors transition-duration-150"
                >
                  <div class="flex align-items-center gap-2">
                    <i
                      [class]="'pi ' + getLayerIcon(layer.name) + ' text-600'"
                    ></i>
                    <span class="text-sm font-medium">{{
                      getLayerLabel(layer.name)
                    }}</span>
                  </div>
                  <div class="flex align-items-center gap-2">
                    <p-toggleswitch
                      [ngModel]="layer.visible"
                      (onChange)="store.toggleLayerVisibility(layer.name)"
                      pTooltip="Widoczność"
                      tooltipPosition="left"
                    ></p-toggleswitch>
                    <p-button
                      [icon]="layer.locked ? 'pi pi-lock' : 'pi pi-lock-open'"
                      [text]="true"
                      [severity]="layer.locked ? 'danger' : 'secondary'"
                      [rounded]="true"
                      (click)="store.toggleLayerLock(layer.name)"
                    ></p-button>
                  </div>
                </div>
              }
            </div>
          </p-accordion-content>
        </p-accordion-panel>

        <!-- Properties Panel -->
        <p-accordion-panel value="properties">
          <p-accordion-header>
            <div class="flex align-items-center gap-2">
              <i class="pi pi-sliders-h"></i>
              <span class="font-medium">Właściwości</span>
            </div>
          </p-accordion-header>
          <p-accordion-content>
            @if (store.selectedShapes().length === 0) {
              <p class="m-0 text-sm text-600 text-center py-4 italic">
                Brak zaznaczenia
              </p>
            } @else if (store.selectedShapes().length === 1) {
              @let shape = store.selectedShapes()[0];
              <div class="flex flex-column gap-3">
                <div
                  class="flex justify-content-between align-items-center text-sm"
                >
                  <span class="text-600">Typ:</span>
                  <span class="font-bold text-900">{{ shape.type }}</span>
                </div>
                <div
                  class="flex justify-content-between align-items-center text-sm"
                >
                  <span class="text-600">X:</span>
                  <span class="font-bold text-900 font-mono"
                    >{{ shape.x | number: "1.0-0" }} mm</span
                  >
                </div>
                <div
                  class="flex justify-content-between align-items-center text-sm"
                >
                  <span class="text-600">Y:</span>
                  <span class="font-bold text-900 font-mono"
                    >{{ shape.y | number: "1.0-0" }} mm</span
                  >
                </div>
                <div
                  class="flex justify-content-between align-items-center text-sm"
                >
                  <span class="text-600">Rotacja:</span>
                  <span class="font-bold text-900 font-mono"
                    >{{ shape.rotation }}°</span
                  >
                </div>
              </div>
            } @else {
              <p class="m-0 text-sm text-600 text-center py-4">
                Zaznaczono
                <span class="font-bold text-primary">{{
                  store.selectedShapes().length
                }}</span>
                elementów
              </p>
            }
          </p-accordion-content>
        </p-accordion-panel>

        <!-- Catalog Panel -->
        <p-accordion-panel value="catalog">
          <p-accordion-header>
            <div class="flex align-items-center gap-2">
              <i class="pi pi-box"></i>
              <span class="font-medium">Katalog</span>
            </div>
          </p-accordion-header>
          <p-accordion-content>
            <div class="flex flex-column gap-1">
              <div
                class="catalog-item flex align-items-center gap-3 p-3 border-round hover:bg-100 cursor-pointer transition-colors transition-duration-150"
                (click)="
                  selectCatalogItem('PANEL_120_60', 'Panel 120x60', 120, 60)
                "
              >
                <i class="pi pi-th-large text-xl text-primary"></i>
                <div class="flex flex-column overflow-hidden">
                  <span class="text-sm font-bold text-900 truncate"
                    >Panel 120x60</span
                  >
                  <span class="text-xs text-600">PERI MULTIFLEX</span>
                </div>
              </div>

              <div
                class="catalog-item flex align-items-center gap-3 p-3 border-round hover:bg-100 cursor-pointer transition-colors transition-duration-150"
                (click)="
                  selectCatalogItem('PANEL_90_60', 'Panel 90x60', 90, 60)
                "
              >
                <i class="pi pi-th-large text-xl text-primary"></i>
                <div class="flex flex-column overflow-hidden">
                  <span class="text-sm font-bold text-900 truncate"
                    >Panel 90x60</span
                  >
                  <span class="text-xs text-600">PERI MULTIFLEX</span>
                </div>
              </div>

              <div
                class="catalog-item flex align-items-center gap-3 p-3 border-round hover:bg-100 cursor-pointer transition-colors transition-duration-150"
                (click)="
                  selectCatalogItem(
                    'PROP_PEP_20_300',
                    'Stempel PEP 20-300',
                    20,
                    20,
                    'prop'
                  )
                "
              >
                <i class="pi pi-stop text-xl text-primary"></i>
                <div class="flex flex-column overflow-hidden">
                  <span class="text-sm font-bold text-900 truncate"
                    >Stempel PEP 20-300</span
                  >
                  <span class="text-xs text-600">PERI</span>
                </div>
              </div>
            </div>
          </p-accordion-content>
        </p-accordion-panel>
      </p-accordion>
    </div>
  `,
  styles: [
    `
      .editor-sidebar {
      }
      ::ng-deep .p-accordion-header {
        background: transparent !important;
        border: none !important;
        padding: 1rem !important;
      }
      ::ng-deep .p-accordion-content {
        border: none !important;
        padding: 0 1rem 1rem 1rem !important;
      }
    `,
  ],
})
export class EditorSidebarComponent {
  public readonly store = inject(EditorStore);

  public getLayerIcon(layer: LayerType): string {
    const icons: Record<LayerType, string> = {
      slab: "pi-clone",
      beams: "pi-minus",
      formwork: "pi-th-large",
      annotations: "pi-language",
    };
    return icons[layer] || "pi-layers";
  }

  public getLayerLabel(layer: LayerType): string {
    const labels: Record<LayerType, string> = {
      slab: "Strop",
      beams: "Belki",
      formwork: "Szalunki",
      annotations: "Adnotacje",
    };
    return labels[layer];
  }

  public selectCatalogItem(
    code: string,
    name: string,
    width: number,
    length: number,
    type: "panel" | "prop" = "panel",
  ): void {
    this.store.setActiveCatalogItem({
      code,
      name,
      width,
      length,
      manufacturer: "PERI",
      system: "MULTIFLEX",
      type,
    });
  }
}
