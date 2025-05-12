import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  // Required to be set so the URL loading for @jitl/quickjs-wasmfile-release-asyncify/wasm
  // will not load the wrong path.
  base: path.resolve(__dirname, "."),
  
  test: {
    include: ['lib/**/*.{test,spec}.?(c|m)[jt]s?(x)']
  }
})
