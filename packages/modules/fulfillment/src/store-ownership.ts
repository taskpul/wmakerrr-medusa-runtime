import { Context, InternalModuleDeclaration } from "@medusajs/framework/types"
import {
  deduplicate,
  isString,
  MedusaError,
  promiseAll,
} from "@medusajs/framework/utils"

export const FULFILLMENT_DEDICATED_STORE_ID = "__medusa_dedicated__"
export const FULFILLMENT_REQUEST_ROLE = "medusa_fulfillment_request"
export const FULFILLMENT_STORE_SETTING = "medusa.store_id"

export type FulfillmentModuleOptions = {
  store_isolation?:
    | { mode: "shared"; store_id?: never }
    | { mode?: "dedicated"; store_id?: string }
}

type StoreContext = Context & { storeId?: string }
type GeneratedCrudMethod =
  | "retrieve"
  | "list"
  | "listAndCount"
  | "delete"
  | "softDelete"
  | "restore"
  | "create"
  | "update"

export type GeneratedCrudHookInput = {
  method: GeneratedCrudMethod
  methodName: string
  modelName: string
  args: unknown[]
  context: Context
}

export type GeneratedCrudResultHookInput = GeneratedCrudHookInput & {
  result: unknown
}

type OwnershipService = { list: (...args: any[]) => Promise<any[]> }
type FulfillmentOwnershipServices = Record<
  | "Fulfillment"
  | "FulfillmentAddress"
  | "FulfillmentSet"
  | "ServiceZone"
  | "GeoZone"
  | "ShippingOption"
  | "ShippingOptionRule"
  | "ShippingOptionType"
  | "ShippingProfile",
  OwnershipService
>

const globallyOwnedModels = new Set(["FulfillmentProvider"])
const referencedIds = (records: Record<string, any>[], key: string) =>
  deduplicate(records.flatMap((record) => (record[key] ? [record[key]] : [])))

export class FulfillmentStoreOwnership {
  readonly #mode: "dedicated" | "shared"
  readonly #dedicatedStoreId: string
  readonly #services: FulfillmentOwnershipServices

  get isShared(): boolean {
    return this.#mode === "shared"
  }

