import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261108120000_enforce_store_isolation extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "store" add column "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `create unique index "IDX_store_tenant_store_id" on "store" ("store_id") where "store_id" <> '__medusa_dedicated__' and "deleted_at" is null;`
    )
    this.addSql(`
      create function "medusa_store_owner"()
      returns trigger language plpgsql as $$
      declare active_store text;
      begin
        active_store := nullif(current_setting('medusa.store_id', true), '');
        if tg_op = 'INSERT' and active_store is not null then new."store_id" := active_store;
        elsif tg_op = 'UPDATE' and new."store_id" is distinct from old."store_id" then
          raise check_violation using message = 'store.store_id is immutable';
        end if;
        return new;
      end
      $$;
    `)
    this.addSql(`
      create function "medusa_store_active_store_id"()
      returns text language sql stable as $$
        select coalesce(nullif(current_setting('medusa.store_id', true), ''),
          case when current_user <> 'medusa_store_request' then '__medusa_dedicated__' end);
      $$;
    `)
    this.addSql(
      `create trigger "TR_store_owner" before insert or update of "store_id" on "store" for each row execute function "medusa_store_owner"();`
    )
    this.addSql(`alter table "store" enable row level security;`)
    this.addSql(`alter table "store" force row level security;`)
    this.addSql(
      `create policy "POL_store_isolation" on "store" for all using ("store_id" = "medusa_store_active_store_id"()) with check ("store_id" = "medusa_store_active_store_id"());`
    )
    for (const table of ["store_currency", "store_locale"]) {
      this.addSql(`alter table "${table}" enable row level security;`)
      this.addSql(`alter table "${table}" force row level security;`)
      this.addSql(
        `create policy "POL_${table}_store_isolation" on "${table}" for all using (exists (select 1 from "store" where "store"."id" = "${table}"."store_id")) with check (exists (select 1 from "store" where "store"."id" = "${table}"."store_id"));`
      )
    }
  }

  override async down(): Promise<void> {
    for (const table of ["store_locale", "store_currency"]) {
      this.addSql(
        `drop policy if exists "POL_${table}_store_isolation" on "${table}";`
      )
      this.addSql(`alter table "${table}" no force row level security;`)
      this.addSql(`alter table "${table}" disable row level security;`)
    }
    this.addSql(`drop policy if exists "POL_store_isolation" on "store";`)
    this.addSql(`alter table "store" no force row level security;`)
    this.addSql(`alter table "store" disable row level security;`)
    this.addSql(`drop trigger if exists "TR_store_owner" on "store";`)
    this.addSql(`drop function if exists "medusa_store_active_store_id"();`)
    this.addSql(`drop function if exists "medusa_store_owner"();`)
    this.addSql(`drop index if exists "IDX_store_tenant_store_id";`)
    this.addSql(`alter table "store" drop column "store_id";`)
  }
}
