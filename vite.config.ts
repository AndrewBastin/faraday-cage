import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: './lib/main.ts',
        modules: './lib/modules/index.ts'
      },
    },
  }
})
