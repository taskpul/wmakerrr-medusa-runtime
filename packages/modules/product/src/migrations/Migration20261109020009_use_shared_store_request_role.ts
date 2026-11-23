import { Migration } from "@medusajs/framework/mikro-orm/migrations"
import { sharedStoreRequestRoleMigrationSql } from "@medusajs/framework/utils"

const migration = sharedStoreRequestRoleMigrationSql({
  tables: [
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
    "product_tags",
    "product_category_product",
    "product_variant_option",
  ],
  activeStoreFunction: "medusa_product_active_store_id",
  legacyRequestRole: "medusa_product_request",
})

export class Migration20261109020009_use_shared_store_request_role extends Migration {
  override async up(): Promise<void> {
    migration.up.forEach((sql) => this.addSql(sql))
  }

  override async down(): Promise<void> {
    migration.down.forEach((sql) => this.addSql(sql))
  }
}
