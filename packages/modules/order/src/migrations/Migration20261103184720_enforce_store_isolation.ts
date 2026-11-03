import { Migration } from "@medusajs/framework/mikro-orm/migrations"

const directTables = [
  "order_address",
  "order",
  "return",
  "order_exchange",
  "order_claim",
  "return_reason",
] as const

const relationships = [
  ["order", "shipping_address_id", "order_address", "set null"],
  ["order", "billing_address_id", "order_address", "set null"],
  ["return", "order_id", "order", "cascade"],
  ["order_exchange", "order_id", "order", "cascade"],
  ["order_claim", "order_id", "order", "cascade"],
  ["return_reason", "parent_return_reason_id", "return_reason", "set null"],
] as const

const orderChildren = [
  "order_change",
  "order_change_action",
  "order_credit_line",
  "order_item",
  "order_summary",
  "order_transaction",
  "order_shipping",
] as const

const derivedPolicies = [
  ...orderChildren.map(
    (table) =>
      [
        table,
        `exists (select 1 from "order" where "order"."id" = "${table}"."order_id")`,
      ] as const
  ),
  [
    "order_line_item",
    `exists (select 1 from "order_item" join "order" on "order"."id" = "order_item"."order_id" where "order_item"."item_id" = "order_line_item"."id")`,
  ],
  [
    "order_line_item_adjustment",
    `exists (select 1 from "order_line_item" where "order_line_item"."id" = "order_line_item_adjustment"."item_id")`,
  ],
  [
    "order_line_item_tax_line",
    `exists (select 1 from "order_line_item" where "order_line_item"."id" = "order_line_item_tax_line"."item_id")`,
  ],
  [
    "order_shipping_method",
    `exists (select 1 from "order_shipping" where "order_shipping"."shipping_method_id" = "order_shipping_method"."id")`,
  ],
  [
    "order_shipping_method_adjustment",
    `exists (select 1 from "order_shipping_method" where "order_shipping_method"."id" = "order_shipping_method_adjustment"."shipping_method_id")`,
  ],
  [
    "order_shipping_method_tax_line",
    `exists (select 1 from "order_shipping_method" where "order_shipping_method"."id" = "order_shipping_method_tax_line"."shipping_method_id")`,
  ],
  [
    "order_exchange_item",
    `exists (select 1 from "order_exchange" where "order_exchange"."id" = "order_exchange_item"."exchange_id")`,
  ],
  [
    "order_claim_item",
    `exists (select 1 from "order_claim" where "order_claim"."id" = "order_claim_item"."claim_id")`,
  ],
  [
    "order_claim_item_image",
    `exists (select 1 from "order_claim_item" where "order_claim_item"."id" = "order_claim_item_image"."claim_item_id")`,
  ],
  [
    "return_item",
    `exists (select 1 from "return" where "return"."id" = "return_item"."return_id")`,
  ],
] as const

export class Migration20261103184720_enforce_store_isolation extends Migration {
  override async up(): Promise<void> {
    for (const table of directTables) {
      this.addSql(
        `create unique index "IDX_${table}_id_store_id" on "${table}" ("id", "store_id");`
      )
    }
    for (const [child, column, parent, deleteAction] of relationships) {
      this.addSql(
        `alter table "${child}" add constraint "${child}_${column}_store_foreign" foreign key ("${column}", "store_id") references "${parent}" ("id", "store_id") on update restrict on delete ${deleteAction};`
      )
    }
    this.addSql(`
      create function "medusa_order_store_owner"()
      returns trigger language plpgsql as $$
      declare active_store text;
      begin
        active_store := nullif(current_setting('medusa.store_id', true), '');
        if tg_op = 'INSERT' and active_store is not null then new."store_id" := active_store;
        elsif tg_op = 'UPDATE' and new."store_id" is distinct from old."store_id" then
          raise check_violation using message = format('%s.store_id is immutable', tg_table_name);
        end if;
        return new;
      end
      $$;
    `)
    this.addSql(`
      create function "medusa_order_active_store_id"()
      returns text language sql stable as $$
        select coalesce(nullif(current_setting('medusa.store_id', true), ''),
          case when current_user <> 'medusa_order_request' then '__medusa_dedicated__' end);
      $$;
    `)
    for (const table of directTables) {
      this.addSql(
        `create trigger "TR_${table}_store_owner" before insert or update of "store_id" on "${table}" for each row execute function "medusa_order_store_owner"();`
      )
      this.addSql(`alter table "${table}" enable row level security;`)
      this.addSql(`alter table "${table}" force row level security;`)
      this.addSql(
        `create policy "POL_${table}_store_isolation" on "${table}" for all using ("store_id" = "medusa_order_active_store_id"()) with check ("store_id" = "medusa_order_active_store_id"());`
      )
    }
    for (const [table, predicate] of derivedPolicies) {
      this.addSql(`alter table "${table}" enable row level security;`)
      this.addSql(`alter table "${table}" force row level security;`)
      this.addSql(
        `create policy "POL_${table}_store_select" on "${table}" for select using (${predicate});`
      )
      this.addSql(
        `create policy "POL_${table}_store_insert" on "${table}" for insert with check ("medusa_order_active_store_id"() is not null);`
      )
      this.addSql(
        `create policy "POL_${table}_store_update" on "${table}" for update using (${predicate}) with check (${predicate});`
      )
      this.addSql(
        `create policy "POL_${table}_store_delete" on "${table}" for delete using (${predicate});`
      )
    }
  }

  override async down(): Promise<void> {
    for (const [table] of [...derivedPolicies].reverse()) {
      this.addSql(
        `drop policy if exists "POL_${table}_store_delete" on "${table}";`
      )
      this.addSql(
        `drop policy if exists "POL_${table}_store_update" on "${table}";`
      )
      this.addSql(
        `drop policy if exists "POL_${table}_store_insert" on "${table}";`
      )
      this.addSql(
        `drop policy if exists "POL_${table}_store_select" on "${table}";`
      )
      this.addSql(`alter table "${table}" no force row level security;`)
      this.addSql(`alter table "${table}" disable row level security;`)
    }
    for (const table of [...directTables].reverse()) {
      this.addSql(
        `drop policy if exists "POL_${table}_store_isolation" on "${table}";`
      )
      this.addSql(`alter table "${table}" no force row level security;`)
      this.addSql(`alter table "${table}" disable row level security;`)
      this.addSql(
        `drop trigger if exists "TR_${table}_store_owner" on "${table}";`
      )
    }
    this.addSql(`drop function if exists "medusa_order_active_store_id"();`)
    this.addSql(`drop function if exists "medusa_order_store_owner"();`)
    for (const [child, column] of [...relationships].reverse()) {
      this.addSql(
        `alter table "${child}" drop constraint if exists "${child}_${column}_store_foreign";`
      )
    }
    for (const table of [...directTables].reverse()) {
      this.addSql(`drop index if exists "IDX_${table}_id_store_id";`)
    }
  }
}
