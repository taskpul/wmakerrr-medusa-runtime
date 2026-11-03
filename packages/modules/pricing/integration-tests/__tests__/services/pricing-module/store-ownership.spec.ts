import { IPricingModuleService } from "@medusajs/framework/types"
import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"
import {
  PRICING_REQUEST_ROLE,
  PRICING_STORE_SETTING,
} from "../../../../src/database-context"
import { Migration20261103142513_enforce_pricing_request_rls } from "../../../../src/migrations/Migration20261103142513_enforce_pricing_request_rls"

jest.setTimeout(30000)

moduleIntegrationTestRunner<IPricingModuleService>({
  moduleName: Modules.PRICING,
  pathToMigrations: __dirname + "/../../../../src/migrations",
  resolve: resolve(process.cwd(), "src"),
  moduleOptions: {
    store_isolation: {
      mode: "shared",
    },
  },
  testSuite: ({ service, MikroOrmWrapper }) => {
    const storeA = { storeId: "store_a" }
    const storeB = { storeId: "store_b" }

    beforeEach(async () => {
      const manager = MikroOrmWrapper.getManager()
      await manager.execute(`
        do $$
        begin
          if not exists (
            select 1 from pg_roles where rolname = '${PRICING_REQUEST_ROLE}'
          ) then
            create role "${PRICING_REQUEST_ROLE}"
              nologin nosuperuser nobypassrls;
          end if;
        end
        $$;
      `)
      await manager.execute(
        `alter role "${PRICING_REQUEST_ROLE}" nologin nosuperuser nobypassrls;`
      )
      await manager.execute(
        `grant usage on schema public to "${PRICING_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant select, insert, update, delete on table "price_set", "price", "price_rule", "price_list", "price_list_rule", "price_preference" to "${PRICING_REQUEST_ROLE}";`
      )
    })

    describe("Pricing Store ownership", () => {
      it("fails closed without an active Store", async () => {
        await expect(service.listPriceSets()).rejects.toThrow(
          "Pricing operations in shared mode require Context.storeId"
        )
      })

      it("binds the verified Store and request role to one transaction", async () => {
        const manager = MikroOrmWrapper.getManager() as SqlEntityManager

        await manager.transactional(async (transactionManager) => {
          await service.listPriceSets(
            {},
            {},
            {
              ...storeA,
              transactionManager,
            }
          )

          const [databaseContext] = await transactionManager.execute<
            { current_user: string; store_id: string }[]
          >(
            `select current_user, current_setting('${PRICING_STORE_SETTING}', true) as store_id`
          )

          expect(databaseContext).toEqual({
            current_user: PRICING_REQUEST_ROLE,
            store_id: storeA.storeId,
          })

          await expect(
            service.listPriceSets(
              {},
              {},
              {
                ...storeB,
                transactionManager,
              }
            )
          ).rejects.toThrow(
            "Pricing transaction is already bound to another Store"
          )
        })
      })

      it("denies database reads and writes when Store context is missing", async () => {
        const manager = MikroOrmWrapper.getManager() as SqlEntityManager

        await manager.transactional(async (transactionManager) => {
          await transactionManager.execute(
            `set local role "${PRICING_REQUEST_ROLE}"`
          )

          const rows = await transactionManager.execute(
            `select "id" from "price_set"`
          )
          expect(rows).toEqual([])

          await expect(
            transactionManager.execute(
              `insert into "price_set" ("id", "store_id") values (?, ?)`,
              ["pset_missing_context", storeA.storeId]
            )
          ).rejects.toThrow(/row-level security policy/i)
        })
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

      it("keeps concurrent Store requests isolated", async () => {
        const [priceSetA, priceSetB] = await Promise.all([
          service.createPriceSets(
            { prices: [{ amount: 1000, currency_code: "eur" }] },
            storeA
          ),
          service.createPriceSets(
            { prices: [{ amount: 2000, currency_code: "eur" }] },
            storeB
          ),
        ])

        const [storeAPriceSets, storeBPriceSets] = await Promise.all([
          service.listPriceSets({}, {}, storeA),
          service.listPriceSets({}, {}, storeB),
        ])

        expect(storeAPriceSets).toEqual([
          expect.objectContaining({ id: priceSetA.id, store_id: "store_a" }),
        ])
        expect(storeBPriceSets).toEqual([
          expect.objectContaining({ id: priceSetB.id, store_id: "store_b" }),
        ])
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

      it("scopes every generated read before pagination", async () => {
        const priceSetA = await service.createPriceSets({}, storeA)
        const priceSetB = await service.createPriceSets({}, storeB)
        const priceA = await service.createPrices(
          {
            price_set_id: priceSetA.id,
            amount: 1000,
            currency_code: "eur",
          },
          storeA
        )
        const priceB = await service.createPrices(
          {
            price_set_id: priceSetB.id,
            amount: 2000,
            currency_code: "eur",
          },
          storeB
        )

        const [prices, count] = await service.listAndCountPrices(
          {},
          { take: 1 },
          storeA
        )
        const listedPrices = await service.listPrices({}, {}, storeA)

        expect(count).toBe(1)
        expect(prices).toEqual([expect.objectContaining({ id: priceA.id })])
        expect(listedPrices).toEqual([
          expect.objectContaining({ id: priceA.id }),
        ])
        await expect(
          service.retrievePrice(priceB.id, {}, storeA)
        ).rejects.toThrow(`Price with id: ${priceB.id} was not found`)
      })

      it("stamps generated creates and rejects foreign parents", async () => {
        const priceSetA = await service.createPriceSets({}, storeA)
        const priceSetB = await service.createPriceSets({}, storeB)
        const price = await service.createPrices(
          {
            price_set_id: priceSetA.id,
            amount: 1000,
            currency_code: "eur",
            store_id: "store_b",
          } as any,
          storeA
        )

        expect(price.store_id).toBe("store_a")
        await expect(
          service.createPrices(
            {
              price_set_id: priceSetB.id,
              amount: 900,
              currency_code: "eur",
            },
            storeA
          )
        ).rejects.toThrow("Price sets do not belong to the active Store")
      })

      it("guards generated updates, deletes, soft deletes, and restores", async () => {
        const priceSetA = await service.createPriceSets({}, storeA)
        const priceSetB = await service.createPriceSets({}, storeB)
        const priceA = await service.createPrices(
          {
            price_set_id: priceSetA.id,
            amount: 1000,
            currency_code: "eur",
          },
          storeA
        )
        const priceB = await service.createPrices(
          {
            price_set_id: priceSetB.id,
            amount: 2000,
            currency_code: "eur",
          },
          storeB
        )

        await expect(
          service.updatePrices({ id: priceB.id, amount: 1 }, storeA)
        ).rejects.toThrow("Price do not belong to the active Store")
        await expect(service.deletePrices(priceB.id, storeA)).rejects.toThrow(
          "Price do not belong to the active Store"
        )
        await expect(
          service.softDeletePrices(priceB.id, {}, storeA)
        ).rejects.toThrow("Price do not belong to the active Store")

        await service.softDeletePrices(priceA.id, {}, storeA)
        await service.restorePrices(priceA.id, {}, storeA)
        await expect(
          service.retrievePrice(priceA.id, {}, storeA)
        ).resolves.toEqual(expect.objectContaining({ id: priceA.id }))
      })

      it("enforces Store ownership in PostgreSQL", async () => {
        const priceSetA = await service.createPriceSets({}, storeA)
        const priceSetB = await service.createPriceSets(
          {
            prices: [{ amount: 2000, currency_code: "eur" }],
          },
          storeB
        )
        const [priceListB] = await service.createPriceLists(
          [
            {
              title: "Store B sale",
              description: "Store B only",
            },
          ],
          storeB
        )
        const manager = MikroOrmWrapper.getManager()

        await expect(
          manager.execute(
            `insert into "price" ("id", "store_id", "currency_code", "amount", "raw_amount", "rules_count", "price_set_id") values (?, ?, ?, ?, ?::jsonb, ?, ?)`,
            [
              "price_cross_store",
              "store_a",
              "eur",
              100,
              JSON.stringify({ value: "100", precision: 20 }),
              0,
              priceSetB.id,
            ]
          )
        ).rejects.toThrow(/parent owned by the same Store/i)

        await expect(
          manager.execute(
            `insert into "price" ("id", "store_id", "currency_code", "amount", "raw_amount", "rules_count", "price_set_id", "price_list_id") values (?, ?, ?, ?, ?::jsonb, ?, ?, ?)`,
            [
              "price_cross_store_list",
              "store_a",
              "eur",
              100,
              JSON.stringify({ value: "100", precision: 20 }),
              0,
              priceSetA.id,
              priceListB.id,
            ]
          )
        ).rejects.toThrow(/parent owned by the same Store/i)

        await expect(
          manager.execute(
            `insert into "price_rule" ("id", "store_id", "attribute", "value", "price_id") values (?, ?, ?, ?, ?)`,
            [
              "prule_cross_store_price",
              "store_a",
              "region_id",
              "reg_test",
              priceSetB.prices![0].id,
            ]
          )
        ).rejects.toThrow(/parent owned by the same Store/i)

        await expect(
          manager.execute(
            `insert into "price_list_rule" ("id", "store_id", "attribute", "value", "price_list_id") values (?, ?, ?, ?::jsonb, ?)`,
            [
              "prule_cross_store_list",
              "store_a",
              "region_id",
              JSON.stringify("reg_test"),
              priceListB.id,
            ]
          )
        ).rejects.toThrow(/parent owned by the same Store/i)

        await expect(
          manager.execute(
            `update "price_set" set "store_id" = ? where "id" = ?`,
            ["store_a", priceSetB.id]
          )
        ).rejects.toThrow(/immutable/i)
      })

      it("reverts the Pricing request RLS migration cleanly", async () => {
        const manager = MikroOrmWrapper.getManager() as SqlEntityManager
        const migration =
          new Migration20261103142513_enforce_pricing_request_rls(
            undefined as never,
            undefined as never
          )

        await migration.down()
        for (const query of migration.getQueries()) {
          await manager.execute(query as string)
        }

        const tables = await manager.execute<
          { relrowsecurity: boolean; relforcerowsecurity: boolean }[]
        >(`
          select "relrowsecurity", "relforcerowsecurity"
          from "pg_class"
          where "relname" in (
            'price_set',
            'price',
            'price_rule',
            'price_list',
            'price_list_rule',
            'price_preference'
          )
        `)
        const policies = await manager.execute<{ count: string }[]>(`
          select count(*)::text as "count"
          from "pg_policies"
          where "policyname" like 'POL_%_store_isolation'
        `)

        expect(tables).toHaveLength(6)
        expect(tables).toEqual(
          expect.arrayContaining(
            Array.from({ length: 6 }, () => ({
              relrowsecurity: false,
              relforcerowsecurity: false,
            }))
          )
        )
        expect(policies[0].count).toBe("0")
      })
    })
  },
})
