import { Context } from "@medusajs/types"
import { isPresent } from "../../common"
import { MessageAggregator } from "../../event-bus"
import {
  MedusaContextType,
  mergeActiveMedusaContext,
} from "./context-parameter"
import { runManagerContext } from "./run-manager-context"

const FlushEmittedEventsSymbol = Symbol.for("MedusaFlushEmittedEvents")

export function InjectManager(managerProperty?: string): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: any
  ): void {
    if (!target.MedusaContextIndex_) {
      throw new Error(
        `To apply @InjectManager you have to flag a parameter using @MedusaContext`
      )
    }

    managerProperty ??= "baseRepository_"

    const originalMethod = descriptor.value
    const argIndex = target.MedusaContextIndex_[propertyKey]

    descriptor.value = async function (...args: any[]) {
      const originalContext = mergeActiveMedusaContext(args[argIndex] ?? {})
      const copiedContext = {} as Context
      for (const key in originalContext) {
        if (key === "transactionManager") {
          continue
        }

        Object.defineProperty(copiedContext, key, {
          enumerable: true,
          get: function () {
            return originalContext[key]
          },
          set: function (value) {
            originalContext[key] = value
          },
        })
      }

      const resourceWithManager = !managerProperty
        ? this
        : this[managerProperty]

      if (
        !isPresent(resourceWithManager) &&
        !isPresent(originalContext.manager)
      ) {
        throw new Error(
          `Could not find a manager in the context. Ensure that "${managerProperty}" is set on your service and points to a repository — e.g. extend MedusaService(...), which provides "baseRepository_" automatically.`
        )
      }

      copiedContext.manager ??=
        resourceWithManager.getFreshManager(originalContext)

      if (originalContext?.transactionManager) {
        copiedContext.transactionManager = originalContext?.transactionManager
      }

      copiedContext.__type = MedusaContextType

      const flushEvents = originalMethod[FlushEmittedEventsSymbol]
      if (flushEvents) {
        copiedContext.messageAggregator ??= new MessageAggregator()
      }

      args[argIndex] = copiedContext

      const result = await runManagerContext(
        this,
        copiedContext,
        async (context) => {
          args[argIndex] = context
          return await originalMethod.apply(this, args)
        }
      )

      if (flushEvents) {
        await flushEvents(this, copiedContext)
      }

      return result
    }
  }
}
