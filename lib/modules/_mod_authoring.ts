// Provides functions which are really important for authoring modules.
// Modules which are part of this library should use this instead of lib/modules/index.ts as that is meant
// to export modules and these utilities out for consumers of this library to use. This is to resolve a circular dependency
// between the modules which may causes issues in some tooling.
//
// Modules which are not part of this library should just use lib/modules/index.ts (exported as faraday-cage/modules) as it
// exports all the functions given here.

import { QuickJSAsyncContext, QuickJSAsyncRuntime, QuickJSHandle, Scope } from "quickjs-emscripten"
import { buildNestedObject, marshalToVM } from "../marshalling"

export type CageModuleCtx = {
  vm: QuickJSAsyncContext,
  scope: Scope,
  runtime: QuickJSAsyncRuntime,
  afterScriptExecutionHooks: Array<() => void>,
  keepAlivePromises: Array<Promise<void>>
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
