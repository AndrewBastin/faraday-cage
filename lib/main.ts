import {
  newQuickJSAsyncWASMModule, newQuickJSAsyncWASMModuleFromVariant, newVariant, 
  QuickJSAsyncWASMModule, RELEASE_ASYNC,
  Scope
} from "quickjs-emscripten"
import asyncWasmLocation from "@jitl/quickjs-wasmfile-release-asyncify/wasm?url"
import { CageModule, CageModuleCtx } from "./modules"

export type RunCodeResult =
  | { type: "ok"; }
  | { type: "error"; err: Error }

export class FaradayCage {
  private constructor(private qjs: QuickJSAsyncWASMModule) {}

  public static async createFromQJSWasmLocation(wasmLocation: string): Promise<FaradayCage> {
    const qjs = await newQuickJSAsyncWASMModule(
      newVariant(RELEASE_ASYNC, { wasmLocation })
    )

    return new FaradayCage(qjs)
  }

  public static async create(): Promise<FaradayCage> {
    const qjs = await newQuickJSAsyncWASMModuleFromVariant(
      newVariant(
        RELEASE_ASYNC, {
          wasmLocation: asyncWasmLocation
        }
      )
    )

    return new FaradayCage(qjs)
  }

  public async runCode(code: string, modules: CageModule[]): Promise<RunCodeResult> {
    await Scope.withScopeAsync(async (scope) => {
      const runtime = scope.manage(this.qjs.newRuntime())

      const vm = scope.manage(runtime.newContext())

      const loadedModuleCtx: CageModuleCtx[] = []

      for (const module of modules) {
        const modCtx: CageModuleCtx = {
          vm,
          runtime,
          scope,
          afterScriptExecutionHooks: [],
        };

        module.def(modCtx)

        loadedModuleCtx.push(modCtx)
      }

      const result = scope.manage(await vm.evalCodeAsync(code, undefined, { type: "module" }))

      if (result.error) {
        // TODO: Implement better error mechanism
        console.log("Execution error:", vm.dump(result.error))
      } else {
        for (const ctx of loadedModuleCtx) {
          for (const afterScriptCallback of ctx.afterScriptExecutionHooks) {
            afterScriptCallback()
          }
        }
      }
    })

    return { type: "ok" }
  }
}
