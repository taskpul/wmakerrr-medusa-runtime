import { IProductModuleService } from "@medusajs/framework/types"
import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import { Modules } from "@medusajs/framework/utils"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { resolve } from "path"
import { Migration20261103154512 } from "../../../src/migrations/Migration20261103154512"
import { Migration20261103154513_enforce_store_ownership } from "../../../src/migrations/Migration20261103154513_enforce_store_ownership"
import { Migration20261103154514_enforce_product_request_rls } from "../../../src/migrations/Migration20261103154514_enforce_product_request_rls"
import { Migration20261103154515_enforce_composite_store_relationships } from "../../../src/migrations/Migration20261103154515_enforce_composite_store_relationships"
import {
  PRODUCT_DEDICATED_STORE_ID,
  PRODUCT_REQUEST_ROLE,
  PRODUCT_STORE_SETTING,
} from "../../../src/store-ownership"

jest.setTimeout(30000)

const directStoreTables = [
  "product_category",
  "product_collection",
  "product_option",
  "product_option_value",
  "product_tag",
  "product_type",
  "product",
  "product_product_option",
  "product_product_option_value",
  "image",
  "product_variant",
  "product_variant_product_image",
] as const

const parentDerivedPivotTables = [
  "product_tags",
  "product_category_product",
  "product_variant_option",
] as const

const allProductTables = [
  ...directStoreTables,
  ...parentDerivedPivotTables,
] as const

const quotedTables = (tables: readonly string[]) =>
  tables.map((table) => `"${table}"`).join(", ")

const sqlNames = (tables: readonly string[]) =>
  tables.map((table) => `'${table}'`).join(", ")

async function executeMigration(
  manager: SqlEntityManager,
  migration:
    | Migration20261103154512
    | Migration20261103154513_enforce_store_ownership
    | Migration20261103154514_enforce_product_request_rls
    | Migration20261103154515_enforce_composite_store_relationships,
  direction: "up" | "down"
) {
  await migration[direction]()
  for (const query of migration.getQueries()) {
    await manager.execute(query as string)
  }
}

