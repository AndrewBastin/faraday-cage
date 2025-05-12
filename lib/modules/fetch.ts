import { defineCageModule, defineSandboxFn, defineSandboxFunctionRaw, defineSandboxObject, type CageModuleCtx } from "./_mod_authoring";
import type { QuickJSHandle } from "quickjs-emscripten";
import { marshalToVM } from "../marshalling";

/**
 * Interface for configuring the fetch module
 */
export type FetchModuleConfig = {
  /**
   * Custom fetch implementation to use instead of the global fetch
   * Must conform to the WHATWG Fetch API
   */
  fetchImpl?: typeof fetch;
};

/**
 * Creates a complete fetch module implementation for the sandbox
 *
 * This module provides an implementation of the WHATWG Fetch API
 * (https://fetch.spec.whatwg.org/) including fetch, Request, Response,
 * Headers, and AbortController.
 *
 * @param config - Optional configuration object for customizing the fetch implementation
 * @returns A CageModule that implements the fetch API in the sandbox
 *
 * @example
 * ```typescript
 * const cage = await FaradayCage.createFromQJSWasmLocation(wasmUrl);
 *
 * // Use default (global) fetch
 * await cage.runCode(code, [fetch()]);
 *
 * // Use custom fetch implementation
 * await cage.runCode(code, [
 *   fetch({
 *     fetchImpl: customFetchFunction
 *   })
 * ]);
 * ```
 */
