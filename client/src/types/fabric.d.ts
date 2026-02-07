/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-function-type */
declare module 'fabric' {
  export namespace fabric {
    export class Canvas {
      constructor(element: string | HTMLCanvasElement, options?: any);
      width?: number;
      height?: number;
      viewportTransform?: number[];
      isDragging?: boolean;
      lastPosX?: number;
      lastPosY?: number;
      selection?: boolean;
      renderOnAddRemove: boolean;
      backgroundColor: string | any;
      defaultCursor?: string;
      perPixelTargetFind?: boolean;
      targetFindTolerance?: number;
      skipOffscreen?: boolean;
      preserveObjectStacking?: boolean;
      fireMiddleClick?: boolean;
      stopContextMenu?: boolean;
      add(...objects: Object[]): Canvas;
      remove(...objects: Object[]): Canvas;
      clear(): Canvas;
      renderAll(): Canvas;
      requestRenderAll(): Canvas;
      getZoom(): number;
      setZoom(value: number): Canvas;
      zoomToPoint(point: { x: number; y: number } | any, value: number): Canvas;
      setDimensions(
        dimensions: { width: number | string; height: number | string },
        options?: any,
      ): Canvas;
      getObjects(): Object[];
      getActiveObject(): Object | null;
      getActiveObjects(): Object[];
      discardActiveObject(): Canvas;
      setActiveObject(object: Object | any): Canvas;
      setViewportTransform(vpt: number[]): Canvas;
      getWidth(): number;
      getHeight(): number;
      getCenter(): { left: number; top: number };
      getElement(): HTMLCanvasElement;
      dispose(): void;
      on(eventName: string, handler: (e: any) => void): void;
      sendToBack(object: Object): Canvas;
      bringToFront(object: Object): Canvas;
      getPointer(e: any): { x: number; y: number };
      toJSON(propertiesToInclude?: string[]): any;
      loadFromJSON(json: string | any, callback?: Function): Promise<void>;
      bringObjectToFront(object: Object): Canvas;
      setBackgroundColor(
        color: string | Pattern | any,
        callback?: Function,
        options?: any,
      ): Canvas;
      skipTargetFind?: boolean;
    }

    export class Object {
      left?: number;
      top?: number;
      width?: number;
      height?: number;
      scaleX?: number;
      scaleY?: number;
      originX?: string;
      originY?: string;
      selectable?: boolean;
      evented?: boolean;
      opacity?: number;
      visible?: boolean;
      angle?: number;
      type?: string;
      stroke?: string;
      strokeWidth?: number;
      fill?: string;
      rx?: number;
      ry?: number;
      hasControls?: boolean;
      hasBorders?: boolean;
      objectCaching?: boolean;
      data?: any;
      strokeUniform?: boolean;
      set(props: any): Object;
      set(key: string, value: any): Object;
      setCoords(): Object;
      rotate(angle: number): Object;
      clone(): Promise<Object>;
      getBoundingRect(
        absolute?: boolean,
        calculate?: boolean,
      ): {
        left: number;
        top: number;
        width: number;
        height: number;
      };
      getCenterPoint(): { x: number; y: number };
      sendToBack(): Object;
      bringToFront(): Object;
      containsPoint(point: { x: number; y: number }): boolean;
      toDataURL(options?: any): string;
    }

    export type FabricObject = Object;

    export class Point {
      constructor(x: number, y: number);
      x: number;
      y: number;
    }

    export class Line extends Object {
      constructor(points: number[], options?: any);
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }

    export class Circle extends Object {
      constructor(options?: any);
      radius: number;
    }

    export class Polyline extends Object {
      constructor(points: any[], options?: any);
      points?: any[];
    }

    export class Polygon extends Object {
      constructor(points: any[], options?: any);
    }

    export class Rect extends Object {
      constructor(options?: any);
    }

    export class Group extends Object {
      constructor(objects: Object[], options?: any);
      getObjects(): Object[];
    }

    export class Image extends Object {
      static fromURL(url: string, options?: any): Promise<Image>;
    }

    export function loadSVGFromURL(
      url: string,
    ): Promise<{ objects: Object[]; options: any }>;

    export class ActiveSelection extends Object {
      constructor(objects: Object[], options?: any);
    }

    export class Text extends Object {
      constructor(text: string, options?: any);
      text: string;
    }

    export class Pattern {
      constructor(options?: {
        source: string | HTMLImageElement | HTMLCanvasElement;
        repeat?: string;
        offsetX?: number;
        offsetY?: number;
        crossOrigin?: string;
        patternTransform?: number[];
      });
      source: string | HTMLImageElement | HTMLCanvasElement;
      repeat: string;
    }
  }
}
