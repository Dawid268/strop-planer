declare module 'dxf-parser' {
  export interface DxfParser {
    parseSync(source: string): any;
  }
  export class DxfParser {
    constructor();
    parseSync(source: string): any;
  }
}
