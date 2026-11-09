import { Migration } from "@medusajs/framework/mikro-orm/migrations"
import { sharedStoreRequestRoleMigrationSql } from "@medusajs/framework/utils"

const migration = sharedStoreRequestRoleMigrationSql({
  tables: [
    "price_set",
    "price",
    "price_rule",
    "price_list",
    "price_list_rule",
    "price_preference",
  ],
})

export class Migration20261109020008_use_shared_store_request_role extends Migration {
  override async up(): Promise<void> {
    migration.up.forEach((sql) => this.addSql(sql))
  }

  override async down(): Promise<void> {
    migration.down.forEach((sql) => this.addSql(sql))
  }
}
