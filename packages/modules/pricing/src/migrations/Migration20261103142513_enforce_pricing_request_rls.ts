import { Migration } from "@medusajs/framework/mikro-orm/migrations"

const pricingTables = [
  "price_set",
  "price",
  "price_rule",
  "price_list",
  "price_list_rule",
  "price_preference",
] as const

export class Migration20261103142513_enforce_pricing_request_rls extends Migration {
  override async up(): Promise<void> {
    for (const tableName of pricingTables) {
      this.addSql(`alter table "${tableName}" enable row level security;`)
      this.addSql(`alter table "${tableName}" force row level security;`)
      this.addSql(`
        create policy "POL_${tableName}_store_isolation"
        on "${tableName}"
        for all
        using (
          "store_id" = nullif(current_setting('medusa.store_id', true), '')
        )
        with check (
          "store_id" = nullif(current_setting('medusa.store_id', true), '')
        );
      `)
    }
  }

  override async down(): Promise<void> {
    for (const tableName of [...pricingTables].reverse()) {
      this.addSql(
        `drop policy if exists "POL_${tableName}_store_isolation" on "${tableName}";`
      )
      this.addSql(`alter table "${tableName}" no force row level security;`)
      this.addSql(`alter table "${tableName}" disable row level security;`)
    }
  }
}
