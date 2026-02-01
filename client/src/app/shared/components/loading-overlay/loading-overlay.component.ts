import { Component, input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ProgressSpinnerModule } from "primeng/progressspinner";

@Component({
  selector: "app-loading-overlay",
  standalone: true,
  imports: [CommonModule, ProgressSpinnerModule],
  templateUrl: "./loading-overlay.component.html",
  styleUrl: "./loading-overlay.component.scss",
})
export class LoadingOverlayComponent {
  public readonly visible = input(false);
  public readonly title = input("Przetwarzanie...");
  public readonly currentStep = input("");
  public readonly steps = input<string[]>([]);
  public readonly currentStepIndex = input(0);
}
