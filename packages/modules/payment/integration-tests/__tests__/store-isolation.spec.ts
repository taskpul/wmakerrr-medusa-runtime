import { IPaymentModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"
import {
  PAYMENT_REQUEST_ROLE,
  PAYMENT_STORE_SETTING,
} from "../../src/store-isolation"

jest.setTimeout(30000)

moduleIntegrationTestRunner<IPaymentModuleService>({
  moduleName: Modules.PAYMENT,
  pathToMigrations: __dirname + "/../../src/migrations",
  resolve: resolve(process.cwd(), "src"),
  moduleOptions: { store_isolation: { mode: "shared" } },
  testSuite: ({ service, MikroOrmWrapper }) => {
    const storeA = { storeId: "store_a" }
    const storeB = { storeId: "store_b" }

    beforeEach(async () => {
      const manager = MikroOrmWrapper.getManager()
      await manager.execute(`do $$ begin
        if not exists (select 1 from pg_roles where rolname = '${PAYMENT_REQUEST_ROLE}') then
          create role "${PAYMENT_REQUEST_ROLE}" nologin nosuperuser nobypassrls;
        end if;
      end $$;`)
      await manager.execute(
        `alter role "${PAYMENT_REQUEST_ROLE}" nologin nosuperuser nobypassrls;`
      )
      await manager.execute(
        `grant usage on schema public to "${PAYMENT_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant select, insert, update, delete on all tables in schema public to "${PAYMENT_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant usage, select on all sequences in schema public to "${PAYMENT_REQUEST_ROLE}";`
      )
    })

    it("fails closed and isolates payment collections", async () => {
      await expect(service.listPaymentCollections()).rejects.toThrow(
        "Payment operations in shared mode require Context.storeId"
      )

      const collectionA = await service.createPaymentCollections(
        { currency_code: "eur", amount: 100 },
        storeA
      )
      const collectionB = await service.createPaymentCollections(
        { currency_code: "eur", amount: 100 },
        storeB
      )

      await expect(
        service.retrievePaymentCollection(collectionB.id, {}, storeA)
      ).rejects.toThrow(/not found/i)
      await expect(
        service.listPaymentCollections({}, {}, storeA)
      ).resolves.toEqual([
        expect.objectContaining({ id: collectionA.id, store_id: "store_a" }),
      ])

      const manager = MikroOrmWrapper.getManager()
      const foreignRows = await manager.transactional(async (transaction) => {
        await transaction.execute(`set local role "${PAYMENT_REQUEST_ROLE}"`)
        await transaction.execute(
          `select set_config('${PAYMENT_STORE_SETTING}', ?, true)`,
          ["store_b"]
        )
        return await transaction.execute(
          `select "id" from "payment_collection" where "id" = ?`,
          [collectionA.id]
        )
      })
      expect(foreignRows).toEqual([])
    })
  },
})
