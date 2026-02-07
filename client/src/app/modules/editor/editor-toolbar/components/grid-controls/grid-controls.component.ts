import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TranslocoModule } from '@jsverse/transloco';
import { EditorStore } from '@stores/editor.store';

@Component({
  selector: 'app-grid-controls',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule, TranslocoModule],
  templateUrl: './grid-controls.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridControlsComponent {
  public readonly store = inject(EditorStore);

  public toggleGrid(): void {
    // #region agent log
    fetch("http://127.0.0.1:7247/ingest/7133446a-8894-439e-aca5-19c6ad6230f6",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location:"grid-controls.component.ts:19",message:"toggle_grid_clicked",data:{showGrid:this.store.showGrid(),gridSize:this.store.gridSize()},timestamp:Date.now(),sessionId:"debug-session",runId:"pre-fix",hypothesisId:"H3"})}).catch(()=>{});
    // #endregion
    this.store.toggleGrid();
  }

  public toggleSnapToGrid(): void {
    // #region agent log
    fetch("http://127.0.0.1:7247/ingest/7133446a-8894-439e-aca5-19c6ad6230f6",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location:"grid-controls.component.ts:27",message:"toggle_snap_clicked",data:{snapToGrid:this.store.snapToGrid(),gridSize:this.store.gridSize()},timestamp:Date.now(),sessionId:"debug-session",runId:"pre-fix",hypothesisId:"H3"})}).catch(()=>{});
    // #endregion
    this.store.toggleSnapToGrid();
  }
}
