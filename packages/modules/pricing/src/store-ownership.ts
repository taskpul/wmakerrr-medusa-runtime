import {
  Context,
  InternalModuleDeclaration,
  ModulesSdkTypes,
} from "@medusajs/framework/types"
import {
  deduplicate,
  isString,
  MedusaError,
  promiseAll,
} from "@medusajs/framework/utils"
import { PricingModuleOptions } from "./types/store-ownership"

export const DEDICATED_STORE_ID = "__medusa_dedicated__"

type StoreContext = Context & {
  storeId?: string
}

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

type PricingOwnershipServices = Record<
  | "PriceSet"
  | "Price"
  | "PriceRule"
  | "PriceList"
  | "PriceListRule"
  | "PricePreference",
  ModulesSdkTypes.IMedusaInternalService<any>
>

export class PricingStoreOwnership {
  readonly #mode: "dedicated" | "shared"
  readonly #dedicatedStoreId: string
  readonly #services: PricingOwnershipServices

  get isShared(): boolean {
    return this.#mode === "shared"
  }

  constructor(
    moduleOptions:
      | InternalModuleDeclaration
      | PricingModuleOptions
      | Record<string, unknown>,
    services: PricingOwnershipServices
  ) {
    this.#services = services
    const optionsContainer: Record<string, unknown> =
      "options" in moduleOptions && moduleOptions.options
        ? (moduleOptions.options as Record<string, unknown>)
        : (moduleOptions as Record<string, unknown>)
    const options = (optionsContainer.store_isolation ?? {}) as NonNullable<
      PricingModuleOptions["store_isolation"]
    >

    this.#mode = options.mode ?? "dedicated"
    this.#dedicatedStoreId = options.store_id ?? DEDICATED_STORE_ID

    if (this.#mode === "shared" && options.store_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Pricing store_isolation.store_id cannot be configured in shared mode"
      )
    }
  }

  resolveStoreId(context: Context): string {
    const requestedStoreId = (context as StoreContext).storeId?.trim()

    if (this.#mode === "shared") {
      if (!requestedStoreId) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Pricing operations in shared mode require Context.storeId"
        )
      }

      return requestedStoreId
    }

    if (requestedStoreId && requestedStoreId !== this.#dedicatedStoreId) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Pricing context does not match the dedicated Store"
      )
    }

    return this.#dedicatedStoreId
  }

  scope<T extends object>(
    filter: T,
    context: Context
  ): T & { store_id: string } {
    return {
      ...filter,
      store_id: this.resolveStoreId(context),
    }
  }

  stamp<T extends object>(data: T, context: Context): T & { store_id: string } {
    return {
      ...data,
      store_id: this.resolveStoreId(context),
    }
  }

  stampPrice<T extends { price_rules?: object[] }>(
    price: T,
    context: Context
  ): T & { store_id: string } {
    return {
      ...this.stamp(price, context),
      price_rules: price.price_rules?.map((rule) => this.stamp(rule, context)),
    }
  }

  async prepareGeneratedMethodArgs(
    input: GeneratedCrudHookInput
  ): Promise<unknown[]> {
    const { method, modelName, context } = input
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
      const stamped = this.#stampGeneratedRecords(input.args[0], context)
      await this.#assertGeneratedParentOwnership(
        modelName,
        Array.isArray(stamped) ? stamped : [stamped],
        context
      )
      return [stamped]
    }

    if (method === "update") {
      const original = input.args[0]
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
            data: this.#stampGeneratedRecords(entry.data, context),
          }
        }

        return this.stamp(entry, context)
      })
      const updateRecords = stamped.flatMap((entry) =>
        "selector" in entry
          ? Array.isArray(entry.data)
            ? entry.data
            : [entry.data]
          : [entry]
      )

      await this.#assertGeneratedParentOwnership(
        modelName,
        updateRecords,
        context
      )
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

  #generatedCrudService(modelName: string) {
    const service = this.#services[modelName]

    if (!service) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Pricing generated CRUD has no ownership service for ${modelName}`
      )
    }

    return service
  }

  async #assertGeneratedParentOwnership(
    modelName: string,
    records: Record<string, any>[],
    context: Context
  ): Promise<void> {
    const referencedIds = (key: string) =>
      deduplicate(
        records.flatMap((record) => (record[key] ? [record[key]] : []))
      )

    if (modelName === "Price") {
      await this.assertOwnedIds(
        this.#services.PriceSet,
        referencedIds("price_set_id"),
        "Price sets",
        context
      )
      await this.assertOwnedIds(
        this.#services.PriceList,
        referencedIds("price_list_id"),
        "Price lists",
        context
      )
    } else if (modelName === "PriceRule") {
      await this.assertOwnedIds(
        this.#services.Price,
        referencedIds("price_id"),
        "Prices",
        context
      )
    } else if (modelName === "PriceListRule") {
      await this.assertOwnedIds(
        this.#services.PriceList,
        referencedIds("price_list_id"),
        "Price lists",
        context
      )
    }
  }

  #stampGeneratedRecords(data: any, context: Context) {
    const records = Array.isArray(data) ? data : [data]
    const stamped = records.map((record) => this.stamp(record, context))

    return Array.isArray(data) ? stamped : stamped[0]
  }

  listOwned(
    service: ModulesSdkTypes.IMedusaInternalService<any>,
    filter: object,
    config: object,
    context: Context
  ) {
    return service.list(this.scope(filter, context), config, context)
  }

  assertOnlyOwnedIds(
    candidateIds: string[],
    ownedIds: Iterable<string>,
    entityName: string,
    ownerDescription: string
  ): void {
    if (!this.isShared) {
      return
    }

    const owned = new Set(ownedIds)
    const foreignIds = deduplicate(candidateIds.filter((id) => !owned.has(id)))
    if (foreignIds.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `${entityName} do not belong to ${ownerDescription}: ${foreignIds.join(", ")}`
      )
    }
  }

  assertReferencedRecordsOwned(
    records: { id?: string }[],
    ownedRecords: { id: string }[],
    entityName: string,
    ownerDescription: string
  ): void {
    this.assertOnlyOwnedIds(
      records.flatMap((record) => (record.id ? [record.id] : [])),
      ownedRecords.map((record) => record.id),
      entityName,
      ownerDescription
    )
  }

  async assertOwnedIds(
    service: ModulesSdkTypes.IMedusaInternalService<any>,
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
      { select: ["id"], take: null },
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
    service: ModulesSdkTypes.IMedusaInternalService<any>,
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
      const owned = await service.list(
        this.scope({ id: ids }, context),
        { select: ["id"], take: null, withDeleted },
        context
      )
      this.assertOnlyOwnedIds(
        ids,
        owned.map((record) => record.id),
        entityName,
        "the active Store"
      )
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

  async deleteOwned(
    service: ModulesSdkTypes.IMedusaInternalService<any>,
    primaryKeyValues: string | object | string[] | object[],
    entityName: string,
    context: Context
  ): Promise<void> {
    const ids = await this.resolveOwnedDeleteIds(
      service,
      primaryKeyValues,
      entityName,
      context
    )
    await service.delete(ids, context)
  }
}
