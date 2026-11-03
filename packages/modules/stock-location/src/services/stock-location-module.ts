import {
  Context,
  CreateStockLocationInput,
  DAL,
  FilterableStockLocationProps,
  IEventBusService,
  InferEntityType,
  InternalModuleDeclaration,
  IStockLocationService,
  ModuleJoinerConfig,
  ModulesSdkTypes,
  StockLocationAddressInput,
  StockLocationTypes,
  UpdateStockLocationAddressInput,
  UpdateStockLocationInput,
  UpsertStockLocationAddressInput,
  UpsertStockLocationInput,
} from "@medusajs/framework/types"
import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import {
  EmitEvents,
  InjectManager,
  InjectTransactionManager,
  isString,
  MedusaContext,
  MedusaService,
  Modules,
  promiseAll,
  MedusaError,
} from "@medusajs/framework/utils"
import { joinerConfig } from "../joiner-config"
import { StockLocation, StockLocationAddress } from "../models"
import { setStockLocationStoreDatabaseContext } from "../database-context"
import {
  GeneratedCrudHookInput,
  GeneratedCrudResultHookInput,
  StockLocationStoreOwnership,
} from "../store-ownership"

type InjectedDependencies = {
  [Modules.EVENT_BUS]: IEventBusService
  baseRepository: DAL.RepositoryService
  stockLocationService: ModulesSdkTypes.IMedusaInternalService<any>
  stockLocationAddressService: ModulesSdkTypes.IMedusaInternalService<any>
}

/**
 * Service for managing stock locations.
 */
