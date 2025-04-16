import './style.css'
import typescriptLogo from './typescript.svg'
import asyncWasmLocation from "@jitl/quickjs-wasmfile-release-asyncify/wasm?url"

import { FaradayCage } from "../lib/main"
import { blobPolyfill, esmModuleLoader, console as consoleModule } from "../lib/modules"

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <a href="https://vite.dev" target="_blank">
      <img src="/vite.svg" class="logo" alt="Vite logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
    </a>
    <h1>Vite + TypeScript</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      Click on the Vite and TypeScript logos to learn more
    </p>
  </div>
`;

(async () => {
  const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)

  cage.runCode(
    `
      import isEven from "https://esm.sh/is-even"

      console.log(isEven(1))
    `,
    [
      blobPolyfill,
      esmModuleLoader,
      consoleModule({
        onLog(...args) {
          console.log(...args)
        }
      })
    ]
  )
})()
