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
import { EditorStore } from '@stores/editor.store';
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
    // #region agent log
    window.addEventListener("error", (event) => {
      fetch("http://127.0.0.1:7247/ingest/7133446a-8894-439e-aca5-19c6ad6230f6",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location:"editor-page.component.ts:55",message:"window_error",data:{message:event.message,filename:event.filename,lineno:event.lineno,colno:event.colno},timestamp:Date.now(),sessionId:"debug-session",runId:"pre-fix",hypothesisId:"H6"})}).catch(()=>{});
    });
    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason as { message?: string; name?: string } | null;
      fetch("http://127.0.0.1:7247/ingest/7133446a-8894-439e-aca5-19c6ad6230f6",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location:"editor-page.component.ts:60",message:"unhandled_rejection",data:{name:reason?.name,reason:reason?.message},timestamp:Date.now(),sessionId:"debug-session",runId:"pre-fix",hypothesisId:"H7"})}).catch(()=>{});
    });
    // #endregion
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