  constructor(
    moduleOptions:
      | InternalModuleDeclaration
      | FulfillmentModuleOptions
      | Record<string, unknown>
      | undefined,
    services: FulfillmentOwnershipServices
  ) {
    this.#services = services
    const configuredOptions = moduleOptions ?? {}
    const optionsContainer: Record<string, unknown> =
      "options" in configuredOptions && configuredOptions.options
        ? (configuredOptions.options as Record<string, unknown>)
        : (configuredOptions as Record<string, unknown>)
    const options = (optionsContainer.store_isolation ?? {}) as NonNullable<
      FulfillmentModuleOptions["store_isolation"]
    >

    this.#mode = options.mode ?? "dedicated"
    this.#dedicatedStoreId = options.store_id ?? FULFILLMENT_DEDICATED_STORE_ID

    if (this.#mode === "shared" && options.store_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Fulfillment store_isolation.store_id cannot be configured in shared mode"
      )
    }
  }

  resolveStoreId(context: Context): string {
    const requestedStoreId = (context as StoreContext).storeId?.trim()
    if (this.#mode === "shared") {
      if (!requestedStoreId) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Fulfillment operations in shared mode require Context.storeId"
        )
      }
      return requestedStoreId
    }
    if (requestedStoreId && requestedStoreId !== this.#dedicatedStoreId) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Fulfillment context does not match the dedicated Store"
      )
    }
    return this.#dedicatedStoreId
  }

  scope<T extends object>(filter: T, context: Context) {
    return { ...filter, store_id: this.resolveStoreId(context) }
  }

  stamp<T extends object>(data: T, context: Context): T {
    return { ...data, store_id: this.resolveStoreId(context) } as T
  }

  stampFulfillmentSets<T>(data: T, context: Context): T {
    return this.#mapRecords(data, (record) => {
      const stamped = this.stamp(record, context)
      if (record.service_zones) {
        stamped.service_zones = this.stampServiceZones(
          record.service_zones,
          context
        )
      }
      return stamped
    })
  }

  stampServiceZones<T>(data: T, context: Context): T {
    return this.#mapRecords(data, (record) => {
      const stamped = this.stamp(record, context)
      if (record.geo_zones) {
        stamped.geo_zones = this.#stampRecords(record.geo_zones, context)
      }
      return stamped
    })
  }

  stampShippingOptions<T>(data: T, context: Context): T {
    return this.#mapRecords(data, (record) => {
      const stamped = this.stamp(record, context)
      if (record.rules) {
        stamped.rules = this.#stampRecords(record.rules, context)
      }
      return stamped
    })
  }

  stampFulfillments<T>(data: T, context: Context): T {
    return this.#mapRecords(data, (record) => {
      const stamped = this.stamp(record, context)
      if (record.delivery_address) {
        stamped.delivery_address = this.stamp(record.delivery_address, context)
      }
      for (const key of ["items", "labels"] as const) {
        if (record[key]) {
          stamped[key] = this.#stampRecords(record[key], context)
        }
      }
      return stamped
    })
  }

  async prepareGeneratedMethodArgs(
    input: GeneratedCrudHookInput
  ): Promise<unknown[]> {
    const { method, modelName, context } = input
    if (globallyOwnedModels.has(modelName)) {
      return input.args
    }
    const service = this.#generatedCrudService(modelName)

    if (method === "retrieve") {
      await this.assertOwnedIds(
        service,
        [input.args[0] as string],
        modelName,
        context,
        true
      )
      return input.args
    }
    if (method === "list" || method === "listAndCount") {
      return [
        this.scope((input.args[0] ?? {}) as object, context),
        input.args[1],
      ]
    }
    if (method === "create") {
      const stamped = this.#stampGeneratedRecords(
        modelName,
        input.args[0],
        context
      )
      await this.#assertParentOwnership(modelName, stamped, context)
      return [stamped]
    }
    if (method === "update") {
      const original = input.args[0] as any
      const entries = Array.isArray(original) ? original : [original]
      const directIds = entries.flatMap((entry) =>
        entry && !("selector" in entry) && entry.id ? [entry.id] : []
      )
      if (this.isShared) {
        await this.assertOwnedIds(service, directIds, modelName, context)
      }
      const stamped = entries.map((entry) => {
        if (entry && "selector" in entry) {
          return {
            ...entry,
            selector: this.scope(entry.selector, context),
            data: this.#stampGeneratedRecords(modelName, entry.data, context),
          }
        }
        return this.#stampGeneratedRecords(modelName, entry, context)
      })
      const updateRecords = stamped.flatMap((entry) =>
        "selector" in entry
          ? Array.isArray(entry.data)
            ? entry.data
            : [entry.data]
          : [entry]
      )
      await this.#assertParentOwnership(modelName, updateRecords, context)
      return [Array.isArray(original) ? stamped : stamped[0]]
    }

    const ids = await this.resolveOwnedDeleteIds(
      service,
      input.args[0] as string | object | string[] | object[],
      modelName,
      context,
      method === "restore"
    )
    return [ids, ...input.args.slice(1)]
  }

  validateGeneratedMethodResult(input: GeneratedCrudResultHookInput): void {
    if (globallyOwnedModels.has(input.modelName)) {
      return
    }
    const storeId = this.resolveStoreId(input.context)
    const records = (
      Array.isArray(input.result) ? input.result : [input.result]
    ).filter(Boolean) as { store_id?: string }[]
    if (
      records.some(
        (record) => record.store_id !== undefined && record.store_id !== storeId
      )
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `${input.modelName} result crossed the active Store boundary`
      )
    }
  }

  async assertParentOwnership(
    modelName: string,
    data: unknown,
    context: Context
  ) {
    await this.#assertParentOwnership(modelName, data, context)
  }

  async assertOwnedIds(
    service: OwnershipService,
    ids: string[],
    entityName: string,
    context: Context,
    missingAsNotFound = false
  ): Promise<void> {
    const uniqueIds = deduplicate(ids.filter(Boolean))
    if (!uniqueIds.length) {
      return
    }
    const owned = await service.list(
      this.scope({ id: uniqueIds }, context),
      { select: ["id"], take: null, withDeleted: true },
      context
    )
    const ownedIds = new Set(owned.map((record) => record.id))
    const foreignIds = uniqueIds.filter((id) => !ownedIds.has(id))
    if (!foreignIds.length) {
      return
    }
    if (missingAsNotFound && foreignIds.length === 1) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `${entityName} with id: ${foreignIds[0]} was not found`
      )
    }
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `${entityName} do not belong to the active Store: ${foreignIds.join(", ")}`
    )
  }

  async resolveOwnedDeleteIds(
    service: OwnershipService,
    primaryKeyValues: string | object | string[] | object[],
    entityName: string,
    context: Context,
    withDeleted = false
  ): Promise<string[]> {
    const values = Array.isArray(primaryKeyValues)
      ? primaryKeyValues
      : [primaryKeyValues]
    const ids = values.filter(isString)
    const selectors = values.filter(
      (value): value is object => typeof value === "object" && value !== null
    )
    if (ids.length) {
      await this.assertOwnedIds(service, ids, entityName, context, !withDeleted)
    }
    const selected = (
      await promiseAll(
        selectors.map((selector) =>
          service.list(
            this.scope(selector, context),
            { select: ["id"], take: null, withDeleted },
            context
          )
        )
      )
    ).flat()
    return deduplicate([...ids, ...selected.map((record) => record.id)])
  }

  #generatedCrudService(modelName: string) {
    const service = this.#services[modelName]
    if (!service) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Fulfillment generated CRUD has no ownership service for ${modelName}`
      )
    }
    return service
  }

  async #assertParentOwnership(
    modelName: string,
    data: unknown,
    context: Context
  ): Promise<void> {
    const records = (Array.isArray(data) ? data : [data]) as Record<
      string,
      any
    >[]
    const checks: Array<Promise<void>> = []
    const add = (
      serviceName: keyof FulfillmentOwnershipServices,
      key: string,
      label: string
    ) =>
      checks.push(
        this.assertOwnedIds(
          this.#services[serviceName],
          referencedIds(records, key),
          label,
          context
        )
      )

    if (modelName === "ServiceZone") {
      add("FulfillmentSet", "fulfillment_set_id", "Fulfillment sets")
    } else if (modelName === "GeoZone") {
      add("ServiceZone", "service_zone_id", "Service zones")
    } else if (modelName === "ShippingOption") {
      add("ServiceZone", "service_zone_id", "Service zones")
      add("ShippingProfile", "shipping_profile_id", "Shipping profiles")
      add(
        "ShippingOptionType",
        "shipping_option_type_id",
        "Shipping option types"
      )
    } else if (modelName === "ShippingOptionRule") {
      add("ShippingOption", "shipping_option_id", "Shipping options")
    } else if (modelName === "Fulfillment") {
      add("ShippingOption", "shipping_option_id", "Shipping options")
    }
    await promiseAll(checks)
  }

  #stampGeneratedRecords(modelName: string, data: any, context: Context) {
    if (modelName === "FulfillmentSet") {
      return this.stampFulfillmentSets(data, context)
    }
    if (modelName === "ServiceZone") {
      return this.stampServiceZones(data, context)
    }
    if (modelName === "ShippingOption") {
      return this.stampShippingOptions(data, context)
    }
    return this.#stampRecords(data, context)
  }

  #stampRecords(data: any, context: Context) {
    return this.#mapRecords(data, (record) => this.stamp(record, context))
  }

  #mapRecords<T>(
    data: T,
    mapper: (record: Record<string, any>) => Record<string, any>
  ): T {
    const records = (Array.isArray(data) ? data : [data]) as Record<
      string,
      any
    >[]
    const mapped = records.map(mapper)
    return (Array.isArray(data) ? mapped : mapped[0]) as T
  }
}
