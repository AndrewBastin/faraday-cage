import { describe, it, expect } from 'vitest'
import asyncWasmLocation from "@jitl/quickjs-wasmfile-release-asyncify/wasm?url"
import { FaradayCage } from '../main'
import { CageModule } from '../modules'

describe('FaradayCage', () => {
  describe('runCode', () => {
    it('should successfully run valid code and return ok result', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      const result = await cage.runCode(`
        const a = 1;
        const b = 2;
        const sum = a + b;
      `, [])
      
      expect(result).toEqual({ type: 'ok' })
    })
    
    it('should return error result for syntax errors', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      const result = await cage.runCode(`
        const a = 1;
        const b = 2;
        const sum = a + + // syntax error
      `, [])
      
      expect(result.type).toBe('error')
      if (result.type === 'error') {
        expect(result.err).toBeDefined()
        expect(typeof result.err).toBe('object')
        expect(result.err).toHaveProperty('message')
      }
    })
    
    it('should return error result for runtime errors', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      const result = await cage.runCode(`
        const a = 1;
        const b = null;
        const error = b.nonExistentProperty; // runtime error
      `, [])
      
      expect(result.type).toBe('error')
      if (result.type === 'error') {
        expect(result.err).toBeDefined()
        expect(typeof result.err).toBe('object')
        expect(result.err).toHaveProperty('message')
      }
    })
    
    it('should handle unexpected errors during execution', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      // Create a module that throws an exception
      const throwingModule: CageModule = {
        def: () => {
          throw new Error('Module error')
        }
      }
      
      const result = await cage.runCode(`console.log('This code will not run');`, [throwingModule])
      
      expect(result.type).toBe('error')
      if (result.type === 'error') {
        // We need a type assertion here since we know this specific error is an Error instance
        const err = result.err as Error
        expect(err).toBeInstanceOf(Error)
        expect(err.message).toBe('Module error')
      }
    })
    
    it('should correctly run code with modules', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      // Create a simple test module
      let moduleExecuted = false
      const testModule: CageModule = {
        def: (ctx) => {
          const value = ctx.scope.manage(ctx.vm.newString('test-value'))
          ctx.vm.setProp(ctx.vm.global, 'TEST_VALUE', value)
          moduleExecuted = true
        }
      }
      
      const result = await cage.runCode(`
        const value = TEST_VALUE;
      `, [testModule])
      
      expect(result).toEqual({ type: 'ok' })
      expect(moduleExecuted).toBe(true)
    })
    
    it('should execute afterScriptExecutionHooks after successful execution', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      let hookExecuted = false
      const moduleWithHook: CageModule = {
        def: (ctx) => {
          ctx.afterScriptExecutionHooks.push(() => {
            hookExecuted = true
          })
        }
      }
      
      const result = await cage.runCode(`
        // Simple valid code
        const a = 1;
      `, [moduleWithHook])
      
      expect(result).toEqual({ type: 'ok' })
      expect(hookExecuted).toBe(true)
    })
    
    it('should not execute afterScriptExecutionHooks after failed execution', async () => {
      const cage = await FaradayCage.createFromQJSWasmLocation(asyncWasmLocation)
      
      let hookExecuted = false
      const moduleWithHook: CageModule = {
        def: (ctx) => {
          ctx.afterScriptExecutionHooks.push(() => {
            hookExecuted = true
          })
        }
      }
      
      const result = await cage.runCode(`
        // Invalid code with syntax error
        const a = 1;
        const b = ;
      `, [moduleWithHook])
      
      expect(result.type).toBe('error')
      expect(hookExecuted).toBe(false)
    })
  })
})