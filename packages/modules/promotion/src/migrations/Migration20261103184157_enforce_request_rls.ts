import { Migration } from "@medusajs/framework/mikro-orm/migrations"

const directTables = [
  "promotion_campaign",
  "promotion_campaign_budget",
  "promotion_campaign_budget_usage",
  "promotion",
  "promotion_application_method",
  "promotion_rule",
  "promotion_rule_value",
] as const

const pivots = [
  [
    "promotion_promotion_rule",
    "promotion",
    "promotion_id",
    "promotion_rule",
    "promotion_rule_id",
  ],
  [
    "application_method_target_rules",
    "promotion_application_method",
    "application_method_id",
    "promotion_rule",
    "promotion_rule_id",
  ],
  [
    "application_method_buy_rules",
    "promotion_application_method",
    "application_method_id",
    "promotion_rule",
    "promotion_rule_id",
  ],
] as const

export class Migration20261103184157_enforce_request_rls extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create function "medusa_promotion_active_store_id"()
      returns text language sql stable as $$
        select coalesce(
          nullif(current_setting('medusa.store_id', true), ''),
          case when current_user <> 'medusa_promotion_request'
            then '__medusa_dedicated__'
          end
        );
      $$;
    `)
    for (const table of directTables) {
      this.addSql(`alter table "${table}" enable row level security;`)
      this.addSql(`alter table "${table}" force row level security;`)
      this.addSql(`
        create policy "POL_${table}_store_isolation" on "${table}" for all
        using ("store_id" = "medusa_promotion_active_store_id"())
        with check ("store_id" = "medusa_promotion_active_store_id"());
      `)
    }
    for (const [
      pivot,
      leftTable,
      leftColumn,
      rightTable,
      rightColumn,
    ] of pivots) {
      this.addSql(`alter table "${pivot}" enable row level security;`)
      this.addSql(`alter table "${pivot}" force row level security;`)
      this.addSql(`
        create policy "POL_${pivot}_store_isolation" on "${pivot}" for all
        using (
          exists (select 1 from "${leftTable}" where "${leftTable}"."id" = "${pivot}"."${leftColumn}")
          and exists (select 1 from "${rightTable}" where "${rightTable}"."id" = "${pivot}"."${rightColumn}")
        )
        with check (
          exists (select 1 from "${leftTable}" where "${leftTable}"."id" = "${pivot}"."${leftColumn}")
          and exists (select 1 from "${rightTable}" where "${rightTable}"."id" = "${pivot}"."${rightColumn}")
        );
      `)
    }
  }

  override async down(): Promise<void> {
    for (const [pivot] of [...pivots].reverse()) {
      this.addSql(
        `drop policy if exists "POL_${pivot}_store_isolation" on "${pivot}";`
      )
      this.addSql(`alter table "${pivot}" no force row level security;`)
      this.addSql(`alter table "${pivot}" disable row level security;`)
    }
    for (const table of [...directTables].reverse()) {
      this.addSql(
        `drop policy if exists "POL_${table}_store_isolation" on "${table}";`
      )
      this.addSql(`alter table "${table}" no force row level security;`)
      this.addSql(`alter table "${table}" disable row level security;`)
    }
    this.addSql(`drop function if exists "medusa_promotion_active_store_id"();`)
  }
}
