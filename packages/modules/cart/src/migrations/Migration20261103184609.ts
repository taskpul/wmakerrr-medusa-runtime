import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261103184609 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "cart_address" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )

    this.addSql(
      `alter table if exists "cart" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )

    this.addSql(
      `alter table if exists "credit_line" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )

    this.addSql(
      `alter table if exists "cart_line_item" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )

    this.addSql(
      `alter table if exists "cart_line_item_adjustment" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )

    this.addSql(
      `alter table if exists "cart_line_item_tax_line" add column if not exists "store_id" text not null default '__medusa_dedicated__', add column if not exists "data" jsonb null;`
    )

    this.addSql(
      `alter table if exists "cart_shipping_method" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )

    this.addSql(
      `alter table if exists "cart_shipping_method_adjustment" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )

    this.addSql(
      `alter table if exists "cart_shipping_method_tax_line" add column if not exists "store_id" text not null default '__medusa_dedicated__', add column if not exists "data" jsonb null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "cart_address" drop column if exists "store_id";`
    )

    this.addSql(
      `alter table if exists "cart" drop column if exists "store_id";`
    )

    this.addSql(
      `alter table if exists "credit_line" drop column if exists "store_id";`
    )

    this.addSql(
      `alter table if exists "cart_line_item" drop column if exists "store_id";`
    )

    this.addSql(
      `alter table if exists "cart_line_item_adjustment" drop column if exists "store_id";`
    )

    this.addSql(
      `alter table if exists "cart_line_item_tax_line" drop column if exists "store_id", drop column if exists "data";`
    )

    this.addSql(
      `alter table if exists "cart_shipping_method" drop column if exists "store_id";`
    )

    this.addSql(
      `alter table if exists "cart_shipping_method_adjustment" drop column if exists "store_id";`
    )

    this.addSql(
      `alter table if exists "cart_shipping_method_tax_line" drop column if exists "store_id", drop column if exists "data";`
    )
  }
}
