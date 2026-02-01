import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { Shape, Point } from '../models/editor.models';

export interface ParsedSvgShape {
  id: string;
  type: 'polygon' | 'path' | 'rectangle' | 'line';
  points: Point[];
  x: number;
  y: number;
  width?: number;
  height?: number;
  originalPath?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SvgParserService {
  private readonly http = inject(HttpClient);

  /**
   * Fetches an SVG from URL and parses it into editable shapes
   */
  parseFromUrl(svgUrl: string): Observable<Shape[]> {
    return this.http
      .get(svgUrl, { responseType: 'text' })
      .pipe(map((svgContent) => this.parseSvgContent(svgContent)));
  }

  /**
   * Parses SVG content string into shapes
   */
  parseSvgContent(svgContent: string): Shape[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const shapes: Shape[] = [];

    // Get all path elements
    const paths = doc.querySelectorAll('path');
    paths.forEach((pathEl, index) => {
      const d = pathEl.getAttribute('d');
      if (d) {
        const shape = this.parsePathToShape(d, `svg-path-${index}`);
        if (shape) {
          shapes.push(shape);
        }
      }
    });

    // Get all rect elements
    const rects = doc.querySelectorAll('rect');
    rects.forEach((rectEl, index) => {
      const shape = this.parseRectToShape(rectEl, `svg-rect-${index}`);
      if (shape) {
        shapes.push(shape);
      }
    });

    // Get all line elements
    const lines = doc.querySelectorAll('line');
    lines.forEach((lineEl, index) => {
      const shape = this.parseLineToShape(lineEl, `svg-line-${index}`);
      if (shape) {
        shapes.push(shape);
      }
    });

    // Get all polygon elements
    const polygons = doc.querySelectorAll('polygon');
    polygons.forEach((polyEl, index) => {
      const shape = this.parsePolygonToShape(polyEl, `svg-polygon-${index}`);
      if (shape) {
        shapes.push(shape);
      }
    });

    // Get all polyline elements
    const polylines = doc.querySelectorAll('polyline');
    polylines.forEach((polyEl, index) => {
      const shape = this.parsePolylineToShape(polyEl, `svg-polyline-${index}`);
      if (shape) {
        shapes.push(shape);
      }
    });

    console.log(`Parsed ${shapes.length} shapes from SVG`);
    return shapes;
  }

  /**
   * Parse SVG path d attribute into a shape
   */
  private parsePathToShape(d: string, id: string): Shape | null {
    const points = this.parsePathD(d);
    if (points.length < 2) return null;

    // Check if path forms a closed polygon
    const isPolygon = this.isClosedPath(d) || points.length >= 3;

    // Calculate bounding box
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);

    // Normalize points relative to minX, minY
    const normalizedPoints = points.map((p) => ({
      x: p.x - minX,
      y: p.y - minY,
    }));

    return {
      id,
      type: isPolygon ? 'polygon' : 'rectangle',
      x: minX,
      y: minY,
      rotation: 0,
      selected: false,
      locked: false,
      layer: 'slab',
      points: normalizedPoints,
      properties: {
        originalPath: d,
        isFromSvg: true,
      },
    } as Shape;
  }

  /**
   * Parse SVG path 'd' attribute into array of points
   */
  private parsePathD(d: string): Point[] {
    const points: Point[] = [];
    const commands =
      d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];

    let currentX = 0;
    let currentY = 0;

