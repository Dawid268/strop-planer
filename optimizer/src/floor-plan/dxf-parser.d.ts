declare module 'dxf-parser' {
  interface DxfVertex {
    x: number;
    y: number;
  }

  interface DxfEntity {
    type: string;
    layer?: string;
    vertices?: DxfVertex[];
    center?: DxfVertex;
    radius?: number;
    startPoint?: DxfVertex;
    position?: DxfVertex;
    text?: string;
    string?: string;
  }

  interface DxfParsed {
    entities?: DxfEntity[];
  }

  export default class DxfParser {
    constructor();
    parseSync(source: string): DxfParsed;
  }
}
