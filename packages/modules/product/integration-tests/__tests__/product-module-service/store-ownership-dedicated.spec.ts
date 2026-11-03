import { IProductModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"

jest.setTimeout(30000)

moduleIntegrationTestRunner<IProductModuleService>({
  moduleName: Modules.PRODUCT,
  pathToMigrations: __dirname + "/../../../src/migrations",
  resolve: resolve(process.cwd(), "src"),
  moduleOptions: {
    store_isolation: { mode: "dedicated", store_id: "store_dedicated" },
  },
  testSuite: ({ service }) => {
    it("uses the immutable placement without request context", async () => {
      const product = await service.createProducts({
        title: "Dedicated",
        handle: "dedicated",
      })

      expect(product.store_id).toBe("store_dedicated")
      await expect(service.listProducts()).resolves.toEqual([
        expect.objectContaining({ id: product.id }),
      ])
    })

    it("rejects a mismatched Store context", async () => {
      await expect(
        service.listProducts({}, {}, { storeId: "store_foreign" })
      ).rejects.toThrow("Product context does not match the dedicated Store")
    })
  },
})
