import { IPricingModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"

jest.setTimeout(30000)

moduleIntegrationTestRunner<IPricingModuleService>({
  moduleName: Modules.PRICING,
  moduleOptions: {
    store_isolation: {
      mode: "shared",
    },
  },
  testSuite: ({ service }) => {
    const storeA = { storeId: "store_a" }
    const storeB = { storeId: "store_b" }

    describe("Pricing Store ownership", () => {
      it("fails closed without an active Store", async () => {
        await expect(service.listPriceSets()).rejects.toThrow(
          "Pricing operations in shared mode require Context.storeId"
        )
      })

      it("filters reads before pagination", async () => {
        const priceSetA = await service.createPriceSets(
          {
            prices: [{ amount: 1000, currency_code: "eur" }],
          },
          storeA
        )
        await service.createPriceSets(
          {
            prices: [{ amount: 2000, currency_code: "eur" }],
          },
          storeB
        )

        const [storeAPriceSets, count] = await service.listAndCountPriceSets(
          {},
          { take: 1 },
          storeA
        )

        expect(count).toBe(1)
        expect(storeAPriceSets).toHaveLength(1)
        expect(storeAPriceSets[0].id).toBe(priceSetA.id)
      })

      it("rejects calculation with a foreign Store price set", async () => {
        const priceSetB = await service.createPriceSets(
          {
            prices: [{ amount: 2000, currency_code: "eur" }],
          },
          storeB
        )

        await expect(
          service.calculatePrices(
            { id: [priceSetB.id] },
            { context: { currency_code: "eur" } },
            storeA
          )
        ).rejects.toThrow("Price sets do not belong to the active Store")
      })

      it("rejects a price-list relationship to a foreign price set", async () => {
        const priceSetB = await service.createPriceSets({}, storeB)

        await expect(
          service.createPriceLists(
            [
              {
                title: "Store A sale",
                description: "Must not use Store B prices",
                prices: [
                  {
                    price_set_id: priceSetB.id,
                    amount: 900,
                    currency_code: "eur",
                  },
                ],
              },
            ],
            storeA
          )
        ).rejects.toThrow("Price sets do not belong to the active Store")
      })

      it("rejects deleting another Store's price set", async () => {
        const priceSetB = await service.createPriceSets({}, storeB)

        await expect(
          service.deletePriceSets(priceSetB.id, storeA)
        ).rejects.toThrow("Price sets do not belong to the active Store")

        await expect(
          service.retrievePriceSet(priceSetB.id, {}, storeB)
        ).resolves.toEqual(expect.objectContaining({ id: priceSetB.id }))
      })

      it("keeps price-preference uniqueness inside each Store", async () => {
        const preference = {
          attribute: "currency_code",
          value: "eur",
          is_tax_inclusive: true,
        }

        await expect(
          Promise.all([
            service.createPricePreferences(preference, storeA),
            service.createPricePreferences(preference, storeB),
          ])
        ).resolves.toHaveLength(2)
      })
    })
  },
})
