import { Context, InternalModuleDeclaration } from "@medusajs/types"
import { deduplicate } from "../common/deduplicate"
import { isString } from "../common/is-string"
import { promiseAll } from "../common/promise-all"
import { MedusaError } from "../common/errors"

export type StoreIsolationOptions = {
  store_isolation?:
    | { mode: "shared"; store_id?: never }
    | { mode?: "dedicated"; store_id?: string }
}

type OwnershipService = { list: (...args: any[]) => Promise<any[]> }

export type StoreIsolationGeneratedCrudInput = {
  method:
    | "retrieve"
    | "list"
    | "listAndCount"
    | "delete"
    | "softDelete"
    | "restore"
    | "create"
    | "update"
  methodName: string
  modelName: string
  args: unknown[]
  context: Context
}

export type StoreIsolationGeneratedCrudResult =
  StoreIsolationGeneratedCrudInput & { result: unknown }

export class StoreIsolationManager<
  TServices extends Record<string, OwnershipService>,
> {
  readonly #domain: string
  readonly #mode: "dedicated" | "shared"
  readonly #dedicatedStoreId: string
  readonly #services: TServices
  readonly #unscopedModels: Set<string>

  get isShared(): boolean {
    return this.#mode === "shared"
  }

  constructor(input: {
    domain: string
    moduleOptions:
      | InternalModuleDeclaration
      | StoreIsolationOptions
      | Record<string, unknown>
      | undefined
    services: TServices
    defaultStoreId?: string
    unscopedModels?: string[]
  }) {
    this.#domain = input.domain
    this.#services = input.services
    this.#unscopedModels = new Set(input.unscopedModels ?? [])
    const configured = (input.moduleOptions ?? {}) as Record<string, unknown>
    const container =
      "options" in configured && configured.options
        ? (configured.options as Record<string, unknown>)
        : configured
    const options = (container.store_isolation ?? {}) as NonNullable<
      StoreIsolationOptions["store_isolation"]
    >
    this.#mode = options.mode ?? "dedicated"
    this.#dedicatedStoreId =
      options.store_id ?? input.defaultStoreId ?? "__medusa_dedicated__"
    if (this.#mode === "shared" && options.store_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `${this.#domain} store_isolation.store_id cannot be configured in shared mode`
      )
    }
  }

  resolveStoreId(context: Context): string {
    const requested = (
      context as Context & { storeId?: string }
    ).storeId?.trim()
    if (this.#mode === "shared") {
      if (!requested) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `${this.#domain} operations in shared mode require Context.storeId`
        )
      }
      return requested
    }
    if (requested && requested !== this.#dedicatedStoreId) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `${this.#domain} context does not match the dedicated Store`
      )
    }
    return this.#dedicatedStoreId
  }

  scope<T extends object>(filter: T, context: Context) {
    return { ...filter, store_id: this.resolveStoreId(context) }
  }

  stamp<T>(data: T, context: Context): T {
    const records = (Array.isArray(data) ? data : [data]) as Record<
      string,
      unknown
    >[]
    const storeId = this.resolveStoreId(context)
    const stamped = records.map((record) => ({ ...record, store_id: storeId }))
    return (Array.isArray(data) ? stamped : stamped[0]) as T
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

  async prepareGeneratedMethodArgs(
    input: StoreIsolationGeneratedCrudInput
  ): Promise<unknown[]> {
    if (this.#unscopedModels.has(input.modelName)) {
      return input.args
    }
    const service = this.#services[input.modelName]
    if (!service) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `${this.#domain} generated CRUD has no ownership service for ${input.modelName}`
      )
    }
    if (input.method === "retrieve") {
      await this.assertOwnedIds(
        service,
        [input.args[0] as string],
        input.modelName,
        input.context,
        true
      )
      return input.args
    }
    if (input.method === "list" || input.method === "listAndCount") {
      return [
        this.scope((input.args[0] ?? {}) as object, input.context),
        input.args[1],
      ]
    }
    if (input.method === "create") {
      return [this.stamp(input.args[0], input.context)]
    }
    if (input.method === "update") {
      const original = input.args[0] as any
      const entries = Array.isArray(original) ? original : [original]
      const ids = entries.flatMap((entry) =>
        entry && !("selector" in entry) && entry.id ? [entry.id] : []
      )
      await this.assertOwnedIds(service, ids, input.modelName, input.context)
      const stamped = entries.map((entry) =>
        entry && "selector" in entry
          ? {
              ...entry,
              selector: this.scope(entry.selector, input.context),
              data: this.stamp(entry.data, input.context),
            }
          : this.stamp(entry, input.context)
      )
      return [Array.isArray(original) ? stamped : stamped[0]]
    }
    const values = Array.isArray(input.args[0])
      ? input.args[0]
      : [input.args[0]]
    const ids = values.filter(isString)
    const selectors = values.filter(
      (value): value is object => typeof value === "object" && value !== null
    )
    await this.assertOwnedIds(
      service,
      ids,
      input.modelName,
      input.context,
      input.method !== "restore"
    )
    const selected = (
      await promiseAll(
        selectors.map((selector) =>
          service.list(
            this.scope(selector, input.context),
            {
              select: ["id"],
              take: null,
              withDeleted: input.method === "restore",
            },
            input.context
          )
        )
      )
    ).flat()
    return [
      deduplicate([...ids, ...selected.map((record) => record.id)]),
      ...input.args.slice(1),
    ]
  }

  validateGeneratedMethodResult(
    input: StoreIsolationGeneratedCrudResult
  ): void {
    if (this.#unscopedModels.has(input.modelName)) {
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
}
