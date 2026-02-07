/// <reference lib="webworker" />

interface Point {
  x: number;
  y: number;
}

interface LineData {
  a: Point;
  b: Point;
}

interface PolygonData {
  points?: Point[];
}

interface RawGeometryData {
  lines?: LineData[];
  polygons?: (Point[] | PolygonData)[];
}

interface GeometryShape {
  id: string;
  type: string;
  points: Point[];
  x: number;
  y: number;
}

interface GeometryChunk {
  chunkIndex: number;
  totalChunks: number;
  shapes: GeometryShape[];
  progress: number;
}

interface ProgressData {
  total: number;
  processed: number;
  message: string;
}

interface CompleteData {
  totalShapes: number;
}

interface WorkerMessage {
  type: 'parse' | 'cancel';
  data?: RawGeometryData;
  chunkSize?: number;
}

interface WorkerResponse {
  type: 'chunk' | 'complete' | 'error' | 'progress';
  data?: GeometryChunk | ProgressData | CompleteData;
  error?: string;
}

let isProcessing = false;
let cancelRequested = false;

addEventListener('message', ({ data }: MessageEvent<WorkerMessage>) => {
  switch (data.type) {
    case 'parse':
      if (data.data) {
        parseGeometry(data.data, data.chunkSize || 500);
      }
      break;
    case 'cancel':
      cancelRequested = true;
      break;
  }
});

function parseGeometry(rawData: RawGeometryData, chunkSize: number): void {
  if (isProcessing) {
    postMessage({
      type: 'error',
      error: 'Already processing',
    } as WorkerResponse);
    return;
  }

  isProcessing = true;
  cancelRequested = false;

  try {
    const polygons = rawData?.lines?.length
      ? rawData.lines.map(
          (l: { a: { x: number; y: number }; b: { x: number; y: number } }) => [
            l.a,
            l.b,
          ],
        )
      : rawData?.polygons || [];
    const totalShapes = polygons.length;
    const totalChunks = Math.ceil(totalShapes / chunkSize);

    postMessage({
      type: 'progress',
      data: {
        total: totalShapes,
        processed: 0,
        message: 'Rozpoczynam parsowanie...',
      },
    } as WorkerResponse);

    for (let i = 0; i < totalChunks; i++) {
      if (cancelRequested) {
        postMessage({ type: 'error', error: 'Cancelled' } as WorkerResponse);
        break;
      }

      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, totalShapes);
      const chunkPolygons = polygons.slice(start, end);

      const shapes = chunkPolygons
        .map(
          (poly: Point[] | PolygonData, idx: number): GeometryShape | null => {
            const globalIdx = start + idx;

            if (Array.isArray(poly) && poly.length >= 2) {
              return {
                id: `ai-poly-${globalIdx}`,
                type: 'polygon',
                points: poly.map((p: Point) => ({ x: p.x, y: p.y })),
                x: 0,
                y: 0,
              };
            }

            const polyData = poly as PolygonData;
            if (polyData.points && Array.isArray(polyData.points)) {
              return {
                id: `ai-poly-${globalIdx}`,
                type: 'polygon',
                points: polyData.points.map((p: Point) => ({ x: p.x, y: p.y })),
                x: 0,
                y: 0,
              };
            }

            return null;
          },
        )
        .filter((shape): shape is GeometryShape => shape !== null);

      const progress = Math.round(((i + 1) / totalChunks) * 100);

      postMessage({
        type: 'chunk',
        data: {
          chunkIndex: i,
          totalChunks,
          shapes,
          progress,
        },
      } as WorkerResponse);

      postMessage({
        type: 'progress',
        data: {
          total: totalShapes,
          processed: end,
          message: `Przetworzono ${end} z ${totalShapes} elementów (${progress}%)`,
        },
      } as WorkerResponse);
    }

    if (!cancelRequested) {
      postMessage({
        type: 'complete',
        data: { totalShapes },
      } as WorkerResponse);
    }
  } catch (error) {
    postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    } as WorkerResponse);
  } finally {
    isProcessing = false;
    cancelRequested = false;
  }
}
