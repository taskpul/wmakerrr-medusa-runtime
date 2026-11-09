import { Migration } from "@medusajs/framework/mikro-orm/migrations"
import { sharedStoreRequestRoleMigrationSql } from "@medusajs/framework/utils"

const migration = sharedStoreRequestRoleMigrationSql({
  tables: [
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
  ],
  activeStoreFunction: "medusa_fulfillment_active_store_id",
  legacyRequestRole: "medusa_fulfillment_request",
})

export class Migration20261109020000_use_shared_store_request_role extends Migration {
  override async up(): Promise<void> {
    migration.up.forEach((sql) => this.addSql(sql))
  }

  override async down(): Promise<void> {
    migration.down.forEach((sql) => this.addSql(sql))
  }
}
