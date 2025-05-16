import {
  newQuickJSAsyncWASMModule, newQuickJSAsyncWASMModuleFromVariant, newVariant, 
  QuickJSAsyncWASMModule, RELEASE_ASYNC,
  Scope
} from "quickjs-emscripten"
import asyncWasmLocation from "@jitl/quickjs-wasmfile-release-asyncify/wasm?url"

// @ts-ignore
import { QuickJSAsyncFFI as asyncFFI } from "@jitl/quickjs-wasmfile-release-asyncify/ffi"
// @ts-ignore
import asyncEmscriptenMod from "@jitl/quickjs-wasmfile-release-asyncify/emscripten-module"

import { CageModule, CageModuleCtx } from "./modules"

export type RunCodeResult =
  | { type: "ok"; }
  | { type: "error"; err: unknown }

export class FaradayCage {
  private constructor(private qjs: QuickJSAsyncWASMModule) {}

  public static async createFromQJSWasmLocation(wasmLocation: string): Promise<FaradayCage> {
    const qjs = await newQuickJSAsyncWASMModule(
      newVariant(RELEASE_ASYNC, { wasmLocation })
    )

    return new FaradayCage(qjs)
  }

  public static async create(): Promise<FaradayCage> {
    // HACK: We patch importFFI and importModuleLoader to not do a dynamic import.
    // Dynamic Import for some reason is broken inside the worker in Hoppscotch 
    // that runs the scripts. This is not allowed as `variant.importFFI` is marked 
    // readonly via type, so this can break!
    
    const variant = newVariant(RELEASE_ASYNC, {});

    (variant as any).importFFI = () => Promise.resolve(asyncFFI);
    (variant as any).importModuleLoader = () => Promise.resolve(asyncEmscriptenMod);

    const finalVariant = newVariant(variant, {
      wasmLocation: asyncWasmLocation
    });

    const qjs = await newQuickJSAsyncWASMModuleFromVariant(finalVariant)

    return new FaradayCage(qjs)
  }

  public async runCode(code: string, modules: CageModule[]): Promise<RunCodeResult> {
    try {
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
          throw vm.dump(result.error);
        } else {
          for (const ctx of loadedModuleCtx) {
            for (const afterScriptCallback of ctx.afterScriptExecutionHooks) {
              afterScriptCallback()
            }
          }
        }
      })

      return { type: "ok" };
    } catch (err) {
      // Handle any unexpected errors during execution
      return { type: "error", err: err as Error };
    }
  }
}
