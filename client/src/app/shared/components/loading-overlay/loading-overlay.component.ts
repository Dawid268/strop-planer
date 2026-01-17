import { Component, input, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ProgressSpinnerModule } from "primeng/progressspinner";

@Component({
  selector: "app-loading-overlay",
  standalone: true,
  imports: [CommonModule, ProgressSpinnerModule],
  template: `
    @if (visible()) {
    <div
      class="loading-overlay fixed inset-0 z-5 flex align-items-center justify-content-center bg-white-alpha-90"
    >
      <div class="loading-content text-center max-w-25rem">
        <p-progressSpinner
          styleClass="w-4rem h-4rem mb-4"
          strokeWidth="4"
        ></p-progressSpinner>
        <h2 class="m-0 mb-2 text-900 font-medium text-2xl">{{ title() }}</h2>
        <p class="m-0 mb-5 text-600 text-lg">{{ currentStep() }}</p>

        @if (steps().length > 0) {
        <div class="steps-list flex flex-column gap-3 text-left">
          @for (step of steps(); track $index) {
          <div
            class="step flex align-items-center gap-2 transition-all transition-duration-300"
            [class.text-green-600]="$index < currentStepIndex()"
            [class.text-primary]="$index === currentStepIndex()"
            [class.text-400]="$index > currentStepIndex()"
          >
            <i
              [class]="
                'pi text-xl ' +
                ($index < currentStepIndex()
                  ? 'pi-check-circle'
                  : $index === currentStepIndex()
                  ? 'pi-spin pi-cog'
                  : 'pi-circle')
              "
            ></i>
            <span [class.font-bold]="$index === currentStepIndex()">{{
              step
            }}</span>
          </div>
          }
        </div>
        }
      </div>
    </div>
    }
  `,
  styles: [
    `
      .loading-overlay {
        z-index: 9999;
      }
    `,
  ],
})
export class LoadingOverlayComponent {
  public readonly visible = input(false);
  public readonly title = input("Przetwarzanie...");
  public readonly currentStep = input("");
  public readonly steps = input<string[]>([]);
  public readonly currentStepIndex = input(0);
}
