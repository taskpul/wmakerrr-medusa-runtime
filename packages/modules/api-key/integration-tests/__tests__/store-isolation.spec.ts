import { IApiKeyModuleService } from "@medusajs/framework/types"
import { ApiKeyType, Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"

jest.setTimeout(30000)

moduleIntegrationTestRunner<IApiKeyModuleService>({
  moduleName: Modules.API_KEY,
  pathToMigrations: __dirname + "/../../src/migrations",
  resolve: resolve(process.cwd(), "src"),
  moduleOptions: { store_isolation: { mode: "shared" } },
  testSuite: ({ service, MikroOrmWrapper }) => {
    const storeA = { storeId: "store_a" }
    const storeB = { storeId: "store_b" }

    it("fails closed for management and isolates API keys", async () => {
      await expect(service.listApiKeys()).rejects.toThrow(
        "API Key operations in shared mode require Context.storeId"
      )

      const keyA = await service.createApiKeys(
        {
          title: "Store API key",
          type: ApiKeyType.SECRET,
          created_by: "admin_a",
        },
        storeA
      )
      const keyB = await service.createApiKeys(
        {
          title: "Store API key",
          type: ApiKeyType.SECRET,
          created_by: "admin_b",
        },
        storeB
      )

      await expect(service.retrieveApiKey(keyB.id, {}, storeA)).rejects.toThrow(
        /not found/i
      )
      await expect(service.listApiKeys({}, {}, storeA)).resolves.toEqual([
        expect.objectContaining({ id: keyA.id, store_id: "store_a" }),
      ])

      await expect(service.authenticate(keyB.token)).resolves.toEqual(
        expect.objectContaining({ id: keyB.id, store_id: "store_b" })
      )

      await expect(
        MikroOrmWrapper.getManager().execute(
          `update "api_key" set "store_id" = ? where "id" = ?`,
          ["store_b", keyA.id]
        )
      ).rejects.toThrow(/immutable/i)
    })
  },
})
