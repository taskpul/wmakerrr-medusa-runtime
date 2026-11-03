import { IPromotionModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"
import {
  PROMOTION_REQUEST_ROLE,
  PROMOTION_STORE_SETTING,
} from "../../src/store-ownership"

jest.setTimeout(30000)

moduleIntegrationTestRunner<IPromotionModuleService>({
  moduleName: Modules.PROMOTION,
  pathToMigrations: __dirname + "/../../src/migrations",
  resolve: resolve(process.cwd(), "src"),
  moduleOptions: { store_isolation: { mode: "shared" } },
  testSuite: ({ service, MikroOrmWrapper }) => {
    const storeA = { storeId: "store_a" }
    const storeB = { storeId: "store_b" }

    beforeEach(async () => {
      const manager = MikroOrmWrapper.getManager()
      await manager.execute(`do $$ begin
        if not exists (select 1 from pg_roles where rolname = '${PROMOTION_REQUEST_ROLE}') then
          create role "${PROMOTION_REQUEST_ROLE}" nologin nosuperuser nobypassrls;
        end if;
      end $$;`)
      await manager.execute(
        `alter role "${PROMOTION_REQUEST_ROLE}" nologin nosuperuser nobypassrls;`
      )
      await manager.execute(
        `grant usage on schema public to "${PROMOTION_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant select, insert, update, delete on all tables in schema public to "${PROMOTION_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant usage, select on all sequences in schema public to "${PROMOTION_REQUEST_ROLE}";`
      )
    })

    it("fails closed and isolates campaign identifiers", async () => {
      await expect(service.listCampaigns()).rejects.toThrow(
        "Promotion operations in shared mode require Context.storeId"
      )

      const campaignA = await service.createCampaigns(
        { name: "Store A", campaign_identifier: "holiday" },
        storeA
      )
      const campaignB = await service.createCampaigns(
        { name: "Store B", campaign_identifier: "holiday" },
        storeB
      )

      await expect(
        service.retrieveCampaign(campaignB.id, {}, storeA)
      ).rejects.toThrow(/not found/i)
      await expect(service.listCampaigns({}, {}, storeA)).resolves.toEqual([
        expect.objectContaining({ id: campaignA.id, store_id: "store_a" }),
      ])

      const manager = MikroOrmWrapper.getManager()
      const foreignRows = await manager.transactional(async (transaction) => {
        await transaction.execute(`set local role "${PROMOTION_REQUEST_ROLE}"`)
        await transaction.execute(
          `select set_config('${PROMOTION_STORE_SETTING}', ?, true)`,
          ["store_b"]
        )
        return await transaction.execute(
          `select "id" from "promotion_campaign" where "id" = ?`,
          [campaignA.id]
        )
      })
      expect(foreignRows).toEqual([])
    })
  },
})
