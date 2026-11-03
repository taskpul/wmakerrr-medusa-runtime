import { ICartModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"
import {
  CART_REQUEST_ROLE,
  CART_STORE_SETTING,
} from "../../src/store-isolation"

jest.setTimeout(30000)

moduleIntegrationTestRunner<ICartModuleService>({
  moduleName: Modules.CART,
  pathToMigrations: __dirname + "/../../src/migrations",
  resolve: resolve(process.cwd(), "src"),
  moduleOptions: { store_isolation: { mode: "shared" } },
  testSuite: ({ service, MikroOrmWrapper }) => {
    const storeA = { storeId: "store_a" }
    const storeB = { storeId: "store_b" }

    beforeEach(async () => {
      const manager = MikroOrmWrapper.getManager()
      await manager.execute(`do $$ begin
        if not exists (select 1 from pg_roles where rolname = '${CART_REQUEST_ROLE}') then
          create role "${CART_REQUEST_ROLE}" nologin nosuperuser nobypassrls;
        end if;
      end $$;`)
      await manager.execute(
        `alter role "${CART_REQUEST_ROLE}" nologin nosuperuser nobypassrls;`
      )
      await manager.execute(
        `grant usage on schema public to "${CART_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant select, insert, update, delete on all tables in schema public to "${CART_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant usage, select on all sequences in schema public to "${CART_REQUEST_ROLE}";`
      )
    })

    it("fails closed and isolates carts", async () => {
      await expect(service.listCarts()).rejects.toThrow(
        "Cart operations in shared mode require Context.storeId"
      )

      const cartA = await service.createCarts({ currency_code: "eur" }, storeA)
      const cartB = await service.createCarts({ currency_code: "eur" }, storeB)

      await expect(service.retrieveCart(cartB.id, {}, storeA)).rejects.toThrow(
        /not found/i
      )
      await expect(service.listCarts({}, {}, storeA)).resolves.toEqual([
        expect.objectContaining({ id: cartA.id, store_id: "store_a" }),
      ])

      const manager = MikroOrmWrapper.getManager()
      const foreignRows = await manager.transactional(async (transaction) => {
        await transaction.execute(`set local role "${CART_REQUEST_ROLE}"`)
        await transaction.execute(
          `select set_config('${CART_STORE_SETTING}', ?, true)`,
          ["store_b"]
        )
        return await transaction.execute(
          `select "id" from "cart" where "id" = ?`,
          [cartA.id]
        )
      })
      expect(foreignRows).toEqual([])
    })
  },
})
