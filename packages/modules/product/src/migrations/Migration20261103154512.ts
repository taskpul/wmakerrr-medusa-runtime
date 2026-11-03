import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261103154512 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`drop index if exists "IDX_product_category_path";`)
    this.addSql(`drop index if exists "IDX_category_handle_unique";`)
    this.addSql(`drop index if exists "IDX_collection_handle_unique";`)
    this.addSql(`drop index if exists "IDX_option_value_option_id_unique";`)
    this.addSql(`drop index if exists "IDX_tag_value_unique";`)
    this.addSql(`drop index if exists "IDX_type_value_unique";`)
    this.addSql(`drop index if exists "IDX_product_handle_unique";`)
    this.addSql(`drop index if exists "IDX_product_type_id";`)
    this.addSql(`drop index if exists "IDX_product_collection_id";`)
    this.addSql(`drop index if exists "IDX_product_status";`)
    this.addSql(`drop index if exists "IDX_product_variant_id_product_id";`)
    this.addSql(`drop index if exists "IDX_product_variant_product_id";`)
    this.addSql(`drop index if exists "IDX_product_variant_sku_unique";`)
    this.addSql(`drop index if exists "IDX_product_variant_barcode_unique";`)
    this.addSql(`drop index if exists "IDX_product_variant_ean_unique";`)
    this.addSql(`drop index if exists "IDX_product_variant_upc_unique";`)

    this.addSql(
      `alter table if exists "product_option" drop constraint if exists "product_option_global_title_unique";`
    )

    this.addSql(
      `alter table if exists "product_category" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_category_store_id_id" ON "product_category" ("store_id", "id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_category_path" ON "product_category" ("store_id", "mpath") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_category_handle_unique" ON "product_category" ("store_id", "handle") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "product_collection" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_collection_store_id_id" ON "product_collection" ("store_id", "id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_collection_handle_unique" ON "product_collection" ("store_id", "handle") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "product_option" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_option_store_id_id" ON "product_option" ("store_id", "id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_option_global_title_unique" ON "product_option" ("store_id", "title") WHERE deleted_at IS NULL AND is_exclusive = false;`
    )

    this.addSql(
      `alter table if exists "product_option_value" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_option_value_store_id_id" ON "product_option_value" ("store_id", "id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_option_value_option_id_unique" ON "product_option_value" ("store_id", "option_id", "value") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "product_tag" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_tag_store_id_id" ON "product_tag" ("store_id", "id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tag_value_unique" ON "product_tag" ("store_id", "value") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "product_type" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_type_store_id_id" ON "product_type" ("store_id", "id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_type_value_unique" ON "product_type" ("store_id", "value") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "product" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_store_id_id" ON "product" ("store_id", "id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_handle_unique" ON "product" ("store_id", "handle") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_type_id" ON "product" ("store_id", "type_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_collection_id" ON "product" ("store_id", "collection_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_status" ON "product" ("store_id", "status") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "product_product_option" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_product_option_store_id_id" ON "product_product_option" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "product_product_option_value" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_product_option_value_store_id_id" ON "product_product_option_value" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "image" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_image_store_id_id" ON "image" ("store_id", "id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "product_variant" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_variant_store_id_id" ON "product_variant" ("store_id", "id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_variant_id_product_id" ON "product_variant" ("store_id", "id", "product_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_variant_product_id" ON "product_variant" ("store_id", "product_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_variant_sku_unique" ON "product_variant" ("store_id", "sku") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_variant_barcode_unique" ON "product_variant" ("store_id", "barcode") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_variant_ean_unique" ON "product_variant" ("store_id", "ean") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_variant_upc_unique" ON "product_variant" ("store_id", "upc") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "product_variant_product_image" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_variant_product_image_store_id_id" ON "product_variant_product_image" ("store_id", "id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_product_category_store_id_id";`)
    this.addSql(`drop index if exists "IDX_product_category_path";`)
    this.addSql(`drop index if exists "IDX_category_handle_unique";`)
    this.addSql(
      `alter table if exists "product_category" drop column if exists "store_id";`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_category_path" ON "product_category" ("mpath") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_category_handle_unique" ON "product_category" ("handle") WHERE deleted_at IS NULL;`
    )

    this.addSql(`drop index if exists "IDX_product_collection_store_id_id";`)
    this.addSql(`drop index if exists "IDX_collection_handle_unique";`)
    this.addSql(
      `alter table if exists "product_collection" drop column if exists "store_id";`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_collection_handle_unique" ON "product_collection" ("handle") WHERE deleted_at IS NULL;`
    )

    this.addSql(`drop index if exists "IDX_product_option_store_id_id";`)
    this.addSql(
      `drop index if exists "IDX_product_option_global_title_unique";`
    )
    this.addSql(
      `alter table if exists "product_option" drop column if exists "store_id";`
    )

    this.addSql(`drop index if exists "IDX_product_option_value_store_id_id";`)
    this.addSql(`drop index if exists "IDX_option_value_option_id_unique";`)
    this.addSql(
      `alter table if exists "product_option_value" drop column if exists "store_id";`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_option_value_option_id_unique" ON "product_option_value" ("option_id", "value") WHERE deleted_at IS NULL;`
    )

    this.addSql(`drop index if exists "IDX_product_tag_store_id_id";`)
    this.addSql(`drop index if exists "IDX_tag_value_unique";`)
    this.addSql(
      `alter table if exists "product_tag" drop column if exists "store_id";`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tag_value_unique" ON "product_tag" ("value") WHERE deleted_at IS NULL;`
    )

    this.addSql(`drop index if exists "IDX_product_type_store_id_id";`)
    this.addSql(`drop index if exists "IDX_type_value_unique";`)
    this.addSql(
      `alter table if exists "product_type" drop column if exists "store_id";`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_type_value_unique" ON "product_type" ("value") WHERE deleted_at IS NULL;`
    )

    this.addSql(`drop index if exists "IDX_product_store_id_id";`)
    this.addSql(`drop index if exists "IDX_product_handle_unique";`)
    this.addSql(`drop index if exists "IDX_product_type_id";`)
    this.addSql(`drop index if exists "IDX_product_collection_id";`)
    this.addSql(`drop index if exists "IDX_product_status";`)
    this.addSql(
      `alter table if exists "product" drop column if exists "store_id";`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_handle_unique" ON "product" ("handle") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_type_id" ON "product" ("type_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_collection_id" ON "product" ("collection_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_status" ON "product" ("status") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `drop index if exists "IDX_product_product_option_store_id_id";`
    )
    this.addSql(
      `alter table if exists "product_product_option" drop column if exists "store_id";`
    )

    this.addSql(
      `drop index if exists "IDX_product_product_option_value_store_id_id";`
    )
    this.addSql(
      `alter table if exists "product_product_option_value" drop column if exists "store_id";`
    )

    this.addSql(`drop index if exists "IDX_image_store_id_id";`)
    this.addSql(
      `alter table if exists "image" drop column if exists "store_id";`
    )

    this.addSql(`drop index if exists "IDX_product_variant_store_id_id";`)
    this.addSql(`drop index if exists "IDX_product_variant_id_product_id";`)
    this.addSql(`drop index if exists "IDX_product_variant_product_id";`)
    this.addSql(`drop index if exists "IDX_product_variant_sku_unique";`)
    this.addSql(`drop index if exists "IDX_product_variant_barcode_unique";`)
    this.addSql(`drop index if exists "IDX_product_variant_ean_unique";`)
    this.addSql(`drop index if exists "IDX_product_variant_upc_unique";`)
    this.addSql(
      `alter table if exists "product_variant" drop column if exists "store_id";`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_variant_id_product_id" ON "product_variant" ("id", "product_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_variant_product_id" ON "product_variant" ("product_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_variant_sku_unique" ON "product_variant" ("sku") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_variant_barcode_unique" ON "product_variant" ("barcode") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_variant_ean_unique" ON "product_variant" ("ean") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_variant_upc_unique" ON "product_variant" ("upc") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `drop index if exists "IDX_product_variant_product_image_store_id_id";`
    )
    this.addSql(
      `alter table if exists "product_variant_product_image" drop column if exists "store_id";`
    )
  }
}
