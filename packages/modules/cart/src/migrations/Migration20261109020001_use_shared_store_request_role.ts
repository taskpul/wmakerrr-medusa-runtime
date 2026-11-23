import { Migration } from "@medusajs/framework/mikro-orm/migrations"
import { sharedStoreRequestRoleMigrationSql } from "@medusajs/framework/utils"

const migration = sharedStoreRequestRoleMigrationSql({
  tables: [
    "cart_address",
    "cart",
    "credit_line",
    "cart_line_item",
    "cart_line_item_adjustment",
    "cart_line_item_tax_line",
    "cart_shipping_method",
    "cart_shipping_method_adjustment",
    "cart_shipping_method_tax_line",
  ],
  activeStoreFunction: "medusa_cart_active_store_id",
  legacyRequestRole: "medusa_cart_request",
})

export class Migration20261109020001_use_shared_store_request_role extends Migration {
  override async up(): Promise<void> {
    migration.up.forEach((sql) => this.addSql(sql))
  }

  override async down(): Promise<void> {
    migration.down.forEach((sql) => this.addSql(sql))
  }
}
