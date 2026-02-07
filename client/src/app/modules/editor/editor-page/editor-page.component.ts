import {
  Component,
  inject,
  signal,
  OnInit,
  viewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { EditorStore } from '@stores/editor';
import { EditorToolbarComponent } from '@modules/editor/editor-toolbar/editor-toolbar.component';
import { EditorCanvasComponent } from '@modules/editor/editor-canvas/editor-canvas.component';
import { EditorSidebarComponent } from '@modules/editor/editor-sidebar/editor-sidebar.component';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import type { Shape } from '@models/editor.models';

@Component({
  selector: 'app-editor-page',
  standalone: true,
  imports: [
    CommonModule,
    EditorToolbarComponent,
    EditorCanvasComponent,
    EditorSidebarComponent,
    ButtonModule,
    ToastModule,
    ProgressSpinnerModule,
  ],
  providers: [MessageService],
  templateUrl: './editor-page.component.html',
  styleUrls: ['./editor-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly store = inject(EditorStore);
  private readonly messageService = inject(MessageService);
  protected readonly cdr = inject(ChangeDetectorRef);

  private editorCanvas = viewChild<EditorCanvasComponent>('editorCanvas');

  protected showDxf = signal(false);
  protected projectId = signal<string | null>(null);

  public toggleView(): void {
    this.showDxf.update((v) => !v);
  }

  public ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.projectId.set(id);
    if (id) {
      this.store.setProjectId(id);
    }

    const exportId = this.route.snapshot.queryParamMap.get('exportId');
    if (exportId) {
      const data = sessionStorage.getItem(exportId);
      if (data) {
        try {
          const shapes = JSON.parse(data) as Shape[];
          this.store.loadFromProject(shapes, null);
          return;
        } catch {
          // Silently ignore invalid export data - proceed with normal load
        }
      }
    }

    if (id) {
      this.store.loadEditorData(id);
    }
  }

  public onSlabSelected(shape: Shape): void {
    this.store.addShape(shape);
    this.toggleView();
    this.messageService.add({
      severity: 'info',
      summary: 'Import',
      detail: 'Zaimportowano obrys stropu',
    });
  }

  public onSave(): void {
    this.store.save();
  }

  public onRotateCanvasLeft(): void {
    const canvas = this.editorCanvas();
    if (canvas) {
      canvas.rotateCanvasLeft();
    }
  }

  onRotateCanvasRight(): void {
    const canvas = this.editorCanvas();
    if (canvas) {
      canvas.rotateCanvasRight();
    }
  }
}
