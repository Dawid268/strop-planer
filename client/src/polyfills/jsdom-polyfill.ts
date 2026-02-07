/**
 * Browser-safe polyfill for jsdom
 * This prevents runtime errors when fabric.js tries to import jsdom in the browser
 */

// Export an empty object to satisfy imports
export const JSDOM = null;
export default {};
