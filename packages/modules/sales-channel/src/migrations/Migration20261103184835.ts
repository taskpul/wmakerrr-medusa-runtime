import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261103184835 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "sales_channel" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "sales_channel" drop column if exists "store_id";`
    )
  }
}