export default class StockLocationModuleService
  extends MedusaService<{
    StockLocation: { dto: StockLocationTypes.StockLocationDTO }
    StockLocationAddress: { dto: StockLocationTypes.StockLocationAddressDTO }
  }>({ StockLocation, StockLocationAddress })
  implements IStockLocationService
{
  protected readonly eventBusModuleService_: IEventBusService
  protected baseRepository_: DAL.RepositoryService
  protected readonly stockLocationService_: ModulesSdkTypes.IMedusaInternalService<
    InferEntityType<typeof StockLocation>
  >
  protected readonly stockLocationAddressService_: ModulesSdkTypes.IMedusaInternalService<
    InferEntityType<typeof StockLocationAddress>
  >
  protected readonly storeOwnership_: StockLocationStoreOwnership
  private readonly databaseStoreContexts_ = new WeakMap<object, string>()

  constructor(
    {
      [Modules.EVENT_BUS]: eventBusModuleService,
      baseRepository,
      stockLocationService,
      stockLocationAddressService,
    }: InjectedDependencies,
    protected readonly moduleDeclaration: InternalModuleDeclaration
  ) {
    // @ts-ignore
    super(...arguments)

    this.baseRepository_ = baseRepository
    this.stockLocationService_ = stockLocationService
    this.stockLocationAddressService_ = stockLocationAddressService
    this.eventBusModuleService_ = eventBusModuleService
    this.storeOwnership_ = new StockLocationStoreOwnership(moduleDeclaration, {
      StockLocation: stockLocationService,
      StockLocationAddress: stockLocationAddressService,
    })
  }

  __joinerConfig(): ModuleJoinerConfig {
    return joinerConfig
  }

  __storeIsolationMode(): "dedicated" | "shared" {
    return this.storeOwnership_.isShared ? "shared" : "dedicated"
  }

  protected async withManagerContext_<T>(
    context: Context,
    task: (context: Context) => Promise<T>
  ): Promise<T> {
    const storeId = this.storeOwnership_.resolveStoreId(context)
    const execute = async (
      transactionManager: SqlEntityManager,
      scopedContext: Context
    ) => {
      scopedContext.storeId ??= storeId
      const activeStoreId = this.databaseStoreContexts_.get(transactionManager)
      if (activeStoreId && activeStoreId !== storeId) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Stock Location transaction is already bound to another Store"
        )
      }
      if (!activeStoreId) {
        await setStockLocationStoreDatabaseContext(
          transactionManager,
          storeId,
          this.storeOwnership_.isShared
        )
        this.databaseStoreContexts_.set(transactionManager, storeId)
      }
      return await task(scopedContext)
    }
    const transactionManager = context.transactionManager as
      SqlEntityManager | undefined
    if (transactionManager) return await execute(transactionManager, context)
    return await this.baseRepository_.transaction<SqlEntityManager>(
      async (manager) =>
        await execute(manager, { ...context, transactionManager: manager }),
      {
        manager: context.manager as SqlEntityManager | undefined,
        isolationLevel: context.isolationLevel,
        enableNestedTransactions: context.enableNestedTransactions,
      } as any
    )
  }

  protected async prepareGeneratedMethodArgs_(
    input: GeneratedCrudHookInput
  ): Promise<unknown[]> {
    return this.storeOwnership_.prepareGeneratedMethodArgs(input)
  }

  protected async validateGeneratedMethodResult_(
    input: GeneratedCrudResultHookInput
  ): Promise<void> {
    this.storeOwnership_.validateGeneratedMethodResult(input)
  }

  // @ts-expect-error
  createStockLocations(
    data: CreateStockLocationInput,
    context: Context
  ): Promise<StockLocationTypes.StockLocationDTO>
  // @ts-expect-error
  createStockLocations(
    data: CreateStockLocationInput[],
    context: Context
  ): Promise<StockLocationTypes.StockLocationDTO[]>

  @InjectManager()
  @EmitEvents()
  // @ts-expect-error
  async createStockLocations(
    data: CreateStockLocationInput | CreateStockLocationInput[],
    @MedusaContext() context: Context = {}
  ): Promise<
    StockLocationTypes.StockLocationDTO | StockLocationTypes.StockLocationDTO[]
  > {
    const input = Array.isArray(data) ? data : [data]

    const created = await this.createStockLocations_(input, context)

    const serialized = await this.baseRepository_.serialize<
      | StockLocationTypes.StockLocationDTO
      | StockLocationTypes.StockLocationDTO[]
    >(created)

    return Array.isArray(data) ? serialized : serialized[0]
  }

  @InjectTransactionManager()
  async createStockLocations_(
    data: CreateStockLocationInput[],
    @MedusaContext() context: Context = {}
  ): Promise<InferEntityType<typeof StockLocation>[]> {
    const stamped = this.storeOwnership_.stampLocations(data, context)
    await this.storeOwnership_.assertAddresses(stamped, context)
    return await this.stockLocationService_.create(stamped, context)
  }

  async upsertStockLocations(
    data: UpsertStockLocationInput,
    context?: Context
  ): Promise<StockLocationTypes.StockLocationDTO>
  async upsertStockLocations(
    data: UpsertStockLocationInput[],
    context?: Context
  ): Promise<StockLocationTypes.StockLocationDTO[]>

  @InjectManager()
  @EmitEvents()
  async upsertStockLocations(
    data: UpsertStockLocationInput | UpsertStockLocationInput[],
    @MedusaContext() context: Context = {}
  ): Promise<
    StockLocationTypes.StockLocationDTO | StockLocationTypes.StockLocationDTO[]
  > {
    const input = Array.isArray(data) ? data : [data]

    const result = await this.upsertStockLocations_(input, context)

    return await this.baseRepository_.serialize<
      | StockLocationTypes.StockLocationDTO[]
      | StockLocationTypes.StockLocationDTO
    >(Array.isArray(data) ? result : result[0])
  }

  @InjectTransactionManager()
  async upsertStockLocations_(
    input: UpsertStockLocationInput[],
    @MedusaContext() context: Context = {}
  ) {
    const toUpdate = input.filter(
      (location): location is UpdateStockLocationInput => !!location.id
    ) as UpdateStockLocationInput[]
    const toCreate = input.filter(
      (location) => !location.id
    ) as CreateStockLocationInput[]

    const operations: Promise<
      | InferEntityType<typeof StockLocation>[]
      | InferEntityType<typeof StockLocation>
    >[] = []

    if (toCreate.length) {
      operations.push(this.createStockLocations_(toCreate, context))
    }
    if (toUpdate.length) {
      operations.push(this.updateStockLocations_(toUpdate, context))
    }

    return (await promiseAll(operations)).flat()
  }

  // @ts-expect-error
  updateStockLocations(
    id: string,
    input: UpdateStockLocationInput,
    context?: Context
  ): Promise<StockLocationTypes.StockLocationDTO>
  // @ts-expect-error
  updateStockLocations(
    selector: FilterableStockLocationProps,
    input: UpdateStockLocationInput,
    context?: Context
  ): Promise<StockLocationTypes.StockLocationDTO[]>

  /**
   * Updates an existing stock location.
   * @param stockLocationId - The ID of the stock location to update.
   * @param updateData - The update data for the stock location.
   * @param context
   * @returns The updated stock location.
   */
  @InjectManager()
  @EmitEvents()
  // @ts-expect-error
  async updateStockLocations(
    idOrSelector: string | FilterableStockLocationProps,
    data: UpdateStockLocationInput | UpdateStockLocationInput[],
    @MedusaContext() context: Context = {}
  ): Promise<
    StockLocationTypes.StockLocationDTO | StockLocationTypes.StockLocationDTO[]
  > {
    let normalizedInput:
      | (UpdateStockLocationInput & { id: string })[]
      | { data: any; selector: FilterableStockLocationProps } = []
    if (isString(idOrSelector)) {
      normalizedInput = [{ id: idOrSelector, ...data }]
    } else {
      normalizedInput = { data, selector: idOrSelector }
    }
    const updated = await this.updateStockLocations_(normalizedInput, context)

    const serialized = await this.baseRepository_.serialize<
      | StockLocationTypes.StockLocationDTO
      | StockLocationTypes.StockLocationDTO[]
    >(updated)

    return Array.isArray(data) ? serialized : serialized[0]
  }

  @InjectTransactionManager()
  async updateStockLocations_(
    data:
      | UpdateStockLocationInput[]
      | UpdateStockLocationInput
      | { data: any; selector: FilterableStockLocationProps },
    @MedusaContext() context: Context = {}
  ): Promise<
    | InferEntityType<typeof StockLocation>[]
    | InferEntityType<typeof StockLocation>
  > {
    const entries =
      "selector" in data
        ? data
        : this.storeOwnership_.stampLocations(data, context)
    if ("selector" in entries) {
      entries.selector = this.storeOwnership_.scope(entries.selector, context)
      entries.data = this.storeOwnership_.stampLocations(entries.data, context)
      await this.storeOwnership_.assertAddresses(entries.data, context)
    } else {
      const records = Array.isArray(entries) ? entries : [entries]
      await this.storeOwnership_.assertOwnedIds(
        this.stockLocationService_,
        records
          .map(
            (record) => (record as UpdateStockLocationInput & { id: string }).id
          )
          .filter(Boolean),
        "Stock locations",
        context
      )
      await this.storeOwnership_.assertAddresses(records, context)
    }
    return await this.stockLocationService_.update(entries, context)
  }

  // @ts-expect-error
  updateStockLocationAddresses(
    data: StockLocationAddressInput & { id: string },
    context?: Context
  ): Promise<StockLocationTypes.StockLocationAddressDTO>
  // @ts-expect-error
  updateStockLocationAddresses(
    data: (StockLocationAddressInput & { id: string })[],
    context?: Context
  ): Promise<StockLocationTypes.StockLocationAddressDTO[]>

  @InjectManager()
  @EmitEvents()
  // @ts-expect-error
  async updateStockLocationAddresses(
    data:
      | (StockLocationAddressInput & { id: string })
      | (StockLocationAddressInput & { id: string })[],
    @MedusaContext() context: Context = {}
  ) {
    const input = Array.isArray(data) ? data : [data]

    const updated = await this.updateStockLocationAddresses_(input, context)

    const serialized = await this.baseRepository_.serialize<
      | StockLocationTypes.StockLocationAddressDTO
      | StockLocationTypes.StockLocationAddressDTO[]
    >(updated)

    return Array.isArray(data) ? serialized : serialized[0]
  }

  @InjectTransactionManager()
  private async updateStockLocationAddresses_(
    input: (StockLocationAddressInput & { id: string })[],
    @MedusaContext() context: Context
  ) {
    await this.storeOwnership_.assertOwnedIds(
      this.stockLocationAddressService_,
      input.map(({ id }) => id),
      "Stock location addresses",
      context
    )
    return await this.stockLocationAddressService_.update(
      this.storeOwnership_.stamp(input, context),
      context
    )
  }

  async upsertStockLocationAddresses(
    data: UpsertStockLocationAddressInput,
    context?: Context
  ): Promise<StockLocationTypes.StockLocationAddressDTO>
  async upsertStockLocationAddresses(
    data: UpsertStockLocationAddressInput[],
    context?: Context
  ): Promise<StockLocationTypes.StockLocationAddressDTO[]>

  @InjectManager()
  @EmitEvents()
  async upsertStockLocationAddresses(
    data: UpsertStockLocationAddressInput | UpsertStockLocationAddressInput[],
    @MedusaContext() context: Context = {}
  ): Promise<
    | StockLocationTypes.StockLocationAddressDTO
    | StockLocationTypes.StockLocationAddressDTO[]
  > {
    const input = Array.isArray(data) ? data : [data]

    const result = await this.upsertStockLocationAddresses_(input, context)

    return await this.baseRepository_.serialize<
      | StockLocationTypes.StockLocationAddressDTO[]
      | StockLocationTypes.StockLocationAddressDTO
    >(Array.isArray(data) ? result : result[0])
  }

  @InjectTransactionManager()
  async upsertStockLocationAddresses_(
    input: UpsertStockLocationAddressInput[],
    @MedusaContext() context: Context = {}
  ) {
    const toUpdate = input.filter(
      (location): location is UpdateStockLocationAddressInput => !!location.id
    ) as UpdateStockLocationAddressInput[]
    const toCreate = input.filter(
      (location) => !location.id
    ) as StockLocationAddressInput[]

    const operations: Promise<
      | InferEntityType<typeof StockLocationAddress>[]
      | InferEntityType<typeof StockLocationAddress>
    >[] = []

    if (toCreate.length) {
      operations.push(
        this.stockLocationAddressService_.create(
          this.storeOwnership_.stamp(toCreate, context),
          context
        )
      )
    }
    if (toUpdate.length) {
      operations.push(
        (async () => {
          await this.storeOwnership_.assertOwnedIds(
            this.stockLocationAddressService_,
            toUpdate.map(({ id }) => id),
            "Stock location addresses",
            context
          )
          return await this.stockLocationAddressService_.update(
            this.storeOwnership_.stamp(toUpdate, context),
            context
          )
        })()
      )
    }

    return (await promiseAll(operations)).flat()
  }
}
