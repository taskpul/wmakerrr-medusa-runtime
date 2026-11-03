import { IPricingModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"

jest.setTimeout(30000)

moduleIntegrationTestRunner<IPricingModuleService>({
  moduleName: Modules.PRICING,
  resolve: resolve(process.cwd(), "src"),
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

      it("rejects upserting another Store's price set", async () => {
        const priceSetB = await service.createPriceSets(
          {
            prices: [{ amount: 2000, currency_code: "eur" }],
          },
          storeB
        )
        const foreignPrice = priceSetB.prices![0]

        await expect(
          service.upsertPriceSets(
            {
              id: priceSetB.id,
              prices: [{ amount: 100, currency_code: "eur" }],
            },
            storeA
          )
        ).rejects.toThrow("Price sets do not belong to the active Store")

        const unchanged = await service.retrievePriceSet(
          priceSetB.id,
          { relations: ["prices"] },
          storeB
        )
        expect(unchanged.prices).toEqual([
          expect.objectContaining({ id: foreignPrice.id, amount: 2000 }),
        ])
      })

      it("rejects foreign price IDs on every price upsert path", async () => {
        const priceSetA = await service.createPriceSets({}, storeA)
        const priceSetB = await service.createPriceSets(
          {
            prices: [{ amount: 2000, currency_code: "eur" }],
          },
          storeB
        )
        const foreignPrice = priceSetB.prices![0]
        const [priceListA] = await service.createPriceLists(
          [
            {
              title: "Store A sale",
              description: "Store A prices only",
            },
          ],
          storeA
        )
        const attackPrice = {
          id: foreignPrice.id,
          price_set_id: priceSetA.id,
          amount: 100,
          currency_code: "eur",
        }

        await expect(
          service.addPrices(
            [{ priceSetId: priceSetA.id, prices: [attackPrice] }],
            storeA
          )
        ).rejects.toThrow("Prices do not belong to the active Store")
        await expect(
          service.addPriceListPrices(
            [{ price_list_id: priceListA.id, prices: [attackPrice] }],
            storeA
          )
        ).rejects.toThrow("Prices do not belong to the active Store")
        await expect(
          service.updatePriceListPrices(
            [{ price_list_id: priceListA.id, prices: [attackPrice] }],
            storeA
          )
        ).rejects.toThrow("Prices do not belong to the active Store")

        const unchanged = await service.retrievePriceSet(
          priceSetB.id,
          { relations: ["prices"] },
          storeB
        )
        expect(unchanged.prices).toEqual([
          expect.objectContaining({ id: foreignPrice.id, amount: 2000 }),
        ])
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
