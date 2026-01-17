import { Component, computed, inject, OnInit } from "@angular/core";
import { CommonModule, DecimalPipe, DatePipe } from "@angular/common";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { ButtonModule } from "primeng/button";
import { CardModule } from "primeng/card";
import { ProjectsStore } from "../../store/projects.store";

const PRICE_MAP: Record<string, number> = {
  // Panels
  PANEL_120_60: 45.0,
  PANEL_90_60: 38.0,
  PANEL_150_75: 55.0,
  PANEL_125_75: 48.0,
  PANEL_100_75: 42.0,
  // Props
  PROP_PEP_20_300: 12.5,
  PROP_PEP_20_350: 14.0,
  // Beams
  BEAM_VT_20K_200: 8.0,
  BEAM_VT_20K_245: 9.5,
  // Default fallback
  DEFAULT_PANEL: 40.0,
  DEFAULT_PROP: 12.0,
  DEFAULT_BEAM: 8.0,
};

@Component({
  selector: "app-project-overview",
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    RouterLink,
    DecimalPipe,
    DatePipe,
  ],
  template: `
    <div class="project-overview-container p-4 max-w-screen-xl mx-auto">
      @if (project(); as p) {
      <header
        class="overview-header flex flex-column md:flex-row md:justify-content-between md:align-items-center gap-4 mb-5"
      >
        <div class="header-content">
          <h1 class="text-4xl font-medium text-900 m-0">{{ p.name }}</h1>
          <p class="text-600 mt-2">
            Utworzono: {{ p.createdAt | date : "mediumDate" }}
          </p>
        </div>
        <div class="header-actions">
          <p-button
            label="Otwórz Edytor"
            icon="pi pi-pencil"
            [routerLink]="['editor']"
            class="font-bold"
          ></p-button>
        </div>
      </header>

      <div class="grid">
        <!-- Stats Card -->
        <div class="col-12 md:col-8">
          <p-card header="Szacunki" styleClass="h-full shadow-2 border-none">
            <div class="flex flex-column gap-3">
              <div
                class="flex justify-content-between align-items-center py-3 border-bottom-1 border-100"
              >
                <span class="text-600">Powierzchnia stropów</span>
                <span class="text-900 font-bold text-xl"
                  >{{ p.slabArea || 0 | number : "1.0-2" }} m²</span
                >
              </div>
              <div
                class="flex justify-content-between align-items-center py-3 border-bottom-1 border-100"
              >
                <span class="text-600">Szacowany koszt (doba)</span>
                <span class="text-green-600 font-bold text-2xl"
                  >{{ estimatedCost() | number : "1.2-2" }} zł</span
                >
              </div>
              <div class="flex justify-content-between align-items-center py-3">
                <span class="text-600">Liczba elementów</span>
                <span class="text-900 font-bold text-xl">{{
                  totalElements()
                }}</span>
              </div>
            </div>
          </p-card>
        </div>

        <!-- Quick Actions -->
        <div class="col-12 md:col-4">
          <p-card
            header="Szybkie akcje"
            styleClass="h-full shadow-2 border-none"
          >
            <div class="flex flex-column gap-3 pt-2">
              <p-button
                label="Magazyn"
                icon="pi pi-briefcase"
                [routerLink]="['/inventory']"
                styleClass="p-button-secondary p-button-outlined w-full"
              ></p-button>
              <p-button
                label="Generuj Raport"
                icon="pi pi-file-pdf"
                [disabled]="true"
                styleClass="p-button-secondary p-button-outlined w-full"
              ></p-button>
            </div>
          </p-card>
        </div>
      </div>
      } @else {
      <div
        class="loading-state flex flex-column align-items-center justify-content-center p-8 text-center text-600"
      >
        <p class="text-xl mb-4 text-900">Ładowanie projektu...</p>
        <p-button
          label="Ponów próbę"
          icon="pi pi-refresh"
          (click)="loadProject()"
          class="p-button-text"
        ></p-button>
      </div>
      }
    </div>
  `,
  styles: [
    `
      .project-overview-container {
      }
    `,
  ],
})
export class ProjectOverviewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  public store = inject(ProjectsStore);

  projectId = this.route.snapshot.paramMap.get("id");

  project = computed(() => {
    const selected = this.store.selectedProject();
    if (selected && selected.id === this.projectId) {
      return selected;
    }
    return this.store.projects().find((p) => p.id === this.projectId);
  });

  private projectShapes = computed(() => {
    const p = this.project();
    if (!p) return [];
    const shapes =
      p.optimizationResult?.shapes ||
      p.calculationResult?.shapes ||
      p.extractedPdfData?.shapes ||
      (p as any)["shapes"] ||
      [];
    return Array.isArray(shapes) ? shapes : [];
  });

  totalElements = computed(() => this.projectShapes().length);

  estimatedCost = computed(() => {
    const shapes = this.projectShapes();
    if (!shapes.length) return 0;

    return shapes.reduce((total, shape) => {
      let price = 0;

      if (shape.type === "panel") {
        price = PRICE_MAP[shape.catalogCode] || PRICE_MAP["DEFAULT_PANEL"];
      } else if (shape.type === "prop") {
        price = PRICE_MAP[shape.catalogCode] || PRICE_MAP["DEFAULT_PROP"];
      } else if (shape.type === "beam") {
        price = PRICE_MAP["DEFAULT_BEAM"];
      }

      return total + price;
    }, 0);
  });

  ngOnInit() {
    this.loadProject();
  }

  loadProject() {
    if (this.projectId) {
      this.store.loadProject(this.projectId);
    }
  }
}
