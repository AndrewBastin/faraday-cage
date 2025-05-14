import { defineCageModule, defineSandboxFn, defineSandboxObject, type CageModuleCtx } from "./_mod_authoring";
import { marshalToVM } from "../marshalling";

/**
 * Interface for configuring the WebCrypto module
 */
export type CryptoModuleConfig = {
  /**
   * Custom crypto implementation to use instead of the global crypto
   * Must conform to the W3C Web Cryptography API
   */
  cryptoImpl?: Crypto;
};

/**
 * Creates a complete WebCrypto module implementation for the sandbox
 *
 * This module provides an implementation of the W3C Web Cryptography API
 * (https://w3c.github.io/webcrypto/) including the Crypto and SubtleCrypto
 * interfaces with methods like getRandomValues, randomUUID, and the subtle
 * crypto operations (encrypt, decrypt, sign, verify, digest, etc.)
 *
 * @param config - Optional configuration object for customizing the crypto implementation
 * @returns A CageModule that implements the WebCrypto API in the sandbox
 *
 * @example
 * ```typescript
 * const cage = await FaradayCage.createFromQJSWasmLocation(wasmUrl);
 *
 * // Use default (global) crypto
 * await cage.runCode(code, [crypto()]);
 *
 * // Use custom crypto implementation
 * await cage.runCode(code, [
 *   crypto({
 *     cryptoImpl: customCryptoImplementation
 *   })
 * ]);
 * ```
 */
