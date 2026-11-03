import { IStockLocationService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"
import { STOCK_LOCATION_REQUEST_ROLE } from "../../src/store-ownership"

jest.setTimeout(30000)

moduleIntegrationTestRunner<IStockLocationService>({
  moduleName: Modules.STOCK_LOCATION,
  pathToMigrations: __dirname + "/../../src/migrations",
  resolve: resolve(process.cwd(), "src"),
  moduleOptions: { store_isolation: { mode: "shared" } },
  testSuite: ({ service, MikroOrmWrapper }) => {
    const storeA = { storeId: "store_a" }
    const storeB = { storeId: "store_b" }

    beforeEach(async () => {
      const manager = MikroOrmWrapper.getManager()
      await manager.execute(`
        do $$ begin
          if not exists (select 1 from pg_roles where rolname = '${STOCK_LOCATION_REQUEST_ROLE}') then
            create role "${STOCK_LOCATION_REQUEST_ROLE}" nologin nosuperuser nobypassrls;
          end if;
        end $$;
      `)
      await manager.execute(
        `alter role "${STOCK_LOCATION_REQUEST_ROLE}" nologin nosuperuser nobypassrls;`
      )
      await manager.execute(
        `grant usage on schema public to "${STOCK_LOCATION_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant select, insert, update, delete on all tables in schema public to "${STOCK_LOCATION_REQUEST_ROLE}";`
      )
    })

    it("fails closed without verified Store context", async () => {
      await expect(service.listStockLocations()).rejects.toThrow(
        "Stock Location operations in shared mode require Context.storeId"
      )
    })

    it("isolates create, list, retrieve, update, and delete", async () => {
      const locationA = await service.createStockLocations(
        { name: "Warehouse" },
        storeA
      )
      const locationB = await service.createStockLocations(
        { name: "Warehouse" },
        storeB
      )
      await expect(service.listStockLocations({}, {}, storeA)).resolves.toEqual(
        [expect.objectContaining({ id: locationA.id, store_id: "store_a" })]
      )
      await expect(
        service.retrieveStockLocation(locationB.id, {}, storeA)
      ).rejects.toThrow(/not found/i)
      await expect(
        service.updateStockLocations(locationB.id, { name: "Foreign" }, storeA)
      ).rejects.toThrow()
      await expect(
        service.deleteStockLocations(locationB.id, storeA)
      ).rejects.toThrow()
    })

    it("stamps nested addresses and rejects cross-Store address ownership", async () => {
      const locationA = await service.createStockLocations(
        {
          name: "A",
          address: { address_1: "A Street", country_code: "de" },
        },
        storeA
      )
      expect((locationA as any).store_id).toBe("store_a")
      expect((locationA as any).address.store_id).toBe("store_a")

      const locationB = await service.createStockLocations(
        {
          name: "B",
          address: { address_1: "B Street", country_code: "de" },
        },
        storeB
      )
      await expect(
        service.updateStockLocations(
          locationA.id,
          { address_id: (locationB as any).address.id } as never,
          storeA
        )
      ).rejects.toThrow(/active Store|row-level security/i)
    })
  },
})

moduleIntegrationTestRunner<IStockLocationService>({
  moduleName: Modules.STOCK_LOCATION,
  pathToMigrations: __dirname + "/../../src/migrations",
  resolve: resolve(process.cwd(), "src"),
  moduleOptions: {
    store_isolation: { mode: "dedicated", store_id: "store_dedicated" },
  },
  testSuite: ({ service }) => {
    it("uses immutable dedicated placement and rejects mismatched context", async () => {
      const location = await service.createStockLocations({ name: "Dedicated" })
      expect((location as any).store_id).toBe("store_dedicated")
      await expect(
        service.listStockLocations({}, {}, { storeId: "store_foreign" })
      ).rejects.toThrow(
        "Stock Location context does not match the dedicated Store"
      )
    })
  },
})
