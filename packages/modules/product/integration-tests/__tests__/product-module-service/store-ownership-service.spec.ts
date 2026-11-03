import { IProductModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"
import { PRODUCT_REQUEST_ROLE } from "../../../src/store-ownership"

jest.setTimeout(30000)

moduleIntegrationTestRunner<IProductModuleService>({
  moduleName: Modules.PRODUCT,
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
            select 1 from pg_roles where rolname = '${PRODUCT_REQUEST_ROLE}'
          ) then
            create role "${PRODUCT_REQUEST_ROLE}"
              nologin nosuperuser nobypassrls;
          end if;
        end
        $$;
      `)
      await manager.execute(
        `alter role "${PRODUCT_REQUEST_ROLE}" nologin nosuperuser nobypassrls;`
      )
      await manager.execute(
        `grant usage on schema public to "${PRODUCT_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant select, insert, update, delete on all tables in schema public to "${PRODUCT_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant usage, select on all sequences in schema public to "${PRODUCT_REQUEST_ROLE}";`
      )
    })

    it("fails closed without verified Store context", async () => {
      await expect(service.listProducts()).rejects.toThrow(
        "Product operations in shared mode require Context.storeId"
      )
      await expect(
        service.createProducts({ title: "Unbound", handle: "unbound" })
      ).rejects.toThrow(
        "Product operations in shared mode require Context.storeId"
      )
    })

    it("scopes create, retrieve, list, count, update, and delete", async () => {
      const productA = await service.createProducts(
        { title: "Store A", handle: "same-handle" },
        storeA
      )
      const productB = await service.createProducts(
        { title: "Store B", handle: "same-handle" },
        storeB
      )

      const [productsA, countA] = await service.listAndCountProducts(
        {},
        { take: 1 },
        storeA
      )
      expect(countA).toBe(1)
      expect(productsA).toEqual([
        expect.objectContaining({ id: productA.id, store_id: "store_a" }),
      ])
      await expect(
        service.retrieveProduct(productB.id, {}, storeA)
      ).rejects.toThrow(/not found/i)
      await expect(
        service.updateProducts(productB.id, { title: "Foreign update" }, storeA)
      ).rejects.toThrow()
      await expect(
        service.deleteProducts(productB.id, storeA)
      ).rejects.toThrow()
      await expect(
        service.retrieveProduct(productB.id, {}, storeB)
      ).resolves.toEqual(expect.objectContaining({ id: productB.id }))
    })

    it("overwrites client-supplied ownership and rejects cross-Store parents", async () => {
      const typeB = await service.createProductTypes(
        { value: "Store B type" },
        storeB
      )
      const productA = await service.createProducts(
        {
          title: "Spoof attempt",
          handle: "spoof-attempt",
          store_id: "store_b",
        } as never,
        storeA
      )
      expect(productA.store_id).toBe("store_a")

      await expect(
        service.createProducts(
          {
            title: "Cross Store type",
            handle: "cross-store-type",
            type_id: typeB.id,
          },
          storeA
        )
      ).rejects.toThrow()
    })

    it("keeps nested variants and concurrent requests in their Store", async () => {
      const [productA, productB] = await Promise.all([
        service.createProducts(
          {
            title: "Nested A",
            handle: "nested-a",
            variants: [{ title: "A variant", sku: "shared-sku" }],
          },
          storeA
        ),
        service.createProducts(
          {
            title: "Nested B",
            handle: "nested-b",
            variants: [{ title: "B variant", sku: "shared-sku" }],
          },
          storeB
        ),
      ])

      const [variantsA, variantsB] = await Promise.all([
        service.listProductVariants({}, {}, storeA),
        service.listProductVariants({}, {}, storeB),
      ])
      expect(variantsA).toEqual([
        expect.objectContaining({
          product_id: productA.id,
          store_id: "store_a",
        }),
      ])
      expect(variantsB).toEqual([
        expect.objectContaining({
          product_id: productB.id,
          store_id: "store_b",
        }),
      ])
    })
  },
})
