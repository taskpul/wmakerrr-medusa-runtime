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

export class Migration20261103170221_enforce_fulfillment_request_rls extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create function "medusa_fulfillment_active_store_id"()
      returns text
      language sql
      stable
      as $$
        select coalesce(
          nullif(current_setting('medusa.store_id', true), ''),
          case
            when current_user <> 'medusa_fulfillment_request'
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
          "store_id" = "medusa_fulfillment_active_store_id"()
        )
        with check (
          "store_id" = "medusa_fulfillment_active_store_id"()
        );
      `)
    }
  }

  override async down(): Promise<void> {
    for (const tableName of [...directStoreTables].reverse()) {
      this.addSql(
        `drop policy if exists "POL_${tableName}_store_isolation" on "${tableName}";`
      )
      this.addSql(`alter table "${tableName}" no force row level security;`)
      this.addSql(`alter table "${tableName}" disable row level security;`)
    }

    this.addSql(
      `drop function if exists "medusa_fulfillment_active_store_id"();`
    )
  }
}
