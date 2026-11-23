import { Modules } from "@medusajs/utils"
import { assertStoreSafeLinks } from "../store-link-ownership"

const cases = [
  [Modules.PROMOTION, "promotion_id", "listPromotions"],
  [Modules.CUSTOMER, "customer_id", "listCustomers"],
  [Modules.CART, "cart_id", "listCarts"],
  [Modules.PAYMENT, "payment_collection_id", "listPaymentCollections"],
  [Modules.PAYMENT, "account_holder_id", "listAccountHolders"],
  [Modules.ORDER, "order_id", "listOrders"],
  [Modules.ORDER, "return_id", "listReturns"],
  [Modules.ORDER, "claim_id", "listOrderClaims"],
  [Modules.ORDER, "exchange_id", "listOrderExchanges"],
  [Modules.API_KEY, "publishable_key_id", "listApiKeys"],
  [Modules.API_KEY, "api_key_id", "listApiKeys"],
  [Modules.SALES_CHANNEL, "sales_channel_id", "listSalesChannels"],
] as const

const moduleFor = (
  moduleKey: Modules,
  endpointKey: string,
  method: string,
  ownedIds: string[]
) => ({
  __definition: { key: moduleKey },
  __joinerConfig: { linkableKeys: { [endpointKey]: {} } },
  [method]: jest.fn(async ({ id }: { id: string[] }) =>
    id.filter((candidate) => ownedIds.includes(candidate)).map((id) => ({ id }))
  ),
})

describe("Store-safe module links", () => {
  it.each(cases)(
    "rejects a foreign %s %s endpoint",
    async (moduleKey, endpointKey, method) => {
      const module = moduleFor(moduleKey, endpointKey, method, ["owned"])
      const modules = new Map([[moduleKey, module]]) as any

      await expect(
        assertStoreSafeLinks(
          modules,
          [{ [moduleKey]: { [endpointKey]: "foreign" } }] as any,
          { storeId: "store_a" }
        )
      ).rejects.toThrow("does not belong to the active Store")
    }
  )

  it.each(cases)(
    "accepts an owned %s %s endpoint",
    async (moduleKey, endpointKey, method) => {
      const module = moduleFor(moduleKey, endpointKey, method, ["owned"])
      const modules = new Map([[moduleKey, module]]) as any

      await expect(
        assertStoreSafeLinks(
          modules,
          [{ [moduleKey]: { [endpointKey]: "owned" } }] as any,
          { storeId: "store_a" }
        )
      ).resolves.toBeUndefined()
    }
  )

  it("allows a custom Product link only after its module certifies the endpoint", async () => {
    const product = {
      ...moduleFor(Modules.PRODUCT, "product_id", "listProducts", [
        "prod_owned",
      ]),
      __storeIsolationMode: () => "shared",
      __joinerConfig: {
        linkableKeys: { product_id: {}, variant_id: {} },
      },
      listProductVariants: jest.fn(async () => []),
    }
    const custom = {
      __definition: { key: "customBuilder" },
      __joinerConfig: { linkableKeys: { custom_builder_id: {} } },
      __assertStoreLinkEndpoints: jest.fn(async () => undefined),
    }
    const modules = new Map<string, any>([
      [Modules.PRODUCT, product],
      ["customBuilder", custom],
    ]) as any

    await expect(
      assertStoreSafeLinks(
        modules,
        [
          {
            [Modules.PRODUCT]: { product_id: "prod_owned" },
            customBuilder: { custom_builder_id: "builder_owned" },
          },
        ] as any,
        { storeId: "store_a" }
      )
    ).resolves.toBeUndefined()
    expect(custom.__assertStoreLinkEndpoints).toHaveBeenCalledWith(
      [{ custom_builder_id: "builder_owned" }],
      { storeId: "store_a" }
    )
  })

  it("rejects an uncertified custom Product link", async () => {
    const product = {
      ...moduleFor(Modules.PRODUCT, "product_id", "listProducts", [
        "prod_owned",
      ]),
      __storeIsolationMode: () => "shared",
      __joinerConfig: {
        linkableKeys: { product_id: {}, variant_id: {} },
      },
      listProductVariants: jest.fn(async () => []),
    }
    const custom = {
      __definition: { key: "customBuilder" },
      __joinerConfig: { linkableKeys: { custom_builder_id: {} } },
    }

    await expect(
      assertStoreSafeLinks(
        new Map<string, any>([
          [Modules.PRODUCT, product],
          ["customBuilder", custom],
        ]) as any,
        [
          {
            [Modules.PRODUCT]: { product_id: "prod_owned" },
            customBuilder: { custom_builder_id: "builder_owned" },
          },
        ] as any,
        { storeId: "store_a" }
      )
    ).rejects.toThrow(
      "This Product link endpoint is not certified for shared Store placement"
    )
  })

  it("keeps custom Product links backward compatible outside shared placement", async () => {
    const product = {
      ...moduleFor(Modules.PRODUCT, "product_id", "listProducts", [
        "prod_owned",
      ]),
      __storeIsolationMode: () => "dedicated",
      __joinerConfig: {
        linkableKeys: { product_id: {}, variant_id: {} },
      },
      listProductVariants: jest.fn(async () => []),
    }
    const custom = {
      __definition: { key: "customBuilder" },
      __joinerConfig: { linkableKeys: { custom_builder_id: {} } },
    }

    await expect(
      assertStoreSafeLinks(
        new Map<string, any>([
          [Modules.PRODUCT, product],
          ["customBuilder", custom],
        ]) as any,
        [
          {
            [Modules.PRODUCT]: { product_id: "prod_owned" },
            customBuilder: { custom_builder_id: "builder_owned" },
          },
        ] as any,
        {}
      )
    ).resolves.toBeUndefined()
  })

  it("allows an owned Order-to-Fulfillment link in shared placement", async () => {
    const order = moduleFor(Modules.ORDER, "order_id", "listOrders", [
      "order_owned",
    ])
    const fulfillment = {
      __definition: { key: Modules.FULFILLMENT },
      __joinerConfig: {
        linkableKeys: { fulfillment_id: {}, shipping_option_id: {} },
      },
      __storeIsolationMode: () => "shared",
      listFulfillments: jest.fn(async () => [{ id: "ful_owned" }]),
    }

    await expect(
      assertStoreSafeLinks(
        new Map<string, any>([
          [Modules.ORDER, order],
          [Modules.FULFILLMENT, fulfillment],
        ]) as any,
        [
          {
            [Modules.ORDER]: { order_id: "order_owned" },
            [Modules.FULFILLMENT]: { fulfillment_id: "ful_owned" },
          },
        ] as any,
        { storeId: "store_a" }
      )
    ).resolves.toBeUndefined()
  })
})