export default (config: CryptoModuleConfig = {}) => defineCageModule((ctx) => {
  // Use provided crypto implementation or fallback to global crypto
  const cryptoImpl = config.cryptoImpl ?? crypto;
  
  if (!cryptoImpl) {
    throw new Error('WebCrypto API is not available in this environment. Please provide a custom implementation via cryptoImpl.');
  }

  // Type for 'this' in methods
  type CryptoThis = { __internal_crypto: Crypto };
  type SubtleCryptoThis = { __internal_subtle: SubtleCrypto };

  // Implement the SubtleCrypto interface
  const subtleCryptoPrototype = defineSandboxObject(ctx, {
    encrypt: defineSandboxFn(ctx, "encrypt", function(this: SubtleCryptoThis, ...args: unknown[]) {
      const algorithm = args[0] as AlgorithmIdentifier;
      const key = args[1] as CryptoKey;
      const data = args[2] as BufferSource;
      
      return this.__internal_subtle.encrypt(algorithm, key, data);
    }),

    decrypt: defineSandboxFn(ctx, "decrypt", function(this: SubtleCryptoThis, ...args: unknown[]) {
      const algorithm = args[0] as AlgorithmIdentifier;
      const key = args[1] as CryptoKey;
      const data = args[2] as BufferSource;
      
      return this.__internal_subtle.decrypt(algorithm, key, data);
    }),

    sign: defineSandboxFn(ctx, "sign", function(this: SubtleCryptoThis, ...args: unknown[]) {
      const algorithm = args[0] as AlgorithmIdentifier;
      const key = args[1] as CryptoKey;
      const data = args[2] as BufferSource;
      
      return this.__internal_subtle.sign(algorithm, key, data);
    }),

    verify: defineSandboxFn(ctx, "verify", function(this: SubtleCryptoThis, ...args: unknown[]) {
      const algorithm = args[0] as AlgorithmIdentifier;
      const key = args[1] as CryptoKey;
      const signature = args[2] as BufferSource;
      const data = args[3] as BufferSource;
      
      return this.__internal_subtle.verify(algorithm, key, signature, data);
    }),

    digest: defineSandboxFn(ctx, "digest", function(this: SubtleCryptoThis, ...args: unknown[]) {
      const algorithm = args[0] as AlgorithmIdentifier;
      const data = args[1] as BufferSource;
      
      return this.__internal_subtle.digest(algorithm, data);
    }),

    generateKey: defineSandboxFn(ctx, "generateKey", function(this: SubtleCryptoThis, ...args: unknown[]) {
      const algorithm = args[0] as AlgorithmIdentifier;
      const extractable = Boolean(args[1]);
      const keyUsages = args[2] as KeyUsage[];
      
      return this.__internal_subtle.generateKey(algorithm, extractable, keyUsages);
    }),

    deriveKey: defineSandboxFn(ctx, "deriveKey", function(this: SubtleCryptoThis, ...args: unknown[]) {
      const algorithm = args[0] as AlgorithmIdentifier;
      const baseKey = args[1] as CryptoKey;
      const derivedKeyAlgorithm = args[2] as AlgorithmIdentifier;
      const extractable = Boolean(args[3]);
      const keyUsages = args[4] as KeyUsage[];
      
      return this.__internal_subtle.deriveKey(
        algorithm, 
        baseKey, 
        derivedKeyAlgorithm, 
        extractable, 
        keyUsages
      );
    }),

    deriveBits: defineSandboxFn(ctx, "deriveBits", function(this: SubtleCryptoThis, ...args: unknown[]) {
      const algorithm = args[0] as AlgorithmIdentifier;
      const baseKey = args[1] as CryptoKey;
      const length = args[2] as number;
      
      return this.__internal_subtle.deriveBits(algorithm, baseKey, length);
    }),

    importKey: defineSandboxFn(ctx, "importKey", function(this: SubtleCryptoThis, ...args: unknown[]) {
      const format = String(args[0]);
      const keyData = args[1];
      const algorithm = args[2] as AlgorithmIdentifier;
      const extractable = Boolean(args[3]);
      const keyUsages = args[4] as KeyUsage[];

      // Handle different formats with proper type casting
      if (format === 'jwk') {
        return this.__internal_subtle.importKey(
          'jwk',
          keyData as JsonWebKey,
          algorithm,
          extractable,
          keyUsages
        );
      } else {
        return this.__internal_subtle.importKey(
          format as 'raw' | 'pkcs8' | 'spki',
          keyData as BufferSource,
          algorithm,
          extractable,
          keyUsages
        );
      }
    }),

    exportKey: defineSandboxFn(ctx, "exportKey", function(this: SubtleCryptoThis, ...args: unknown[]) {
      const format = args[0] as "raw" | "pkcs8" | "spki" | "jwk";
      const key = args[1] as CryptoKey;
      
      return this.__internal_subtle.exportKey(format, key);
    }),

    wrapKey: defineSandboxFn(ctx, "wrapKey", function(this: SubtleCryptoThis, ...args: unknown[]) {
      const format = args[0] as "raw" | "pkcs8" | "spki" | "jwk";
      const key = args[1] as CryptoKey;
      const wrappingKey = args[2] as CryptoKey;
      const wrapAlgorithm = args[3] as AlgorithmIdentifier;
      
      return this.__internal_subtle.wrapKey(
        format, 
        key, 
        wrappingKey, 
        wrapAlgorithm
      );
    }),

    unwrapKey: defineSandboxFn(ctx, "unwrapKey", function(this: SubtleCryptoThis, ...args: unknown[]) {
      const format = args[0] as "raw" | "pkcs8" | "spki" | "jwk";
      const wrappedKey = args[1] as BufferSource;
      const unwrappingKey = args[2] as CryptoKey;
      const unwrapAlgorithm = args[3] as AlgorithmIdentifier;
      const unwrappedKeyAlgorithm = args[4] as AlgorithmIdentifier;
      const extractable = Boolean(args[5]);
      const keyUsages = args[6] as KeyUsage[];
      
      return this.__internal_subtle.unwrapKey(
        format,
        wrappedKey,
        unwrappingKey,
        unwrapAlgorithm,
        unwrappedKeyAlgorithm,
        extractable,
        keyUsages
      );
    })
  });

  // Create the subtle crypto object
  function createSubtleCryptoObject(ctx: CageModuleCtx, subtle: SubtleCrypto) {
    const obj = ctx.scope.manage(ctx.vm.newObject());
    
    // Store internal subtle instance
    ctx.vm.setProp(obj, "__internal_subtle", marshalToVM(ctx.vm, ctx.scope, subtle));
    
    // Set prototype
    ctx.vm.defineProp(obj, "__proto__", { 
      configurable: false, 
      enumerable: false, 
      value: subtleCryptoPrototype 
    });
    
    return obj;
  }

  // Implement Crypto interface methods
  const cryptoPrototype = defineSandboxObject(ctx, {
    getRandomValues: defineSandboxFn(ctx, "getRandomValues", function(this: CryptoThis, ...args: unknown[]) {
      const typedArray = args[0] as ArrayBufferView;
      return this.__internal_crypto.getRandomValues(typedArray);
    }),

    randomUUID: defineSandboxFn(ctx, "randomUUID", function(this: CryptoThis) {
      return this.__internal_crypto.randomUUID();
    })
  });

  // Create the main crypto object
  const cryptoObject = ctx.scope.manage(ctx.vm.newObject());

  // Store internal crypto instance
  ctx.vm.setProp(cryptoObject, "__internal_crypto", marshalToVM(ctx.vm, ctx.scope, cryptoImpl));
  
  // Set prototype
  ctx.vm.defineProp(cryptoObject, "__proto__", { 
    configurable: false, 
    enumerable: false, 
    value: cryptoPrototype 
  });

  // Create and attach the subtle crypto object
  const subtleCryptoObj = createSubtleCryptoObject(ctx, cryptoImpl.subtle);
  ctx.vm.setProp(cryptoObject, "subtle", subtleCryptoObj);

  // Register the WebCrypto API on the global object
  ctx.vm.setProp(ctx.vm.global, "crypto", cryptoObject);
});
