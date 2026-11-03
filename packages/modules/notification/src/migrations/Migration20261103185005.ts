import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261103185005 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `drop index if exists "IDX_notification_idempotency_key_unique";`
    )

    this.addSql(
      `alter table if exists "notification" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_notification_store_id_idempotency_key" ON "notification" ("store_id", "idempotency_key") WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `drop index if exists "IDX_notification_store_id_idempotency_key";`
    )
    this.addSql(
      `alter table if exists "notification" drop column if exists "store_id";`
    )

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_notification_idempotency_key_unique" ON "notification" ("idempotency_key") WHERE deleted_at IS NULL;`
    )
  }
}
