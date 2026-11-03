import IndexModuleService from "../index-module-service"
import { PostgresProvider } from "../postgres-provider"

const indexService = (mode: "dedicated" | "shared") => {
  const service = Object.create(IndexModuleService.prototype) as any
  service.moduleOptions_ = { store_isolation: { mode } }
  return service
}

const postgresProvider = (mode: "dedicated" | "shared") => {
  const provider = Object.create(PostgresProvider.prototype) as any
  provider.moduleOptions_ = { store_isolation: { mode } }
  return provider
}

describe("Store-owned Index isolation", () => {
  it("fails closed when a shared query has no Store", () => {
    const service = indexService("shared")

    expect(() =>
      service.scopeStoreOwnedIndexQuery_(
        { fields: ["product.id"], filters: {} },
        {}
      )
    ).toThrow("Index operations in shared mode require Context.storeId")
  })

  it.each(["product", "product_variant", "price", "sales_channel"])(
    "overwrites an untrusted %s Store filter before pagination",
    (entry) => {
      const service = indexService("shared")
      const scoped = service.scopeStoreOwnedIndexQuery_(
        {
          fields: [`${entry}.id`],
          filters: { [entry]: { store_id: "store_foreign" } },
          pagination: { skip: 10, take: 10 },
        },
        { storeId: "store_a" }
      )

      expect(scoped.filters).toEqual({ [entry]: { store_id: "store_a" } })
      expect(scoped.pagination).toEqual({ skip: 10, take: 10 })
    }
  )

  it("preserves the dedicated Index query contract", () => {
    const service = indexService("dedicated")
    const config = {
      fields: ["product.id"],
      filters: { product: { title: "Shirt" } },
    }

    expect(service.scopeStoreOwnedIndexQuery_(config, {})).toBe(config)
    expect(() =>
      service.scopeStoreOwnedIndexQuery_(config, { storeId: "store_foreign" })
    ).toThrow("Index context does not match the dedicated Store")
  })

  it("rejects missing and mixed Product event provenance", () => {
    const provider = postgresProvider("shared")

    expect(() =>
      provider.resolveEventStoreId_(
        { name: "product.created", data: { id: "prod_1" } },
        "Product"
      )
    ).toThrow(
      "Shared Product index events require exactly one Store provenance"
    )
    expect(() =>
      provider.resolveEventStoreId_(
        {
          name: "product.updated",
          data: [
            { id: "prod_1", store_id: "store_a" },
            { id: "prod_2", store_id: "store_b" },
          ],
        },
        "Product"
      )
    ).toThrow(
      "Shared Product index events require exactly one Store provenance"
    )
  })

  it("accepts one Store provenance and rejects a dedicated mismatch", () => {
    const shared = postgresProvider("shared")
    const dedicated = postgresProvider("dedicated")

    expect(
      shared.resolveEventStoreId_(
        {
          name: "product.created",
          data: { id: "prod_1", store_id: "store_a" },
        },
        "Product"
      )
    ).toBe("store_a")
    expect(() =>
      dedicated.resolveEventStoreId_(
        {
          name: "product.created",
          data: { id: "prod_1", store_id: "store_foreign" },
        },
        "Product"
      )
    ).toThrow("Product index event does not match the dedicated Store")
  })
})
