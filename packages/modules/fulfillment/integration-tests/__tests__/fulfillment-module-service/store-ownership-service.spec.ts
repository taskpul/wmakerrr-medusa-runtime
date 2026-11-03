import { IFulfillmentModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"
import { FULFILLMENT_REQUEST_ROLE } from "../../../src/store-ownership"

jest.setTimeout(30000)

moduleIntegrationTestRunner<IFulfillmentModuleService>({
  moduleName: Modules.FULFILLMENT,
  pathToMigrations: __dirname + "/../../../src/migrations",
  resolve: resolve(process.cwd(), "src"),
  moduleOptions: { store_isolation: { mode: "shared" } },
  testSuite: ({ service, MikroOrmWrapper }) => {
    const storeA = { storeId: "store_a" }
    const storeB = { storeId: "store_b" }

    beforeEach(async () => {
      const manager = MikroOrmWrapper.getManager()
      await manager.execute(`
        do $$
        begin
          if not exists (
            select 1 from pg_roles where rolname = '${FULFILLMENT_REQUEST_ROLE}'
          ) then
            create role "${FULFILLMENT_REQUEST_ROLE}"
              nologin nosuperuser nobypassrls;
          end if;
        end
        $$;
      `)
      await manager.execute(
        `alter role "${FULFILLMENT_REQUEST_ROLE}" nologin nosuperuser nobypassrls;`
      )
      await manager.execute(
        `grant usage on schema public to "${FULFILLMENT_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant select, insert, update, delete on all tables in schema public to "${FULFILLMENT_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant usage, select on all sequences in schema public to "${FULFILLMENT_REQUEST_ROLE}";`
      )
    })

    it("fails closed without verified Store context", async () => {
      await expect(service.listShippingProfiles()).rejects.toThrow(
        "Fulfillment operations in shared mode require Context.storeId"
      )
      await expect(
        service.createShippingProfiles({ name: "Unbound", type: "default" })
      ).rejects.toThrow(
        "Fulfillment operations in shared mode require Context.storeId"
      )
    })

    it("scopes generated create, retrieve, list, count, update, and delete", async () => {
      const profileA = await service.createShippingProfiles(
        { name: "Shared profile", type: "default" },
        storeA
      )
      const profileB = await service.createShippingProfiles(
        { name: "Shared profile", type: "default" },
        storeB
      )

      const [profilesA, countA] = await service.listAndCountShippingProfiles(
        {},
        { take: 1 },
        storeA
      )
      expect(countA).toBe(1)
      expect(profilesA).toEqual([
        expect.objectContaining({ id: profileA.id, store_id: "store_a" }),
      ])
      await expect(
        service.retrieveShippingProfile(profileB.id, {}, storeA)
      ).rejects.toThrow(/not found/i)
      await expect(
        service.updateShippingProfiles(
          profileB.id,
          { name: "Foreign update" },
          storeA
        )
      ).rejects.toThrow()
      await expect(
        service.deleteShippingProfiles(profileB.id, storeA)
      ).rejects.toThrow()
    })

    it("overwrites supplied ownership and rejects cross-Store parents", async () => {
      const setB = await service.createFulfillmentSets(
        { name: "Store B", type: "shipping" },
        storeB
      )
      const profileA = await service.createShippingProfiles(
        {
          name: "Spoof attempt",
          type: "default",
          store_id: "store_b",
        } as never,
        storeA
      )
      expect((profileA as any).store_id).toBe("store_a")

      await expect(
        service.createServiceZones(
          { name: "Cross Store", fulfillment_set_id: setB.id },
          storeA
        )
      ).rejects.toThrow()
    })

    it("keeps nested and concurrent records in the initiating Store", async () => {
      const [setA, setB] = await Promise.all([
        service.createFulfillmentSets(
          {
            name: "Nested A",
            type: "shipping",
            service_zones: [
              {
                name: "EU A",
                geo_zones: [{ type: "country", country_code: "de" }],
              },
            ],
          },
          storeA
        ),
        service.createFulfillmentSets(
          {
            name: "Nested B",
            type: "shipping",
            service_zones: [
              {
                name: "EU B",
                geo_zones: [{ type: "country", country_code: "de" }],
              },
            ],
          },
          storeB
        ),
      ])

      const [zonesA, zonesB] = await Promise.all([
        service.listServiceZones({}, {}, storeA),
        service.listServiceZones({}, {}, storeB),
      ])
      expect(zonesA).toEqual([
        expect.objectContaining({
          fulfillment_set_id: setA.id,
          store_id: "store_a",
        }),
      ])
      expect(zonesB).toEqual([
        expect.objectContaining({
          fulfillment_set_id: setB.id,
          store_id: "store_b",
        }),
      ])
    })
  },
})
