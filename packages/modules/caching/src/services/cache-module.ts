import { MedusaModule } from "@medusajs/framework/modules-sdk"
import type {
  ICachingModuleService,
  ICachingStrategy,
  Logger,
} from "@medusajs/framework/types"
import {
  deduplicate,
  GraphQLUtils,
  getActiveMedusaContext,
  MedusaError,
} from "@medusajs/framework/utils"
import { CachingDefaultProvider, InjectedDependencies } from "@types"
import CacheProviderService from "./cache-provider"

const ONE_HOUR_IN_SECOND = 60 * 60

export default class CachingModuleService implements ICachingModuleService {
  protected container: InjectedDependencies
  protected providerService: CacheProviderService
  protected strategyCtr: new (...args: any[]) => ICachingStrategy
  protected strategy: ICachingStrategy
  protected defaultProviderId: string

  protected logger: Logger
  protected ongoingRequests: Map<string, Promise<any>> = new Map()

  protected ttl: number
  protected readonly storeIsolation_: {
    mode: "dedicated" | "shared"
    storeId: string
  }

  static traceGet?: (
    cacheGetFn: () => Promise<any>,
    key: string,
    tags: string[]
  ) => Promise<any>

  static traceSet?: (
    cacheSetFn: () => Promise<any>,
    key: string,
    tags: string[],
    options: { autoInvalidate?: boolean }
  ) => Promise<any>

  static traceClear?: (
    cacheClearFn: () => Promise<any>,
    key: string,
    tags: string[],
    options: { autoInvalidate?: boolean }
  ) => Promise<any>

  constructor(
    container: InjectedDependencies,
    protected readonly moduleDeclaration:
      | { options: { ttl?: number; store_isolation?: any } }
      | { ttl?: number; store_isolation?: any }
  ) {
    this.container = container
    this.providerService = container.cacheProviderService
    this.defaultProviderId = container[CachingDefaultProvider]
    this.strategyCtr = container.strategy as new (
      ...args: any[]
    ) => ICachingStrategy
    this.strategy = new this.strategyCtr(this.container, this)

    const moduleOptions =
      "options" in moduleDeclaration
        ? moduleDeclaration.options
        : moduleDeclaration

    this.ttl = moduleOptions.ttl ?? ONE_HOUR_IN_SECOND
    this.storeIsolation_ = {
      mode: moduleOptions.store_isolation?.mode ?? "dedicated",
      storeId:
        moduleOptions.store_isolation?.store_id ?? "__medusa_dedicated__",
    }

    this.logger = container.logger ?? (console as unknown as Logger)
  }

