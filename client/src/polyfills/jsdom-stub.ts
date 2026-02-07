/**
 * Browser stub for jsdom
 * Fabric.js tries to import jsdom for server-side rendering.
 * In the browser, we provide this empty stub to prevent module resolution errors.
 */

// JSDOM class stub - provides minimal interface
export class JSDOM {
  public window: Window;

  constructor() {
    // In browser, just use the actual window
    this.window = typeof window !== 'undefined' ? window : ({} as Window);
  }
}

// Default export
export default { JSDOM };
