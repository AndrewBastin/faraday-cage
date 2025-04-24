import './style.css'

import { FaradayCage } from "../lib/main"
import { blobPolyfill, esmModuleLoader, console as consoleModule } from "../lib/modules"

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
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
  const cage = await FaradayCage.create()

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