  protected resolveStoreId_(): string | undefined {
    const requested = getActiveMedusaContext()?.storeId?.trim()
    if (this.storeIsolation_.mode === "shared") {
      if (!requested) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Caching operations in shared mode require Store context"
        )
      }
      return requested
    }
    if (requested && requested !== this.storeIsolation_.storeId) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Caching context does not match the dedicated Store"
      )
    }
    return undefined
  }

  protected scopeCacheOptions_<T extends { key?: string; tags?: string[] }>(
    options: T
  ): T {
    const storeId = this.resolveStoreId_()
    if (!storeId) {
      return options
    }
    const prefix = `store:${storeId}:`
    return {
      ...options,
      key: options.key ? `${prefix}${options.key}` : undefined,
      tags: options.tags?.map((tag) => `${prefix}${tag}`),
    }
  }

  __hooks = {
    onApplicationStart: async () => {
      await this.onApplicationStart()
    },
    onApplicationShutdown: async () => {
      await this.onApplicationShutdown()
    },
    onApplicationPrepareShutdown: async () => {
      await this.onApplicationPrepareShutdown()
    },
  }

  protected async onApplicationStart() {
    const loadedSchema = MedusaModule.getAllJoinerConfigs()
      .map((joinerConfig) => joinerConfig?.schema ?? "")
      .join("\n")

    const defaultMedusaSchema = `
    scalar DateTime
    scalar JSON
    directive @enumValue(value: String) on ENUM_VALUE
  `

    const { schema: cleanedSchema } = GraphQLUtils.cleanGraphQLSchema(
      defaultMedusaSchema + loadedSchema
    )
    const mergedSchema = GraphQLUtils.mergeTypeDefs(cleanedSchema)
    const schema = GraphQLUtils.makeExecutableSchema({
      typeDefs: mergedSchema,
    })

    await this.strategy.onApplicationStart?.(
      schema,
      MedusaModule.getAllJoinerConfigs()
    )
  }

  protected async onApplicationShutdown() {
    await this.strategy.onApplicationShutdown?.()
    await this.providerService.shutdown()
  }

  protected async onApplicationPrepareShutdown() {
    await this.strategy.onApplicationPrepareShutdown?.()
  }

  protected static normalizeProviders(
    providers: string[] | { id: string; ttl?: number }[]
  ): { id: string; ttl?: number }[] {
    const providers_ = Array.isArray(providers) ? providers : [providers]
    return providers_.map((provider) => {
      return typeof provider === "string" ? { id: provider } : provider
    })
  }

  protected getRequestKey(
    key?: string,
    tags?: string[],
    providers?: string[]
  ): string {
    const keyPart = key || ""
    const tagsPart = tags?.sort().join(",") || ""
    const providersPart = providers?.join(",") || this.defaultProviderId
    return `${keyPart}|${tagsPart}|${providersPart}`
  }

  protected getClearRequestKey(
    key?: string,
    tags?: string[],
    providers?: string[]
  ): string {
    const keyPart = key || ""
    const tagsPart = tags?.sort().join(",") || ""
    const providersPart = providers?.join(",") || this.defaultProviderId
    return `clear:${keyPart}|${tagsPart}|${providersPart}`
  }

  async get(options: { key?: string; tags?: string[]; providers?: string[] }) {
    options = this.scopeCacheOptions_(options)
    if (CachingModuleService.traceGet) {
      return await CachingModuleService.traceGet(
        () => this.get_(options),
        options.key ?? "",
        options.tags ?? []
      )
    }

    return await this.get_(options)
  }

  private async get_({
    key,
    tags,
    providers,
  }: {
    key?: string
    tags?: string[]
    providers?: string[]
  }) {
    if (!key && !tags) {
      throw new MedusaError(
        MedusaError.Types.INVALID_ARGUMENT,
        "Either key or tags must be provided"
      )
    }

    const requestKey = this.getRequestKey(key, tags, providers)

    const existingRequest = this.ongoingRequests.get(requestKey)
    if (existingRequest) {
      return await existingRequest
    }

    const requestPromise = this.performCacheGet(key, tags, providers)
    this.ongoingRequests.set(requestKey, requestPromise)

    try {
      const result = await requestPromise
      return result
    } finally {
      // Clean up the completed request
      this.ongoingRequests.delete(requestKey)
    }
  }

  protected async performCacheGet(
    key?: string,
    tags?: string[],
    providers?: string[]
  ): Promise<any> {
    const providersToCheck = providers ?? [this.defaultProviderId]

    for (const providerId of providersToCheck) {
      try {
        const provider_ = this.providerService.retrieveProvider(providerId)
        const result = await provider_.get({ key, tags })

        if (result != null) {
          return result
        }
      } catch (error) {
        this.logger.warn(
          `Cache provider ${providerId} failed: ${error.message}\n${error.stack}`
        )
        continue
      }
    }

    return null
  }

  async set(options: {
    key: string
    data: object
    ttl?: number
    tags?: string[]
    computeAutomaticTags?: boolean
    providers?: string[]
    options?: { autoInvalidate?: boolean }
  }) {
    options = this.scopeCacheOptions_(options)
    if (CachingModuleService.traceSet) {
      return await CachingModuleService.traceSet(
        () => this.set_(options),
        options.key,
        options.tags ?? [],
        options.options ?? {}
      )
    }

    return await this.set_(options)
  }

  private async set_({
    key,
    data,
    ttl,
    tags,
    computeAutomaticTags,
    providers,
    options,
  }: {
    key: string
    data: object
    tags?: string[]
    computeAutomaticTags?: boolean
    ttl?: number
    providers?: string[] | { id: string; ttl?: number }[]
    options?: {
      autoInvalidate?: boolean
    }
  }) {
    if (!key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_ARGUMENT,
        "[CachingModuleService] Key must be provided"
      )
    }

    const key_ = key
    // Given tags are used on their own, unless the caller asked for the computed ones
    // to be applied along with them. The union is what anything the computation can't
    // see from the data needs: link tables, relations selected without their id, or
    // entities that affect the data without appearing in it.
    const computed =
      !tags || computeAutomaticTags ? await this.computeTags(data) : []
    const tags_ = tags ? deduplicate([...tags, ...computed]) : computed

    let providers_: string[] | { id: string; ttl?: number }[] = [
      this.defaultProviderId,
    ]
    providers_ = CachingModuleService.normalizeProviders(
      providers ?? providers_
    )

    const providerIds = providers_.map((p) => p.id)
    const requestKey = this.getRequestKey(key_, tags_, providerIds)

    const existingRequest = this.ongoingRequests.get(requestKey)
    if (existingRequest) {
      return await existingRequest
    }

    const requestPromise = this.performCacheSet(
      key_,
      tags_,
      data,
      ttl,
      providers_,
      options
    )
    this.ongoingRequests.set(requestKey, requestPromise)

    try {
      await requestPromise
    } finally {
      // Clean up the completed request
      this.ongoingRequests.delete(requestKey)
    }
  }

  protected async performCacheSet(
    key: string,
    tags: string[],
    data: object,
    ttl?: number,
    providers?: { id: string; ttl?: number }[],
    options?: {
      autoInvalidate?: boolean
    }
  ): Promise<void> {
    await Promise.all(
      (providers || []).map((providerOptions) =>
        this.providerService.retrieveProvider(providerOptions.id).set({
          key,
          tags,
          data,
          ttl: providerOptions.ttl ?? ttl ?? this.ttl,
          options,
        })
      )
    )
  }

  async clear(options: {
    key?: string
    tags?: string[]
    options?: { autoInvalidate?: boolean }
    providers?: string[]
  }) {
    options = this.scopeCacheOptions_(options)
    if (CachingModuleService.traceClear) {
      return await CachingModuleService.traceClear(
        () => this.clear_(options),
        options.key ?? "",
        options.tags ?? [],
        options.options ?? {}
      )
    }

    return await this.clear_(options)
  }

  private async clear_({
    key,
    tags,
    options,
    providers,
  }: {
    key?: string
    tags?: string[]
    options?: {
      autoInvalidate?: boolean
    }
    providers?: string[]
  }) {
    if (!key && !tags) {
      throw new MedusaError(
        MedusaError.Types.INVALID_ARGUMENT,
        "Either key or tags must be provided"
      )
    }

    const requestKey = this.getClearRequestKey(key, tags, providers)

    const existingRequest = this.ongoingRequests.get(requestKey)
    if (existingRequest) {
      return await existingRequest
    }

    const requestPromise = this.performCacheClear(key, tags, options, providers)
    this.ongoingRequests.set(requestKey, requestPromise)

    try {
      await requestPromise
    } finally {
      // Clean up the completed request
      this.ongoingRequests.delete(requestKey)
    }
  }

  protected async performCacheClear(
    key?: string,
    tags?: string[],
    options?: {
      autoInvalidate?: boolean
    },
    providers?: string[]
  ): Promise<void> {
    let providerIds_: string[] = [this.defaultProviderId]
    if (providers) {
      providerIds_ = Array.isArray(providers) ? providers : [providers]
    }

    await Promise.all(
      providerIds_
        .map((id) => this.providerService.retrieveProvider(id))
        .map((provider) => provider.clear({ key, tags, options }))
    )
  }

  async computeKey(input: object): Promise<string> {
    const storeId = this.resolveStoreId_()
    return await this.strategy.computeKey(
      storeId ? { store_id: storeId, input } : input
    )
  }

  async computeTags(
    input: object,
    options?: Record<string, any>
  ): Promise<string[]> {
    const tags = await this.strategy.computeTags(input, options)
    const storeId = this.resolveStoreId_()
    return storeId ? tags.map((tag) => `store:${storeId}:${tag}`) : tags
  }
}
