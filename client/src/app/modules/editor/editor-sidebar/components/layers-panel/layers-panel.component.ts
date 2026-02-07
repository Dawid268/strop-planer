import {
  Component,
  inject,
  ChangeDetectionStrategy,
  signal,
  output,
  viewChild,
  ChangeDetectorRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { ButtonModule } from "primeng/button";
import { MenuModule, Menu } from "primeng/menu";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { MenuItem } from "primeng/api";
import { Subject, debounceTime, distinctUntilChanged } from "rxjs";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { EditorStore } from "@stores/editor.store";
import { EditorLayer } from "@models/project.model";
import { LayerItemComponent } from '@modules/editor/editor-sidebar/components/layer-item';
import { SelectionActionsComponent } from '@modules/editor/editor-sidebar/components/selection-actions';

@Component({
  selector: "app-layers-panel",
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    MenuModule,
    TranslocoModule,
    LayerItemComponent,
    SelectionActionsComponent,
  ],
  templateUrl: "./layers-panel.component.html",
  styleUrls: ["./layers-panel.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayersPanelComponent {
  public readonly store = inject(EditorStore);
  private readonly transloco = inject(TranslocoService);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly layerMenuRef = viewChild<Menu>("layerMenu");

  public readonly openNewLayerDialog = output<void>();

  public layerMenuLayerId = signal<string | null>(null);
  public transientOpacity = signal<Record<string, number>>({});

  private opacityUpdate$ = new Subject<{ layerId: string; opacity: number }>();

  constructor() {
    this.opacityUpdate$
      .pipe(
        debounceTime(500),
        distinctUntilChanged(
          (prev, curr) =>
            prev.layerId === curr.layerId && prev.opacity === curr.opacity,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ layerId, opacity }) => {
        this.store.setLayerOpacity(layerId, opacity);
        this.transientOpacity.update((prev) => {
          const next = { ...prev };
          delete next[layerId];
          return next;
        });
      });
  }

  public onNewLayerClick(): void {
    this.openNewLayerDialog.emit();
  }

  public onOpacityChange(event: { layerId: string; opacity: number }): void {
    this.transientOpacity.update((prev) => ({
      ...prev,
      [event.layerId]: event.opacity,
    }));
    this.opacityUpdate$.next(event);
  }

  public getDisplayOpacity(layer: EditorLayer): number {
    const transient = this.transientOpacity()[layer.id];
    return transient !== undefined ? transient : layer.opacity;
  }

  public onLayerMenuOpen(event: { event: Event; layer: EditorLayer }): void {
    if (event.layer.type !== "user") return;
    if (event.event?.target == null) return;

    // Set ID synchronously
    this.layerMenuLayerId.set(event.layer.id);

    // Force change detection so the menu items are updated based on the new ID
    this.cdr.detectChanges();

    const menu = this.layerMenuRef();
    if (menu) {
      // Toggle using the original event to allow PrimeNG to find the trigger element
      menu.toggle(event.event);
    }
  }

  public getLayerMenuItems(): MenuItem[] {
    const layerId = this.layerMenuLayerId();
    if (!layerId) return [];

    const otherTabs = this.store
      .tabs()
      .filter((t) => t.id !== this.store.activeTabId());
    const moveLabel = this.transloco.translate(
      "editor.sidebar.moveLayerToPage",
    );
    const createNewLabel = this.transloco.translate(
      "editor.sidebar.createNewPage",
    );
    const newTabName = this.transloco.translate("editor.sidebar.newPageName");
    const noOtherLabel = this.transloco.translate(
      "editor.sidebar.noOtherPages",
    );

    const subItems: MenuItem[] =
      otherTabs.length > 0
        ? otherTabs.map((t) => ({
            label: t.name,
            command: (): void => {
              this.store.moveLayerToTab(layerId, t.id);
            },
          }))
        : [{ label: noOtherLabel, disabled: true }];

    return [
      {
        label: createNewLabel,
        icon: "pi pi-plus",
        command: (): void => {
          this.store.moveLayerToNewTab(layerId, newTabName);
        },
      },
      { separator: true },
      {
        label: moveLabel,
        icon: "pi pi-arrow-right",
        items: subItems,
      },
    ];
  }

  public getEditableLayers(): EditorLayer[] {
    return this.store.activeLayers().filter((l) => l.type === "user");
  }
}
