import { Migration } from "@medusajs/framework/mikro-orm/migrations"
import { sharedStoreRequestRoleMigrationSql } from "@medusajs/framework/utils"

const migration = sharedStoreRequestRoleMigrationSql({
  tables: [
    "customer",
    "customer_address",
    "customer_group",
    "customer_group_customer",
  ],
  activeStoreFunction: "medusa_customer_active_store_id",
  legacyRequestRole: "medusa_customer_request",
})

export class Migration20261109020002_use_shared_store_request_role extends Migration {
  override async up(): Promise<void> {
    migration.up.forEach((sql) => this.addSql(sql))
  }

  override async down(): Promise<void> {
    migration.down.forEach((sql) => this.addSql(sql))
  }
}