moduleIntegrationTestRunner<IProductModuleService>({
  moduleName: Modules.PRODUCT,
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
          `set local role "${PRODUCT_REQUEST_ROLE}"`
        )
        await transactionManager.execute(
          `select set_config('${PRODUCT_STORE_SETTING}', ?, true)`,
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
            select 1 from pg_roles where rolname = '${PRODUCT_REQUEST_ROLE}'
          ) then
            create role "${PRODUCT_REQUEST_ROLE}"
              nologin nosuperuser nobypassrls;
          end if;
        end
        $$;
      `)
      await manager.execute(
        `alter role "${PRODUCT_REQUEST_ROLE}" nologin nosuperuser nobypassrls;`
      )
      await manager.execute(
        `grant usage on schema public to "${PRODUCT_REQUEST_ROLE}";`
      )
      await manager.execute(
        `grant select, insert, update, delete on table ${quotedTables(allProductTables)} to "${PRODUCT_REQUEST_ROLE}";`
      )
    })

    describe("Product Store persistence ownership", () => {
      it("installs direct ownership and parent-derived pivot schemas", async () => {
        const manager = MikroOrmWrapper.getManager() as SqlEntityManager
        const directColumns = await manager.execute<
          { table_name: string; is_nullable: string; column_default: string }[]
        >(`
          select "table_name", "is_nullable", "column_default"
          from "information_schema"."columns"
          where "table_schema" = 'public'
            and "column_name" = 'store_id'
            and "table_name" in (${sqlNames(directStoreTables)})
          order by "table_name"
        `)
        const pivotColumns = await manager.execute<{ count: string }[]>(`
          select count(*)::text as "count"
          from "information_schema"."columns"
          where "table_schema" = 'public'
            and "column_name" = 'store_id'
            and "table_name" in (${sqlNames(parentDerivedPivotTables)})
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
          where "relname" in (${sqlNames(allProductTables)})
          order by "relname"
        `)
        const policies = await manager.execute<{ count: string }[]>(`
          select count(*)::text as "count"
          from "pg_policies"
          where "tablename" in (${sqlNames(allProductTables)})
            and "policyname" like 'POL_%_store_isolation'
        `)

        expect(directColumns).toHaveLength(12)
        expect(directColumns).toEqual(
          expect.arrayContaining(
            directStoreTables.map((tableName) => ({
              table_name: tableName,
              is_nullable: "NO",
              column_default: `'${PRODUCT_DEDICATED_STORE_ID}'::text`,
            }))
          )
        )
        expect(pivotColumns[0].count).toBe("0")
        expect(rlsTables).toHaveLength(15)
        expect(rlsTables).toEqual(
          expect.arrayContaining(
            allProductTables.map((tableName) => ({
              relname: tableName,
              relrowsecurity: true,
              relforcerowsecurity: true,
            }))
          )
        )
        expect(policies[0].count).toBe("15")
      })

      it("fails closed for the shared request role without Store context", async () => {
        await withStore(storeA, async (manager) => {
          await manager.execute(
            `insert into "product_tag" ("id", "store_id", "value") values (?, ?, ?)`,
            ["ptag_rls_a", storeA, "rls-a"]
          )
        })

        const manager = MikroOrmWrapper.getManager() as SqlEntityManager
        const rows = await manager.transactional(async (transactionManager) => {
          await transactionManager.execute(
            `set local role "${PRODUCT_REQUEST_ROLE}"`
          )
          return await transactionManager.execute(
            `select "id" from "product_tag"`
          )
        })
        expect(rows).toEqual([])

        await expect(
          manager.transactional(async (transactionManager) => {
            await transactionManager.execute(
              `set local role "${PRODUCT_REQUEST_ROLE}"`
            )
            await transactionManager.execute(
              `insert into "product_tag" ("id", "store_id", "value") values (?, ?, ?)`,
              ["ptag_missing_context", storeA, "missing-context"]
            )
          })
        ).rejects.toThrow(/row-level security policy/i)
      })

      it("scopes catalog uniqueness to one Store", async () => {
        await withStore(storeA, async (manager) => {
          await manager.execute(
            `insert into "product_tag" ("id", "store_id", "value") values (?, ?, ?)`,
            ["ptag_unique_a", storeA, "shared-value"]
          )
        })
        await withStore(storeB, async (manager) => {
          await manager.execute(
            `insert into "product_tag" ("id", "store_id", "value") values (?, ?, ?)`,
            ["ptag_unique_b", storeB, "shared-value"]
          )
        })

        await expect(
          withStore(storeA, async (manager) => {
            await manager.execute(
              `insert into "product_tag" ("id", "store_id", "value") values (?, ?, ?)`,
              ["ptag_unique_a_duplicate", storeA, "shared-value"]
            )
          })
        ).rejects.toThrow(/IDX_tag_value_unique|duplicate key/i)
      })

      it("rejects owner reassignment and cross-Store direct relationships", async () => {
        const manager = MikroOrmWrapper.getManager() as SqlEntityManager
        await manager.execute(
          `insert into "product_category" ("id", "store_id", "name", "handle", "mpath") values (?, ?, ?, ?, ?)`,
          ["pcat_owner_a", storeA, "A", "owner-a", "pcat_owner_a."]
        )
        await manager.execute(
          `insert into "product_category" ("id", "store_id", "name", "handle", "mpath") values (?, ?, ?, ?, ?)`,
          ["pcat_owner_b", storeB, "B", "owner-b", "pcat_owner_b."]
        )
        await manager.execute(
          `insert into "product_category" ("id", "store_id", "name", "handle", "mpath", "parent_category_id") values (?, ?, ?, ?, ?, ?)`,
          [
            "pcat_child_a",
            storeA,
            "A child",
            "owner-a-child",
            "pcat_owner_a.pcat_child_a.",
            "pcat_owner_a",
          ]
        )

        await expect(
          manager.execute(
            `update "product_category" set "store_id" = ? where "id" = ?`,
            [storeB, "pcat_owner_a"]
          )
        ).rejects.toThrow(/immutable/i)
        await expect(
          manager.execute(
            `insert into "product_category" ("id", "store_id", "name", "handle", "mpath", "parent_category_id") values (?, ?, ?, ?, ?, ?)`,
            [
              "pcat_cross_store",
              storeA,
              "Cross Store",
              "cross-store",
              "pcat_owner_b.pcat_cross_store.",
              "pcat_owner_b",
            ]
          )
        ).rejects.toThrow(/parent owned by the same Store/i)
      })

      it("enforces same-Store ownership for implicit pivots", async () => {
        const manager = MikroOrmWrapper.getManager() as SqlEntityManager
        await manager.execute(
          `insert into "product" ("id", "store_id", "title", "handle") values (?, ?, ?, ?)`,
          ["prod_pivot_a", storeA, "Product A", "pivot-a"]
        )
        await manager.execute(
          `insert into "product_tag" ("id", "store_id", "value") values (?, ?, ?)`,
          ["ptag_pivot_a", storeA, "pivot-a"]
        )
        await manager.execute(
          `insert into "product_tag" ("id", "store_id", "value") values (?, ?, ?)`,
          ["ptag_pivot_b", storeB, "pivot-b"]
        )

        await expect(
          manager.execute(
            `insert into "product_tags" ("product_id", "product_tag_id") values (?, ?)`,
            ["prod_pivot_a", "ptag_pivot_a"]
          )
        ).resolves.toBeDefined()
        await expect(
          manager.execute(
            `insert into "product_tags" ("product_id", "product_tag_id") values (?, ?)`,
            ["prod_pivot_a", "ptag_pivot_b"]
          )
        ).rejects.toThrow(/parents must belong to the same Store/i)
      })

      it("executes rollback and dedicated legacy backfill before restoring enforcement", async () => {
        const manager = MikroOrmWrapper.getManager() as SqlEntityManager
        await manager.execute(
          `truncate table ${quotedTables(allProductTables)} cascade;`
        )

        const schemaMigration = new Migration20261103154512(
          undefined as never,
          undefined as never
        )
        const ownershipMigration =
          new Migration20261103154513_enforce_store_ownership(
            undefined as never,
            undefined as never
          )
        const rlsMigration =
          new Migration20261103154514_enforce_product_request_rls(
            undefined as never,
            undefined as never
          )
        const relationshipMigration =
          new Migration20261103154515_enforce_composite_store_relationships(
            undefined as never,
            undefined as never
          )

        await executeMigration(manager, relationshipMigration, "down")
        await executeMigration(manager, rlsMigration, "down")
        await executeMigration(manager, ownershipMigration, "down")
        await executeMigration(manager, schemaMigration, "down")

        const remainingStoreColumns = await manager.execute<
          { count: string }[]
        >(`
          select count(*)::text as "count"
          from "information_schema"."columns"
          where "table_schema" = 'public'
            and "column_name" = 'store_id'
            and "table_name" in (${sqlNames(directStoreTables)})
        `)
        const remainingPolicies = await manager.execute<{ count: string }[]>(`
          select count(*)::text as "count"
          from "pg_policies"
          where "tablename" in (${sqlNames(allProductTables)})
        `)
        expect(remainingStoreColumns[0].count).toBe("0")
        expect(remainingPolicies[0].count).toBe("0")

        await manager.execute(
          `insert into "product_tag" ("id", "value") values (?, ?)`,
          ["ptag_legacy", "legacy"]
        )

        await executeMigration(manager, schemaMigration, "up")
        const [backfilled] = await manager.execute<{ store_id: string }[]>(
          `select "store_id" from "product_tag" where "id" = 'ptag_legacy'`
        )
        expect(backfilled.store_id).toBe(PRODUCT_DEDICATED_STORE_ID)

        await executeMigration(manager, ownershipMigration, "up")
        await executeMigration(manager, rlsMigration, "up")
        await executeMigration(manager, relationshipMigration, "up")

        const restoredPolicies = await manager.execute<{ count: string }[]>(`
          select count(*)::text as "count"
          from "pg_policies"
          where "tablename" in (${sqlNames(allProductTables)})
            and "policyname" like 'POL_%_store_isolation'
        `)
        expect(restoredPolicies[0].count).toBe("15")
      })
    })
  },
})
