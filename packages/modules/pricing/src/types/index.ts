import { Logger } from "@medusajs/framework/types"

export type InitializeModuleInjectableDependencies = {
  logger?: Logger
}

export * as ServiceTypes from "./services"
export * from "./store-ownership"
