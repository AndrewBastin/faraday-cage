import { defineCageModule, defineSandboxFunctionRaw } from "../_mod_authoring";
import { marshalToVM } from "../../marshalling";
import encodingPolyfillCode from "./encoding?raw";

/**
 * Interface for configuring the encoding module
 */
export type EncodingModuleConfig = {
  /**
   * Custom TextEncoder implementation to use instead of the global TextEncoder
   * Must conform to the WHATWG Encoding API
   */
  textEncoderImpl?: typeof TextEncoder;
  
  /**
   * Custom TextDecoder implementation to use instead of the global TextDecoder
   * Must conform to the WHATWG Encoding API
   */
  textDecoderImpl?: typeof TextDecoder;
};

/**
 * Creates a complete encoding module implementation for the sandbox
 *
 * This module provides an implementation of the WHATWG Encoding Standard
 * (https://encoding.spec.whatwg.org/) including TextEncoder and TextDecoder
 * classes with methods like encode, encodeInto, and decode with proper
 * streaming and error handling support.
 *
 * The implementation uses a JavaScript polyfill that bridges to the host
 * environment's TextEncoder and TextDecoder implementations.
 */
export default (config: EncodingModuleConfig = {}) => defineCageModule((ctx) => {
  // Use provided implementations or fallback to global ones
  const TextEncoderImpl = config.textEncoderImpl ?? TextEncoder;
  const TextDecoderImpl = config.textDecoderImpl ?? TextDecoder;

  if (!TextEncoderImpl) {
    throw new Error('TextEncoder is not available in this environment. Please provide a custom implementation via textEncoderImpl.');
  }
  
  if (!TextDecoderImpl) {
    throw new Error('TextDecoder is not available in this environment. Please provide a custom implementation via textDecoderImpl.');
  }

  // Create host encoder and decoder instances for bridging
  const hostEncoder = new TextEncoderImpl();

  // Map to store TextDecoder instances by ID
  const decoderInstances = new Map<number, TextDecoder>();
  let nextDecoderId = 1;

  // Bridge function for TextEncoder.encode
  const hostTextEncoderEncode = defineSandboxFunctionRaw(ctx, "__hostTextEncoderEncode", (str) => {
    const input = ctx.vm.dump(str);
    const result = hostEncoder.encode(String(input));
    return marshalToVM(ctx.vm, ctx.scope, result);
  });

  // Bridge function for TextEncoder.encodeInto
  const hostTextEncoderEncodeInto = defineSandboxFunctionRaw(ctx, "__hostTextEncoderEncodeInto", (str, destination) => {
    const input = ctx.vm.dump(str);
    
    // Handle Uint8Array special case - check if it's a Uint8Array handle
    let dest: Uint8Array;
    try {
      const dumped = ctx.vm.dump(destination);
      
      if (dumped instanceof Uint8Array) {
        dest = dumped;
      } else if (dumped && typeof dumped === 'object') {
        // Check if it's a serialized Uint8Array (object with numeric string keys)
        if (Array.isArray(dumped)) {
          dest = new Uint8Array(dumped);
        } else {
          // Check if it looks like a serialized Uint8Array - object with numeric keys
          const keys = Object.keys(dumped);
          const isNumericKeys = keys.every(key => !isNaN(parseInt(key, 10)));
          
          if (isNumericKeys && keys.length > 0) {
            // Find the maximum index to determine the length
            const maxIndex = Math.max(...keys.map(k => parseInt(k, 10)));
            const arr: number[] = new Array(maxIndex + 1);
            
            // Fill the array with values from the object
            for (let i = 0; i <= maxIndex; i++) {
              arr[i] = (dumped as any)[i.toString()] || 0;
            }
            dest = new Uint8Array(arr);
          } else if ('length' in dumped && typeof dumped.length === 'number') {
            // Convert object with numeric indices to array
            const arr: number[] = [];
            for (let i = 0; i < dumped.length; i++) {
              arr[i] = (dumped as any)[i] || 0;
            }
            dest = new Uint8Array(arr);
          } else {
            throw new Error('Invalid destination type: object without numeric keys or length');
          }
        }
      } else {
        throw new Error('Invalid destination type: ' + typeof dumped);
      }
    } catch (error) {
      throw new TypeError("Failed to execute 'encodeInto' on 'TextEncoder': parameter 2 is not of type 'Uint8Array'.");
    }
    
    const result = hostEncoder.encodeInto(String(input), dest);
    return marshalToVM(ctx.vm, ctx.scope, result);
  });

  // Bridge function for TextDecoder creation
  const hostTextDecoderCreate = defineSandboxFunctionRaw(ctx, "__hostTextDecoderCreate", (label, fatal, ignoreBOM) => {
    const labelStr = ctx.vm.dump(label) as string;
    const fatalBool = ctx.vm.dump(fatal) as boolean;
    const ignoreBOMBool = ctx.vm.dump(ignoreBOM) as boolean;
    
    try {
      const decoder = new TextDecoderImpl(labelStr, { fatal: fatalBool, ignoreBOM: ignoreBOMBool });
      const id = nextDecoderId++;
      decoderInstances.set(id, decoder);
      return ctx.vm.newNumber(id);
    } catch (error) {
      // Re-throw as RangeError according to the spec
      if (error instanceof Error) {
        throw new RangeError(`Failed to construct 'TextDecoder': The encoding label provided ('${labelStr}') is invalid.`);
      }
      throw error;
    }
  });

  // Bridge function for TextDecoder.decode
  const hostTextDecoderDecode = defineSandboxFunctionRaw(ctx, "__hostTextDecoderDecode", (decoderId, input, stream) => {
    const id = ctx.vm.dump(decoderId) as number;
    const streamBool = ctx.vm.dump(stream) as boolean;
    
    // Handle BufferSource input - could be Uint8Array, ArrayBuffer, etc.
    let inputData: BufferSource | undefined;
    if (input && ctx.vm.typeof(input) !== 'undefined') {
      const dumped = ctx.vm.dump(input);
      if (dumped instanceof ArrayBuffer || dumped instanceof Uint8Array || 
          dumped instanceof Int8Array || dumped instanceof DataView) {
        inputData = dumped;
      } else if (dumped && typeof dumped === 'object') {
        // Check if it's a serialized TypedArray (object with numeric string keys)
        if (Array.isArray(dumped)) {
          inputData = new Uint8Array(dumped);
        } else {
          const keys = Object.keys(dumped);
          const isNumericKeys = keys.every(key => !isNaN(parseInt(key, 10)));
          
          if (isNumericKeys && keys.length > 0) {
            // Find the maximum index to determine the length
            const maxIndex = Math.max(...keys.map(k => parseInt(k, 10)));
            const arr: number[] = new Array(maxIndex + 1);
            
            // Fill the array with values from the object
            for (let i = 0; i <= maxIndex; i++) {
              arr[i] = (dumped as any)[i.toString()] || 0;
            }
            inputData = new Uint8Array(arr);
          } else if ('length' in dumped && typeof dumped.length === 'number') {
            // Convert object with numeric indices to array
            const arr: number[] = [];
            for (let i = 0; i < dumped.length; i++) {
              arr[i] = (dumped as any)[i] || 0;
            }
            inputData = new Uint8Array(arr);
          } else {
            inputData = undefined;
          }
        }
      } else {
        inputData = undefined;
      }
    } else {
      inputData = undefined;
    }
    
    const decoder = decoderInstances.get(id);
    if (!decoder) {
      throw new Error('Invalid decoder ID');
    }
    
    const result = decoder.decode(inputData, { stream: streamBool });
    return ctx.vm.newString(result);
  });

  // Inject the polyfill code first
  const bootstrapFuncHandle = ctx.scope.manage(ctx.vm.evalCode(encodingPolyfillCode)).unwrap();

  ctx.scope.manage(
    ctx.vm.callFunction(bootstrapFuncHandle, ctx.vm.undefined, [
      hostTextEncoderEncode,
      hostTextEncoderEncodeInto,
      hostTextDecoderCreate,
      hostTextDecoderDecode
    ])
  );
});
