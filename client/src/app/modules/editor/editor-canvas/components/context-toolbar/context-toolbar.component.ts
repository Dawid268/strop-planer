import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { ButtonModule } from "primeng/button";
import { TooltipModule } from "primeng/tooltip";

@Component({
  selector: "app-context-toolbar",
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule],
  templateUrl: "./context-toolbar.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContextToolbarComponent {
  public readonly position = input<{ x: number; y: number } | null>(null);
  public readonly objectType = input<string | null>(null);

  public readonly generateFormwork = output<void>();
  public readonly deleteItem = output<void>();
  public readonly rotateItem = output<void>();
  public readonly copyItem = output<void>();
  public readonly lockItem = output<void>();
  public readonly convertSelection = output<void>();
}
