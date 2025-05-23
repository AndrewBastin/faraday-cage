import { defineCageModule, defineSandboxFunctionRaw, type CageModuleCtx } from "./_mod_authoring";
import type { QuickJSHandle } from "quickjs-emscripten";
import { marshalToVM } from "../marshalling";

type TimerType = "timeout" | "interval";

interface TimerInfo {
  id: number;
  type: TimerType;
  callback: QuickJSHandle;
  delay: number;
  args: QuickJSHandle[];
  createdAt: number;
  intervalId?: ReturnType<typeof setInterval>;
  timeoutId?: ReturnType<typeof setTimeout>;
}

/**
 * Creates a timer module implementation for the sandbox
 *
 * This module provides an implementation of the Web API timer functions:
 * setTimeout, setInterval, clearTimeout, and clearInterval.
 *
 * @returns A CageModule that implements timer functions in the sandbox
 *
 * @example
 * ```typescript
 * const cage = await FaradayCage.create();
 *
 * await cage.runCode(`
 *   setTimeout(() => console.log("Hello after 1s"), 1000);
 *   
 *   const intervalId = setInterval(() => console.log("Every 500ms"), 500);
 *   setTimeout(() => clearInterval(intervalId), 2000);
 * `, [timers(), console()]);
 * ```
 */
export default () => defineCageModule((ctx: CageModuleCtx) => {
  const timers = new Map<number, TimerInfo>();
  let nextTimerId = 1;
  let isCleaningUp = false;
  let activeTimerCount = 0;

  // Keep-alive promise management
  let resolveKeepAlive: (() => void) | null = null;
  const keepAlivePromise = new Promise<void>((resolve) => {
    resolveKeepAlive = resolve;
  });

  ctx.keepAlivePromises.push(keepAlivePromise);

  // Check if we can resolve the keep-alive promise
  const checkCanResolve = () => {
    if (activeTimerCount === 0 && resolveKeepAlive) {
      resolveKeepAlive();
      resolveKeepAlive = null;
    }
  };

  // Helper to execute timer callback
  const executeCallback = (timer: TimerInfo) => {
    if (isCleaningUp) return;

    try {
      // Call the callback with the stored arguments
      const result = ctx.vm.callFunction(
        timer.callback,
        ctx.vm.undefined,
        ...timer.args
      );

      // If the result is a handle, dispose it
      if (result && "dispose" in result) {
        result.dispose();
      }
    } catch (error) {
      // Timer callbacks should not throw to the host
      console.error("Timer callback error:", error);
    }
  };

  // Helper to clear a timer
  const clearTimer = (id: number) => {
    const timer = timers.get(id);
    if (!timer) return;

    if (timer.timeoutId) {
      clearTimeout(timer.timeoutId);
    }
    if (timer.intervalId) {
      clearInterval(timer.intervalId);
    }

    // Dispose the callback and arguments
    timer.callback.dispose();
    timer.args.forEach(arg => arg.dispose());

    timers.delete(id);
    activeTimerCount--;
    checkCanResolve();
  };

  // Cleanup all timers on scope disposal
  ctx.afterScriptExecutionHooks.push(() => {
    // Check if we can resolve immediately if no timers were created
    checkCanResolve();
    
    // Set up cleanup when the keep-alive promise is about to resolve
    if (resolveKeepAlive) {
      const originalResolve = resolveKeepAlive;
      resolveKeepAlive = () => {
        isCleaningUp = true;
        // Clear all remaining timers
        for (const timerId of timers.keys()) {
          clearTimer(timerId);
        }
        originalResolve();
      };
    }
  });

  // setTimeout implementation
  const setTimeoutFn = defineSandboxFunctionRaw(ctx, "setTimeout", (handler, delay, ...args) => {
    if (isCleaningUp) {
      return marshalToVM(ctx.vm, ctx.scope, 0);
    }

    // Validate handler
    if (ctx.vm.typeof(handler) !== "function") {
      // Per spec, we should support string handlers, but for security we'll throw
      throw new Error("Timer handler must be a function");
    }

    // Coerce delay to number, handle edge cases
    let delayMs = delay !== undefined ? ctx.vm.dump(delay) as number : 0;
    if (typeof delayMs !== "number" || delayMs < 0 || !isFinite(delayMs)) {
      delayMs = 0;
    }
    // Cap at maximum delay (~24.8 days)
    delayMs = Math.min(delayMs, 2147483647);

    const timerId = nextTimerId++;
    activeTimerCount++;

    // Clone handles to ensure they survive
    const callbackHandle = handler.dup();
    const argHandles = args.map(arg => arg.dup());

    const timerInfo: TimerInfo = {
      id: timerId,
      type: "timeout",
      callback: callbackHandle,
      delay: delayMs,
      args: argHandles,
      createdAt: Date.now(),
    };

    timers.set(timerId, timerInfo);

    // Schedule the timeout
    timerInfo.timeoutId = setTimeout(() => {
      executeCallback(timerInfo);
      clearTimer(timerId);
    }, delayMs);

    return marshalToVM(ctx.vm, ctx.scope, timerId);
  });

  // setInterval implementation
  const setIntervalFn = defineSandboxFunctionRaw(ctx, "setInterval", (handler, delay, ...args) => {
    if (isCleaningUp) {
      return marshalToVM(ctx.vm, ctx.scope, 0);
    }

    // Validate handler
    if (ctx.vm.typeof(handler) !== "function") {
      throw new Error("Timer handler must be a function");
    }

    // Coerce delay to number, handle edge cases
    let delayMs = delay !== undefined ? ctx.vm.dump(delay) as number : 0;
    if (typeof delayMs !== "number" || delayMs < 0 || !isFinite(delayMs)) {
      delayMs = 0;
    }
    // Cap at maximum delay
    delayMs = Math.min(delayMs, 2147483647);

    const timerId = nextTimerId++;
    activeTimerCount++;

    // Clone handles to ensure they survive
    const callbackHandle = handler.dup();
    const argHandles = args.map(arg => arg.dup());

    const timerInfo: TimerInfo = {
      id: timerId,
      type: "interval",
      callback: callbackHandle,
      delay: delayMs,
      args: argHandles,
      createdAt: Date.now(),
    };

    timers.set(timerId, timerInfo);

    // Schedule the interval
    timerInfo.intervalId = setInterval(() => {
      executeCallback(timerInfo);
    }, delayMs);

    return marshalToVM(ctx.vm, ctx.scope, timerId);
  });

  // clearTimeout implementation
  const clearTimeoutFn = defineSandboxFunctionRaw(ctx, "clearTimeout", (id) => {
    if (id === undefined || id === null) {
      return ctx.vm.undefined;
    }

    const timerId = ctx.vm.dump(id) as number;
    if (typeof timerId === "number") {
      clearTimer(timerId);
    }

    return ctx.vm.undefined;
  });

  // clearInterval implementation
  const clearIntervalFn = defineSandboxFunctionRaw(ctx, "clearInterval", (id) => {
    if (id === undefined || id === null) {
      return ctx.vm.undefined;
    }

    const timerId = ctx.vm.dump(id) as number;
    if (typeof timerId === "number") {
      clearTimer(timerId);
    }

    return ctx.vm.undefined;
  });

  // Register timer functions on the global object
  ctx.vm.setProp(ctx.vm.global, "setTimeout", setTimeoutFn);
  ctx.vm.setProp(ctx.vm.global, "setInterval", setIntervalFn);
  ctx.vm.setProp(ctx.vm.global, "clearTimeout", clearTimeoutFn);
  ctx.vm.setProp(ctx.vm.global, "clearInterval", clearIntervalFn);
});