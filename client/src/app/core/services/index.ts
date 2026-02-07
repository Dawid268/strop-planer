/**
 * Barrel export for all services
 */
export { ErrorHandlerService } from './error-handler.service';
export { ErrorNotificationService } from './error-notification.service';
export { CanvasDrawingService } from './canvas-drawing.service';
export { CanvasHistoryService } from './canvas-history.service';
export { CanvasInteractionService } from './canvas-interaction.service';
export { CanvasRendererService } from './canvas-renderer.service';
export { CanvasSelectionService } from './canvas-selection.service';
export { CanvasEventHandlerService } from './canvas-event-handler.service';
export { CanvasShapeSyncService } from './canvas-shape-sync.service';
export { CanvasStateService } from './canvas-state.service';
export { CanvasKeyboardService } from './canvas-keyboard.service';
export { CanvasClipboardService } from './canvas-clipboard.service';
export { CanvasSlabDetectionService } from './canvas-slab-detection.service';
export { SvgParserService } from './svg-parser.service';
export { ViewportService } from './viewport.service';
export { ExportService } from './export.service';
export { CadService } from './cad.service';
export { FabricRendererService } from './fabric-renderer.service';

// Canvas sub-services
export {
  CanvasChunkService,
  CanvasRenderQueueService,
  CanvasVisibilityService,
  type ChunkBounds,
  type RenderChunk,
  type ChunkStats,
} from './canvas';
