import {
  SHARED_STORE_REQUEST_ROLE,
  sharedStoreRequestRoleMigrationSql,
} from "../store-isolation-manager"

describe("sharedStoreRequestRoleMigrationSql", () => {
  it("provisions one restricted role and restores the legacy policy on rollback", () => {
    const migration = sharedStoreRequestRoleMigrationSql({
      tables: ["store", "sales_channel"],
      activeStoreFunction: "medusa_sales_channel_active_store_id",
      legacyRequestRole: "medusa_sales_channel_request",
    })

    expect(migration.up.join("\n")).toContain(
      `create role "${SHARED_STORE_REQUEST_ROLE}" nologin nosuperuser nobypassrls`
    )
    expect(migration.up.join("\n")).toContain(
      `on table "store", "sales_channel" to "${SHARED_STORE_REQUEST_ROLE}"`
    )
    expect(migration.up.join("\n")).toContain(
      `current_user <> '${SHARED_STORE_REQUEST_ROLE}'`
    )
    expect(migration.down.join("\n")).toContain(
      "current_user <> 'medusa_sales_channel_request'"
    )
  })

  it("rejects identifiers that could alter migration SQL", () => {
    expect(() =>
      sharedStoreRequestRoleMigrationSql({
        tables: ['store"; drop table store; --'],
      })
    ).toThrow("Unsafe SQL identifier")
  })
})
