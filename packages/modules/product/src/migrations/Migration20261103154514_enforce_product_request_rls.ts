import { Migration } from "@medusajs/framework/mikro-orm/migrations"

const directStoreTables = [
  "product_category",
  "product_collection",
  "product_option",
  "product_option_value",
  "product_tag",
  "product_type",
  "product",
  "product_product_option",
  "product_product_option_value",
  "image",
  "product_variant",
  "product_variant_product_image",
] as const

const pivotPolicies = [
  ["product_tags", "product", "product_id", "product_tag", "product_tag_id"],
  [
    "product_category_product",
    "product",
    "product_id",
    "product_category",
    "product_category_id",
  ],
  [
    "product_variant_option",
    "product_variant",
    "variant_id",
    "product_option_value",
    "option_value_id",
  ],
] as const

export class Migration20261103154514_enforce_product_request_rls extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create function "medusa_product_active_store_id"()
      returns text
      language sql
      stable
      as $$
        select coalesce(
          nullif(current_setting('medusa.store_id', true), ''),
          case
            when current_user <> 'medusa_product_request'
              then '__medusa_dedicated__'
          end
        );
      $$;
    `)

    for (const tableName of directStoreTables) {
      this.addSql(`alter table "${tableName}" enable row level security;`)
      this.addSql(`alter table "${tableName}" force row level security;`)
      this.addSql(`
        create policy "POL_${tableName}_store_isolation"
        on "${tableName}"
        for all
        using (
          "store_id" = "medusa_product_active_store_id"()
        )
        with check (
          "store_id" = "medusa_product_active_store_id"()
        );
      `)
    }

    for (const [
      pivotTable,
      leftTable,
      leftColumn,
      rightTable,
      rightColumn,
    ] of pivotPolicies) {
      this.addSql(`alter table "${pivotTable}" enable row level security;`)
      this.addSql(`alter table "${pivotTable}" force row level security;`)
      this.addSql(`
        create policy "POL_${pivotTable}_store_isolation"
        on "${pivotTable}"
        for all
        using (
          exists (
            select 1 from "${leftTable}"
            where "${leftTable}"."id" = "${pivotTable}"."${leftColumn}"
          )
          and exists (
            select 1 from "${rightTable}"
            where "${rightTable}"."id" = "${pivotTable}"."${rightColumn}"
          )
        )
        with check (
          exists (
            select 1 from "${leftTable}"
            where "${leftTable}"."id" = "${pivotTable}"."${leftColumn}"
          )
          and exists (
            select 1 from "${rightTable}"
            where "${rightTable}"."id" = "${pivotTable}"."${rightColumn}"
          )
        );
      `)
    }
  }

  override async down(): Promise<void> {
    for (const [pivotTable] of [...pivotPolicies].reverse()) {
      this.addSql(
        `drop policy if exists "POL_${pivotTable}_store_isolation" on "${pivotTable}";`
      )
      this.addSql(`alter table "${pivotTable}" no force row level security;`)
      this.addSql(`alter table "${pivotTable}" disable row level security;`)
    }

    for (const tableName of [...directStoreTables].reverse()) {
      this.addSql(
        `drop policy if exists "POL_${tableName}_store_isolation" on "${tableName}";`
      )
      this.addSql(`alter table "${tableName}" no force row level security;`)
      this.addSql(`alter table "${tableName}" disable row level security;`)
    }

    this.addSql(`drop function if exists "medusa_product_active_store_id"();`)
  }
}
