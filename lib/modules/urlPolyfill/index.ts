import { defineCageModule } from "../_mod_authoring";
import urlPolyfillCode from "./url?raw";

/**
 * URL and URLSearchParams polyfill module for the Faraday Cage sandbox environment.
 * 
 * This module provides a JavaScript polyfill implementation of the WHATWG URL API,
 * including the URL and URLSearchParams classes. Since QuickJS doesn't include
 * these Web APIs natively, this polyfill enables URL parsing and manipulation
 * within the sandboxed environment.
 * 
 * Features:
 * - Full URL parsing and manipulation (protocol, host, pathname, search, hash, etc.)
 * - URLSearchParams for query string manipulation
 * - Relative URL resolution
 * - Percent encoding/decoding
 * - Compatible with the standard WHATWG URL specification
 * 
 * **Module Loading Order**: When using both urlPolyfill and blobPolyfill together,
 * load this module first, then blobPolyfill. This ensures you get both full URL
 * parsing capabilities and blob URL methods (createObjectURL/revokeObjectURL).
 * 
 * @example
 * ```typescript
 * const cage = await FaradayCage.create({
 *   modules: [urlPolyfillModule]
 * });
 * 
 * const result = await cage.runCode(`
 *   const url = new URL('https://example.com/path?foo=bar');
 *   url.searchParams.set('baz', 'qux');
 *   url.toString(); // 'https://example.com/path?foo=bar&baz=qux'
 * `);
 * ```
 */
export default defineCageModule((ctx) => {
  ctx.vm.evalCode(urlPolyfillCode)
})
