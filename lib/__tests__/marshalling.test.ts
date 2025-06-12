import { describe, it, expect } from "vitest"
import { marshalToVM } from "../marshalling"
import { newQuickJSAsyncWASMModule, Scope } from "quickjs-emscripten"
import { FaradayCage } from "../main"
import { defineCageModule } from "../modules/_mod_authoring"

describe("marshalToVM - Array marshalling", () => {
  it("should marshal empty arrays", async () => {
    const QuickJS = await newQuickJSAsyncWASMModule()
    
    await Scope.withScopeAsync(async (scope) => {
      const runtime = scope.manage(QuickJS.newRuntime())
      const vm = scope.manage(runtime.newContext())
      
      const arrayHandle = marshalToVM(vm, scope, [])
      const result = vm.dump(arrayHandle)
      
      expect(result).toEqual([])
    })
  })

  it("should marshal arrays with primitive values", async () => {
    const QuickJS = await newQuickJSAsyncWASMModule()
    
    await Scope.withScopeAsync(async (scope) => {
      const runtime = scope.manage(QuickJS.newRuntime())
      const vm = scope.manage(runtime.newContext())
      
      const testArray = [1, "hello", true, false, null, undefined]
      const arrayHandle = marshalToVM(vm, scope, testArray)
      const result = vm.dump(arrayHandle)
      
      expect(result).toEqual([1, "hello", true, false, null, null])
    })
  })

  it("should marshal nested arrays", async () => {
    const QuickJS = await newQuickJSAsyncWASMModule()
    
    await Scope.withScopeAsync(async (scope) => {
      const runtime = scope.manage(QuickJS.newRuntime())
      const vm = scope.manage(runtime.newContext())
      
      const testArray = [1, [2, 3], [[4, 5], [6, 7]], [[[8]]]]
      const arrayHandle = marshalToVM(vm, scope, testArray)
      const result = vm.dump(arrayHandle)
      
      expect(result).toEqual([1, [2, 3], [[4, 5], [6, 7]], [[[8]]]])
    })
  })

  it("should marshal arrays with objects", async () => {
    const QuickJS = await newQuickJSAsyncWASMModule()
    
    await Scope.withScopeAsync(async (scope) => {
      const runtime = scope.manage(QuickJS.newRuntime())
      const vm = scope.manage(runtime.newContext())
      
      const testArray = [
        { name: "Alice", age: 30 },
        { name: "Bob", scores: [85, 90, 88] },
        { nested: { deep: { value: 42 } } }
      ]
      const arrayHandle = marshalToVM(vm, scope, testArray)
      const result = vm.dump(arrayHandle)
      
      expect(result).toEqual([
        { name: "Alice", age: 30 },
        { name: "Bob", scores: [85, 90, 88] },
        { nested: { deep: { value: 42 } } }
      ])
    })
  })

  it("should marshal arrays with mixed complex structures", async () => {
    const QuickJS = await newQuickJSAsyncWASMModule()
    
    await Scope.withScopeAsync(async (scope) => {
      const runtime = scope.manage(QuickJS.newRuntime())
      const vm = scope.manage(runtime.newContext())
      
      const testArray = [
        "string",
        123,
        { obj: { arr: [1, 2, { nested: true }] } },
        [[[{ deeply: "nested" }]]],
        null,
        undefined,
        true,
        false,
        { mixedArray: [1, "two", null, [3, 4]] }
      ]
      const arrayHandle = marshalToVM(vm, scope, testArray)
      const result = vm.dump(arrayHandle)
      
      expect(result).toEqual([
        "string",
        123,
        { obj: { arr: [1, 2, { nested: true }] } },
        [[[{ deeply: "nested" }]]],
        null,
        null,
        true,
        false,
        { mixedArray: [1, "two", null, [3, 4]] }
      ])
    })
  })

  it("should marshal large arrays", async () => {
    const QuickJS = await newQuickJSAsyncWASMModule()
    
    await Scope.withScopeAsync(async (scope) => {
      const runtime = scope.manage(QuickJS.newRuntime())
      const vm = scope.manage(runtime.newContext())
      
      const largeArray = Array.from({ length: 1000 }, (_, i) => i)
      const arrayHandle = marshalToVM(vm, scope, largeArray)
      const result = vm.dump(arrayHandle)
      
      expect(result).toHaveLength(1000)
      expect(result[0]).toBe(0)
      expect(result[999]).toBe(999)
    })
  })

  it("should marshal arrays containing errors", async () => {
    const QuickJS = await newQuickJSAsyncWASMModule()
    
    await Scope.withScopeAsync(async (scope) => {
      const runtime = scope.manage(QuickJS.newRuntime())
      const vm = scope.manage(runtime.newContext())
      
      const testError = new Error("Test error")
      testError.name = "TestError"
      const testArray = ["before", testError, "after"]
      const arrayHandle = marshalToVM(vm, scope, testArray)
      const result = vm.dump(arrayHandle)
      
      expect(result).toHaveLength(3)
      expect(result[0]).toBe("before")
      expect(result[1]).toMatchObject({
        name: "TestError",
        message: "Test error"
      })
      expect(result[2]).toBe("after")
    })
  })
})

