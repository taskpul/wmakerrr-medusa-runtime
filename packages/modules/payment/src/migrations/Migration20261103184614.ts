import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261103184614 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "account_holder" drop constraint if exists "account_holder_store_id_provider_id_external_id_unique";`
    )
    this.addSql(
      `drop index if exists "IDX_account_holder_provider_id_external_id_unique";`
    )

    this.addSql(
      `alter table if exists "account_holder" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_account_holder_store_id_provider_id_external_id_unique" ON "account_holder" ("store_id", "provider_id", "external_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "payment_collection" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )

    this.addSql(
      `alter table if exists "payment_session" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )

    this.addSql(
      `alter table if exists "payment" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )

    this.addSql(
      `alter table if exists "capture" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )

    this.addSql(
      `alter table if exists "refund" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `drop index if exists "IDX_account_holder_store_id_provider_id_external_id_unique";`
    )
    this.addSql(
      `alter table if exists "account_holder" drop column if exists "store_id";`
    )

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_account_holder_provider_id_external_id_unique" ON "account_holder" ("provider_id", "external_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "payment_collection" drop column if exists "store_id";`
    )

    this.addSql(
      `alter table if exists "payment_session" drop column if exists "store_id";`
    )

    this.addSql(
      `alter table if exists "payment" drop column if exists "store_id";`
    )

    this.addSql(
      `alter table if exists "capture" drop column if exists "store_id";`
    )

    this.addSql(
      `alter table if exists "refund" drop column if exists "store_id";`
    )
  }
}
