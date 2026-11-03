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

export class PricingStoreOwnership {
  readonly #mode: "dedicated" | "shared"
  readonly #dedicatedStoreId: string

  get isShared(): boolean {
    return this.#mode === "shared"
  }

  constructor(
    moduleOptions:
      InternalModuleDeclaration | PricingModuleOptions | Record<string, unknown>
  ) {
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
    context: Context
  ): Promise<string[]> {
    const values = Array.isArray(primaryKeyValues)
      ? primaryKeyValues
      : [primaryKeyValues]
    const ids = values.filter(isString)
    const selectors = values.filter(
      (value): value is object => typeof value === "object" && value !== null
    )

    await this.assertOwnedIds(service, ids, entityName, context)
    const selected = (
      await promiseAll(
        selectors.map((selector) =>
          service.list(
            this.scope(selector, context),
            { select: ["id"], take: null },
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
