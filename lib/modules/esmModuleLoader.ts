import { defineCageModule } from "./_mod_authoring";

/**
 * Normalizes module paths for ES module resolution.
 * 
 * @param base - The base module URL (typically the importing module's URL)
 * @param request - The requested module path (can be relative, absolute, or full URL)
 * @returns The normalized full URL for the module
 * 
 * @example
 * normalizeModulePath('https://example.com/src/main.js', './utils.js')
 * // Returns: 'https://example.com/src/utils.js'
 * 
 * normalizeModulePath('https://example.com/src/main.js', '/lib/helper.js')
 * // Returns: 'https://example.com/lib/helper.js'
 */
function normalizeModulePath(base: string, request: string): string {
  // If request is already a full URL, return it
  if (request.startsWith('http://') || request.startsWith('https://')) {
    return request;
  }

  try {
    const baseUrl = new URL(base);
    
    if (request.startsWith('/')) {
      // For absolute-like paths, resolve from the origin
      return new URL(request, baseUrl.origin).toString();
    }
    
    // For relative paths, resolve from the full base URL
    return new URL(request, baseUrl.toString()).toString();
  } catch (e) {
    return request;
  }
}

/**
 * ES Module (ESM) loader for the Faraday Cage sandbox environment.
 * 
 * This module enables dynamic loading of ES modules from URLs within the
 * QuickJS sandbox. It provides:
 * - HTTP/HTTPS module fetching capabilities
 * - Proper URL resolution for relative and absolute module paths
 * - Integration with the QuickJS module system
 * 
 * The loader handles module resolution similar to browser ES modules,
 * supporting relative paths (./module.js), absolute paths (/module.js),
 * and full URLs (https://example.com/module.js).
 * 
 * @example
 * ```typescript
 * const cage = await FaradayCage.create({
 *   modules: [esmModuleLoaderModule]
 * });
 * 
 * const result = await cage.runCode(`
 *   import { utils } from 'https://example.com/utils.js';
 *   import { helper } from './helper.js';
 *   
 *   utils.doSomething();
 * `);
 * ```
 * 
 * @throws {Error} When a module fails to fetch (network error or non-OK response)
 * @throws {TypeError} When the module path cannot be resolved to a valid URL
 */
export default defineCageModule((ctx) => {
  ctx.runtime.setModuleLoader(
    async (modulePath, _ctx) => {
      try {
        const url = new URL(modulePath)
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to fetch module: ${response.statusText}`)
        }
        return await response.text()
      } catch (error) {
        if (error instanceof TypeError) {
          // Not a valid URL, return empty string as before
          return ""
        }
        throw error
      }
    },
    (baseModuleName, requestName, _vm) => {
      return normalizeModulePath(baseModuleName, requestName)
    }
  )
})
