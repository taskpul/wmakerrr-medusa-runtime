import { IOrderModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"
import {
  ORDER_REQUEST_ROLE,
  ORDER_STORE_SETTING,
} from "../../src/store-isolation"

jest.setTimeout(30000)

moduleIntegrationTestRunner<IOrderModuleService>({
  moduleName: Modules.ORDER,
  pathToMigrations: __dirname + "/../../src/migrations",
  resolve: resolve(process.cwd(), "src"),
  moduleOptions: { store_isolation: { mode: "shared" } },
  testSuite: ({ service, MikroOrmWrapper }) => {
    const storeA = { storeId: "store_a" }
    const storeB = { storeId: "store_b" }

    beforeEach(async () => {
      const manager = MikroOrmWrapper.getManager()
      await manager.execute(`do $$ begin
        if not exists (select 1 from pg_roles where rolname = '${ORDER_REQUEST_ROLE}') then
          create role "${ORDER_REQUEST_ROLE}" nologin nosuperuser nobypassrls;
        end if;
      end $$;`)
      await manager.execute(
        `alter role "${ORDER_REQUEST_ROLE}" nologin nosuperuser nobypassrls;`
      )
      await manager.execute(
        `grant usage on schema public to "${ORDER_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant select, insert, update, delete on all tables in schema public to "${ORDER_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant usage, select on all sequences in schema public to "${ORDER_REQUEST_ROLE}";`
      )
    })

    it("fails closed and isolates orders with their children", async () => {
      await expect(service.listOrders()).rejects.toThrow(
        "Order operations in shared mode require Context.storeId"
      )

      const orderA = await service.createOrders(
        {
          currency_code: "eur",
          items: [{ title: "Store A item", quantity: 1, unit_price: 100 }],
        },
        storeA
      )
      const orderB = await service.createOrders(
        {
          currency_code: "eur",
          items: [{ title: "Store B item", quantity: 1, unit_price: 100 }],
        },
        storeB
      )

      await expect(
        service.retrieveOrder(orderB.id, {}, storeA)
      ).rejects.toThrow(/not found/i)
      await expect(service.listOrders({}, {}, storeA)).resolves.toEqual([
        expect.objectContaining({ id: orderA.id, store_id: "store_a" }),
      ])
      await expect(service.listOrderLineItems({}, {}, storeA)).resolves.toEqual(
        [expect.objectContaining({ title: "Store A item" })]
      )

      const manager = MikroOrmWrapper.getManager()
      const [foreignOrders, foreignItems] = await manager.transactional(
        async (transaction) => {
          await transaction.execute(`set local role "${ORDER_REQUEST_ROLE}"`)
          await transaction.execute(
            `select set_config('${ORDER_STORE_SETTING}', ?, true)`,
            ["store_b"]
          )
          return await Promise.all([
            transaction.execute(`select "id" from "order" where "id" = ?`, [
              orderA.id,
            ]),
            transaction.execute(
              `select "id" from "order_line_item" where "title" = ?`,
              ["Store A item"]
            ),
          ])
        }
      )
      expect(foreignOrders).toEqual([])
      expect(foreignItems).toEqual([])
    })
  },
})
