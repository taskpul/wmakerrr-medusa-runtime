import { Migration } from "@medusajs/framework/mikro-orm/migrations"
import { sharedStoreRequestRoleMigrationSql } from "@medusajs/framework/utils"

const migration = sharedStoreRequestRoleMigrationSql({
  tables: [
    "promotion_campaign",
    "promotion_campaign_budget",
    "promotion_campaign_budget_usage",
    "promotion",
    "promotion_application_method",
    "promotion_rule",
    "promotion_rule_value",
    "promotion_promotion_rule",
    "application_method_target_rules",
    "application_method_buy_rules",
  ],
  activeStoreFunction: "medusa_promotion_active_store_id",
  legacyRequestRole: "medusa_promotion_request",
})

export class Migration20261109020010_use_shared_store_request_role extends Migration {
  override async up(): Promise<void> {
    migration.up.forEach((sql) => this.addSql(sql))
  }

  override async down(): Promise<void> {
    migration.down.forEach((sql) => this.addSql(sql))
  }
}
