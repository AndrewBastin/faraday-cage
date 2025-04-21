# Faraday Cage

A JavaScript sandboxing library with a focus on extensibility.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Features

- Secure JavaScript code execution in an isolated environment
- Extensible module system for customizing sandbox capabilities
- Built on QuickJS via WebAssembly
- TypeScript support
- ESM module loading capabilities

## Installation

```bash
npm install faraday-cage
# or
yarn add faraday-cage
# or
pnpm add faraday-cage
```

## Usage

### Basic Example

```typescript
import asyncWasmLocation from "@jitl/quickjs-wasmfile-release-asyncify/wasm?url"
import { FaradayCage } from 'faraday-cage';
import { console as consoleModule } from 'faraday-cage/modules';

async function runSandboxedCode() {
  // Create a new sandbox instance using Vite's ?url import feature to get the WASM module URL
  const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation);
  
  // Define the code to run
  const code = `
    console.log('Hello from the sandbox!');
    const result = 40 + 2;
    console.log('Result:', result);
  `;
  
  // Run the code with console module
  const result = await cage.runCode(code, [
    consoleModule({
      onLog(...args) {
        console.log(...args)
      }
    })
  ]);
  
  if (result.type === "error") {
    console.error('Error executing code:', result.err);
  }
}

runSandboxedCode();
```

### ESM Module Loading Example

```typescript
import asyncWasmLocation from "@jitl/quickjs-wasmfile-release-asyncify/wasm?url"
import { FaradayCage } from 'faraday-cage';
import { 
  console as consoleModule,
  esmModuleLoader,
  blobPolyfill
} from 'faraday-cage/modules';

async function loadExternalModule() {
  const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation);
  
  const code = `
    // Import an ESM module directly from a CDN
    import isEven from "https://esm.sh/is-even"
    
    console.log(isEven(1))  // false
    console.log(isEven(2))  // true
  `;
  
  await cage.runCode(code, [
    blobPolyfill,
    esmModuleLoader,
    consoleModule({
      onLog(...args) {
        console.log(...args)
      }
    })
  ]);
}
```

### Custom Module Example

```typescript
import asyncWasmLocation from "@jitl/quickjs-wasmfile-release-asyncify/wasm?url"
import { FaradayCage } from 'faraday-cage';
import { defineCageModule, defineSandboxFn } from 'faraday-cage/modules';

// Create a custom module to expose functionality to the sandbox
const mathModule = defineCageModule((ctx) => {
  // Create a function available in the sandbox
  const randomFn = defineSandboxFn(ctx, 'random', () => {
    return Math.random();
  });
  
  // Add function to global object
  const global = ctx.vm.global;
  ctx.vm.setProp(global, 'getRandomNumber', randomFn);
});

async function runWithCustomModule() {
  const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation);
  
  const code = `
    // Use our custom function
    const value = getRandomNumber();
    console.log('Random value:', value);
  `;
  
  await cage.runCode(code, [mathModule]);
}
```

## WASM Module Requirements

**Important:** Faraday Cage does not include the QuickJS WASM module. You must install and provide it separately:

```bash
npm install @jitl/quickjs-wasmfile-release-asyncify
# or
yarn add @jitl/quickjs-wasmfile-release-asyncify
# or
pnpm add @jitl/quickjs-wasmfile-release-asyncify
```

This design decision was made to support different build pipelines and bundlers properly, allowing you to handle WASM loading in the way that best fits your project setup.

### Async WASM Requirement

Faraday Cage specifically requires an async-enabled QuickJS WASM module (such as `@jitl/quickjs-wasmfile-release-asyncify`). The Asyncify transform enables synchronous calls from QuickJS to async host functions, which is essential for Faraday Cage's functionality.

### WASM Module Import

The example below uses Vite's `?url` import suffix to get the URL of the QuickJS WASM module, but you can obtain the URL through any method appropriate for your build system:

```typescript
// Using Vite's import feature to get the URL of the WASM file
import asyncWasmLocation from "@jitl/quickjs-wasmfile-release-asyncify/wasm?url"

// Then pass that URL to the sandbox
const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation);
```

## API Reference

### `FaradayCage`

The main class for creating and managing sandboxes.

#### `static async createFromQJSWasmLocation(wasmLocation: string): Promise<FaradayCage>`

Creates a new sandbox instance from a QuickJS WebAssembly file.

#### `FaradayCage.prototype.runCode(code: string, modules: CageModule[]): Promise<RunCodeResult>`

Runs the provided code with the specified modules.

### `RunCodeResult`

The result of running code in the sandbox, which is one of:

```typescript
// Success case
{ type: "ok" }

// Error case
{ type: "error"; err: Error }
```

Example of handling the result:
```typescript
const result = await cage.runCode(code, modules);
if (result.type === "error") {
  console.error('Error executing code:', result.err);
}
```

### Modules

Modules add functionality to the sandbox:

- `console`: Provides `console.log` and other console methods
- `blobPolyfill`: Adds support for the Blob API
- `esmModuleLoader`: Enables ESM imports from external sources

## License

MIT
