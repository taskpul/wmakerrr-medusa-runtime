import { Migration } from "@medusajs/framework/mikro-orm/migrations"

const tables = ["stock_location_address", "stock_location"] as const

export class Migration20261103173329_enforce_store_ownership extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create unique index "IDX_stock_location_address_id_store_id" on "stock_location_address" ("id", "store_id");`
    )
    this.addSql(`
      do $$
      begin
        if exists (
          select 1 from "stock_location" child
          join "stock_location_address" parent on parent."id" = child."address_id"
          where child."store_id" <> parent."store_id"
        ) then
          raise foreign_key_violation using
            message = 'stock_location.address_id contains a cross-Store relationship';
        end if;
      end
      $$;
    `)
    this.addSql(`
      alter table "stock_location"
      add constraint "stock_location_address_id_store_foreign"
      foreign key ("address_id", "store_id")
      references "stock_location_address" ("id", "store_id")
      on update restrict on delete cascade;
    `)
    this.addSql(`
      create function "medusa_stock_location_store_id_immutable"()
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
        `create trigger "TR_${table}_store_id_immutable" before update of "store_id" on "${table}" for each row execute function "medusa_stock_location_store_id_immutable"();`
      )
    }
  }

  override async down(): Promise<void> {
    for (const table of [...tables].reverse()) {
      this.addSql(
        `drop trigger if exists "TR_${table}_store_id_immutable" on "${table}";`
      )
    }
    this.addSql(`drop function if exists "medusa_stock_location_store_id_immutable"();`)
    this.addSql(
      `alter table "stock_location" drop constraint if exists "stock_location_address_id_store_foreign";`
    )
    this.addSql(`drop index if exists "IDX_stock_location_address_id_store_id";`)
  }
}
