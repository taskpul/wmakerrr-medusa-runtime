import {
  CreateNotificationDTO,
  INotificationModuleService,
} from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"
import {
  NOTIFICATION_REQUEST_ROLE,
  NOTIFICATION_STORE_SETTING,
} from "../../src/store-isolation"

jest.setTimeout(30000)

moduleIntegrationTestRunner<INotificationModuleService>({
  moduleName: Modules.NOTIFICATION,
  pathToMigrations: __dirname + "/../../src/migrations",
  resolve: resolve(process.cwd(), "src"),
  moduleOptions: {
    store_isolation: { mode: "shared" },
    providers: [
      {
        resolve: resolve(
          process.cwd() +
            "/integration-tests/__fixtures__/providers/default-provider"
        ),
        id: "test-provider",
        options: { name: "Test provider", channels: ["email"] },
      },
    ],
  },
  testSuite: ({ service, MikroOrmWrapper }) => {
    const storeA = { storeId: "store_a" }
    const storeB = { storeId: "store_b" }

    beforeEach(async () => {
      const manager = MikroOrmWrapper.getManager()
      await manager.execute(`do $$ begin
        if not exists (select 1 from pg_roles where rolname = '${NOTIFICATION_REQUEST_ROLE}') then
          create role "${NOTIFICATION_REQUEST_ROLE}" nologin nosuperuser nobypassrls;
        end if;
      end $$;`)
      await manager.execute(
        `alter role "${NOTIFICATION_REQUEST_ROLE}" nologin nosuperuser nobypassrls;`
      )
      await manager.execute(
        `grant usage on schema public to "${NOTIFICATION_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant select, insert, update, delete on all tables in schema public to "${NOTIFICATION_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant usage, select on all sequences in schema public to "${NOTIFICATION_REQUEST_ROLE}";`
      )
    })

    const notification = (to: string): CreateNotificationDTO => ({
      to,
      template: "order-created",
      channel: "email",
      data: {},
      idempotency_key: "order-1",
    })

    it("fails closed and scopes idempotency by Store", async () => {
      await expect(service.listNotifications()).rejects.toThrow(
        "Notification operations in shared mode require Context.storeId"
      )

      const notificationA = await service.createNotifications(
        notification("a@example.com"),
        storeA
      )
      const notificationB = await service.createNotifications(
        notification("b@example.com"),
        storeB
      )

      await expect(
        service.retrieveNotification(notificationB.id, {}, storeA)
      ).rejects.toThrow(/not found/i)
      await expect(service.listNotifications({}, {}, storeA)).resolves.toEqual([
        expect.objectContaining({
          id: notificationA.id,
          store_id: "store_a",
        }),
      ])

      const manager = MikroOrmWrapper.getManager()
      const foreignRows = await manager.transactional(async (transaction) => {
        await transaction.execute(
          `set local role "${NOTIFICATION_REQUEST_ROLE}"`
        )
        await transaction.execute(
          `select set_config('${NOTIFICATION_STORE_SETTING}', ?, true)`,
          ["store_b"]
        )
        return await transaction.execute(
          `select "id" from "notification" where "id" = ?`,
          [notificationA.id]
        )
      })
      expect(foreignRows).toEqual([])
    })
  },
})
