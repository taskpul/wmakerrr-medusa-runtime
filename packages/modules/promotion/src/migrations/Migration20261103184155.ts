import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261103184155 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "promotion_campaign_budget_usage" drop constraint if exists "promotion_campaign_budget_usage_store_id_attribute_value_budget_id_unique";`
    )
    this.addSql(
      `alter table if exists "promotion_campaign" drop constraint if exists "promotion_campaign_store_id_campaign_identifier_unique";`
    )
    this.addSql(
      `drop index if exists "IDX_promotion_campaign_campaign_identifier_unique";`
    )

    this.addSql(
      `alter table if exists "promotion_campaign" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_promotion_campaign_store_id_campaign_identifier_unique" ON "promotion_campaign" ("store_id", "campaign_identifier") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_promotion_campaign_store_id_id" ON "promotion_campaign" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "promotion_campaign_budget" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `alter table if exists "promotion_campaign_budget" alter column "raw_used" type jsonb using ("raw_used"::jsonb);`
    )
    this.addSql(
      `alter table if exists "promotion_campaign_budget" alter column "raw_used" set default '{"value":"0","precision":20}';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_promotion_campaign_budget_store_id_id" ON "promotion_campaign_budget" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `drop index if exists "IDX_promotion_campaign_budget_usage_attribute_value_budget_id_unique";`
    )

    this.addSql(
      `alter table if exists "promotion_campaign_budget_usage" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `alter table if exists "promotion_campaign_budget_usage" alter column "raw_used" type jsonb using ("raw_used"::jsonb);`
    )
    this.addSql(
      `alter table if exists "promotion_campaign_budget_usage" alter column "raw_used" set default '{"value":"0","precision":20}';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_promotion_campaign_budget_usage_store_id_attribute_value_budget_id_unique" ON "promotion_campaign_budget_usage" ("store_id", "attribute_value", "budget_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_promotion_campaign_budget_usage_store_id_id" ON "promotion_campaign_budget_usage" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "promotion" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_promotion_store_id_id" ON "promotion" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "promotion_application_method" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_promotion_application_method_store_id_id" ON "promotion_application_method" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "promotion_rule" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_promotion_rule_store_id_id" ON "promotion_rule" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "promotion_rule_value" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_promotion_rule_value_store_id_id" ON "promotion_rule_value" ("store_id", "id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `drop index if exists "IDX_promotion_campaign_store_id_campaign_identifier_unique";`
    )
    this.addSql(`drop index if exists "IDX_promotion_campaign_store_id_id";`)
    this.addSql(
      `alter table if exists "promotion_campaign" drop column if exists "store_id";`
    )

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_promotion_campaign_campaign_identifier_unique" ON "promotion_campaign" (campaign_identifier) WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `drop index if exists "IDX_promotion_campaign_budget_store_id_id";`
    )
    this.addSql(
      `alter table if exists "promotion_campaign_budget" drop column if exists "store_id";`
    )

    this.addSql(
      `alter table if exists "promotion_campaign_budget" alter column "raw_used" drop default;`
    )
    this.addSql(
      `alter table if exists "promotion_campaign_budget" alter column "raw_used" type jsonb using ("raw_used"::jsonb);`
    )

    this.addSql(
      `drop index if exists "IDX_promotion_campaign_budget_usage_store_id_attribute_value_budget_id_unique";`
    )
    this.addSql(
      `drop index if exists "IDX_promotion_campaign_budget_usage_store_id_id";`
    )
    this.addSql(
      `alter table if exists "promotion_campaign_budget_usage" drop column if exists "store_id";`
    )

    this.addSql(
      `alter table if exists "promotion_campaign_budget_usage" alter column "raw_used" drop default;`
    )
    this.addSql(
      `alter table if exists "promotion_campaign_budget_usage" alter column "raw_used" type jsonb using ("raw_used"::jsonb);`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_promotion_campaign_budget_usage_attribute_value_budget_id_unique" ON "promotion_campaign_budget_usage" (attribute_value, budget_id) WHERE deleted_at IS NULL;`
    )

    this.addSql(`drop index if exists "IDX_promotion_store_id_id";`)
    this.addSql(
      `alter table if exists "promotion" drop column if exists "store_id";`
    )

    this.addSql(
      `drop index if exists "IDX_promotion_application_method_store_id_id";`
    )
    this.addSql(
      `alter table if exists "promotion_application_method" drop column if exists "store_id";`
    )

    this.addSql(`drop index if exists "IDX_promotion_rule_store_id_id";`)
    this.addSql(
      `alter table if exists "promotion_rule" drop column if exists "store_id";`
    )

    this.addSql(`drop index if exists "IDX_promotion_rule_value_store_id_id";`)
    this.addSql(
      `alter table if exists "promotion_rule_value" drop column if exists "store_id";`
    )
  }
}
