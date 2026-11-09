import { Migration } from "@medusajs/framework/mikro-orm/migrations"
import { sharedStoreRequestRoleMigrationSql } from "@medusajs/framework/utils"

const migration = sharedStoreRequestRoleMigrationSql({
  tables: ["sales_channel"],
  activeStoreFunction: "medusa_sales_channel_active_store_id",
  legacyRequestRole: "medusa_sales_channel_request",
})

export class Migration20261109020000_use_shared_store_request_role extends Migration {
  override async up(): Promise<void> {
    migration.up.forEach((sql) => this.addSql(sql))
  }

  override async down(): Promise<void> {
    migration.down.forEach((sql) => this.addSql(sql))
  }
}