describe("defineSandboxFn - Data marshalling", () => {
  it("should marshal primitive types from sandbox to host", async () => {
    let capturedValues: any[] = []
    
    const testModule = defineCageModule((ctx) => {
      const { vm, scope } = ctx
      
      const captureValue = scope.manage(vm.newFunction("captureValue", (...args) => {
        capturedValues.push(vm.dump(args[0]))
        return vm.undefined
      }))
      
      vm.setProp(vm.global, "captureValue", captureValue)
    })

    const cage = await FaradayCage.create()
    
    const result = await cage.runCode(`
      captureValue(42)
      captureValue("hello world")
      captureValue(true)
      captureValue(false)
      captureValue(null)
      captureValue(undefined)
      captureValue(3.14159)
    `, [testModule])

    expect(result.type).toBe("ok")
    expect(capturedValues).toEqual([
      42,
      "hello world",
      true,
      false,
      null,
      undefined,
      3.14159
    ])
  })

  it("should marshal objects from sandbox to host", async () => {
    let capturedObject: any = null
    
    const testModule = defineCageModule((ctx) => {
      const { vm, scope } = ctx
      
      const captureObject = scope.manage(vm.newFunction("captureObject", (...args) => {
        capturedObject = vm.dump(args[0])
        return vm.undefined
      }))
      
      vm.setProp(vm.global, "captureObject", captureObject)
    })

    const cage = await FaradayCage.create()
    
    const result = await cage.runCode(`
      const obj = {
        name: "Test Object",
        count: 123,
        active: true,
        metadata: {
          created: "2024-01-01",
          tags: ["test", "example"],
          settings: {
            enabled: false,
            threshold: 0.75
          }
        },
        items: [
          { id: 1, value: "first" },
          { id: 2, value: "second" }
        ]
      }
      captureObject(obj)
    `, [testModule])

    expect(result.type).toBe("ok")
    expect(capturedObject).toEqual({
      name: "Test Object",
      count: 123,
      active: true,
      metadata: {
        created: "2024-01-01",
        tags: ["test", "example"],
        settings: {
          enabled: false,
          threshold: 0.75
        }
      },
      items: [
        { id: 1, value: "first" },
        { id: 2, value: "second" }
      ]
    })
  })

  it("should marshal arrays from sandbox to host", async () => {
    let capturedArray: any = null
    
    const testModule = defineCageModule((ctx) => {
      const { vm, scope } = ctx
      
      const captureArray = scope.manage(vm.newFunction("captureArray", (...args) => {
        capturedArray = vm.dump(args[0])
        return vm.undefined
      }))
      
      vm.setProp(vm.global, "captureArray", captureArray)
    })

    const cage = await FaradayCage.create()
    
    const result = await cage.runCode(`
      const arr = [
        1,
        "string",
        true,
        null,
        { nested: "object" },
        [2, 3, [4, 5]],
        undefined
      ]
      captureArray(arr)
    `, [testModule])

    expect(result.type).toBe("ok")
    expect(capturedArray).toEqual([
      1,
      "string",
      true,
      null,
      { nested: "object" },
      [2, 3, [4, 5]],
      null // undefined in arrays becomes null
    ])
  })

  it("should marshal data from host to sandbox", async () => {
    let receivedInSandbox: any = null
    
    const testModule = defineCageModule((ctx) => {
      const { vm, scope } = ctx
      
      const sendData = scope.manage(vm.newFunction("sendData", () => {
        const testData = {
          message: "From host",
          number: 999,
          array: [1, 2, 3],
          nested: {
            bool: true,
            items: ["a", "b", "c"]
          }
        }
        
        return marshalToVM(vm, scope, testData)
      }))
      
      const verifyData = scope.manage(vm.newFunction("verifyData", (...args) => {
        receivedInSandbox = vm.dump(args[0])
        return vm.undefined
      }))
      
      vm.setProp(vm.global, "sendData", sendData)
      vm.setProp(vm.global, "verifyData", verifyData)
    })

    const cage = await FaradayCage.create()
    
    const result = await cage.runCode(`
      const data = sendData()
      verifyData(data)
    `, [testModule])

    expect(result.type).toBe("ok")
    expect(receivedInSandbox).toEqual({
      message: "From host",
      number: 999,
      array: [1, 2, 3],
      nested: {
        bool: true,
        items: ["a", "b", "c"]
      }
    })
  })

  it("should handle errors during marshalling", async () => {
    let capturedError: any = null
    
    const testModule = defineCageModule((ctx) => {
      const { vm, scope } = ctx
      
      const captureError = scope.manage(vm.newFunction("captureError", (...args) => {
        capturedError = vm.dump(args[0])
        return vm.undefined
      }))
      
      vm.setProp(vm.global, "captureError", captureError)
    })

    const cage = await FaradayCage.create()
    
    const result = await cage.runCode(`
      const err = new Error("Test error message")
      err.name = "CustomError"
      captureError(err)
    `, [testModule])

    expect(result.type).toBe("ok")
    expect(capturedError).toMatchObject({
      name: "CustomError",
      message: "Test error message"
    })
  })

  it("should handle circular references gracefully", async () => {
    let errorOccurred = false
    
    const testModule = defineCageModule((ctx) => {
      const { vm, scope } = ctx
      
      const testCircular = scope.manage(vm.newFunction("testCircular", (...args) => {
        try {
          vm.dump(args[0])
        } catch (error) {
          errorOccurred = true
        }
        return vm.undefined
      }))
      
      vm.setProp(vm.global, "testCircular", testCircular)
    })

    const cage = await FaradayCage.create()
    
    const result = await cage.runCode(`
      const obj = { name: "parent" }
      obj.self = obj
      testCircular(obj)
    `, [testModule])

    expect(result.type).toBe("ok")
    // QuickJS handles circular references by creating a reference
    expect(errorOccurred).toBe(false)
  })

  it("should marshal multiple arguments", async () => {
    let capturedArgs: any[] = []
    
    const testModule = defineCageModule((ctx) => {
      const { vm, scope } = ctx
      
      const multiArgFunction = scope.manage(vm.newFunction("multiArgFunction", (...args) => {
        capturedArgs = args.map(arg => vm.dump(arg))
        return vm.undefined
      }))
      
      vm.setProp(vm.global, "multiArgFunction", multiArgFunction)
    })

    const cage = await FaradayCage.create()
    
    const result = await cage.runCode(`
      multiArgFunction(
        "first",
        42,
        true,
        { key: "value" },
        [1, 2, 3],
        null,
        undefined
      )
    `, [testModule])

    expect(result.type).toBe("ok")
    expect(capturedArgs).toEqual([
      "first",
      42,
      true,
      { key: "value" },
      [1, 2, 3],
      null,
      undefined
    ])
  })

  it("should return marshalled values from host functions", async () => {
    const testModule = defineCageModule((ctx) => {
      const { vm, scope } = ctx
      
      const getComplexData = scope.manage(vm.newFunction("getComplexData", () => {
        const data = {
          users: [
            { id: 1, name: "Alice", active: true },
            { id: 2, name: "Bob", active: false }
          ],
          config: {
            version: "1.0.0",
            features: ["feature1", "feature2"],
            settings: {
              debug: false,
              timeout: 5000
            }
          },
          stats: [10, 20, 30, 40, 50]
        }
        
        return marshalToVM(vm, scope, data)
      }))
      
      vm.setProp(vm.global, "getComplexData", getComplexData)
    })

    const cage = await FaradayCage.create()
    
    const result = await cage.runCode(`
      export const data = getComplexData()
    `, [testModule])

    expect(result.type).toBe("ok")
  })
})
