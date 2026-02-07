/**
 * Browser-safe Fabric.js import wrapper
 * This module ensures proper initialization of fabric without jsdom dependencies
 */

// Set up browser environment to prevent jsdom loading
if (typeof window !== 'undefined') {
  // Mark that we're in a browser environment
  (globalThis as unknown as { document: unknown }).document =
    (globalThis as unknown as { document: unknown }).document || window.document;
}

// Re-export fabric
// eslint-disable-next-line @typescript-eslint/no-require-imports
export { fabric } from 'fabric';
