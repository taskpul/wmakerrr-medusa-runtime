import {
  Context,
  DAL,
  InferEntityType,
  INotificationModuleService,
  InternalModuleDeclaration,
  Logger,
  ModulesSdkTypes,
  NotificationTypes,
} from "@medusajs/framework/types"
import {
  EmitEvents,
  generateEntityId,
  InjectManager,
  MedusaContext,
  MedusaError,
  MedusaService,
  NotificationStatus,
  promiseAll,
  StoreIsolationGeneratedCrudInput,
  StoreIsolationGeneratedCrudResult,
  StoreIsolationManager,
} from "@medusajs/framework/utils"
import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import { Notification } from "@models"
import NotificationProviderService from "./notification-provider"
import { setNotificationStoreDatabaseContext } from "../database-context"

type InjectedDependencies = {
  logger?: Logger
  baseRepository: DAL.RepositoryService
  notificationService: ModulesSdkTypes.IMedusaInternalService<
    typeof Notification
  >
  notificationProviderService: NotificationProviderService
}

export default class NotificationModuleService
  extends MedusaService<{
    Notification: { dto: NotificationTypes.NotificationDTO }
  }>({ Notification })
  implements INotificationModuleService
{
  protected baseRepository_: DAL.RepositoryService
  protected readonly notificationService_: ModulesSdkTypes.IMedusaInternalService<
    typeof Notification
  >
  protected readonly notificationProviderService_: NotificationProviderService
  protected readonly storeIsolation_: StoreIsolationManager<any>
  private readonly databaseStoreContexts_ = new WeakMap<object, string>()

  constructor(
    {
      baseRepository,
      notificationService,
      notificationProviderService,
    }: InjectedDependencies,
    protected readonly moduleDeclaration: InternalModuleDeclaration
  ) {
    // @ts-ignore
    super(...arguments)
    this.baseRepository_ = baseRepository
    this.notificationService_ = notificationService
    this.notificationProviderService_ = notificationProviderService
    this.storeIsolation_ = new StoreIsolationManager({
      domain: "Notification",
      moduleOptions: moduleDeclaration,
      services: { Notification: notificationService },
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
          "Notification transaction is already bound to another Store"
        )
      }
      if (!active) {
        await setNotificationStoreDatabaseContext(
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
  createNotifications(
    data: NotificationTypes.CreateNotificationDTO[],
    sharedContext?: Context
  ): Promise<NotificationTypes.NotificationDTO[]>
  // @ts-expect-error
  createNotifications(
    data: NotificationTypes.CreateNotificationDTO,
    sharedContext?: Context
  ): Promise<NotificationTypes.NotificationDTO>

  @InjectManager()
  @EmitEvents()
  // @ts-expect-error
  async createNotifications(
    data:
      | NotificationTypes.CreateNotificationDTO
      | NotificationTypes.CreateNotificationDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<
    NotificationTypes.NotificationDTO | NotificationTypes.NotificationDTO[]
  > {
    const normalized = Array.isArray(data) ? data : [data]

    const createdNotifications = await this.createNotifications_(
      normalized,
      sharedContext
    )

    const serialized =
      await this.baseRepository_.serialize<NotificationTypes.NotificationDTO[]>(
        createdNotifications
      )

    return Array.isArray(data) ? serialized : serialized[0]
  }

  @InjectManager()
  protected async createNotifications_(
    data: NotificationTypes.CreateNotificationDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<InferEntityType<typeof Notification>[]> {
    if (!data.length) {
      return []
    }

    // TODO: At this point we should probably take a lock with the idempotency keys so we don't have race conditions.
    // Also, we should probably rely on Redis for this instead of the database.
    const idempotencyKeys = data
      .map((entry) => entry.idempotency_key)
      .filter(Boolean)

    let { notificationsToProcess, createdNotifications } =
      await this.baseRepository_.transaction(
        async (txManager) => {
          const context = {
            ...sharedContext,
            transactionManager: txManager,
          }

          const alreadySentNotifications = await this.notificationService_.list(
            this.storeIsolation_.scope(
              {
                idempotency_key: idempotencyKeys,
              },
              context
            ),
            {},
            context
          )

          const existsMap = new Map(
            alreadySentNotifications.map((n) => [
              n.idempotency_key as string,
              n,
            ])
          )

          const notificationsToProcess = data.filter(
            (entry) =>
              !entry.idempotency_key ||
              !existsMap.has(entry.idempotency_key) ||
              (existsMap.has(entry.idempotency_key) &&
                existsMap.get(entry.idempotency_key)!.status ===
                  NotificationStatus.FAILURE)
          )

          const channels = notificationsToProcess.map((not) => not.channel)
          const providers =
            await this.notificationProviderService_.getProviderForChannels(
              channels,
              context
            )

          // Create the notifications to be sent to prevent concurrent actions listing the same notifications
          const normalizedNotificationsToProcess = notificationsToProcess.map(
            (entry) => {
              const provider = providers.find((provider) =>
                provider?.channels.includes(entry.channel)
              )

              return {
                provider,
                data: {
                  id: generateEntityId(undefined, "noti"),
                  ...entry,
                  provider_id: provider?.id,
                },
              }
            }
          )

          const toCreate = normalizedNotificationsToProcess
            .filter(
              (e) =>
                !e.data.idempotency_key ||
                !existsMap.has(e.data.idempotency_key)
            )
            .map((e) => e.data)

          const createdNotifications = toCreate.length
            ? await this.notificationService_.create(
                this.storeIsolation_.stamp(toCreate, context),
                context
              )
            : []

          return {
            notificationsToProcess: normalizedNotificationsToProcess,
            createdNotifications,
          }
        },
        { manager: sharedContext.transactionManager as any } as any
      )

    const notificationToUpdate: { id: string; external_id?: string }[] = []

    try {
      await promiseAll(
        notificationsToProcess.map(async (entry) => {
          const provider = entry.provider

          if (!provider?.is_enabled) {
            entry.data.status = NotificationStatus.FAILURE
            notificationToUpdate.push(entry.data)

            const errorMessage = !provider
              ? `Could not find a notification provider for channel: ${entry.data.channel} for notification id ${entry.data.id}`
              : `Notification provider ${provider.id} is not enabled. To enable it, configure it as a provider in the notification module options.`

            throw new MedusaError(MedusaError.Types.NOT_FOUND, errorMessage)
          }

          const res = await this.notificationProviderService_
            .send(provider, entry.data)
            .catch((e) => {
              entry.data.status = NotificationStatus.FAILURE
              notificationToUpdate.push(entry.data)
              throw new MedusaError(
                MedusaError.Types.UNEXPECTED_STATE,
                `Failed to send notification with id ${entry.data.id}:\n${e.message}`
              )
            })

          entry.data.external_id = res.id
          entry.data.status = NotificationStatus.SUCCESS

          notificationToUpdate.push(entry.data)
        }),
        {
          aggregateErrors: true,
        }
      )
    } finally {
      const updatedNotifications = await this.notificationService_.update(
        notificationToUpdate,
        sharedContext
      )
      const updatedNotificationsMap = new Map(
        updatedNotifications.map((n) => [n.id, n])
      )

      // Maintain the order of the notifications
      createdNotifications = createdNotifications.map((notification) => {
        return updatedNotificationsMap.get(notification.id) || notification
      })
    }

    return createdNotifications
  }
}
