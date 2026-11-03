import {
  FULFILLMENT_DEDICATED_STORE_ID,
  FulfillmentStoreOwnership,
} from "../store-ownership"

const ownershipServices = (overrides: Record<string, unknown> = {}) => {
  const service = { list: jest.fn(async () => []) }
  return {
    Fulfillment: service,
    FulfillmentAddress: service,
    FulfillmentSet: service,
    ServiceZone: service,
    GeoZone: service,
    ShippingOption: service,
    ShippingOptionRule: service,
    ShippingOptionType: service,
    ShippingProfile: service,
    ...overrides,
  } as any
}

describe("FulfillmentStoreOwnership", () => {
  it("fails closed without Store context in shared mode", () => {
    const ownership = new FulfillmentStoreOwnership(
      { store_isolation: { mode: "shared" } },
      ownershipServices()
    )

    expect(() => ownership.resolveStoreId({})).toThrow(
      "Fulfillment operations in shared mode require Context.storeId"
    )
  })

  it("uses the dedicated placement and rejects a mismatched context", () => {
    const ownership = new FulfillmentStoreOwnership({}, ownershipServices())

    expect(ownership.resolveStoreId({})).toBe(FULFILLMENT_DEDICATED_STORE_ID)
    expect(() =>
      ownership.resolveStoreId({ storeId: "store_foreign" } as any)
    ).toThrow("Fulfillment context does not match the dedicated Store")
  })

  it("scopes generated list filters before persistence access", async () => {
    const ownership = new FulfillmentStoreOwnership(
      { store_isolation: { mode: "shared" } },
      ownershipServices()
    )

    await expect(
      ownership.prepareGeneratedMethodArgs({
        method: "list",
        methodName: "listShippingProfiles",
        modelName: "ShippingProfile",
        args: [{ type: "default" }, { take: 10 }],
        context: { storeId: "store_a" } as any,
      })
    ).resolves.toEqual([{ type: "default", store_id: "store_a" }, { take: 10 }])
  })

  it("stamps nested records and verifies their owned parent", async () => {
    const fulfillmentSetService = {
      list: jest.fn(async () => [{ id: "fset_a" }]),
    }
    const ownership = new FulfillmentStoreOwnership(
      { store_isolation: { mode: "shared" } },
      ownershipServices({ FulfillmentSet: fulfillmentSetService })
    )

    const [result] = await ownership.prepareGeneratedMethodArgs({
      method: "create",
      methodName: "createServiceZones",
      modelName: "ServiceZone",
      args: [
        {
          name: "EU",
          fulfillment_set_id: "fset_a",
          store_id: "store_foreign",
          geo_zones: [{ type: "country", country_code: "de" }],
        },
      ],
      context: { storeId: "store_a" } as any,
    })

    expect(result).toEqual(
      expect.objectContaining({
        store_id: "store_a",
        geo_zones: [
          expect.objectContaining({
            store_id: "store_a",
            country_code: "de",
          }),
        ],
      })
    )
    expect(fulfillmentSetService.list).toHaveBeenCalledWith(
      { id: ["fset_a"], store_id: "store_a" },
      { select: ["id"], take: null, withDeleted: true },
      expect.objectContaining({ storeId: "store_a" })
    )
  })

  it("rejects a foreign parent before writing a relationship", async () => {
    const ownership = new FulfillmentStoreOwnership(
      { store_isolation: { mode: "shared" } },
      ownershipServices()
    )

    await expect(
      ownership.assertParentOwnership(
        "ShippingOption",
        {
          service_zone_id: "serzo_foreign",
          shipping_profile_id: "sp_local",
        },
        { storeId: "store_a" } as any
      )
    ).rejects.toThrow("do not belong to the active Store")
  })

  it("keeps the provider registry global while Store operations stay scoped", async () => {
    const ownership = new FulfillmentStoreOwnership(
      { store_isolation: { mode: "shared" } },
      ownershipServices()
    )
    const args = [{ id: "provider_global" }, { take: 10 }]

    await expect(
      ownership.prepareGeneratedMethodArgs({
        method: "list",
        methodName: "listFulfillmentProviders",
        modelName: "FulfillmentProvider",
        args,
        context: { storeId: "store_a" } as any,
      })
    ).resolves.toBe(args)
  })
})
