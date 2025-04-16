import { defineCageModule, defineSandboxObject ,defineSandboxFunctionRaw } from "."

export type ConsoleEventHandler = {
  onLog?: (...args: unknown[]) => void
}

export default (eventHandler: ConsoleEventHandler) => defineCageModule((ctx) => {
  const consoleHandle = defineSandboxObject(ctx, {
    log: defineSandboxFunctionRaw(ctx, "log", (...args) => {
      const mappedArgs = args.map((arg) => ctx.vm.dump(arg))

      eventHandler.onLog?.(...mappedArgs)

      return ctx.vm.undefined
    })
  })

  ctx.vm.setProp(ctx.vm.global, "console", consoleHandle)
})
