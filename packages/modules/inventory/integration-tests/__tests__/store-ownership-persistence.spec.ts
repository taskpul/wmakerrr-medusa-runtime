import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import { IInventoryService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"
import { Migration20261103173322_AddStoreOwnership } from "../../src/migrations/Migration20261103173322_AddStoreOwnership"
import { Migration20261103173323_enforce_store_ownership } from "../../src/migrations/Migration20261103173323_enforce_store_ownership"
import { Migration20261103173324_enforce_inventory_request_rls } from "../../src/migrations/Migration20261103173324_enforce_inventory_request_rls"
import {
  INVENTORY_DEDICATED_STORE_ID,
  INVENTORY_REQUEST_ROLE,
  INVENTORY_STORE_SETTING,
} from "../../src/store-ownership"

jest.setTimeout(30000)

const tables = [
  "inventory_item",
  "inventory_level",
  "reservation_item",
] as const
const quotedTables = tables.map((table) => `"${table}"`).join(", ")
const sqlNames = tables.map((table) => `'${table}'`).join(", ")

async function executeMigration(
  manager: SqlEntityManager,
  migration:
    | Migration20261103173322_AddStoreOwnership
    | Migration20261103173323_enforce_store_ownership
    | Migration20261103173324_enforce_inventory_request_rls,
  direction: "up" | "down"
) {
  await migration[direction]()
  for (const query of migration.getQueries()) {
    await manager.execute(query as string)
  }
}

moduleIntegrationTestRunner<IInventoryService>({
  moduleName: Modules.INVENTORY,
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
          `set local role "${INVENTORY_REQUEST_ROLE}"`
        )
        await transactionManager.execute(
          `select set_config('${INVENTORY_STORE_SETTING}', ?, true)`,
          [storeId]
        )
        return await task(transactionManager)
      })
    }

    beforeEach(async () => {
      const manager = MikroOrmWrapper.getManager() as SqlEntityManager
      await manager.execute(`
        do $$ begin
          if not exists (select 1 from pg_roles where rolname = '${INVENTORY_REQUEST_ROLE}') then
            create role "${INVENTORY_REQUEST_ROLE}" nologin nosuperuser nobypassrls;
          end if;
        end $$;
      `)
      await manager.execute(
        `alter role "${INVENTORY_REQUEST_ROLE}" nologin nosuperuser nobypassrls;`
      )
      await manager.execute(
        `grant usage on schema public to "${INVENTORY_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant select, insert, update, delete on table ${quotedTables} to "${INVENTORY_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant usage, select on all sequences in schema public to "${INVENTORY_REQUEST_ROLE}";`
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
        select count(*)::text as "count"
        from "pg_policies"
        where "tablename" in (${sqlNames})
          and "policyname" like 'POL_%_store_isolation'
      `)

      expect(columns).toHaveLength(3)
      expect(columns).toEqual(
        expect.arrayContaining(
          tables.map((tableName) => ({
            table_name: tableName,
            is_nullable: "NO",
            column_default: `'${INVENTORY_DEDICATED_STORE_ID}'::text`,
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
      expect(policies[0].count).toBe("3")
    })

    it("fails closed without Store context and rejects owner reassignment", async () => {
      await withStore("store_a", async (manager) => {
        await manager.execute(
          `insert into "inventory_item" ("id", "store_id", "sku") values (?, ?, ?)`,
          ["i_owner_a", "store_a", "OWNER-A"]
        )
      })

      const manager = MikroOrmWrapper.getManager() as SqlEntityManager
      const rows = await manager.transactional(async (transactionManager) => {
        await transactionManager.execute(
          `set local role "${INVENTORY_REQUEST_ROLE}"`
        )
        return await transactionManager.execute(
          `select "id" from "inventory_item"`
        )
      })
      expect(rows).toEqual([])

      await expect(
        withStore("store_a", async (transactionManager) => {
          await transactionManager.execute(
            `update "inventory_item" set "store_id" = ? where "id" = ?`,
            ["store_b", "i_owner_a"]
          )
        })
      ).rejects.toThrow(/immutable|row-level security/i)
    })

    it("refuses rollback when Store-scoped SKUs cannot be collapsed safely", async () => {
      await withStore("store_a", async (manager) => {
        await manager.execute(
          `insert into "inventory_item" ("id", "store_id", "sku") values (?, ?, ?)`,
          ["i_rollback_a", "store_a", "ROLLBACK-SKU"]
        )
      })
      await withStore("store_b", async (manager) => {
        await manager.execute(
          `insert into "inventory_item" ("id", "store_id", "sku") values (?, ?, ?)`,
          ["i_rollback_b", "store_b", "ROLLBACK-SKU"]
        )
      })

      const manager = MikroOrmWrapper.getManager() as SqlEntityManager
      const ownership = new Migration20261103173323_enforce_store_ownership(
        undefined as never,
        undefined as never
      )
      await expect(
        executeMigration(manager, ownership, "down")
      ).rejects.toThrow(/cannot be collapsed|unique/i)
    })

    it("rolls back, backfills legacy rows, and restores enforcement", async () => {
      const manager = MikroOrmWrapper.getManager() as SqlEntityManager
      await manager.execute(`truncate table ${quotedTables} cascade;`)

      const schema = new Migration20261103173322_AddStoreOwnership(
        undefined as never,
        undefined as never
      )
      const ownership = new Migration20261103173323_enforce_store_ownership(
        undefined as never,
        undefined as never
      )
      const rls = new Migration20261103173324_enforce_inventory_request_rls(
        undefined as never,
        undefined as never
      )

      await executeMigration(manager, rls, "down")
      await executeMigration(manager, ownership, "down")
      await executeMigration(manager, schema, "down")
      await manager.execute(
        `insert into "inventory_item" ("id", "sku") values (?, ?)`,
        ["i_legacy", "LEGACY"]
      )

      await executeMigration(manager, schema, "up")
      const [backfilled] = await manager.execute<{ store_id: string }[]>(
        `select "store_id" from "inventory_item" where "id" = 'i_legacy'`
      )
      expect(backfilled.store_id).toBe(INVENTORY_DEDICATED_STORE_ID)

      await executeMigration(manager, ownership, "up")
      await executeMigration(manager, rls, "up")
      const policies = await manager.execute<{ count: string }[]>(`
        select count(*)::text as "count" from "pg_policies"
        where "tablename" in (${sqlNames})
          and "policyname" like 'POL_%_store_isolation'
      `)
      expect(policies[0].count).toBe("3")
    })
  },
})
