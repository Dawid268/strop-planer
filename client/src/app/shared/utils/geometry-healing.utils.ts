import { CanvasPoint, getDistance } from "./canvas.utils";

export interface Segment {
  p1: CanvasPoint;
  p2: CanvasPoint;
}

/**
 * Attempts to merge multiple segments into a single closed sequence of points.
 * Useful for creating a Slab polygon from individual CAD lines.
 */
export function mergeSegmentsToPolygon(
  segments: Segment[],
  tolerance: number = 5,
): CanvasPoint[] {
  if (segments.length === 0) return [];

  // 1. Build a pool of remaining segments
  const pool = [...segments];
  const points: CanvasPoint[] = [];

  // Start with the first segment
  const first = pool.shift()!;
  points.push(first.p1, first.p2);

  let changed = true;
  while (changed && pool.length > 0) {
    changed = false;
    const lastPoint = points[points.length - 1];

    for (let i = 0; i < pool.length; i++) {
      const segment = pool[i];

      // Check distance to p1
      if (getDistance(lastPoint, segment.p1) <= tolerance) {
        points.push(segment.p2);
        pool.splice(i, 1);
        changed = true;
        break;
      }

      // Check distance to p2
      if (getDistance(lastPoint, segment.p2) <= tolerance) {
        points.push(segment.p1);
        pool.splice(i, 1);
        changed = true;
        break;
      }
    }
  }

  // Check if it's closed (last point matches first point)
  if (points.length > 2) {
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    if (getDistance(firstPoint, lastPoint) <= tolerance) {
      // Remove last redundant point if it's too close to the first
      points.pop();
    }
  }

  return points;
}

/**
 * Heals a set of points by snapping nearby vertices together.
 */
export function healPoints(
  points: CanvasPoint[],
  tolerance: number = 5,
): CanvasPoint[] {
  if (points.length < 2) return points;

  const result: CanvasPoint[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];

    if (getDistance(prev, curr) > tolerance) {
      result.push(curr);
    }
  }

  return result;
}
