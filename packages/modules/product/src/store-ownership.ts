import { Context, InternalModuleDeclaration } from "@medusajs/framework/types"
import {
  deduplicate,
  isString,
  MedusaError,
  promiseAll,
} from "@medusajs/framework/utils"
import { ProductModuleOptions } from "./types/store-ownership"

export const PRODUCT_DEDICATED_STORE_ID = "__medusa_dedicated__"
export const PRODUCT_REQUEST_ROLE = "medusa_product_request"
export const PRODUCT_STORE_SETTING = "medusa.store_id"

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

type OwnershipService = {
  list: (...args: any[]) => Promise<any[]>
}

type ProductOwnershipServices = Record<
  | "Product"
  | "ProductCategory"
  | "ProductCollection"
  | "ProductOption"
  | "ProductOptionValue"
  | "ProductTag"
  | "ProductType"
  | "ProductVariant"
  | "ProductImage"
  | "ProductProductOption",
  OwnershipService
>

const referencedIds = (records: Record<string, any>[], key: string) =>
  deduplicate(records.flatMap((record) => (record[key] ? [record[key]] : [])))

export class ProductStoreOwnership {
  readonly #mode: "dedicated" | "shared"
  readonly #dedicatedStoreId: string
  readonly #services: ProductOwnershipServices

  get isShared(): boolean {
    return this.#mode === "shared"
  }

  constructor(
    moduleOptions:
      | InternalModuleDeclaration
      | ProductModuleOptions
      | Record<string, unknown>
      | undefined,
    services: ProductOwnershipServices
  ) {
    this.#services = services
    const configuredOptions = moduleOptions ?? {}
    const optionsContainer: Record<string, unknown> =
      "options" in configuredOptions && configuredOptions.options
        ? (configuredOptions.options as Record<string, unknown>)
        : (configuredOptions as Record<string, unknown>)
    const options = (optionsContainer.store_isolation ?? {}) as NonNullable<
      ProductModuleOptions["store_isolation"]
    >

    this.#mode = options.mode ?? "dedicated"
    this.#dedicatedStoreId = options.store_id ?? PRODUCT_DEDICATED_STORE_ID

    if (this.#mode === "shared" && options.store_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Product store_isolation.store_id cannot be configured in shared mode"
      )
    }
  }

  resolveStoreId(context: Context): string {
    const requestedStoreId = (context as StoreContext).storeId?.trim()

    if (this.#mode === "shared") {
      if (!requestedStoreId) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Product operations in shared mode require Context.storeId"
        )
      }
      return requestedStoreId
    }

    if (requestedStoreId && requestedStoreId !== this.#dedicatedStoreId) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Product context does not match the dedicated Store"
      )
    }
    return this.#dedicatedStoreId
  }

  scope<T extends object>(
    filter: T,
    context: Context
  ): T & { store_id: string } {
    return { ...filter, store_id: this.resolveStoreId(context) }
  }

  stamp<T extends object>(data: T, context: Context): T & { store_id: string } {
    return { ...data, store_id: this.resolveStoreId(context) }
  }

  stampMany<T extends object>(data: T[], context: Context) {
    return data.map((entry) => this.stamp(entry, context))
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
        `Product generated CRUD has no ownership service for ${modelName}`
      )
    }
    return service
  }

  async #assertGeneratedParentOwnership(
    modelName: string,
    records: Record<string, any>[],
    context: Context
  ): Promise<void> {
    const checks: Array<Promise<void>> = []
    const add = (
      serviceName: keyof ProductOwnershipServices,
      key: string,
      label: string
    ) => {
      checks.push(
        this.assertOwnedIds(
          this.#services[serviceName],
          referencedIds(records, key),
          label,
          context
        )
      )
    }

    if (modelName === "Product") {
      add("ProductType", "type_id", "Product types")
      add("ProductCollection", "collection_id", "Product collections")
    } else if (modelName === "ProductCategory") {
      add("ProductCategory", "parent_category_id", "Product categories")
    } else if (modelName === "ProductOptionValue") {
      add("ProductOption", "option_id", "Product options")
    } else if (modelName === "ProductVariant") {
      add("Product", "product_id", "Products")
    } else if (modelName === "ProductImage") {
      add("Product", "product_id", "Products")
    } else if (modelName === "ProductProductOption") {
      add("Product", "product_id", "Products")
      add("ProductOption", "product_option_id", "Product options")
    }
    await promiseAll(checks)
  }

  #stampGeneratedRecords(data: any, context: Context) {
    const records = Array.isArray(data) ? data : [data]
    const stamped = records.map((record) => this.stamp(record, context))
    return Array.isArray(data) ? stamped : stamped[0]
  }

  listOwned(
    service: OwnershipService,
    filter: object,
    config: object,
    context: Context
  ) {
    return service.list(this.scope(filter, context), config, context)
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
}
