import { defineCageModule, defineSandboxFunctionRaw } from "..";
import blobPolyfillCode from "./blob?raw";

export default defineCageModule((ctx) => {
  ctx.vm.evalCode(blobPolyfillCode)

  // Implement atob and btoa
  const atobFuncHandle = defineSandboxFunctionRaw(ctx, "atob", (str) => {
    // TODO: Be more robust
    const val = ctx.vm.dump(str)

    return ctx.vm.newString(atob(val))
  })

  const btoaFuncHandle = defineSandboxFunctionRaw(ctx, "btoa", (str) => {
    // TODO: Be more robust
    const val = ctx.vm.dump(str)

    return ctx.vm.newString(btoa(val))
  })

  ctx.vm.setProp(ctx.vm.global, "atob", atobFuncHandle)
  ctx.vm.setProp(ctx.vm.global, "btoa", btoaFuncHandle)
})
