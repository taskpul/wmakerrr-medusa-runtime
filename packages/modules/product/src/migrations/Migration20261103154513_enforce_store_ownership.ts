import { Migration } from "@medusajs/framework/mikro-orm/migrations"

const directRelationships = [
  ["product_category", "product_category", "parent_category_id"],
  ["product_option_value", "product_option", "option_id"],
  ["product", "product_type", "type_id"],
  ["product", "product_collection", "collection_id"],
  ["product_product_option", "product", "product_id"],
  ["product_product_option", "product_option", "product_option_id"],
  [
    "product_product_option_value",
    "product_product_option",
    "product_product_option_id",
  ],
  [
    "product_product_option_value",
    "product_option_value",
    "product_option_value_id",
  ],
  ["image", "product", "product_id"],
  ["product_variant", "product", "product_id"],
  ["product_variant_product_image", "product_variant", "variant_id"],
  ["product_variant_product_image", "image", "image_id"],
] as const

const pivotRelationships = [
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

export class Migration20261103154513_enforce_store_ownership extends Migration {
  override async up(): Promise<void> {
    for (const [childTable, parentTable, parentColumn] of directRelationships) {
      this.addSql(`
        do $$
        begin
          if exists (
            select 1
            from "${childTable}" child
            join "${parentTable}" parent
              on parent."id" = child."${parentColumn}"
            where child."store_id" <> parent."store_id"
          ) then
            raise foreign_key_violation using
              message = '${childTable}.${parentColumn} contains a cross-Store relationship';
          end if;
        end
        $$;
      `)
    }

    for (const [
      pivotTable,
      leftTable,
      leftColumn,
      rightTable,
      rightColumn,
    ] of pivotRelationships) {
      this.addSql(`
        do $$
        begin
          if exists (
            select 1
            from "${pivotTable}" pivot
            join "${leftTable}" left_parent
              on left_parent."id" = pivot."${leftColumn}"
            join "${rightTable}" right_parent
              on right_parent."id" = pivot."${rightColumn}"
            where left_parent."store_id" <> right_parent."store_id"
          ) then
            raise foreign_key_violation using
              message = '${pivotTable} contains a cross-Store relationship';
          end if;
        end
        $$;
      `)
    }

    this.addSql(`
      create function "medusa_product_enforce_store_ownership"()
      returns trigger
      language plpgsql
      as $$
      declare
        parent_id text;
        parent_store_id text;
      begin
        parent_id := to_jsonb(new) ->> tg_argv[1];
        if parent_id is null then
          return new;
        end if;

        execute format(
          'select store_id from %I where id = $1',
          tg_argv[0]
        ) into parent_store_id using parent_id;

        if parent_store_id is null then
          return new;
        end if;

        if parent_store_id is distinct from new."store_id" then
          raise foreign_key_violation using
            message = format('%s.%s must reference a parent owned by the same Store', tg_table_name, tg_argv[1]),
            table = tg_table_name,
            column = tg_argv[1];
        end if;

        return new;
      end
      $$;
    `)

    this.addSql(`
      create function "medusa_product_enforce_pivot_store_ownership"()
      returns trigger
      language plpgsql
      as $$
      declare
        left_id text;
        right_id text;
        left_store_id text;
        right_store_id text;
      begin
        left_id := to_jsonb(new) ->> tg_argv[1];
        right_id := to_jsonb(new) ->> tg_argv[3];

        execute format(
          'select store_id from %I where id = $1',
          tg_argv[0]
        ) into left_store_id using left_id;
        execute format(
          'select store_id from %I where id = $1',
          tg_argv[2]
        ) into right_store_id using right_id;

        if left_store_id is null or right_store_id is null then
          return new;
        end if;

        if left_store_id is distinct from right_store_id then
          raise foreign_key_violation using
            message = format('%s parents must belong to the same Store', tg_table_name),
            table = tg_table_name;
        end if;

        return new;
      end
      $$;
    `)

    this.addSql(`
      create function "medusa_product_store_id_immutable"()
      returns trigger
      language plpgsql
      as $$
      begin
        if new."store_id" is distinct from old."store_id" then
          raise check_violation using
            message = format('%s.store_id is immutable', tg_table_name),
            table = tg_table_name,
            column = 'store_id';
        end if;
        return new;
      end
      $$;
    `)

    for (const [childTable, parentTable, parentColumn] of directRelationships) {
      this.addSql(
        `create trigger "TR_${childTable}_${parentColumn}_store_owner" before insert or update of "${parentColumn}", "store_id" on "${childTable}" for each row execute function "medusa_product_enforce_store_ownership"('${parentTable}', '${parentColumn}');`
      )
    }

    for (const [
      pivotTable,
      leftTable,
      leftColumn,
      rightTable,
      rightColumn,
    ] of pivotRelationships) {
      this.addSql(
        `create trigger "TR_${pivotTable}_store_owner" before insert or update on "${pivotTable}" for each row execute function "medusa_product_enforce_pivot_store_ownership"('${leftTable}', '${leftColumn}', '${rightTable}', '${rightColumn}');`
      )
    }

    for (const tableName of directStoreTables) {
      this.addSql(
        `create trigger "TR_${tableName}_store_id_immutable" before update of "store_id" on "${tableName}" for each row execute function "medusa_product_store_id_immutable"();`
      )
    }
  }

  override async down(): Promise<void> {
    for (const tableName of [...directStoreTables].reverse()) {
      this.addSql(
        `drop trigger if exists "TR_${tableName}_store_id_immutable" on "${tableName}";`
      )
    }

    for (const [pivotTable] of [...pivotRelationships].reverse()) {
      this.addSql(
        `drop trigger if exists "TR_${pivotTable}_store_owner" on "${pivotTable}";`
      )
    }

    for (const [childTable, , parentColumn] of [
      ...directRelationships,
    ].reverse()) {
      this.addSql(
        `drop trigger if exists "TR_${childTable}_${parentColumn}_store_owner" on "${childTable}";`
      )
    }

    this.addSql(
      `drop function if exists "medusa_product_store_id_immutable"();`
    )
    this.addSql(
      `drop function if exists "medusa_product_enforce_pivot_store_ownership"();`
    )
    this.addSql(
      `drop function if exists "medusa_product_enforce_store_ownership"();`
    )
  }
}
