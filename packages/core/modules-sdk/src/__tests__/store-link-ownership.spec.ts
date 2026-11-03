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
})
