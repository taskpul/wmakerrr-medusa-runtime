import { Context, InternalModuleDeclaration } from "@medusajs/framework/types"
import {
  deduplicate,
  isString,
  MedusaError,
  promiseAll,
} from "@medusajs/framework/utils"

export const PROMOTION_DEDICATED_STORE_ID = "__medusa_dedicated__"
export const PROMOTION_REQUEST_ROLE = "medusa_promotion_request"
export const PROMOTION_STORE_SETTING = "medusa.store_id"

export type PromotionModuleOptions = {
  store_isolation?:
    | { mode: "shared"; store_id?: never }
    | { mode?: "dedicated"; store_id?: string }
}

type OwnershipService = { list: (...args: any[]) => Promise<any[]> }
type Services = Record<
  | "Promotion"
  | "ApplicationMethod"
  | "Campaign"
  | "CampaignBudget"
  | "CampaignBudgetUsage"
  | "PromotionRule"
  | "PromotionRuleValue",
  OwnershipService
>
type StoreContext = Context & { storeId?: string }

export type GeneratedCrudHookInput = {
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

export type GeneratedCrudResultHookInput = GeneratedCrudHookInput & {
  result: unknown
}

export class PromotionStoreOwnership {
  readonly #mode: "dedicated" | "shared"
  readonly #dedicatedStoreId: string
  readonly #services: Services

  get isShared(): boolean {
    return this.#mode === "shared"
  }

  constructor(
    moduleOptions:
      | InternalModuleDeclaration
      | PromotionModuleOptions
      | Record<string, unknown>
      | undefined,
    services: Services
  ) {
    this.#services = services
    const configured = (moduleOptions ?? {}) as Record<string, unknown>
    const container =
      "options" in configured && configured.options
        ? (configured.options as Record<string, unknown>)
        : configured
    const options = (container.store_isolation ?? {}) as NonNullable<
      PromotionModuleOptions["store_isolation"]
    >
    this.#mode = options.mode ?? "dedicated"
    this.#dedicatedStoreId = options.store_id ?? PROMOTION_DEDICATED_STORE_ID
    if (this.#mode === "shared" && options.store_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Promotion store_isolation.store_id cannot be configured in shared mode"
      )
    }
  }

  resolveStoreId(context: Context): string {
    const requested = (context as StoreContext).storeId?.trim()
    if (this.#mode === "shared") {
      if (!requested) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Promotion operations in shared mode require Context.storeId"
        )
      }
      return requested
    }
    if (requested && requested !== this.#dedicatedStoreId) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Promotion context does not match the dedicated Store"
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
    input: GeneratedCrudHookInput
  ): Promise<unknown[]> {
    const service = this.#services[input.modelName as keyof Services]
    if (!service) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Promotion generated CRUD has no ownership service for ${input.modelName}`
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
}
