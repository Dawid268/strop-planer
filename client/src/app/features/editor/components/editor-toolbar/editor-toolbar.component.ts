import {
  Component,
  inject,
  Output,
  EventEmitter,
  effect,
  ChangeDetectionStrategy,
} from "@angular/core";
import { CommonModule, DecimalPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ButtonModule } from "primeng/button";
import { SelectButtonModule } from "primeng/selectbutton";
import { TooltipModule } from "primeng/tooltip";
import { DividerModule } from "primeng/divider";
import { TranslocoModule } from "@jsverse/transloco";
import { EditorStore } from "../../store/editor.store";
import type { EditorTool } from "../../models/editor.models";

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
    TranslocoModule,
  ],
  templateUrl: "./editor-toolbar.component.html",
  styleUrls: ["./editor-toolbar.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorToolbarComponent {
  public readonly store = inject(EditorStore);

  constructor() {
    effect(() => {
      console.log(
        "DEBUG: Toolbar isSlabDefined signal:",
        this.store.isSlabDefined(),
      );
    });
  }

  @Output() save = new EventEmitter<void>();
  @Output() rotateCanvasLeft = new EventEmitter<void>();
  @Output() rotateCanvasRight = new EventEmitter<void>();

  public toolOptions = [
    {
      value: "select",
      icon: "pi pi-arrow-up-left",
      tooltipKey: "editor.tools.select",
    },
    { value: "pan", icon: "pi pi-arrows-alt", tooltipKey: "editor.tools.pan" },
    {
      value: "add-panel",
      icon: "pi pi-th-large",
      tooltipKey: "editor.tools.addPanel",
    },
    {
      value: "add-prop",
      icon: "pi pi-stop",
      tooltipKey: "editor.tools.addProp",
    },
    {
      value: "draw-beam",
      icon: "pi pi-pencil",
      tooltipKey: "editor.tools.drawBeam",
    },
    {
      value: "draw-polygon",
      icon: "pi pi-pencil",
      tooltipKey: "editor.tools.drawPolygon",
    },
    {
      value: "trace-slab",
      icon: "pi pi-map-marker",
      tooltipKey: "editor.tools.traceSlab",
    },
  ];

  public viewModeOptions = [
    { labelKey: "editor.viewModes.full", value: "full", icon: "pi pi-image" },
    { labelKey: "editor.viewModes.slab", value: "slab", icon: "pi pi-clone" },
  ];

  public setTool(tool: EditorTool): void {
    if (tool) {
      this.store.setActiveTool(tool);
    }
  }

  public setViewMode(mode: any): void {
    if (mode) {
      this.store.setViewMode(mode);
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

  generateOptimalLayout() {
    this.store.generateOptimalLayout();
  }
}
