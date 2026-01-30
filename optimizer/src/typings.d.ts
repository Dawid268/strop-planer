declare module 'dxf-parser' {
  export interface DxfVertex {
    x: number;
    y: number;
    z?: number;
  }

  export interface DxfEntity {
    type: string;
    layer: string;
    vertices?: DxfVertex[];
    center?: DxfVertex;
    radius?: number;
    startPoint?: DxfVertex;
    endPoint?: DxfVertex;
    position?: DxfVertex;
    text?: string;
    string?: string;
    [key: string]: unknown;
  }

  export interface DxfObject {
    entities: DxfEntity[];
    header?: Record<string, unknown>;
    tables?: Record<string, unknown>;
    blocks?: Record<string, unknown>;
  }

  export default class DxfParser {
    parseSync(source: string): DxfObject;
  }
}

declare module 'pdf-parse' {
  interface PdfParseOptions {
    pagerender?: (pageData: unknown) => string;
    max?: number;
    version?: string;
  }

  interface PdfData {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    text: string;
    version: string;
  }

  function pdf(dataBuffer: Buffer, options?: PdfParseOptions): Promise<PdfData>;
  export = pdf;
}
