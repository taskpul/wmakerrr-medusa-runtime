import { Migration } from "@medusajs/framework/mikro-orm/migrations"

const tables = ["inventory_item", "inventory_level", "reservation_item"] as const

export class Migration20261103173324_enforce_inventory_request_rls extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create function "medusa_inventory_active_store_id"()
      returns text language sql stable as $$
        select coalesce(
          nullif(current_setting('medusa.store_id', true), ''),
          case when current_user <> 'medusa_inventory_request'
            then '__medusa_dedicated__'
          end
        );
      $$;
    `)
    for (const table of tables) {
      this.addSql(`alter table "${table}" enable row level security;`)
      this.addSql(`alter table "${table}" force row level security;`)
      this.addSql(`
        create policy "POL_${table}_store_isolation" on "${table}" for all
        using ("store_id" = "medusa_inventory_active_store_id"())
        with check ("store_id" = "medusa_inventory_active_store_id"());
      `)
    }
  }

  override async down(): Promise<void> {
    for (const table of [...tables].reverse()) {
      this.addSql(`drop policy if exists "POL_${table}_store_isolation" on "${table}";`)
      this.addSql(`alter table "${table}" no force row level security;`)
      this.addSql(`alter table "${table}" disable row level security;`)
    }
    this.addSql(`drop function if exists "medusa_inventory_active_store_id"();`)
  }
}
