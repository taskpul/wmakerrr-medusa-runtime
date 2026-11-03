import { Migration } from "@medusajs/framework/mikro-orm/migrations"

const directStoreTables = [
  "fulfillment_address",
  "fulfillment_set",
  "service_zone",
  "geo_zone",
  "shipping_option_type",
  "shipping_profile",
  "shipping_option",
  "shipping_option_rule",
  "fulfillment",
  "fulfillment_label",
  "fulfillment_item",
] as const

const parentTables = [
  "fulfillment_address",
  "fulfillment_set",
  "service_zone",
  "shipping_option_type",
  "shipping_profile",
  "shipping_option",
  "fulfillment",
] as const

const relationships = [
  ["service_zone", "fulfillment_set", "fulfillment_set_id"],
  ["geo_zone", "service_zone", "service_zone_id"],
  ["shipping_option", "service_zone", "service_zone_id"],
  ["shipping_option", "shipping_profile", "shipping_profile_id"],
  ["shipping_option", "shipping_option_type", "shipping_option_type_id"],
  ["shipping_option_rule", "shipping_option", "shipping_option_id"],
  ["fulfillment", "shipping_option", "shipping_option_id"],
  ["fulfillment", "fulfillment_address", "delivery_address_id"],
  ["fulfillment_item", "fulfillment", "fulfillment_id"],
  ["fulfillment_label", "fulfillment", "fulfillment_id"],
] as const

const scopedUniqueIndexes = [
  ["fulfillment_set", "IDX_fulfillment_set_name_unique"],
  ["service_zone", "IDX_service_zone_name_unique"],
  ["shipping_profile", "IDX_shipping_profile_name_unique"],
] as const

export class Migration20261103170220_enforce_store_ownership extends Migration {
  override async up(): Promise<void> {
    for (const [childTable, parentTable, parentColumn] of relationships) {
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

    for (const [tableName, indexName] of scopedUniqueIndexes) {
      this.addSql(`drop index if exists "${indexName}";`)
      this.addSql(
        `create unique index "${indexName}" on "${tableName}" ("store_id", "name") where "deleted_at" is null;`
      )
    }

    for (const tableName of parentTables) {
      this.addSql(
        `create unique index "IDX_${tableName}_id_store_id" on "${tableName}" ("id", "store_id");`
      )
    }

    for (const [childTable, parentTable, parentColumn] of relationships) {
      this.addSql(
        `alter table "${childTable}" add constraint "${childTable}_${parentColumn}_store_foreign" foreign key ("${parentColumn}", "store_id") references "${parentTable}" ("id", "store_id") on update restrict on delete cascade;`
      )
    }

    this.addSql(`
      create function "medusa_fulfillment_store_id_immutable"()
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

    for (const tableName of directStoreTables) {
      this.addSql(
        `create trigger "TR_${tableName}_store_id_immutable" before update of "store_id" on "${tableName}" for each row execute function "medusa_fulfillment_store_id_immutable"();`
      )
    }
  }

  override async down(): Promise<void> {
    for (const tableName of [...directStoreTables].reverse()) {
      this.addSql(
        `drop trigger if exists "TR_${tableName}_store_id_immutable" on "${tableName}";`
      )
    }

    this.addSql(
      `drop function if exists "medusa_fulfillment_store_id_immutable"();`
    )

    for (const [childTable, , parentColumn] of [...relationships].reverse()) {
      this.addSql(
        `alter table "${childTable}" drop constraint if exists "${childTable}_${parentColumn}_store_foreign";`
      )
    }

    for (const tableName of [...parentTables].reverse()) {
      this.addSql(`drop index if exists "IDX_${tableName}_id_store_id";`)
    }

    for (const [tableName, indexName] of [...scopedUniqueIndexes].reverse()) {
      this.addSql(`
        do $$
        begin
          if exists (
            select "name"
            from "${tableName}"
            where "deleted_at" is null
            group by "name"
            having count(*) > 1
          ) then
            raise unique_violation using
              message = '${tableName} contains Store-scoped names that cannot be collapsed to legacy global uniqueness';
          end if;
        end
        $$;
      `)
      this.addSql(`drop index if exists "${indexName}";`)
      this.addSql(
        `create unique index "${indexName}" on "${tableName}" ("name") where "deleted_at" is null;`
      )
    }
  }
}
