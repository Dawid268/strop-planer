// Browser stub for jsdom to prevent module resolution errors.
export class JSDOM {
  constructor() {
    this.window = typeof window !== 'undefined' ? window : {};
  }
}

export default { JSDOM };
