import { QuickJSAsyncContext, QuickJSAsyncRuntime, QuickJSHandle, Scope } from "quickjs-emscripten"
import { buildNestedObject, marshalToVM } from "../marshalling"

export { default as blobPolyfill } from "./blobPolyfill"
export { default as esmModuleLoader } from "./esmModuleLoader"

export * from "./console"
export { default as console } from "./console"

export type CageModuleCtx = {
  vm: QuickJSAsyncContext,
  scope: Scope,
  runtime: QuickJSAsyncRuntime,
  afterScriptExecutionHooks: Array<() => void>
}

export type CageModule = {
  def: (ctx: CageModuleCtx) => void
}

export function defineCageModule(def: (ctx: CageModuleCtx) => void): CageModule {
  return { def }
}

export function defineSandboxFn(ctx: CageModuleCtx, funcName: string, def: (...args: unknown[]) => unknown) {
  const transformedFunc = (...args: QuickJSHandle[]) => {
    const convertedArgs = args.map((arg) => ctx.vm.dump(arg))

    const result = def(...convertedArgs)

    return marshalToVM(ctx.vm, ctx.scope, result)

  }

  return defineSandboxFunctionRaw(ctx, funcName, transformedFunc)
}

export function defineSandboxFunctionRaw(ctx: CageModuleCtx, funcName: string, def: (...args: QuickJSHandle[]) => QuickJSHandle) {
  return ctx.scope.manage(ctx.vm.newFunction(funcName, def))
}

type SandboxObjectDef = {
  [key: string]: QuickJSHandle | SandboxObjectDef
}

export function defineSandboxObject(ctx: CageModuleCtx, def: SandboxObjectDef): QuickJSHandle {
  return buildNestedObject(ctx.vm, ctx.scope, def)
}
