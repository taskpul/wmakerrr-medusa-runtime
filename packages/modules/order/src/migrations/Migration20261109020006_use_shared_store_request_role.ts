import { Migration } from "@medusajs/framework/mikro-orm/migrations"
import { sharedStoreRequestRoleMigrationSql } from "@medusajs/framework/utils"

const migration = sharedStoreRequestRoleMigrationSql({
  tables: [
    "order_address",
    "order",
    "return",
    "order_exchange",
    "order_claim",
    "return_reason",
    "order_change",
    "order_change_action",
    "order_credit_line",
    "order_item",
    "order_summary",
    "order_transaction",
    "order_shipping",
    "order_line_item",
    "order_line_item_adjustment",
    "order_line_item_tax_line",
    "order_shipping_method",
    "order_shipping_method_adjustment",
    "order_shipping_method_tax_line",
    "order_exchange_item",
    "order_claim_item",
    "order_claim_item_image",
    "return_item",
  ],
  activeStoreFunction: "medusa_order_active_store_id",
  legacyRequestRole: "medusa_order_request",
})

export class Migration20261109020006_use_shared_store_request_role extends Migration {
  override async up(): Promise<void> {
    migration.up.forEach((sql) => this.addSql(sql))
  }

  override async down(): Promise<void> {
    migration.down.forEach((sql) => this.addSql(sql))
  }
}
