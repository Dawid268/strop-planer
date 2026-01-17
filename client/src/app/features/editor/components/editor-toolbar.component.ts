import { Component, inject, Output, EventEmitter } from "@angular/core";
import { CommonModule, DecimalPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ButtonModule } from "primeng/button";
import { SelectButtonModule } from "primeng/selectbutton";
import { TooltipModule } from "primeng/tooltip";
import { DividerModule } from "primeng/divider";
import { EditorStore } from "../store/editor.store";
import type { EditorTool } from "../models/editor.models";

@Component({
  selector: "app-editor-toolbar",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    SelectButtonModule,
    TooltipModule,
    DividerModule,
    DecimalPipe,
  ],
  template: `
    <div
      class="editor-toolbar flex align-items-center gap-2 p-2 bg-white border-bottom-1 border-100 shadow-1"
    >
      <!-- Tools -->
      <p-selectButton
        [options]="toolOptions"
        [ngModel]="store.activeTool()"
        (ngModelChange)="setTool($event)"
        class="tool-group"
      >
        <ng-template pTemplate="item" let-item>
          <i
            [class]="item.icon"
            [pTooltip]="item.tooltip"
            tooltipPosition="bottom"
          ></i>
        </ng-template>
      </p-selectButton>

      <p-button
        icon="pi pi-wand"
        [text]="true"
        [rounded]="true"
        pTooltip="Auto-Rozmieść (Generuj)"
        tooltipPosition="bottom"
        (click)="generateAutoLayout()"
        [disabled]="!store.shapes().length"
      ></p-button>

      <p-button
        icon="pi pi-qrcode"
        [text]="true"
        [rounded]="true"
        pTooltip="Auto-Trace PDF (Wektoryzacja)"
        tooltipPosition="bottom"
        (click)="store.autoTracePdf()"
        [disabled]="!store.backgroundUrl || !store.backgroundUrl()"
      ></p-button>

      <p-divider layout="vertical"></p-divider>

      <!-- Zoom controls -->
      <div class="zoom-controls flex align-items-center gap-1">
        <p-button
          icon="pi pi-minus"
          [text]="true"
          [rounded]="true"
          (click)="zoomOut()"
          pTooltip="Oddal"
          tooltipPosition="bottom"
        ></p-button>
        <span
          class="zoom-label text-sm text-600 font-medium px-2 min-w-4rem text-center"
          >{{ store.zoom() * 100 | number: "1.0-0" }}%</span
        >
        <p-button
          icon="pi pi-plus"
          [text]="true"
          [rounded]="true"
          (click)="zoomIn()"
          pTooltip="Przybliż"
          tooltipPosition="bottom"
        ></p-button>
        <p-button
          icon="pi pi-expand"
          [text]="true"
          [rounded]="true"
          (click)="resetView()"
          pTooltip="Resetuj widok"
          tooltipPosition="bottom"
        ></p-button>
      </div>

      <p-divider layout="vertical"></p-divider>

      <!-- Grid & Snap -->
      <div class="grid-controls flex gap-1">
        <p-button
          [icon]="store.showGrid() ? 'pi pi-th-large' : 'pi pi-table'"
          [text]="true"
          [rounded]="true"
          [severity]="store.showGrid() ? 'primary' : 'secondary'"
          (click)="store.toggleGrid()"
          pTooltip="Pokaż/ukryj siatkę"
          tooltipPosition="bottom"
        ></p-button>
        <p-button
          icon="pi pi-magnet"
          [text]="true"
          [rounded]="true"
          [severity]="store.snapToGrid() ? 'primary' : 'secondary'"
          (click)="store.toggleSnapToGrid()"
          pTooltip="Przyciągaj do siatki (G)"
          tooltipPosition="bottom"
        ></p-button>
      </div>

      <p-divider layout="vertical"></p-divider>

      <!-- Canvas Rotation -->
      <div class="rotation-controls flex gap-1">
        <p-button
          icon="pi pi-undo"
          [text]="true"
          [rounded]="true"
          (click)="rotateCanvasLeft.emit()"
          pTooltip="Obróć w lewo 90°"
          tooltipPosition="bottom"
        ></p-button>
        <p-button
          icon="pi pi-refresh"
          [text]="true"
          [rounded]="true"
          (click)="rotateCanvasRight.emit()"
          pTooltip="Obróć w prawo 90°"
          tooltipPosition="bottom"
        ></p-button>
      </div>

      <!-- Spacer -->
      <div class="flex-grow-1"></div>

      <!-- Projected Content (e.g. DXF toggle) -->
      <ng-content></ng-content>

      <p-divider layout="vertical"></p-divider>

      <!-- Actions -->
      <p-button
        label="Zapisz"
        icon="pi pi-save"
        (click)="save.emit()"
        class="font-bold"
      ></p-button>

      <!-- Info -->
      <div
        class="selection-info text-sm text-600 px-2 border-left-1 border-100 ml-2"
      >
        @if (store.selectedIds().length > 0) {
          <span>Zaznaczono: {{ store.selectedIds().length }}</span>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .editor-toolbar {
        z-index: 100;
      }
      ::ng-deep .tool-group .p-button {
        padding: 0.5rem;
      }
    `,
  ],
})
export class EditorToolbarComponent {
  public readonly store = inject(EditorStore);

  @Output() save = new EventEmitter<void>();
  @Output() rotateCanvasLeft = new EventEmitter<void>();
  @Output() rotateCanvasRight = new EventEmitter<void>();

  public toolOptions = [
    { value: "select", icon: "pi pi-arrow-up-left", tooltip: "Zaznacz (V)" },
    { value: "pan", icon: "pi pi-arrows-alt", tooltip: "Przesuń widok (H)" },
    {
      value: "add-panel",
      icon: "pi pi-th-large",
      tooltip: "Dodaj panel szalunkowy (P)",
    },
    { value: "add-prop", icon: "pi pi-stop", tooltip: "Dodaj podporę (S)" },
    { value: "draw-beam", icon: "pi pi-minus", tooltip: "Rysuj belkę (B)" },
    {
      value: "draw-polygon",
      icon: "pi pi-pencil",
      tooltip: "Rysuj strop (Wielokąt)",
    },
  ];

  public setTool(tool: EditorTool): void {
    if (tool) {
      this.store.setActiveTool(tool);
    }
  }

  public zoomIn(): void {
    this.store.setZoom(this.store.zoom() + 0.1);
  }

  public zoomOut(): void {
    this.store.setZoom(this.store.zoom() - 0.1);
  }

  public resetView(): void {
    this.store.resetView();
  }

  generateAutoLayout() {
    this.store.generateAutoLayout();
  }
}
