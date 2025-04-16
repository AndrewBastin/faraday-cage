import { defineCageModule } from ".";

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
