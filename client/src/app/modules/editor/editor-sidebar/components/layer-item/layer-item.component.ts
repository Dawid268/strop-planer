import {
  Component,
  inject,
  ChangeDetectionStrategy,
  input,
  signal,
  output,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { SliderModule } from 'primeng/slider';
import { InputTextModule } from 'primeng/inputtext';
import { EditorStore } from '@stores/editor.store';
import { EditorLayer } from '@models/project.model';

@Component({
  selector: 'app-layer-item',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TooltipModule,
    ToggleSwitchModule,
    SliderModule,
    InputTextModule,
    DecimalPipe,
  ],
  templateUrl: './layer-item.component.html',
  styleUrls: ['./layer-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayerItemComponent {
  public readonly store = inject(EditorStore);

  public readonly layer = input.required<EditorLayer>();
  public readonly displayOpacity = input<number>(1);
  public readonly isActive = input<boolean>(false);

  public readonly opacityChange = output<{
    layerId: string;
    opacity: number;
  }>();
  public readonly openMenu = output<{ event: Event; layer: EditorLayer }>();

  public editingName = signal(false);
  public editingNameValue = signal('');

  public getLayerIcon(): string {
    const icons: Record<string, string> = {
      cad: 'pi-sparkles',
      system: 'pi-cog',
      user: 'pi-user',
    };
    return icons[this.layer().type] || 'pi-layers';
  }

  public getLayerTypeBadge(): { label: string; class: string } {
    const badges: Record<string, { label: string; class: string }> = {
      cad: { label: 'CAD', class: 'bg-purple-100 text-purple-700' },
      system: { label: 'System', class: 'bg-gray-100 text-gray-700' },
      user: { label: 'Własna', class: 'bg-green-100 text-green-700' },
    };
    return (
      badges[this.layer().type] || {
        label: 'Własna',
        class: 'bg-green-100 text-green-700',
      }
    );
  }

  public isLayerEditable(): boolean {
    return this.layer().type === 'user';
  }

  public isLayerRemovable(): boolean {
    return this.layer().type === 'user';
  }

  public startEditingName(): void {
    if (this.isLayerEditable()) {
      this.editingName.set(true);
      this.editingNameValue.set(this.layer().name);
    }
  }

  public saveLayerName(): void {
    const name = this.editingNameValue().trim();
    if (name) {
      this.store.renameLayer(this.layer().id, name);
    }
    this.editingName.set(false);
  }

  public onOpacityChange(opacity: number): void {
    this.opacityChange.emit({
      layerId: this.layer().id,
      opacity: opacity / 100,
    });
  }

  public onMenuOpen(event: Event): void {
    this.openMenu.emit({ event, layer: this.layer() });
  }
}