export default (config: FetchModuleConfig = {}) => defineCageModule((ctx) => {
  // Use provided fetch implementation or fallback to global fetch
  const fetchImpl = config.fetchImpl || fetch;

  // Type for 'this' in methods
  type HeadersThis = { __internal_headers: Headers };

  // Implement Headers class
  const headersPrototype = defineSandboxObject(ctx, {
    append: defineSandboxFn(ctx, "append", function(this: HeadersThis, ...args: unknown[]) {
      const name = String(args[0]);
      const value = String(args[1]);
      this.__internal_headers.append(name, value);
      return undefined;
    }),

    delete: defineSandboxFn(ctx, "delete", function(this: HeadersThis, ...args: unknown[]) {
      const name = String(args[0]);
      this.__internal_headers.delete(name);
      return undefined;
    }),

    get: defineSandboxFn(ctx, "get", function(this: HeadersThis, ...args: unknown[]) {
      const name = String(args[0]);
      return this.__internal_headers.get(name);
    }),

    has: defineSandboxFn(ctx, "has", function(this: HeadersThis, ...args: unknown[]) {
      const name = String(args[0]);
      return this.__internal_headers.has(name);
    }),

    set: defineSandboxFn(ctx, "set", function(this: HeadersThis, ...args: unknown[]) {
      const name = String(args[0]);
      const value = String(args[1]);
      this.__internal_headers.set(name, value);
      return undefined;
    }),

    forEach: defineSandboxFn(ctx, "forEach", function(this: HeadersThis, ...args: unknown[]) {
      const callbackfn = args[0] as (value: string, key: string, parent: any) => void;
      this.__internal_headers.forEach((value: string, key: string) => {
        callbackfn(value, key, this);
      });
      return undefined;
    }),

    entries: defineSandboxFn(ctx, "entries", function(this: HeadersThis) {
      // Polyfill for headers.entries() if not available
      const entries: [string, string][] = [];
      this.__internal_headers.forEach((value, key) => {
        entries.push([key, value]);
      });
      return entries;
    }),

    keys: defineSandboxFn(ctx, "keys", function(this: HeadersThis) {
      // Polyfill for headers.keys() if not available
      const keys: string[] = [];
      this.__internal_headers.forEach((_, key) => {
        keys.push(key);
      });
      return keys;
    }),

    values: defineSandboxFn(ctx, "values", function(this: HeadersThis) {
      // Polyfill for headers.values() if not available
      const values: string[] = [];
      this.__internal_headers.forEach((value) => {
        values.push(value);
      });
      return values;
    })
  });

  const HeadersConstructor = defineSandboxFunctionRaw(ctx, "Headers", (headersInit) => {
    const obj = ctx.scope.manage(ctx.vm.newObject());
    
    // Create actual Headers instance
    const headersInstance = new Headers(
      headersInit ? (ctx.vm.dump(headersInit) as HeadersInit) : undefined
    );
    
    // Store internal headers instance
    ctx.vm.setProp(obj, "__internal_headers", marshalToVM(ctx.vm, ctx.scope, headersInstance));
    
    // Set prototype
    ctx.vm.defineProp(obj, "__proto__", { configurable: false, enumerable: false, value: headersPrototype });
    
    return obj;
  });

  // Types for 'this' in methods
  type SignalThis = { __internal_signal: AbortSignal };
  type ControllerThis = { __internal_controller: AbortController };

  // Implement AbortController and AbortSignal
  const abortSignalPrototype = defineSandboxObject(ctx, {
    addEventListener: defineSandboxFn(ctx, "addEventListener", function(this: SignalThis, ...args: unknown[]) {
      const type = String(args[0]);
      const listener = args[1] as () => void;
      this.__internal_signal.addEventListener(type, listener);
      return undefined;
    }),

    removeEventListener: defineSandboxFn(ctx, "removeEventListener", function(this: SignalThis, ...args: unknown[]) {
      const type = String(args[0]);
      const listener = args[1] as () => void;
      this.__internal_signal.removeEventListener(type, listener);
      return undefined;
    }),

    // aborted property will be defined on instances
  });

  const abortControllerPrototype = defineSandboxObject(ctx, {
    abort: defineSandboxFn(ctx, "abort", function(this: ControllerThis, ...args: unknown[]) {
      const reason = args[0];
      this.__internal_controller.abort(reason);
      return undefined;
    }),

    // signal property will be defined on instances
  });

  const AbortControllerConstructor = defineSandboxFunctionRaw(ctx, "AbortController", () => {
    const obj = ctx.scope.manage(ctx.vm.newObject());
    
    // Create actual AbortController instance
    const controller = new AbortController();
    
    // Store internal controller instance
    ctx.vm.setProp(obj, "__internal_controller", marshalToVM(ctx.vm, ctx.scope, controller));
    
    // Create signal object
    const signalObj = ctx.scope.manage(ctx.vm.newObject());
    ctx.vm.setProp(signalObj, "__internal_signal", marshalToVM(ctx.vm, ctx.scope, controller.signal));
    ctx.vm.defineProp(signalObj, "__proto__", { configurable: false, enumerable: false, value: abortSignalPrototype });
    
    // Define aborted property on the signal object
    const getAbortedFn = defineSandboxFn(ctx, "get_aborted", function(this: SignalThis) {
      return this.__internal_signal.aborted;
    });

    ctx.vm.defineProp(signalObj, "aborted", {
      configurable: false,
      enumerable: true,
      get: getAbortedFn as unknown as ((this: QuickJSHandle) => QuickJSHandle)
    });
    
    // Attach signal to controller
    ctx.vm.setProp(obj, "signal", signalObj);
    
    // Set prototype
    ctx.vm.defineProp(obj, "__proto__", { configurable: false, enumerable: false, value: abortControllerPrototype });
    
    return obj;
  });

  // Type for body methods
  type BodyThis = { __internal_instance: Request | Response };

  // Common body methods for both Request and Response
  const createBodyMethods = (prototype: any) => {
    ctx.vm.setProp(prototype, "arrayBuffer", defineSandboxFn(ctx, "arrayBuffer", function(this: BodyThis) {
      return this.__internal_instance.arrayBuffer();
    }));

    ctx.vm.setProp(prototype, "blob", defineSandboxFn(ctx, "blob", function(this: BodyThis) {
      return this.__internal_instance.blob();
    }));

    ctx.vm.setProp(prototype, "formData", defineSandboxFn(ctx, "formData", function(this: BodyThis) {
      return this.__internal_instance.formData();
    }));

    ctx.vm.setProp(prototype, "json", defineSandboxFn(ctx, "json", function(this: BodyThis) {
      return this.__internal_instance.json();
    }));

    ctx.vm.setProp(prototype, "text", defineSandboxFn(ctx, "text", function(this: BodyThis) {
      return this.__internal_instance.text();
    }));
  };

  // Type for Response and Request
  type ResponseThis = { __internal_instance: Response };
  type RequestThis = { __internal_instance: Request };

  // Implement Response class
  const responsePrototype = defineSandboxObject(ctx, {
    clone: defineSandboxFn(ctx, "clone", function(this: ResponseThis) {
      // Create new Response object with the cloned response
      return createResponseObject(ctx, this.__internal_instance.clone());
    })
  });

  // Add body methods to Response prototype
  createBodyMethods(responsePrototype);

  const ResponseConstructor = defineSandboxFunctionRaw(ctx, "Response", (body, init) => {
    // Create a new Response instance
    const bodyValue = body ? ctx.vm.dump(body) : undefined;
    const initValue = init ? ctx.vm.dump(init) as ResponseInit : undefined;

    const response = new Response(bodyValue, initValue);

    // Create Response object
    return createResponseObject(ctx, response);
  });

  // Implement Request class
  const requestPrototype = defineSandboxObject(ctx, {
    clone: defineSandboxFn(ctx, "clone", function(this: RequestThis) {
      // Create new Request object with the cloned request
      return createRequestObject(ctx, this.__internal_instance.clone());
    })
  });

  // Add body methods to Request prototype
  createBodyMethods(requestPrototype);

  const RequestConstructor = defineSandboxFunctionRaw(ctx, "Request", (input, init) => {
    // Convert input Request object or string URL
    let inputValue: string | Request;
    
    if (ctx.vm.typeof(input) === "object") {
      const obj = ctx.vm.dump(input);
      if (obj && typeof obj === "object" && "__internal_instance" in obj) {
        inputValue = obj.__internal_instance;
      } else {
        inputValue = String(obj);
      }
    } else {
      inputValue = String(ctx.vm.dump(input));
    }
    
    const initValue = init ? ctx.vm.dump(init) as RequestInit : undefined;
    
    // Create an actual Request instance
    const request = new Request(inputValue, initValue);
    
    // Create Request object
    return createRequestObject(ctx, request);
  });

  // Helper function to create a Response object with properties
  function createResponseObject(ctx: CageModuleCtx, response: Response) {
    const obj = ctx.scope.manage(ctx.vm.newObject());

    // Store internal response instance
    ctx.vm.setProp(obj, "__internal_instance", marshalToVM(ctx.vm, ctx.scope, response));

    // Set prototype
    ctx.vm.defineProp(obj, "__proto__", { configurable: false, enumerable: false, value: responsePrototype });

    // Add standard properties
    const properties = [
      { name: "ok", value: response.ok },
      { name: "redirected", value: response.redirected },
      { name: "status", value: response.status },
      { name: "statusText", value: response.statusText },
      { name: "type", value: response.type },
      { name: "url", value: response.url },
      { name: "bodyUsed", value: response.bodyUsed }
    ];

    for (const prop of properties) {
      ctx.vm.setProp(obj, prop.name, marshalToVM(ctx.vm, ctx.scope, prop.value));
    }

    // Add headers
    const headersObj = ctx.scope.manage(ctx.vm.newObject());
    const headersInstance = response.headers;
    ctx.vm.setProp(headersObj, "__internal_headers", marshalToVM(ctx.vm, ctx.scope, headersInstance));
    ctx.vm.defineProp(headersObj, "__proto__", { configurable: false, enumerable: false, value: headersPrototype });
    ctx.vm.setProp(obj, "headers", headersObj);

    return obj;
  }

  // Helper function to create a Request object with properties
  function createRequestObject(ctx: CageModuleCtx, request: Request) {
    const obj = ctx.scope.manage(ctx.vm.newObject());

    // Store internal request instance
    ctx.vm.setProp(obj, "__internal_instance", marshalToVM(ctx.vm, ctx.scope, request));

    // Set prototype
    ctx.vm.defineProp(obj, "__proto__", { configurable: false, enumerable: false, value: requestPrototype });

    // Add standard properties
    const properties = [
      { name: "cache", value: request.cache },
      { name: "credentials", value: request.credentials },
      { name: "destination", value: request.destination },
      { name: "integrity", value: request.integrity },
      { name: "method", value: request.method },
      { name: "mode", value: request.mode },
      { name: "redirect", value: request.redirect },
      { name: "referrer", value: request.referrer },
      { name: "referrerPolicy", value: request.referrerPolicy },
      { name: "url", value: request.url },
      { name: "bodyUsed", value: request.bodyUsed }
    ];

    for (const prop of properties) {
      ctx.vm.setProp(obj, prop.name, marshalToVM(ctx.vm, ctx.scope, prop.value));
    }

    // Add headers
    const headersObj = ctx.scope.manage(ctx.vm.newObject());
    const headersInstance = request.headers;
    ctx.vm.setProp(headersObj, "__internal_headers", marshalToVM(ctx.vm, ctx.scope, headersInstance));
    ctx.vm.defineProp(headersObj, "__proto__", { configurable: false, enumerable: false, value: headersPrototype });
    ctx.vm.setProp(obj, "headers", headersObj);

    return obj;
  }

  // Implement main fetch function
  const fetchFunction = defineSandboxFunctionRaw(ctx, "fetch", (input, init) => {
    // Convert input Request object or string URL
    let inputValue: string | Request;
    
    if (ctx.vm.typeof(input) === "object") {
      const obj = ctx.vm.dump(input);
      if (obj && typeof obj === "object" && "__internal_instance" in obj) {
        inputValue = obj.__internal_instance;
      } else {
        inputValue = String(obj);
      }
    } else {
      inputValue = String(ctx.vm.dump(input));
    }
    
    const initValue = init ? ctx.vm.dump(init) as RequestInit : undefined;
    
    // Create promise that will resolve with the Response
    return ctx.scope.manage(
      ctx.vm.newPromise((resolve, reject) => {
        fetchImpl(inputValue, initValue)
          .then((response) => {
            // Convert the response to a sandbox Response object
            const responseObj = createResponseObject(ctx, response);
            resolve(responseObj);
          })
          .catch((error) => {
            reject(marshalToVM(ctx.vm, ctx.scope, error));
          });
      })
    ).handle;
  });

  // Register the fetch API on the global object
  ctx.vm.setProp(ctx.vm.global, "fetch", fetchFunction);
  ctx.vm.setProp(ctx.vm.global, "Headers", HeadersConstructor);
  ctx.vm.setProp(ctx.vm.global, "Request", RequestConstructor);
  ctx.vm.setProp(ctx.vm.global, "Response", ResponseConstructor);
  ctx.vm.setProp(ctx.vm.global, "AbortController", AbortControllerConstructor);
});
