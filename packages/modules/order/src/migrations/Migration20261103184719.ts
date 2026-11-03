import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261103184719 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "order_address" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )

    this.addSql(
      `alter table if exists "order" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )

    this.addSql(
      `alter table if exists "order_line_item_tax_line" add column if not exists "metadata" jsonb null, add column if not exists "data" jsonb null;`
    )

    this.addSql(
      `alter table if exists "order_shipping_method_tax_line" add column if not exists "metadata" jsonb null, add column if not exists "data" jsonb null;`
    )

    this.addSql(
      `alter table if exists "return" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )

    this.addSql(
      `alter table if exists "order_exchange" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )

    this.addSql(
      `alter table if exists "order_claim" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )

    this.addSql(
      `alter table if exists "return_reason" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "order_address" drop column if exists "store_id";`
    )

    this.addSql(
      `alter table if exists "order" drop column if exists "store_id";`
    )

    this.addSql(
      `alter table if exists "order_line_item_tax_line" drop column if exists "metadata", drop column if exists "data";`
    )

    this.addSql(
      `alter table if exists "order_shipping_method_tax_line" drop column if exists "metadata", drop column if exists "data";`
    )

    this.addSql(
      `alter table if exists "return" drop column if exists "store_id";`
    )

    this.addSql(
      `alter table if exists "order_exchange" drop column if exists "store_id";`
    )

    this.addSql(
      `alter table if exists "order_claim" drop column if exists "store_id";`
    )

    this.addSql(
      `alter table if exists "return_reason" drop column if exists "store_id";`
    )
  }
}
