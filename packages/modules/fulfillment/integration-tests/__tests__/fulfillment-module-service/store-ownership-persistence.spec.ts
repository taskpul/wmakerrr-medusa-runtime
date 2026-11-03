import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import { IFulfillmentModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"
import { Migration20261103170219 } from "../../../src/migrations/Migration20261103170219"
import { Migration20261103170220_enforce_store_ownership } from "../../../src/migrations/Migration20261103170220_enforce_store_ownership"
import { Migration20261103170221_enforce_fulfillment_request_rls } from "../../../src/migrations/Migration20261103170221_enforce_fulfillment_request_rls"
import {
  FULFILLMENT_DEDICATED_STORE_ID,
  FULFILLMENT_REQUEST_ROLE,
  FULFILLMENT_STORE_SETTING,
} from "../../../src/store-ownership"

jest.setTimeout(30000)

const directStoreTables = [
  "fulfillment_address",
  "fulfillment_set",
  "service_zone",
  "geo_zone",
  "shipping_option_type",
  "shipping_profile",
  "shipping_option",
  "shipping_option_rule",
  "fulfillment",
  "fulfillment_label",
  "fulfillment_item",
] as const

const quotedTables = directStoreTables.map((table) => `"${table}"`).join(", ")
const sqlNames = directStoreTables.map((table) => `'${table}'`).join(", ")

async function executeMigration(
  manager: SqlEntityManager,
  migration:
    | Migration20261103170219
    | Migration20261103170220_enforce_store_ownership
    | Migration20261103170221_enforce_fulfillment_request_rls,
  direction: "up" | "down"
) {
  await migration[direction]()
  for (const query of migration.getQueries()) {
    await manager.execute(query as string)
  }
}

moduleIntegrationTestRunner<IFulfillmentModuleService>({
  moduleName: Modules.FULFILLMENT,
  pathToMigrations: __dirname + "/../../../src/migrations",
  resolve: resolve(process.cwd(), "src"),
  testSuite: ({ MikroOrmWrapper }) => {
    const storeA = "store_a"
    const storeB = "store_b"

    const withStore = async <T>(
      storeId: string,
      task: (manager: SqlEntityManager) => Promise<T>
    ) => {
      const manager = MikroOrmWrapper.getManager() as SqlEntityManager
      return await manager.transactional(async (transactionManager) => {
        await transactionManager.execute(
          `set local role "${FULFILLMENT_REQUEST_ROLE}"`
        )
        await transactionManager.execute(
          `select set_config('${FULFILLMENT_STORE_SETTING}', ?, true)`,
          [storeId]
        )
        return await task(transactionManager)
      })
    }

    beforeEach(async () => {
      const manager = MikroOrmWrapper.getManager() as SqlEntityManager
      await manager.execute(`
        do $$
        begin
          if not exists (
            select 1 from pg_roles where rolname = '${FULFILLMENT_REQUEST_ROLE}'
          ) then
            create role "${FULFILLMENT_REQUEST_ROLE}"
              nologin nosuperuser nobypassrls;
          end if;
        end
        $$;
      `)
      await manager.execute(
        `alter role "${FULFILLMENT_REQUEST_ROLE}" nologin nosuperuser nobypassrls;`
      )
      await manager.execute(
        `grant usage on schema public to "${FULFILLMENT_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant select, insert, update, delete on table ${quotedTables} to "${FULFILLMENT_REQUEST_ROLE}";`
      )
    })

    describe("Fulfillment Store persistence ownership", () => {
      it("installs non-null ownership columns and forced RLS", async () => {
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

        expect(columns).toHaveLength(11)
        expect(columns).toEqual(
          expect.arrayContaining(
            directStoreTables.map((tableName) => ({
              table_name: tableName,
              is_nullable: "NO",
              column_default: `'${FULFILLMENT_DEDICATED_STORE_ID}'::text`,
            }))
          )
        )
        expect(rlsTables).toHaveLength(11)
        expect(rlsTables).toEqual(
          expect.arrayContaining(
            directStoreTables.map((tableName) => ({
              relname: tableName,
              relrowsecurity: true,
              relforcerowsecurity: true,
            }))
          )
        )
        expect(policies[0].count).toBe("11")
      })

      it("fails closed for the shared request role without Store context", async () => {
        await withStore(storeA, async (manager) => {
          await manager.execute(
            `insert into "shipping_profile" ("id", "store_id", "name", "type") values (?, ?, ?, ?)`,
            ["sp_rls_a", storeA, "RLS A", "default"]
          )
        })

        const manager = MikroOrmWrapper.getManager() as SqlEntityManager
        const rows = await manager.transactional(async (transactionManager) => {
          await transactionManager.execute(
            `set local role "${FULFILLMENT_REQUEST_ROLE}"`
          )
          return await transactionManager.execute(
            `select "id" from "shipping_profile"`
          )
        })
        expect(rows).toEqual([])

        await expect(
          manager.transactional(async (transactionManager) => {
            await transactionManager.execute(
              `set local role "${FULFILLMENT_REQUEST_ROLE}"`
            )
            await transactionManager.execute(
              `insert into "shipping_profile" ("id", "store_id", "name", "type") values (?, ?, ?, ?)`,
              ["sp_missing_context", storeA, "Missing", "default"]
            )
          })
        ).rejects.toThrow(/row-level security policy/i)
      })

      it("scopes business-key uniqueness to one Store", async () => {
        await withStore(storeA, async (manager) => {
          await manager.execute(
            `insert into "shipping_profile" ("id", "store_id", "name", "type") values (?, ?, ?, ?)`,
            ["sp_unique_a", storeA, "Shared profile", "default"]
          )
        })
        await withStore(storeB, async (manager) => {
          await manager.execute(
            `insert into "shipping_profile" ("id", "store_id", "name", "type") values (?, ?, ?, ?)`,
            ["sp_unique_b", storeB, "Shared profile", "default"]
          )
        })

        await expect(
          withStore(storeA, async (manager) => {
            await manager.execute(
              `insert into "shipping_profile" ("id", "store_id", "name", "type") values (?, ?, ?, ?)`,
              ["sp_unique_duplicate", storeA, "Shared profile", "default"]
            )
          })
        ).rejects.toThrow(/IDX_shipping_profile_name_unique|duplicate key/i)
      })

      it("rejects owner reassignment and cross-Store relationships", async () => {
        await withStore(storeA, async (manager) => {
          await manager.execute(
            `insert into "fulfillment_set" ("id", "store_id", "name", "type") values (?, ?, ?, ?)`,
            ["fset_owner_a", storeA, "Owner A", "shipping"]
          )
        })
        await withStore(storeB, async (manager) => {
          await manager.execute(
            `insert into "fulfillment_set" ("id", "store_id", "name", "type") values (?, ?, ?, ?)`,
            ["fset_owner_b", storeB, "Owner B", "shipping"]
          )
        })

        await expect(
          withStore(storeA, async (manager) => {
            await manager.execute(
              `update "fulfillment_set" set "store_id" = ? where "id" = ?`,
              [storeB, "fset_owner_a"]
            )
          })
        ).rejects.toThrow(/immutable|row-level security/i)
        await expect(
          withStore(storeA, async (manager) => {
            await manager.execute(
              `insert into "service_zone" ("id", "store_id", "name", "fulfillment_set_id") values (?, ?, ?, ?)`,
              ["serzo_cross_store", storeA, "Cross", "fset_owner_b"]
            )
          })
        ).rejects.toThrow(/foreign key|fulfillment_set_id/i)
      })

      it("rolls back, backfills legacy rows, and restores enforcement", async () => {
        const manager = MikroOrmWrapper.getManager() as SqlEntityManager
        await manager.execute(`truncate table ${quotedTables} cascade;`)

        const schemaMigration = new Migration20261103170219(
          undefined as never,
          undefined as never
        )
        const ownershipMigration =
          new Migration20261103170220_enforce_store_ownership(
            undefined as never,
            undefined as never
          )
        const rlsMigration =
          new Migration20261103170221_enforce_fulfillment_request_rls(
            undefined as never,
            undefined as never
          )

        await executeMigration(manager, rlsMigration, "down")
        await executeMigration(manager, ownershipMigration, "down")
        await executeMigration(manager, schemaMigration, "down")

        const remainingColumns = await manager.execute<{ count: string }[]>(`
          select count(*)::text as "count"
          from "information_schema"."columns"
          where "table_schema" = 'public'
            and "column_name" = 'store_id'
            and "table_name" in (${sqlNames})
        `)
        expect(remainingColumns[0].count).toBe("0")

        await manager.execute(
          `insert into "shipping_profile" ("id", "name", "type") values (?, ?, ?)`,
          ["sp_legacy", "Legacy", "default"]
        )

        await executeMigration(manager, schemaMigration, "up")
        const [backfilled] = await manager.execute<{ store_id: string }[]>(
          `select "store_id" from "shipping_profile" where "id" = 'sp_legacy'`
        )
        expect(backfilled.store_id).toBe(FULFILLMENT_DEDICATED_STORE_ID)

        await executeMigration(manager, ownershipMigration, "up")
        await executeMigration(manager, rlsMigration, "up")

        const restoredPolicies = await manager.execute<{ count: string }[]>(`
          select count(*)::text as "count"
          from "pg_policies"
          where "tablename" in (${sqlNames})
            and "policyname" like 'POL_%_store_isolation'
        `)
        expect(restoredPolicies[0].count).toBe("11")
      })
    })
  },
})
