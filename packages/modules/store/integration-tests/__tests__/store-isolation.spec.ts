import { IStoreModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"
import { STORE_REQUEST_ROLE, STORE_SETTING } from "../../src/store-isolation"

jest.setTimeout(30000)

moduleIntegrationTestRunner<IStoreModuleService>({
  moduleName: Modules.STORE,
  pathToMigrations: __dirname + "/../../src/migrations",
  resolve: resolve(process.cwd(), "src"),
  moduleOptions: { store_isolation: { mode: "shared" } },
  testSuite: ({ service, MikroOrmWrapper }) => {
    const storeA = { storeId: "store_a" }
    const storeB = { storeId: "store_b" }

    beforeEach(async () => {
      const manager = MikroOrmWrapper.getManager()
      await manager.execute(
        `alter role "${STORE_REQUEST_ROLE}" nologin nosuperuser nobypassrls;`
      )
    })

    it("fails closed and isolates Store settings", async () => {
      await expect(service.listStores()).rejects.toThrow(
        "Store operations in shared mode require Context.storeId"
      )

      const createdA = await service.createStores(
        {
          name: "Store A",
          supported_currencies: [{ currency_code: "eur", is_default: true }],
        },
        storeA
      )
      const createdB = await service.createStores(
        {
          name: "Store B",
          supported_currencies: [{ currency_code: "usd", is_default: true }],
        },
        storeB
      )

      await expect(
        service.retrieveStore(createdB.id, {}, storeA)
      ).rejects.toThrow(/not found/i)
      await expect(service.listStores({}, {}, storeA)).resolves.toEqual([
        expect.objectContaining({
          id: createdA.id,
          store_id: "store_a",
          name: "Store A",
        }),
      ])

      const manager = MikroOrmWrapper.getManager()
      const foreignRows = await manager.transactional(async (transaction) => {
        await transaction.execute(`set local role "${STORE_REQUEST_ROLE}"`)
        await transaction.execute(
          `select set_config('${STORE_SETTING}', ?, true)`,
          ["store_b"]
        )
        return await transaction.execute(
          `select "id" from "store" where "id" = ?`,
          [createdA.id]
        )
      })
      expect(foreignRows).toEqual([])
    })
  },
})
