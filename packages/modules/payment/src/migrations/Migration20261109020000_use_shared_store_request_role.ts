import { Migration } from "@medusajs/framework/mikro-orm/migrations"
import { sharedStoreRequestRoleMigrationSql } from "@medusajs/framework/utils"

const migration = sharedStoreRequestRoleMigrationSql({
  tables: [
    "account_holder",
    "payment_collection",
    "payment_session",
    "payment",
    "capture",
    "refund",
    "payment_collection_payment_providers",
  ],
  activeStoreFunction: "medusa_payment_active_store_id",
  legacyRequestRole: "medusa_payment_request",
})

export class Migration20261109020000_use_shared_store_request_role extends Migration {
  override async up(): Promise<void> {
    migration.up.forEach((sql) => this.addSql(sql))
  }

  override async down(): Promise<void> {
    migration.down.forEach((sql) => this.addSql(sql))
  }
}
