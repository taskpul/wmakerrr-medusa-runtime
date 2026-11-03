import { Migration } from "@medusajs/framework/mikro-orm/migrations"

const tables = ["inventory_item", "inventory_level", "reservation_item"] as const
const relationships = [
  ["inventory_level", "inventory_item_id"],
  ["reservation_item", "inventory_item_id"],
] as const

export class Migration20261103173323_enforce_store_ownership extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create unique index "IDX_inventory_item_id_store_id" on "inventory_item" ("id", "store_id");`
    )
    for (const [childTable, parentColumn] of relationships) {
      this.addSql(`
        do $$
        begin
          if exists (
            select 1 from "${childTable}" child
            join "inventory_item" parent on parent."id" = child."${parentColumn}"
            where child."store_id" <> parent."store_id"
          ) then
            raise foreign_key_violation using
              message = '${childTable}.${parentColumn} contains a cross-Store relationship';
          end if;
        end
        $$;
      `)
      this.addSql(
        `alter table "${childTable}" add constraint "${childTable}_${parentColumn}_store_foreign" foreign key ("${parentColumn}", "store_id") references "inventory_item" ("id", "store_id") on update restrict on delete cascade;`
      )
    }
    this.addSql(`
      create function "medusa_inventory_store_id_immutable"()
      returns trigger language plpgsql as $$
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
    for (const table of tables) {
      this.addSql(
        `create trigger "TR_${table}_store_id_immutable" before update of "store_id" on "${table}" for each row execute function "medusa_inventory_store_id_immutable"();`
      )
    }
  }

  override async down(): Promise<void> {
    this.addSql(`
      do $$
      begin
        if exists (
          select "sku" from "inventory_item"
          where "deleted_at" is null and "sku" is not null
          group by "sku" having count(*) > 1
        ) then
          raise unique_violation using
            message = 'Store-scoped inventory SKUs cannot be collapsed to legacy global uniqueness';
        end if;
      end
      $$;
    `)
    for (const table of [...tables].reverse()) {
      this.addSql(
        `drop trigger if exists "TR_${table}_store_id_immutable" on "${table}";`
      )
    }
    this.addSql(`drop function if exists "medusa_inventory_store_id_immutable"();`)
    for (const [childTable, parentColumn] of [...relationships].reverse()) {
      this.addSql(
        `alter table "${childTable}" drop constraint if exists "${childTable}_${parentColumn}_store_foreign";`
      )
    }
    this.addSql(`drop index if exists "IDX_inventory_item_id_store_id";`)
  }
}
