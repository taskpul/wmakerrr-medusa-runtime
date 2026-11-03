import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261103184430 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "customer_group" drop constraint if exists "customer_group_store_id_name_unique";`
    )
    this.addSql(
      `alter table if exists "customer" drop constraint if exists "customer_store_id_email_has_account_unique";`
    )
    this.addSql(`drop index if exists "IDX_customer_email_has_account_unique";`)

    this.addSql(
      `alter table if exists "customer" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_store_id_email_has_account_unique" ON "customer" ("store_id", "email", "has_account") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_store_id_id" ON "customer" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "customer_address" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_address_store_id_id" ON "customer_address" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(`drop index if exists "IDX_customer_group_name_unique";`)

    this.addSql(
      `alter table if exists "customer_group" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_group_store_id_name_unique" ON "customer_group" ("store_id", "name") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_group_store_id_id" ON "customer_group" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "customer_group_customer" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_group_customer_store_id_id" ON "customer_group_customer" ("store_id", "id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `drop index if exists "IDX_customer_store_id_email_has_account_unique";`
    )
    this.addSql(`drop index if exists "IDX_customer_store_id_id";`)
    this.addSql(
      `alter table if exists "customer" drop column if exists "store_id";`
    )

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_email_has_account_unique" ON "customer" (email, has_account) WHERE deleted_at IS NULL;`
    )

    this.addSql(`drop index if exists "IDX_customer_address_store_id_id";`)
    this.addSql(
      `alter table if exists "customer_address" drop column if exists "store_id";`
    )

    this.addSql(
      `drop index if exists "IDX_customer_group_store_id_name_unique";`
    )
    this.addSql(`drop index if exists "IDX_customer_group_store_id_id";`)
    this.addSql(
      `alter table if exists "customer_group" drop column if exists "store_id";`
    )

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_group_name_unique" ON "customer_group" (name) WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `drop index if exists "IDX_customer_group_customer_store_id_id";`
    )
    this.addSql(
      `alter table if exists "customer_group_customer" drop column if exists "store_id";`
    )
  }
}
