import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261103170219 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "fulfillment_address" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_fulfillment_address_store_id_id" ON "fulfillment_address" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "fulfillment_set" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_fulfillment_set_store_id_id" ON "fulfillment_set" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "service_zone" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_service_zone_store_id_id" ON "service_zone" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(`drop index if exists "IDX_geo_zone_country_code";`)
    this.addSql(`drop index if exists "IDX_geo_zone_province_code";`)
    this.addSql(`drop index if exists "IDX_geo_zone_city";`)

    this.addSql(
      `alter table if exists "geo_zone" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_geo_zone_store_id_id" ON "geo_zone" ("store_id", "id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_geo_zone_store_id_country_code" ON "geo_zone" ("store_id", "country_code") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_geo_zone_store_id_province_code" ON "geo_zone" ("store_id", "province_code") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_geo_zone_store_id_city" ON "geo_zone" ("store_id", "city") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "shipping_option_type" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_shipping_option_type_store_id_id" ON "shipping_option_type" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "shipping_profile" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_shipping_profile_store_id_id" ON "shipping_profile" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "shipping_option" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_shipping_option_store_id_id" ON "shipping_option" ("store_id", "id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_shipping_option_store_service_zone" ON "shipping_option" ("store_id", "service_zone_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_shipping_option_store_shipping_profile" ON "shipping_option" ("store_id", "shipping_profile_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "shipping_option_rule" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_shipping_option_rule_store_id_id" ON "shipping_option_rule" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(`drop index if exists "IDX_fulfillment_location_id";`)

    this.addSql(
      `alter table if exists "fulfillment" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_fulfillment_store_id_id" ON "fulfillment" ("store_id", "id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fulfillment_store_id_location_id" ON "fulfillment" ("store_id", "location_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "fulfillment_label" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_fulfillment_label_store_id_id" ON "fulfillment_label" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `drop index if exists "IDX_fulfillment_item_inventory_item_id";`
    )
    this.addSql(`drop index if exists "IDX_fulfillment_item_line_item_id";`)

    this.addSql(
      `alter table if exists "fulfillment_item" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_fulfillment_item_store_id_id" ON "fulfillment_item" ("store_id", "id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fulfillment_item_store_id_inventory_item_id" ON "fulfillment_item" ("store_id", "inventory_item_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fulfillment_item_store_id_line_item_id" ON "fulfillment_item" ("store_id", "line_item_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_fulfillment_address_store_id_id";`)
    this.addSql(
      `alter table if exists "fulfillment_address" drop column if exists "store_id";`
    )

    this.addSql(`drop index if exists "IDX_fulfillment_set_store_id_id";`)
    this.addSql(
      `alter table if exists "fulfillment_set" drop column if exists "store_id";`
    )

    this.addSql(`drop index if exists "IDX_service_zone_store_id_id";`)
    this.addSql(
      `alter table if exists "service_zone" drop column if exists "store_id";`
    )

    this.addSql(`drop index if exists "IDX_geo_zone_store_id_id";`)
    this.addSql(`drop index if exists "IDX_geo_zone_store_id_country_code";`)
    this.addSql(`drop index if exists "IDX_geo_zone_store_id_province_code";`)
    this.addSql(`drop index if exists "IDX_geo_zone_store_id_city";`)
    this.addSql(
      `alter table if exists "geo_zone" drop column if exists "store_id";`
    )

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_geo_zone_country_code" ON "geo_zone" ("country_code") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_geo_zone_province_code" ON "geo_zone" ("province_code") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_geo_zone_city" ON "geo_zone" ("city") WHERE deleted_at IS NULL;`
    )

    this.addSql(`drop index if exists "IDX_shipping_option_type_store_id_id";`)
    this.addSql(
      `alter table if exists "shipping_option_type" drop column if exists "store_id";`
    )

    this.addSql(`drop index if exists "IDX_shipping_profile_store_id_id";`)
    this.addSql(
      `alter table if exists "shipping_profile" drop column if exists "store_id";`
    )

    this.addSql(`drop index if exists "IDX_shipping_option_store_id_id";`)
    this.addSql(
      `drop index if exists "IDX_shipping_option_store_service_zone";`
    )
    this.addSql(
      `drop index if exists "IDX_shipping_option_store_shipping_profile";`
    )
    this.addSql(
      `alter table if exists "shipping_option" drop column if exists "store_id";`
    )

    this.addSql(`drop index if exists "IDX_shipping_option_rule_store_id_id";`)
    this.addSql(
      `alter table if exists "shipping_option_rule" drop column if exists "store_id";`
    )

    this.addSql(`drop index if exists "IDX_fulfillment_store_id_id";`)
    this.addSql(`drop index if exists "IDX_fulfillment_store_id_location_id";`)
    this.addSql(
      `alter table if exists "fulfillment" drop column if exists "store_id";`
    )

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fulfillment_location_id" ON "fulfillment" ("location_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(`drop index if exists "IDX_fulfillment_label_store_id_id";`)
    this.addSql(
      `alter table if exists "fulfillment_label" drop column if exists "store_id";`
    )

    this.addSql(`drop index if exists "IDX_fulfillment_item_store_id_id";`)
    this.addSql(
      `drop index if exists "IDX_fulfillment_item_store_id_inventory_item_id";`
    )
    this.addSql(
      `drop index if exists "IDX_fulfillment_item_store_id_line_item_id";`
    )
    this.addSql(
      `alter table if exists "fulfillment_item" drop column if exists "store_id";`
    )

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fulfillment_item_inventory_item_id" ON "fulfillment_item" ("inventory_item_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fulfillment_item_line_item_id" ON "fulfillment_item" ("line_item_id") WHERE deleted_at IS NULL;`
    )
  }
}
