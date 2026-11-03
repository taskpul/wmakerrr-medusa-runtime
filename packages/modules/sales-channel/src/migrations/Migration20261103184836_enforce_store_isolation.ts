import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261103184836_enforce_store_isolation extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create unique index "IDX_sales_channel_id_store_id" on "sales_channel" ("id", "store_id");`
    )
    this.addSql(`
      create function "medusa_sales_channel_store_owner"()
      returns trigger language plpgsql as $$
      declare active_store text;
      begin
        active_store := nullif(current_setting('medusa.store_id', true), '');
        if tg_op = 'INSERT' and active_store is not null then new."store_id" := active_store;
        elsif tg_op = 'UPDATE' and new."store_id" is distinct from old."store_id" then
          raise check_violation using message = 'sales_channel.store_id is immutable';
        end if;
        return new;
      end
      $$;
    `)
    this.addSql(`
      create function "medusa_sales_channel_active_store_id"()
      returns text language sql stable as $$
        select coalesce(nullif(current_setting('medusa.store_id', true), ''),
          case when current_user <> 'medusa_sales_channel_request' then '__medusa_dedicated__' end);
      $$;
    `)
    this.addSql(
      `create trigger "TR_sales_channel_store_owner" before insert or update of "store_id" on "sales_channel" for each row execute function "medusa_sales_channel_store_owner"();`
    )
    this.addSql(`alter table "sales_channel" enable row level security;`)
    this.addSql(`alter table "sales_channel" force row level security;`)
    this.addSql(
      `create policy "POL_sales_channel_store_isolation" on "sales_channel" for all using ("store_id" = "medusa_sales_channel_active_store_id"()) with check ("store_id" = "medusa_sales_channel_active_store_id"());`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `drop policy if exists "POL_sales_channel_store_isolation" on "sales_channel";`
    )
    this.addSql(`alter table "sales_channel" no force row level security;`)
    this.addSql(`alter table "sales_channel" disable row level security;`)
    this.addSql(
      `drop trigger if exists "TR_sales_channel_store_owner" on "sales_channel";`
    )
    this.addSql(
      `drop function if exists "medusa_sales_channel_active_store_id"();`
    )
    this.addSql(`drop function if exists "medusa_sales_channel_store_owner"();`)
    this.addSql(`drop index if exists "IDX_sales_channel_id_store_id";`)
  }
}
