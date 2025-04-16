import type { QuickJSHandle } from "quickjs-emscripten";

// TODO: Could have a better impl
export function isQuickJSHandle(value: unknown): value is QuickJSHandle {
  const handle = value as QuickJSHandle

  if (handle === null || handle === undefined) {
    return false
  }

  // HACK: Pretty naive check that should work for the most part, hopefully
  if (typeof handle === "object" && typeof handle.alive === "boolean") {
    return true
  }

  return false
}
