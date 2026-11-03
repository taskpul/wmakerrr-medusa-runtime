import { Context } from "@medusajs/types"
import { AsyncLocalStorage } from "node:async_hooks"
import { MedusaError } from "../../common"

const activeMedusaContext = new AsyncLocalStorage<Context>()

export const getActiveMedusaContext = (): Context | undefined =>
  activeMedusaContext.getStore()

export const mergeActiveMedusaContext = (context: Context = {}): Context => {
  const active = getActiveMedusaContext()
  if (!active) {
    return context
  }
  if (active.storeId && context.storeId && active.storeId !== context.storeId) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Store context cannot be rebound during workflow execution"
    )
  }
  return { ...active, ...context, storeId: context.storeId ?? active.storeId }
}

export const runWithMedusaContext = <T>(context: Context, task: () => T): T =>
  activeMedusaContext.run(context, task)

export function MedusaContext() {
  return function (
    target: any,
    propertyKey: string | symbol,
    parameterIndex: number
  ) {
    if (!Object.prototype.hasOwnProperty.call(target, "MedusaContextIndex_")) {
      target.MedusaContextIndex_ = { ...(target.MedusaContextIndex_ ?? {}) }
    }

    target.MedusaContextIndex_[propertyKey] = parameterIndex
  }
}

MedusaContext.getIndex = function (
  target: any,
  propertyKey: string
): number | undefined {
  return target.MedusaContextIndex_?.[propertyKey]
}

export const MedusaContextType = "MedusaContext"
