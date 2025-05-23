import { defineCageModule, defineSandboxFunctionRaw } from "..";
import blobPolyfillCode from "./blob?raw";

/**
 * Blob API polyfill module for the Faraday Cage sandbox environment.
 * 
 * This module provides:
 * - Blob, File, and FileReader constructors via a JavaScript polyfill
 * - URL.createObjectURL() and URL.revokeObjectURL() for blob URL handling
 * - Native implementations of `atob` and `btoa` for Base64 encoding/decoding
 * 
 * The polyfill enables file and binary data handling in the QuickJS environment
 * which doesn't have these Web APIs built-in. The atob/btoa functions bridge
 * between the sandbox and the host environment for Base64 operations.
 * 
 * Note: This module only provides URL methods for blob handling (createObjectURL/revokeObjectURL),
 * not the full URL constructor API. For complete URL support with parsing and manipulation,
 * use the urlPolyfill module.
 * 
 * **Module Loading Order**: When using both urlPolyfill and blobPolyfill together,
 * load urlPolyfill first, then blobPolyfill. This preserves the full URL API while
 * adding blob-specific methods. Loading blobPolyfill first will cause urlPolyfill
 * to overwrite the blob URL methods.
 * 
 * @example
 * ```typescript
 * const cage = await FaradayCage.create({
 *   modules: [blobPolyfillModule]
 * });
 * 
 * const result = await cage.runCode(`
 *   const blob = new Blob(['Hello World'], { type: 'text/plain' });
 *   const file = new File(['content'], 'test.txt', { type: 'text/plain' });
 *   const blobUrl = URL.createObjectURL(blob);
 *   const encoded = btoa('Hello World');
 *   const decoded = atob(encoded);
 *   { blob, file, blobUrl, encoded, decoded }
 * `);
 * ```
 */
export default defineCageModule((ctx) => {
  ctx.vm.evalCode(blobPolyfillCode)

  // Implement atob and btoa
  const atobFuncHandle = defineSandboxFunctionRaw(ctx, "atob", (str) => {
    // TODO: Be more robust
    const val = ctx.vm.dump(str)

    return ctx.vm.newString(atob(val))
  })

  const btoaFuncHandle = defineSandboxFunctionRaw(ctx, "btoa", (str) => {
    // TODO: Be more robust
    const val = ctx.vm.dump(str)

    return ctx.vm.newString(btoa(val))
  })

  ctx.vm.setProp(ctx.vm.global, "atob", atobFuncHandle)
  ctx.vm.setProp(ctx.vm.global, "btoa", btoaFuncHandle)
})
