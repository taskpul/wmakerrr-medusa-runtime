import { Migration } from "@medusajs/framework/mikro-orm/migrations"

const parentTables = [
  "product_category",
  "product_collection",
  "product_option",
  "product_option_value",
  "product_type",
  "product",
  "product_product_option",
  "image",
  "product_variant",
] as const

const relationships = [
  ["product_category", "parent_category_id", "product_category"],
  ["product_option_value", "option_id", "product_option"],
  ["product", "type_id", "product_type"],
  ["product", "collection_id", "product_collection"],
  ["product_product_option", "product_id", "product"],
  ["product_product_option", "product_option_id", "product_option"],
  [
    "product_product_option_value",
    "product_product_option_id",
    "product_product_option",
  ],
  [
    "product_product_option_value",
    "product_option_value_id",
    "product_option_value",
  ],
  ["image", "product_id", "product"],
  ["product_variant", "product_id", "product"],
  ["product_variant_product_image", "variant_id", "product_variant"],
  ["product_variant_product_image", "image_id", "image"],
] as const

const constraintName = (childTable: string, parentColumn: string) =>
  `FK_${childTable}_${parentColumn}_store_id`

export class Migration20261103154515_enforce_composite_store_relationships extends Migration {
  override async up(): Promise<void> {
    for (const tableName of parentTables) {
      this.addSql(
        `create unique index if not exists "IDX_${tableName}_id_store_id_fk" on "${tableName}" ("id", "store_id");`
      )
    }

    for (const [childTable, parentColumn, parentTable] of relationships) {
      this.addSql(
        `alter table if exists "${childTable}" add constraint "${constraintName(
          childTable,
          parentColumn
        )}" foreign key ("${parentColumn}", "store_id") references "${parentTable}" ("id", "store_id");`
      )
    }
  }

  override async down(): Promise<void> {
    for (const [childTable, parentColumn] of [...relationships].reverse()) {
      this.addSql(
        `alter table if exists "${childTable}" drop constraint if exists "${constraintName(
          childTable,
          parentColumn
        )}";`
      )
    }

    for (const tableName of [...parentTables].reverse()) {
      this.addSql(`drop index if exists "IDX_${tableName}_id_store_id_fk";`)
    }
  }
}
