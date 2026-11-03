import { IPricingModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"

jest.setTimeout(30000)

moduleIntegrationTestRunner<IPricingModuleService>({
  moduleName: Modules.PRICING,
  pathToMigrations: __dirname + "/../../../../src/migrations",
  resolve: resolve(process.cwd(), "src"),
  moduleOptions: {
    store_isolation: {
      mode: "dedicated",
      store_id: "store_dedicated",
    },
  },
  testSuite: ({ service }) => {
    describe("Pricing dedicated Store ownership", () => {
      it("uses the configured Store without request context", async () => {
        const priceSet = await service.createPriceSets({})

        expect(priceSet.store_id).toBe("store_dedicated")
        await expect(service.listPriceSets()).resolves.toEqual([
          expect.objectContaining({
            id: priceSet.id,
            store_id: "store_dedicated",
          }),
        ])
      })

      it("accepts matching context and rejects Store rebinding", async () => {
        await expect(
          service.createPriceSets({}, { storeId: "store_dedicated" })
        ).resolves.toEqual(
          expect.objectContaining({ store_id: "store_dedicated" })
        )

        await expect(
          service.createPriceSets({}, { storeId: "store_other" })
        ).rejects.toThrow("Pricing context does not match the dedicated Store")
      })

      it("overwrites caller-supplied Store ownership", async () => {
        const priceSet = await service.createPriceSets({
          store_id: "store_other",
        } as never)

        expect(priceSet.store_id).toBe("store_dedicated")
      })
    })
  },
})
