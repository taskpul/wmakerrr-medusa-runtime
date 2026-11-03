import { ISalesChannelModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"
import {
  SALES_CHANNEL_REQUEST_ROLE,
  SALES_CHANNEL_STORE_SETTING,
} from "../../src/store-isolation"

jest.setTimeout(30000)

moduleIntegrationTestRunner<ISalesChannelModuleService>({
  moduleName: Modules.SALES_CHANNEL,
  pathToMigrations: __dirname + "/../../src/migrations",
  resolve: resolve(process.cwd(), "src"),
  moduleOptions: { store_isolation: { mode: "shared" } },
  testSuite: ({ service, MikroOrmWrapper }) => {
    const storeA = { storeId: "store_a" }
    const storeB = { storeId: "store_b" }

    beforeEach(async () => {
      const manager = MikroOrmWrapper.getManager()
      await manager.execute(`do $$ begin
        if not exists (select 1 from pg_roles where rolname = '${SALES_CHANNEL_REQUEST_ROLE}') then
          create role "${SALES_CHANNEL_REQUEST_ROLE}" nologin nosuperuser nobypassrls;
        end if;
      end $$;`)
      await manager.execute(
        `alter role "${SALES_CHANNEL_REQUEST_ROLE}" nologin nosuperuser nobypassrls;`
      )
      await manager.execute(
        `grant usage on schema public to "${SALES_CHANNEL_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant select, insert, update, delete on all tables in schema public to "${SALES_CHANNEL_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant usage, select on all sequences in schema public to "${SALES_CHANNEL_REQUEST_ROLE}";`
      )
    })

    it("fails closed and isolates sales channels", async () => {
      await expect(service.listSalesChannels()).rejects.toThrow(
        "Sales Channel operations in shared mode require Context.storeId"
      )

      const channelA = await service.createSalesChannels(
        { name: "Online" },
        storeA
      )
      const channelB = await service.createSalesChannels(
        { name: "Online" },
        storeB
      )

      await expect(
        service.retrieveSalesChannel(channelB.id, {}, storeA)
      ).rejects.toThrow(/not found/i)
      await expect(service.listSalesChannels({}, {}, storeA)).resolves.toEqual([
        expect.objectContaining({ id: channelA.id, store_id: "store_a" }),
      ])

      const manager = MikroOrmWrapper.getManager()
      const foreignRows = await manager.transactional(async (transaction) => {
        await transaction.execute(
          `set local role "${SALES_CHANNEL_REQUEST_ROLE}"`
        )
        await transaction.execute(
          `select set_config('${SALES_CHANNEL_STORE_SETTING}', ?, true)`,
          ["store_b"]
        )
        return await transaction.execute(
          `select "id" from "sales_channel" where "id" = ?`,
          [channelA.id]
        )
      })
      expect(foreignRows).toEqual([])
    })
  },
})
