import {
  Context,
  DAL,
  InferEntityType,
  InternalModuleDeclaration,
  IStoreModuleService,
  ModulesSdkTypes,
  StoreTypes,
} from "@medusajs/framework/types"
import {
  EmitEvents,
  getDuplicates,
  InjectManager,
  InjectTransactionManager,
  isString,
  MedusaContext,
  MedusaError,
  MedusaService,
  normalizeCurrencyCode,
  promiseAll,
  removeUndefined,
  StoreIsolationGeneratedCrudInput,
  StoreIsolationGeneratedCrudResult,
  StoreIsolationManager,
} from "@medusajs/framework/utils"
import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"

import { Store, StoreCurrency, StoreLocale } from "@models"
import { UpdateStoreInput } from "@types"
import { setStoreDatabaseContext } from "../database-context"

type InjectedDependencies = {
  baseRepository: DAL.RepositoryService
  storeService: ModulesSdkTypes.IMedusaInternalService<any>
}

export default class StoreModuleService
  extends MedusaService<{
    Store: { dto: StoreTypes.StoreDTO }
    StoreCurrency: { dto: StoreTypes.StoreCurrencyDTO }
    StoreLocale: { dto: StoreTypes.StoreLocaleDTO }
  }>({ Store, StoreCurrency, StoreLocale })
  implements IStoreModuleService
{
  protected baseRepository_: DAL.RepositoryService
  protected readonly storeService_: ModulesSdkTypes.IMedusaInternalService<
    InferEntityType<typeof Store>
  >
  protected readonly storeIsolation_: StoreIsolationManager<any>
  private readonly databaseStoreContexts_ = new WeakMap<object, string>()

  constructor(
    { baseRepository, storeService }: InjectedDependencies,
    protected readonly moduleDeclaration: InternalModuleDeclaration
  ) {
    // @ts-ignore
    super(...arguments)
    this.baseRepository_ = baseRepository
    this.storeService_ = storeService
    this.storeIsolation_ = new StoreIsolationManager({
      domain: "Store",
      moduleOptions: moduleDeclaration,
      services: { Store: storeService },
      unscopedModels: ["StoreCurrency", "StoreLocale"],
    })
  }

  __storeIsolationMode(): "dedicated" | "shared" {
    return this.storeIsolation_.isShared ? "shared" : "dedicated"
  }

  protected async withManagerContext_<T>(
    context: Context,
    task: (context: Context) => Promise<T>
  ): Promise<T> {
    const storeId = this.storeIsolation_.resolveStoreId(context)
    const execute = async (manager: SqlEntityManager, scoped: Context) => {
      scoped.storeId ??= storeId
      const active = this.databaseStoreContexts_.get(manager)
      if (active && active !== storeId) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Store transaction is already bound to another Store"
        )
      }
      if (!active) {
        await setStoreDatabaseContext(
          manager,
          storeId,
          this.storeIsolation_.isShared
        )
        this.databaseStoreContexts_.set(manager, storeId)
      }
      return await task(scoped)
    }
    const transactionManager = context.transactionManager as SqlEntityManager
    if (transactionManager) {
      return await execute(transactionManager, context)
    }
    return await this.baseRepository_.transaction<SqlEntityManager>(
      async (manager) =>
        await execute(manager, { ...context, transactionManager: manager }),
      { manager: context.manager as SqlEntityManager | undefined } as any
    )
  }

  protected async prepareGeneratedMethodArgs_(
    input: StoreIsolationGeneratedCrudInput
  ): Promise<unknown[]> {
    return this.storeIsolation_.prepareGeneratedMethodArgs(input)
  }

  protected async validateGeneratedMethodResult_(
    input: StoreIsolationGeneratedCrudResult
  ): Promise<void> {
    this.storeIsolation_.validateGeneratedMethodResult(input)
  }

  // @ts-expect-error
  async createStores(
    data: StoreTypes.CreateStoreDTO[],
    sharedContext?: Context
  ): Promise<StoreTypes.StoreDTO[]>
  // @ts-expect-error
  async createStores(
    data: StoreTypes.CreateStoreDTO,
    sharedContext?: Context
  ): Promise<StoreTypes.StoreDTO>

  @InjectManager()
  @EmitEvents()
  // @ts-expect-error
  async createStores(
    data: StoreTypes.CreateStoreDTO | StoreTypes.CreateStoreDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<StoreTypes.StoreDTO | StoreTypes.StoreDTO[]> {
    const input = Array.isArray(data) ? data : [data]

    const result = await this.create_(input, sharedContext)

    return await this.baseRepository_.serialize<StoreTypes.StoreDTO[]>(
      Array.isArray(data) ? result : result[0]
    )
  }

  @InjectTransactionManager()
  async create_(
    data: StoreTypes.CreateStoreDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<InferEntityType<typeof Store>[]> {
    let normalizedInput = StoreModuleService.normalizeInput(data)
    StoreModuleService.validateCreateRequest(normalizedInput)

    return (
      await this.storeService_.upsertWithReplace(
        normalizedInput,
        { relations: ["supported_currencies", "supported_locales"] },
        sharedContext
      )
    ).entities
  }

  async upsertStores(
    data: StoreTypes.UpsertStoreDTO[],
    sharedContext?: Context
  ): Promise<StoreTypes.StoreDTO[]>
  async upsertStores(
    data: StoreTypes.UpsertStoreDTO,
    sharedContext?: Context
  ): Promise<StoreTypes.StoreDTO>

  @InjectManager()
  @EmitEvents()
  async upsertStores(
    data: StoreTypes.UpsertStoreDTO | StoreTypes.UpsertStoreDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<StoreTypes.StoreDTO | StoreTypes.StoreDTO[]> {
    const result = await this.upsertStores_(data, sharedContext)

    return await this.baseRepository_.serialize<
      StoreTypes.StoreDTO[] | StoreTypes.StoreDTO
    >(Array.isArray(data) ? result : result[0])
  }

  @InjectTransactionManager()
  protected async upsertStores_(
    data: StoreTypes.UpsertStoreDTO | StoreTypes.UpsertStoreDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<InferEntityType<typeof Store>[]> {
    const input = Array.isArray(data) ? data : [data]
    const forUpdate = input.filter(
      (store): store is UpdateStoreInput => !!store.id
    )
    const forCreate = input.filter(
      (store): store is StoreTypes.CreateStoreDTO => !store.id
    )

    const operations: Promise<InferEntityType<typeof Store>[]>[] = []

    if (forCreate.length) {
      operations.push(this.create_(forCreate, sharedContext))
    }
    if (forUpdate.length) {
      operations.push(this.update_(forUpdate, sharedContext))
    }

    const result = (await promiseAll(operations)).flat()

    return result
  }

  // @ts-expect-error
  async updateStores(
    id: string,
    data: StoreTypes.UpdateStoreDTO,
    sharedContext?: Context
  ): Promise<StoreTypes.StoreDTO>
  // @ts-expect-error
  async updateStores(
    selector: StoreTypes.FilterableStoreProps,
    data: StoreTypes.UpdateStoreDTO,
    sharedContext?: Context
  ): Promise<StoreTypes.StoreDTO[]>

  @InjectManager()
  @EmitEvents()
  // @ts-expect-error
  async updateStores(
    idOrSelector: string | StoreTypes.FilterableStoreProps,
    data: StoreTypes.UpdateStoreDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<StoreTypes.StoreDTO | StoreTypes.StoreDTO[]> {
    let normalizedInput: UpdateStoreInput[] = []
    if (isString(idOrSelector)) {
      normalizedInput = [{ id: idOrSelector, ...data }]
    } else {
      const stores = await this.storeService_.list(
        idOrSelector,
        {},
        sharedContext
      )

      normalizedInput = stores.map((store) => ({
        id: store.id,
        ...data,
      }))
    }

    const updateResult = await this.update_(normalizedInput, sharedContext)

    const stores = await this.baseRepository_.serialize<
      StoreTypes.StoreDTO[] | StoreTypes.StoreDTO
    >(updateResult)

    return isString(idOrSelector) ? stores[0] : stores
  }

  @InjectTransactionManager()
  protected async update_(
    data: UpdateStoreInput[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<InferEntityType<typeof Store>[]> {
    const normalizedInput = StoreModuleService.normalizeInput(data)
    StoreModuleService.validateUpdateRequest(normalizedInput)

    return (
      await this.storeService_.upsertWithReplace(
        normalizedInput,
        { relations: ["supported_currencies", "supported_locales"] },
        sharedContext
      )
    ).entities
  }

  private static normalizeInput<T extends StoreTypes.UpdateStoreDTO>(
    stores: T[]
  ): T[] {
    return stores.map((store) =>
      removeUndefined({
        ...store,
        supported_currencies: store.supported_currencies?.map((c) => ({
          ...c,
          currency_code: normalizeCurrencyCode(c.currency_code),
        })),
        name: store.name?.trim(),
      })
    )
  }

  private static validateCreateRequest(
    stores: StoreTypes.CreateStoreDTO[] | StoreTypes.UpdateStoreDTO[]
  ) {
    for (const store of stores) {
      if (store.supported_currencies?.length) {
        StoreModuleService.validateUnique(
          store.supported_currencies.map((currency) => currency.currency_code),
          "currency"
        )

        let seenDefault = false
        store.supported_currencies.forEach((currency) => {
          if (currency.is_default) {
            if (seenDefault) {
              throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                `Only one default currency is allowed`
              )
            }
            seenDefault = true
          }
        })

        if (!seenDefault) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `There should be a default currency set for the store`
          )
        }
      }

      if (store.supported_locales?.length) {
        StoreModuleService.validateUnique(
          store.supported_locales.map((locale) => locale.locale_code),
          "locale"
        )
      }
    }
  }

  private static validateUnique = (items: string[], fieldName: string) => {
    const duplicates = getDuplicates(items)

    if (duplicates.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Duplicate ${fieldName} codes: ${duplicates.join(", ")}`
      )
    }
  }

  private static validateUpdateRequest(stores: UpdateStoreInput[]) {
    StoreModuleService.validateCreateRequest(stores)
  }
}
