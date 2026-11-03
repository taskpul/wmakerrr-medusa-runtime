import { IFulfillmentModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"

jest.setTimeout(30000)

moduleIntegrationTestRunner<IFulfillmentModuleService>({
  moduleName: Modules.FULFILLMENT,
  pathToMigrations: __dirname + "/../../../src/migrations",
  resolve: resolve(process.cwd(), "src"),
  moduleOptions: {
    store_isolation: { mode: "dedicated", store_id: "store_dedicated" },
  },
  testSuite: ({ service }) => {
    it("uses the immutable placement without request context", async () => {
      const profile = await service.createShippingProfiles({
        name: "Dedicated",
        type: "default",
      })

      expect((profile as any).store_id).toBe("store_dedicated")
      await expect(service.listShippingProfiles()).resolves.toEqual([
        expect.objectContaining({ id: profile.id }),
      ])
    })

    it("rejects a mismatched Store context", async () => {
      await expect(
        service.listShippingProfiles({}, {}, { storeId: "store_foreign" })
      ).rejects.toThrow(
        "Fulfillment context does not match the dedicated Store"
      )
    })
  },
})
