import { IInventoryService } from "@medusajs/framework/types"
import { BigNumber, Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"
import { INVENTORY_REQUEST_ROLE } from "../../src/store-ownership"

jest.setTimeout(30000)

moduleIntegrationTestRunner<IInventoryService>({
  moduleName: Modules.INVENTORY,
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
          if not exists (select 1 from pg_roles where rolname = '${INVENTORY_REQUEST_ROLE}') then
            create role "${INVENTORY_REQUEST_ROLE}" nologin nosuperuser nobypassrls;
          end if;
        end $$;
      `)
      await manager.execute(
        `alter role "${INVENTORY_REQUEST_ROLE}" nologin nosuperuser nobypassrls;`
      )
      await manager.execute(
        `grant usage on schema public to "${INVENTORY_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant select, insert, update, delete on all tables in schema public to "${INVENTORY_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant usage, select on all sequences in schema public to "${INVENTORY_REQUEST_ROLE}";`
      )
    })

    it("fails closed without verified Store context", async () => {
      await expect(service.listInventoryItems()).rejects.toThrow(
        "Inventory operations in shared mode require Context.storeId"
      )
      await expect(
        service.createInventoryItems({ sku: "UNBOUND" })
      ).rejects.toThrow(
        "Inventory operations in shared mode require Context.storeId"
      )
    })

    it("scopes items and allows the same SKU in different Stores", async () => {
      const itemA = await service.createInventoryItems(
        { sku: "SHARED-SKU" },
        storeA
      )
      const itemB = await service.createInventoryItems(
        { sku: "SHARED-SKU" },
        storeB
      )

      await expect(service.listInventoryItems({}, {}, storeA)).resolves.toEqual(
        [expect.objectContaining({ id: itemA.id, store_id: "store_a" })]
      )
      await expect(
        service.retrieveInventoryItem(itemB.id, {}, storeA)
      ).rejects.toThrow(/not found/i)
      await expect(
        service.createInventoryItems({ sku: "SHARED-SKU" }, storeA)
      ).rejects.toThrow(/duplicate|unique/i)
    })

    it("rejects spoofed ownership and cross-Store inventory parents", async () => {
      const itemB = await service.createInventoryItems({ sku: "B" }, storeB)
      const itemA = await service.createInventoryItems(
        { sku: "A", store_id: "store_b" } as never,
        storeA
      )
      expect((itemA as any).store_id).toBe("store_a")
      await expect(
        service.createInventoryLevels(
          { inventory_item_id: itemB.id, location_id: "location_a" },
          storeA
        )
      ).rejects.toThrow(/active Store|row-level security/i)
    })

    it("isolates levels, reservations, and aggregate quantity reads", async () => {
      const itemA = await service.createInventoryItems(
        { sku: "A-LEVEL" },
        storeA
      )
      const itemB = await service.createInventoryItems(
        { sku: "B-LEVEL" },
        storeB
      )
      await service.createInventoryLevels(
        {
          inventory_item_id: itemA.id,
          location_id: "shared-location",
          stocked_quantity: 10,
        },
        storeA
      )
      await service.createInventoryLevels(
        {
          inventory_item_id: itemB.id,
          location_id: "shared-location",
          stocked_quantity: 30,
        },
        storeB
      )
      await service.createReservationItems(
        {
          inventory_item_id: itemA.id,
          location_id: "shared-location",
          quantity: 4,
        },
        storeA
      )

      await expect(
        service.retrieveAvailableQuantity(itemA.id, ["shared-location"], storeA)
      ).resolves.toEqual(new BigNumber(6))
      await expect(
        service.listReservationItems({}, {}, storeB)
      ).resolves.toEqual([])
      await expect(
        service.retrieveAvailableQuantity(itemA.id, ["shared-location"], storeB)
      ).rejects.toThrow(/not found/i)
    })
  },
})

moduleIntegrationTestRunner<IInventoryService>({
  moduleName: Modules.INVENTORY,
  pathToMigrations: __dirname + "/../../src/migrations",
  resolve: resolve(process.cwd(), "src"),
  moduleOptions: {
    store_isolation: { mode: "dedicated", store_id: "store_dedicated" },
  },
  testSuite: ({ service }) => {
    it("uses immutable dedicated placement and rejects mismatched context", async () => {
      const item = await service.createInventoryItems({ sku: "DEDICATED" })
      expect((item as any).store_id).toBe("store_dedicated")
      await expect(
        service.listInventoryItems({}, {}, { storeId: "store_foreign" })
      ).rejects.toThrow("Inventory context does not match the dedicated Store")
    })
  },
})
