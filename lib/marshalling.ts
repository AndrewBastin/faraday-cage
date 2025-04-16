import type { QuickJSAsyncContext, QuickJSHandle, Scope } from "quickjs-emscripten"
import { isQuickJSHandle } from "./utils"

function isPromise(value: unknown): value is Promise<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    value !== undefined &&
    typeof (value as any)["then"] === "function"
  )
}

export function marshalToVM(vm: QuickJSAsyncContext, scope: Scope, value: unknown): QuickJSHandle {
  if (value === null) {
    return vm.null
  }

  if (value === undefined) {
    return vm.undefined
  }

  if (value === true) {
    return vm.true
  }

  if (value === false) {
    return vm.false
  }

  if (Array.isArray(value)) {
    const marshalledValueHandles = value.map((val) => marshalToVM(vm, scope, val))

    const arrayHandle = scope.manage(vm.newArray())

    for (let i = 0; i < marshalledValueHandles.length; i++) {
      vm.setProp(arrayHandle, i, marshalledValueHandles[i])
    }
  }

  if (value instanceof Error) {
    return scope.manage(
      vm.newError({
        name: value.name,
        message: value.message
      })
    )
  }

  if (isPromise(value)) {
    return scope.manage(
      vm.newPromise((resolve, reject) => {
        value
          .then((result) => {
            resolve(marshalToVM(vm, scope, result))
          })
          .catch((error) => {
            reject(marshalToVM(vm, scope, error))
          })
      })
    ).handle
  }


  if (typeof value === "object") {
    const marshalledValueHandles = Object.entries(value).map(([key, val]) => {
      const valueHandle = marshalToVM(vm, scope, val)

      return [key, valueHandle] as const
    })

    const objectHandle = scope.manage(vm.newObject())

    for (const [key, valueHandle] of marshalledValueHandles) {
      vm.setProp(objectHandle, key, valueHandle)
    }

    return objectHandle
  }

  if (typeof value === "string") {
    return scope.manage(vm.newString(value))
  }

  if (typeof value === "number") {
    return scope.manage(vm.newNumber(value))
  }

  if (typeof value === "function") {
    throw new Error("Cannot marshal function to VM")
  }

  throw new Error("Cannot marshal the given value")
}

export type SandboxObjectDef = {
  [key: string]: QuickJSHandle | SandboxObjectDef
}

export function buildNestedObject(vm: QuickJSAsyncContext, scope: Scope, obj: SandboxObjectDef): QuickJSHandle {
  const keyHandlePairs = Object.entries(obj)
    .map(([key, val]) =>
      [key, isQuickJSHandle(val) ? val : buildNestedObject(vm, scope, val)] as const
    )

  const objHandle = scope.manage(vm.newObject())

  for (const [key, valueHandle] of keyHandlePairs) {
    vm.setProp(objHandle, key, valueHandle)
  }

  return objHandle
}
