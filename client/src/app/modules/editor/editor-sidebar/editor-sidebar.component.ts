import {
  Component,
  inject,
  ChangeDetectionStrategy,
  signal,
  computed,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { AccordionModule } from "primeng/accordion";
import { ButtonModule } from "primeng/button";
import { TranslocoModule } from "@jsverse/transloco";
import { InputTextModule } from "primeng/inputtext";
import { DialogModule } from "primeng/dialog";
import { EditorStore } from "@stores/editor";
import {
  TabsPanelComponent,
  LayersPanelComponent,
  PropertiesPanelComponent,
  CatalogPanelComponent,
} from "./components";

@Component({
  selector: "app-editor-sidebar",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AccordionModule,
    ButtonModule,
    TranslocoModule,
    InputTextModule,
    DialogModule,
    TabsPanelComponent,
    LayersPanelComponent,
    PropertiesPanelComponent,
    CatalogPanelComponent,
  ],
  templateUrl: "./editor-sidebar.component.html",
  styleUrls: ["./editor-sidebar.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorSidebarComponent {
  public readonly store = inject(EditorStore);

  public showNewLayerDialog = signal(false);
  public showNewTabDialog = signal(false);
  public newLayerName = signal("");
  public newTabName = signal("");

  public openedPanels = computed(() => {
    const active = this.store.activePanel();
    // Always include 'tabs' and 'layers' as base panels,
    // but ensure 'properties' is open when it's the activePanel
    const base = ["tabs", "layers", "catalog"];
    if (active === "properties" || this.store.selectedIds().length > 0) {
      return [...base, "properties"];
    }
    return base;
  });

  public openNewLayerDialog(): void {
    this.newLayerName.set("");
    this.showNewLayerDialog.set(true);
  }

  public openNewTabDialog(): void {
    this.newTabName.set(`Strona ${this.store.tabs().length + 1}`);
    this.showNewTabDialog.set(true);
  }

  public saveAsLayer(): void {
    const name = this.newLayerName().trim();
    if (name) {
      this.store.saveSelectionAsLayer(name);
      this.showNewLayerDialog.set(false);
    }
  }

  public createEmptyLayer(): void {
    const name = this.newLayerName().trim();
    if (name) {
      this.store.createLayerInActiveTab(name, "user");
      this.showNewLayerDialog.set(false);
    }
  }

  public createNewTab(): void {
    const name = this.newTabName().trim();
    if (name) {
      const tabId = this.store.addTab(name);
      this.store.setActiveTab(tabId);
      this.showNewTabDialog.set(false);
    }
  }
}
