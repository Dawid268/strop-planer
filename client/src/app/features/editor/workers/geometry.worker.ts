/// <reference lib="webworker" />

interface GeometryChunk {
  chunkIndex: number;
  totalChunks: number;
  shapes: any[];
  progress: number;
}

interface WorkerMessage {
  type: 'parse' | 'cancel';
  data?: any;
  chunkSize?: number;
}

interface WorkerResponse {
  type: 'chunk' | 'complete' | 'error' | 'progress';
  data?: GeometryChunk | any;
  error?: string;
}

let isProcessing = false;
let cancelRequested = false;

addEventListener('message', ({ data }: MessageEvent<WorkerMessage>) => {
  switch (data.type) {
    case 'parse':
      parseGeometry(data.data, data.chunkSize || 500);
      break;
    case 'cancel':
      cancelRequested = true;
      break;
  }
});

function parseGeometry(rawData: any, chunkSize: number): void {
  if (isProcessing) {
    postMessage({ type: 'error', error: 'Already processing' } as WorkerResponse);
    return;
  }

  isProcessing = true;
  cancelRequested = false;

  try {
    const polygons = rawData?.polygons || [];
    const totalShapes = polygons.length;
    const totalChunks = Math.ceil(totalShapes / chunkSize);

    postMessage({
      type: 'progress',
      data: { total: totalShapes, processed: 0, message: 'Rozpoczynam parsowanie...' }
    } as WorkerResponse);

    for (let i = 0; i < totalChunks; i++) {
      if (cancelRequested) {
        postMessage({ type: 'error', error: 'Cancelled' } as WorkerResponse);
        break;
      }

      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, totalShapes);
      const chunkPolygons = polygons.slice(start, end);

      const shapes = chunkPolygons.map((poly: any, idx: number) => {
        const globalIdx = start + idx;

        if (Array.isArray(poly) && poly.length >= 2) {
          return {
            id: `ai-poly-${globalIdx}`,
            type: 'polygon',
            points: poly.map((p: any) => ({ x: p.x, y: p.y })),
            x: 0,
            y: 0,
          };
        }

        if (poly.points && Array.isArray(poly.points)) {
          return {
            id: `ai-poly-${globalIdx}`,
            type: 'polygon',
            points: poly.points.map((p: any) => ({ x: p.x, y: p.y })),
            x: 0,
            y: 0,
          };
        }

        return null;
      }).filter(Boolean);

      const progress = Math.round(((i + 1) / totalChunks) * 100);

      postMessage({
        type: 'chunk',
        data: {
          chunkIndex: i,
          totalChunks,
          shapes,
          progress,
        }
      } as WorkerResponse);

      postMessage({
        type: 'progress',
        data: {
          total: totalShapes,
          processed: end,
          message: `Przetworzono ${end} z ${totalShapes} elementów (${progress}%)`
        }
      } as WorkerResponse);
    }

    if (!cancelRequested) {
      postMessage({ type: 'complete', data: { totalShapes } } as WorkerResponse);
    }

  } catch (error) {
    postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as WorkerResponse);
  } finally {
    isProcessing = false;
    cancelRequested = false;
  }
}
