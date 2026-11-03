import { ICustomerModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"
import {
  CUSTOMER_REQUEST_ROLE,
  CUSTOMER_STORE_SETTING,
} from "../../src/store-isolation"

jest.setTimeout(30000)

moduleIntegrationTestRunner<ICustomerModuleService>({
  moduleName: Modules.CUSTOMER,
  pathToMigrations: __dirname + "/../../src/migrations",
  resolve: resolve(process.cwd(), "src"),
  moduleOptions: { store_isolation: { mode: "shared" } },
  testSuite: ({ service, MikroOrmWrapper }) => {
    const storeA = { storeId: "store_a" }
    const storeB = { storeId: "store_b" }

    beforeEach(async () => {
      const manager = MikroOrmWrapper.getManager()
      await manager.execute(`do $$ begin
        if not exists (select 1 from pg_roles where rolname = '${CUSTOMER_REQUEST_ROLE}') then
          create role "${CUSTOMER_REQUEST_ROLE}" nologin nosuperuser nobypassrls;
        end if;
      end $$;`)
      await manager.execute(
        `alter role "${CUSTOMER_REQUEST_ROLE}" nologin nosuperuser nobypassrls;`
      )
      await manager.execute(
        `grant usage on schema public to "${CUSTOMER_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant select, insert, update, delete on all tables in schema public to "${CUSTOMER_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant usage, select on all sequences in schema public to "${CUSTOMER_REQUEST_ROLE}";`
      )
    })

    it("fails closed and isolates customer accounts", async () => {
      await expect(service.listCustomers()).rejects.toThrow(
        "Customer operations in shared mode require Context.storeId"
      )

      const customerA = await service.createCustomers(
        { email: "buyer@example.com", has_account: true },
        storeA
      )
      const customerB = await service.createCustomers(
        { email: "buyer@example.com", has_account: true },
        storeB
      )

      await expect(
        service.retrieveCustomer(customerB.id, {}, storeA)
      ).rejects.toThrow(/not found/i)
      await expect(service.listCustomers({}, {}, storeA)).resolves.toEqual([
        expect.objectContaining({ id: customerA.id, store_id: "store_a" }),
      ])

      const manager = MikroOrmWrapper.getManager()
      const foreignRows = await manager.transactional(async (transaction) => {
        await transaction.execute(`set local role "${CUSTOMER_REQUEST_ROLE}"`)
        await transaction.execute(
          `select set_config('${CUSTOMER_STORE_SETTING}', ?, true)`,
          ["store_b"]
        )
        return await transaction.execute(
          `select "id" from "customer" where "id" = ?`,
          [customerA.id]
        )
      })
      expect(foreignRows).toEqual([])
    })
  },
})
