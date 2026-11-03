import { MessageAggregator } from "../../event-bus"
import { InjectIntoContext } from "./inject-into-context"
import { Context, MessageAggregatorFormat } from "@medusajs/types"

const FlushEmittedEventsSymbol = Symbol.for("MedusaFlushEmittedEvents")

async function flushEmittedEvents(
  target: any,
  instance: any,
  context: Context,
  options: MessageAggregatorFormat
): Promise<void> {
  if (!target.emitEvents_) {
    const logger = Object.keys(instance.__container__ ?? {}).includes("logger")
      ? instance.__container__.logger
      : console
    logger.warn(
      `No emitEvents_ method found on ${target.constructor.name}. No events emitted. To be able to use the @EmitEvents() you need to have the emitEvents_ method implemented in the class.`
    )
  }

  const aggregator = context.messageAggregator as MessageAggregator
  if (aggregator.count() > 0) {
    await target.emitEvents_.apply(instance, [aggregator.getMessages(options)])
    aggregator.clearMessages()
  }
}

/**
 * @internal this decorator is not meant to be used except by the internal team for now
 *
 * @param options
 * @constructor
 */
export function EmitEvents(
  options: MessageAggregatorFormat = {} as MessageAggregatorFormat
) {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: any
  ): void {
    InjectIntoContext({
      messageAggregator: () => new MessageAggregator(),
    })(target, propertyKey, descriptor)

    const original = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const result = await original.apply(this, args)

      const argIndex = target.MedusaContextIndex_[propertyKey]
      await flushEmittedEvents(target, this, args[argIndex], options)

      return result
    }
    descriptor.value[FlushEmittedEventsSymbol] = async (
      instance: any,
      context: Context
    ) => await flushEmittedEvents(target, instance, context, options)
  }
}
