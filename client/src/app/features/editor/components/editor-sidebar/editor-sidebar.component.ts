import {
  Component,
  inject,
  ChangeDetectionStrategy,
  signal,
} from "@angular/core";
import { CommonModule, DecimalPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { AccordionModule } from "primeng/accordion";
import { ToggleSwitchModule } from "primeng/toggleswitch";
import { SliderModule } from "primeng/slider";
import { ButtonModule } from "primeng/button";
import { TooltipModule } from "primeng/tooltip";
import { TranslocoModule } from "@jsverse/transloco";
import { InputTextModule } from "primeng/inputtext";
import { MenuModule } from "primeng/menu";
import { DialogModule } from "primeng/dialog";
import { EditorStore } from "../../store/editor.store";
import type { LayerState } from "../../models/editor.models";

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
    TranslocoModule,
    SliderModule,
    DecimalPipe,
    InputTextModule,
    MenuModule,
    DialogModule,
  ],
  templateUrl: "./editor-sidebar.component.html",
  styleUrls: ["./editor-sidebar.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorSidebarComponent {
  public readonly store = inject(EditorStore);

  /** Dialog state for creating/renaming layers */
  public showNewLayerDialog = signal(false);
  public newLayerName = signal("");
  public editingLayerId = signal<string | null>(null);

  /** Show move to layer dropdown */
  public showMoveToLayerMenu = signal(false);

  public getLayerIcon(layer: LayerState): string {
    const icons: Record<string, string> = {
      slab: "pi-clone",
      beams: "pi-minus",
      formwork: "pi-th-large",
      annotations: "pi-language",
    };
    return icons[layer.id] || "pi-layers";
  }

  public getCategoryBadge(category: string): {
    label: string;
    severity: string;
  } {
    const badges: Record<string, { label: string; severity: string }> = {
      system: { label: "System", severity: "secondary" },
      data: { label: "Dane", severity: "info" },
      user: { label: "Własna", severity: "success" },
    };
    return badges[category] || { label: category, severity: "secondary" };
  }

  /** Open dialog for new layer */
  public openNewLayerDialog(): void {
    this.newLayerName.set("");
    this.editingLayerId.set(null);
    this.showNewLayerDialog.set(true);
  }

  /** Save selection as new layer */
  public saveAsLayer(): void {
    const name = this.newLayerName().trim();
    if (name) {
      this.store.saveSelectionAsLayer(name);
      this.showNewLayerDialog.set(false);
    }
  }

  /** Create empty layer */
  public createEmptyLayer(): void {
    const name = this.newLayerName().trim();
    if (name) {
      this.store.createLayer(name);
      this.showNewLayerDialog.set(false);
    }
  }

  /** Start editing layer name */
  public startEditingLayerName(layerId: string): void {
    const layer = this.store.layers().find((l) => l.id === layerId);
    if (layer?.isEditable) {
      this.editingLayerId.set(layerId);
      this.newLayerName.set(layer.name);
    }
  }

  /** Save edited layer name */
  public saveLayerName(layerId: string): void {
    const name = this.newLayerName().trim();
    if (name) {
      this.store.renameLayer(layerId, name);
    }
    this.editingLayerId.set(null);
  }

  /** Get editable layers for "move to layer" dropdown */
  public getEditableLayers(): LayerState[] {
    return this.store
      .layers()
      .filter((l) => l.category !== "system" || l.id === "annotations");
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