    for (const cmd of commands) {
      const type = cmd[0];
      const params = cmd
        .slice(1)
        .trim()
        .split(/[\s,]+/)
        .filter((s) => s)
        .map(Number);

      switch (type) {
        case 'M': // Move to absolute
          if (params.length >= 2) {
            currentX = params[0];
            currentY = params[1];
            points.push({ x: currentX, y: currentY });
            // Additional pairs are treated as line-to
            for (let i = 2; i < params.length; i += 2) {
              if (i + 1 < params.length) {
                currentX = params[i];
                currentY = params[i + 1];
                points.push({ x: currentX, y: currentY });
              }
            }
          }
          break;

        case 'm': // Move to relative
          if (params.length >= 2) {
            currentX += params[0];
            currentY += params[1];
            points.push({ x: currentX, y: currentY });
            for (let i = 2; i < params.length; i += 2) {
              if (i + 1 < params.length) {
                currentX += params[i];
                currentY += params[i + 1];
                points.push({ x: currentX, y: currentY });
              }
            }
          }
          break;

        case 'L': // Line to absolute
          for (let i = 0; i < params.length; i += 2) {
            if (i + 1 < params.length) {
              currentX = params[i];
              currentY = params[i + 1];
              points.push({ x: currentX, y: currentY });
            }
          }
          break;

        case 'l': // Line to relative
          for (let i = 0; i < params.length; i += 2) {
            if (i + 1 < params.length) {
              currentX += params[i];
              currentY += params[i + 1];
              points.push({ x: currentX, y: currentY });
            }
          }
          break;

        case 'H': // Horizontal line absolute
          for (const x of params) {
            currentX = x;
            points.push({ x: currentX, y: currentY });
          }
          break;

        case 'h': // Horizontal line relative
          for (const dx of params) {
            currentX += dx;
            points.push({ x: currentX, y: currentY });
          }
          break;

        case 'V': // Vertical line absolute
          for (const y of params) {
            currentY = y;
            points.push({ x: currentX, y: currentY });
          }
          break;

        case 'v': // Vertical line relative
          for (const dy of params) {
            currentY += dy;
            points.push({ x: currentX, y: currentY });
          }
          break;

        case 'Z':
        case 'z':
          // Close path - no new point
          break;

        // For curves, we'll just take the endpoint
        case 'C': // Cubic bezier absolute
          for (let i = 0; i < params.length; i += 6) {
            if (i + 5 < params.length) {
              currentX = params[i + 4];
              currentY = params[i + 5];
              points.push({ x: currentX, y: currentY });
            }
          }
          break;

        case 'c': // Cubic bezier relative
          for (let i = 0; i < params.length; i += 6) {
            if (i + 5 < params.length) {
              currentX += params[i + 4];
              currentY += params[i + 5];
              points.push({ x: currentX, y: currentY });
            }
          }
          break;
      }
    }

    return points;
  }

  private isClosedPath(d: string): boolean {
    return d.toLowerCase().includes('z');
  }

  private parseRectToShape(rectEl: Element, id: string): Shape | null {
    const x = parseFloat(rectEl.getAttribute('x') || '0');
    const y = parseFloat(rectEl.getAttribute('y') || '0');
    const width = parseFloat(rectEl.getAttribute('width') || '0');
    const height = parseFloat(rectEl.getAttribute('height') || '0');

    if (width === 0 || height === 0) return null;

    return {
      id,
      type: 'polygon',
      x,
      y,
      rotation: 0,
      selected: false,
      locked: false,
      layer: 'slab',
      points: [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height },
      ],
      properties: { isFromSvg: true },
    } as Shape;
  }

  private parseLineToShape(lineEl: Element, id: string): Shape | null {
    const x1 = parseFloat(lineEl.getAttribute('x1') || '0');
    const y1 = parseFloat(lineEl.getAttribute('y1') || '0');
    const x2 = parseFloat(lineEl.getAttribute('x2') || '0');
    const y2 = parseFloat(lineEl.getAttribute('y2') || '0');

    return {
      id,
      type: 'polygon',
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      rotation: 0,
      selected: false,
      locked: false,
      layer: 'slab',
      points: [
        { x: x1 - Math.min(x1, x2), y: y1 - Math.min(y1, y2) },
        { x: x2 - Math.min(x1, x2), y: y2 - Math.min(y1, y2) },
      ],
      properties: { isFromSvg: true },
    } as Shape;
  }

  private parsePolygonToShape(polyEl: Element, id: string): Shape | null {
    const pointsAttr = polyEl.getAttribute('points');
    if (!pointsAttr) return null;

    const points = this.parsePointsAttribute(pointsAttr);
    if (points.length < 3) return null;

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);

    return {
      id,
      type: 'polygon',
      x: minX,
      y: minY,
      rotation: 0,
      selected: false,
      locked: false,
      layer: 'slab',
      points: points.map((p) => ({ x: p.x - minX, y: p.y - minY })),
      properties: { isFromSvg: true },
    } as Shape;
  }

  private parsePolylineToShape(polyEl: Element, id: string): Shape | null {
    const pointsAttr = polyEl.getAttribute('points');
    if (!pointsAttr) return null;

    const points = this.parsePointsAttribute(pointsAttr);
    if (points.length < 2) return null;

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);

    return {
      id,
      type: 'polygon',
      x: minX,
      y: minY,
      rotation: 0,
      selected: false,
      locked: false,
      layer: 'slab',
      points: points.map((p) => ({ x: p.x - minX, y: p.y - minY })),
      properties: { isFromSvg: true },
    } as Shape;
  }

  private parsePointsAttribute(pointsAttr: string): Point[] {
    const points: Point[] = [];
    const pairs = pointsAttr.trim().split(/[\s,]+/);

    for (let i = 0; i < pairs.length - 1; i += 2) {
      const x = parseFloat(pairs[i]);
      const y = parseFloat(pairs[i + 1]);
      if (!isNaN(x) && !isNaN(y)) {
        points.push({ x, y });
      }
    }

    return points;
  }
}
