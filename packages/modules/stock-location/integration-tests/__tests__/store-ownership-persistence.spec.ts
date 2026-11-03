import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import { IStockLocationService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"
import { Migration20261103173328_AddStoreOwnership } from "../../src/migrations/Migration20261103173328_AddStoreOwnership"
import { Migration20261103173329_enforce_store_ownership } from "../../src/migrations/Migration20261103173329_enforce_store_ownership"
import { Migration20261103173330_enforce_stock_location_request_rls } from "../../src/migrations/Migration20261103173330_enforce_stock_location_request_rls"
import {
  STOCK_LOCATION_DEDICATED_STORE_ID,
  STOCK_LOCATION_REQUEST_ROLE,
  STOCK_LOCATION_STORE_SETTING,
} from "../../src/store-ownership"

jest.setTimeout(30000)

const tables = ["stock_location_address", "stock_location"] as const
const quotedTables = tables.map((table) => `"${table}"`).join(", ")
const sqlNames = tables.map((table) => `'${table}'`).join(", ")

async function executeMigration(
  manager: SqlEntityManager,
  migration:
    | Migration20261103173328_AddStoreOwnership
    | Migration20261103173329_enforce_store_ownership
    | Migration20261103173330_enforce_stock_location_request_rls,
  direction: "up" | "down"
) {
  await migration[direction]()
  for (const query of migration.getQueries()) {
    await manager.execute(query as string)
  }
}

moduleIntegrationTestRunner<IStockLocationService>({
  moduleName: Modules.STOCK_LOCATION,
  pathToMigrations: __dirname + "/../../src/migrations",
  resolve: resolve(process.cwd(), "src"),
  testSuite: ({ MikroOrmWrapper }) => {
    const withStore = async <T>(
      storeId: string,
      task: (manager: SqlEntityManager) => Promise<T>
    ) => {
      const manager = MikroOrmWrapper.getManager() as SqlEntityManager
      return await manager.transactional(async (transactionManager) => {
        await transactionManager.execute(
          `set local role "${STOCK_LOCATION_REQUEST_ROLE}"`
        )
        await transactionManager.execute(
          `select set_config('${STOCK_LOCATION_STORE_SETTING}', ?, true)`,
          [storeId]
        )
        return await task(transactionManager)
      })
    }

    beforeEach(async () => {
      const manager = MikroOrmWrapper.getManager() as SqlEntityManager
      await manager.execute(`
        do $$ begin
          if not exists (select 1 from pg_roles where rolname = '${STOCK_LOCATION_REQUEST_ROLE}') then
            create role "${STOCK_LOCATION_REQUEST_ROLE}" nologin nosuperuser nobypassrls;
          end if;
        end $$;
      `)
      await manager.execute(
        `alter role "${STOCK_LOCATION_REQUEST_ROLE}" nologin nosuperuser nobypassrls;`
      )
      await manager.execute(
        `grant usage on schema public to "${STOCK_LOCATION_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant select, insert, update, delete on table ${quotedTables} to "${STOCK_LOCATION_REQUEST_ROLE}";`
      )
    })

    it("installs non-null ownership, forced RLS, and request policies", async () => {
      const manager = MikroOrmWrapper.getManager() as SqlEntityManager
      const columns = await manager.execute<
        { table_name: string; is_nullable: string; column_default: string }[]
      >(`
        select "table_name", "is_nullable", "column_default"
        from "information_schema"."columns"
        where "table_schema" = 'public'
          and "column_name" = 'store_id'
          and "table_name" in (${sqlNames})
        order by "table_name"
      `)
      const rlsTables = await manager.execute<
        {
          relname: string
          relrowsecurity: boolean
          relforcerowsecurity: boolean
        }[]
      >(`
        select "relname", "relrowsecurity", "relforcerowsecurity"
        from "pg_class"
        where "relname" in (${sqlNames})
        order by "relname"
      `)
      const policies = await manager.execute<{ count: string }[]>(`
        select count(*)::text as "count" from "pg_policies"
        where "tablename" in (${sqlNames})
          and "policyname" like 'POL_%_store_isolation'
      `)

      expect(columns).toHaveLength(2)
      expect(columns).toEqual(
        expect.arrayContaining(
          tables.map((tableName) => ({
            table_name: tableName,
            is_nullable: "NO",
            column_default: `'${STOCK_LOCATION_DEDICATED_STORE_ID}'::text`,
          }))
        )
      )
      expect(rlsTables).toEqual(
        expect.arrayContaining(
          tables.map((tableName) => ({
            relname: tableName,
            relrowsecurity: true,
            relforcerowsecurity: true,
          }))
        )
      )
      expect(policies[0].count).toBe("2")
    })

    it("fails closed without Store context and rejects owner reassignment", async () => {
      await withStore("store_a", async (manager) => {
        await manager.execute(
          `insert into "stock_location" ("id", "store_id", "name") values (?, ?, ?)`,
          ["sl_owner_a", "store_a", "Owner A"]
        )
      })

      const manager = MikroOrmWrapper.getManager() as SqlEntityManager
      const rows = await manager.transactional(async (transactionManager) => {
        await transactionManager.execute(
          `set local role "${STOCK_LOCATION_REQUEST_ROLE}"`
        )
        return await transactionManager.execute(
          `select "id" from "stock_location"`
        )
      })
      expect(rows).toEqual([])

      await expect(
        withStore("store_a", async (transactionManager) => {
          await transactionManager.execute(
            `update "stock_location" set "store_id" = ? where "id" = ?`,
            ["store_b", "sl_owner_a"]
          )
        })
      ).rejects.toThrow(/immutable|row-level security/i)
    })

    it("rolls back, backfills legacy rows, and restores enforcement", async () => {
      const manager = MikroOrmWrapper.getManager() as SqlEntityManager
      await manager.execute(`truncate table ${quotedTables} cascade;`)

      const schema = new Migration20261103173328_AddStoreOwnership(
        undefined as never,
        undefined as never
      )
      const ownership = new Migration20261103173329_enforce_store_ownership(
        undefined as never,
        undefined as never
      )
      const rls =
        new Migration20261103173330_enforce_stock_location_request_rls(
          undefined as never,
          undefined as never
        )

      await executeMigration(manager, rls, "down")
      await executeMigration(manager, ownership, "down")
      await executeMigration(manager, schema, "down")
      await manager.execute(
        `insert into "stock_location" ("id", "name") values (?, ?)`,
        ["sl_legacy", "Legacy"]
      )

      await executeMigration(manager, schema, "up")
      const [backfilled] = await manager.execute<{ store_id: string }[]>(
        `select "store_id" from "stock_location" where "id" = 'sl_legacy'`
      )
      expect(backfilled.store_id).toBe(STOCK_LOCATION_DEDICATED_STORE_ID)

      await executeMigration(manager, ownership, "up")
      await executeMigration(manager, rls, "up")
      const policies = await manager.execute<{ count: string }[]>(`
        select count(*)::text as "count" from "pg_policies"
        where "tablename" in (${sqlNames})
          and "policyname" like 'POL_%_store_isolation'
      `)
      expect(policies[0].count).toBe("2")
    })
  },
})
