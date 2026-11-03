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

const relationships = [
  ["promotion", "campaign_id", "promotion_campaign", "set null"],
  ["promotion_campaign_budget", "campaign_id", "promotion_campaign", "cascade"],
  [
    "promotion_campaign_budget_usage",
    "budget_id",
    "promotion_campaign_budget",
    "cascade",
  ],
  ["promotion_application_method", "promotion_id", "promotion", "cascade"],
  ["promotion_rule_value", "promotion_rule_id", "promotion_rule", "cascade"],
] as const

export class Migration20261103184156_enforce_store_relationships extends Migration {
  override async up(): Promise<void> {
    this.addSql(`drop index if exists "IDX_unique_promotion_code";`)
    this.addSql(
      `create unique index "IDX_unique_promotion_code" on "promotion" ("store_id", "code") where "deleted_at" is null;`
    )

    for (const table of directTables) {
      this.addSql(
        `create unique index "IDX_${table}_id_store_id" on "${table}" ("id", "store_id");`
      )
    }

    for (const [
      childTable,
      childColumn,
      parentTable,
      deleteAction,
    ] of relationships) {
      this.addSql(`
        do $$
        begin
          if exists (
            select 1 from "${childTable}" child
            join "${parentTable}" parent on parent."id" = child."${childColumn}"
            where child."${childColumn}" is not null
              and child."store_id" <> parent."store_id"
          ) then
            raise foreign_key_violation using
              message = '${childTable}.${childColumn} contains a cross-Store relationship';
          end if;
        end
        $$;
      `)
      this.addSql(
        `alter table "${childTable}" add constraint "${childTable}_${childColumn}_store_foreign" foreign key ("${childColumn}", "store_id") references "${parentTable}" ("id", "store_id") on update restrict on delete ${deleteAction};`
      )
    }

    this.addSql(`
      create function "medusa_promotion_store_owner"()
      returns trigger language plpgsql as $$
      declare active_store text;
      begin
        active_store := nullif(current_setting('medusa.store_id', true), '');
        if tg_op = 'INSERT' and active_store is not null then
          new."store_id" := active_store;
        elsif tg_op = 'UPDATE' and new."store_id" is distinct from old."store_id" then
          raise check_violation using
            message = format('%s.store_id is immutable', tg_table_name),
            table = tg_table_name,
            column = 'store_id';
        end if;
        return new;
      end
      $$;
    `)
    for (const table of directTables) {
      this.addSql(
        `create trigger "TR_${table}_store_owner" before insert or update of "store_id" on "${table}" for each row execute function "medusa_promotion_store_owner"();`
      )
    }
  }

  override async down(): Promise<void> {
    for (const table of [...directTables].reverse()) {
      this.addSql(
        `drop trigger if exists "TR_${table}_store_owner" on "${table}";`
      )
    }
    this.addSql(`drop function if exists "medusa_promotion_store_owner"();`)
    for (const [childTable, childColumn] of [...relationships].reverse()) {
      this.addSql(
        `alter table "${childTable}" drop constraint if exists "${childTable}_${childColumn}_store_foreign";`
      )
    }
    for (const table of [...directTables].reverse()) {
      this.addSql(`drop index if exists "IDX_${table}_id_store_id";`)
    }
    this.addSql(`drop index if exists "IDX_unique_promotion_code";`)
    this.addSql(
      `create unique index "IDX_unique_promotion_code" on "promotion" ("code") where "deleted_at" is null;`
    )
  }
}
