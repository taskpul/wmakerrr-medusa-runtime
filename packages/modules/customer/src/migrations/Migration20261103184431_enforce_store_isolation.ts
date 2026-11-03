import { Migration } from "@medusajs/framework/mikro-orm/migrations"

const tables = [
  "customer",
  "customer_address",
  "customer_group",
  "customer_group_customer",
] as const

const relationships = [
  ["customer_address", "customer_id", "customer"],
  ["customer_group_customer", "customer_id", "customer"],
  ["customer_group_customer", "customer_group_id", "customer_group"],
] as const

export class Migration20261103184431_enforce_store_isolation extends Migration {
  override async up(): Promise<void> {
    for (const table of tables) {
      this.addSql(
        `create unique index "IDX_${table}_id_store_id" on "${table}" ("id", "store_id");`
      )
    }
    for (const [child, column, parent] of relationships) {
      this.addSql(
        `alter table "${child}" add constraint "${child}_${column}_store_foreign" foreign key ("${column}", "store_id") references "${parent}" ("id", "store_id") on update restrict on delete cascade;`
      )
    }
    this.addSql(`
      create function "medusa_customer_store_owner"()
      returns trigger language plpgsql as $$
      declare active_store text;
      begin
        active_store := nullif(current_setting('medusa.store_id', true), '');
        if tg_op = 'INSERT' and active_store is not null then
          new."store_id" := active_store;
        elsif tg_op = 'UPDATE' and new."store_id" is distinct from old."store_id" then
          raise check_violation using message = format('%s.store_id is immutable', tg_table_name);
        end if;
        return new;
      end
      $$;
    `)
    this.addSql(`
      create function "medusa_customer_active_store_id"()
      returns text language sql stable as $$
        select coalesce(
          nullif(current_setting('medusa.store_id', true), ''),
          case when current_user <> 'medusa_customer_request'
            then '__medusa_dedicated__'
          end
        );
      $$;
    `)
    for (const table of tables) {
      this.addSql(
        `create trigger "TR_${table}_store_owner" before insert or update of "store_id" on "${table}" for each row execute function "medusa_customer_store_owner"();`
      )
      this.addSql(`alter table "${table}" enable row level security;`)
      this.addSql(`alter table "${table}" force row level security;`)
      this.addSql(`
        create policy "POL_${table}_store_isolation" on "${table}" for all
        using ("store_id" = "medusa_customer_active_store_id"())
        with check ("store_id" = "medusa_customer_active_store_id"());
      `)
    }
  }

  override async down(): Promise<void> {
    for (const table of [...tables].reverse()) {
      this.addSql(
        `drop policy if exists "POL_${table}_store_isolation" on "${table}";`
      )
      this.addSql(`alter table "${table}" no force row level security;`)
      this.addSql(`alter table "${table}" disable row level security;`)
      this.addSql(
        `drop trigger if exists "TR_${table}_store_owner" on "${table}";`
      )
    }
    this.addSql(`drop function if exists "medusa_customer_active_store_id"();`)
    this.addSql(`drop function if exists "medusa_customer_store_owner"();`)
    for (const [child, column] of [...relationships].reverse()) {
      this.addSql(
        `alter table "${child}" drop constraint if exists "${child}_${column}_store_foreign";`
      )
    }
    for (const table of [...tables].reverse()) {
      this.addSql(`drop index if exists "IDX_${table}_id_store_id";`)
    }
  }
}
