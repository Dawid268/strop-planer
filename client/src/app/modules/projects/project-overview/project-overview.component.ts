import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProjectsStore } from '@stores/projects.store';

interface ProjectShape {
  type?: string;
  catalogCode?: string;
}

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
  selector: 'app-project-overview',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    RouterLink,
    DecimalPipe,
    DatePipe,
  ],
  templateUrl: './project-overview.component.html',
  styleUrl: './project-overview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectOverviewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  public store = inject(ProjectsStore);

  projectId = this.route.snapshot.paramMap.get('id');

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
    type ResultWithShapes = { shapes?: unknown[] };
    const shapes =
      (p.optimizationResult as ResultWithShapes | undefined)?.shapes ||
      (p.calculationResult as ResultWithShapes | undefined)?.shapes ||
      (p.extractedPdfData as ResultWithShapes | undefined)?.shapes ||
      [];
    return Array.isArray(shapes) ? shapes : [];
  });

  totalElements = computed(() => this.projectShapes().length);

  estimatedCost = computed(() => {
    const shapes = this.projectShapes() as ProjectShape[];
    if (!shapes.length) return 0;

    return shapes.reduce((total: number, shape: ProjectShape) => {
      let price = 0;

      if (shape.type === 'panel') {
        price =
          PRICE_MAP[shape.catalogCode || ''] || PRICE_MAP['DEFAULT_PANEL'];
      } else if (shape.type === 'prop') {
        price = PRICE_MAP[shape.catalogCode || ''] || PRICE_MAP['DEFAULT_PROP'];
      } else if (shape.type === 'beam') {
        price = PRICE_MAP['DEFAULT_BEAM'];
      }

      return total + price;
    }, 0);
  });

  public ngOnInit(): void {
    this.loadProject();
  }

  public loadProject(): void {
    if (this.projectId) {
      this.store.loadProject(this.projectId);
    }
  }
}
