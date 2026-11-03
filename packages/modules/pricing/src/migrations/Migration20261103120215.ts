import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261103120215 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "price_list" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_price_list_store_id_id" ON "price_list" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "price_list_rule" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_price_list_rule_store_id_id" ON "price_list_rule" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(`drop index if exists "IDX_price_preference_attribute_value";`)

    this.addSql(
      `alter table if exists "price_preference" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_price_preference_store_attribute_value" ON "price_preference" ("store_id", "attribute", "value") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "price_set" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_price_set_store_id_id" ON "price_set" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "price" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_price_store_id_id" ON "price" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "price_rule" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_price_rule_store_id_id" ON "price_rule" ("store_id", "id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_price_list_store_id_id";`)
    this.addSql(
      `alter table if exists "price_list" drop column if exists "store_id";`
    )

    this.addSql(`drop index if exists "IDX_price_list_rule_store_id_id";`)
    this.addSql(
      `alter table if exists "price_list_rule" drop column if exists "store_id";`
    )

    this.addSql(
      `drop index if exists "IDX_price_preference_store_attribute_value";`
    )
    this.addSql(
      `alter table if exists "price_preference" drop column if exists "store_id";`
    )

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_price_preference_attribute_value" ON "price_preference" ("attribute", "value") WHERE deleted_at IS NULL;`
    )

    this.addSql(`drop index if exists "IDX_price_set_store_id_id";`)
    this.addSql(
      `alter table if exists "price_set" drop column if exists "store_id";`
    )

    this.addSql(`drop index if exists "IDX_price_store_id_id";`)
    this.addSql(
      `alter table if exists "price" drop column if exists "store_id";`
    )

    this.addSql(`drop index if exists "IDX_price_rule_store_id_id";`)
    this.addSql(
      `alter table if exists "price_rule" drop column if exists "store_id";`
    )
  }
}
