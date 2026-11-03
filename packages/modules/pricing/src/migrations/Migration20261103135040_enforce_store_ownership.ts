import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261103135040_enforce_store_ownership extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      do $$
      begin
        if exists (
          select 1 from "price" child join "price_set" parent on parent."id" = child."price_set_id" where child."store_id" <> parent."store_id"
          union all
          select 1 from "price" child join "price_list" parent on parent."id" = child."price_list_id" where child."store_id" <> parent."store_id"
          union all
          select 1 from "price_rule" child join "price" parent on parent."id" = child."price_id" where child."store_id" <> parent."store_id"
          union all
          select 1 from "price_list_rule" child join "price_list" parent on parent."id" = child."price_list_id" where child."store_id" <> parent."store_id"
        ) then
          raise foreign_key_violation using message = 'Pricing data contains cross-Store relationships';
        end if;
      end
      $$;
    `)

    this.addSql(`
      create function "medusa_pricing_enforce_store_ownership"()
      returns trigger
      language plpgsql
      as $$
      declare
        parent_id text;
        parent_matches boolean;
      begin
        parent_id := to_jsonb(new) ->> tg_argv[1];
        if parent_id is null then
          return new;
        end if;

        execute format(
          'select exists (select 1 from %I where id = $1 and store_id = $2)',
          tg_argv[0]
        ) into parent_matches using parent_id, new."store_id";

        if not parent_matches then
          raise foreign_key_violation using
            message = format('%s.%s must reference a parent owned by the same Store', tg_table_name, tg_argv[1]),
            table = tg_table_name,
            column = tg_argv[1];
        end if;

        return new;
      end
      $$;
    `)

    this.addSql(`
      create function "medusa_pricing_store_id_immutable"()
      returns trigger
      language plpgsql
      as $$
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

    this.addSql(
      `create trigger "TR_price_price_set_store_owner" before insert or update of "price_set_id", "store_id" on "price" for each row execute function "medusa_pricing_enforce_store_ownership"('price_set', 'price_set_id');`
    )
    this.addSql(
      `create trigger "TR_price_price_list_store_owner" before insert or update of "price_list_id", "store_id" on "price" for each row execute function "medusa_pricing_enforce_store_ownership"('price_list', 'price_list_id');`
    )
    this.addSql(
      `create trigger "TR_price_rule_price_store_owner" before insert or update of "price_id", "store_id" on "price_rule" for each row execute function "medusa_pricing_enforce_store_ownership"('price', 'price_id');`
    )
    this.addSql(
      `create trigger "TR_price_list_rule_price_list_store_owner" before insert or update of "price_list_id", "store_id" on "price_list_rule" for each row execute function "medusa_pricing_enforce_store_ownership"('price_list', 'price_list_id');`
    )

    for (const tableName of [
      "price_list",
      "price_list_rule",
      "price_preference",
      "price_set",
      "price",
      "price_rule",
    ]) {
      this.addSql(
        `create trigger "TR_${tableName}_store_id_immutable" before update of "store_id" on "${tableName}" for each row execute function "medusa_pricing_store_id_immutable"();`
      )
    }
  }

  override async down(): Promise<void> {
    for (const tableName of [
      "price_list",
      "price_list_rule",
      "price_preference",
      "price_set",
      "price",
      "price_rule",
    ]) {
      this.addSql(
        `drop trigger if exists "TR_${tableName}_store_id_immutable" on "${tableName}";`
      )
    }

    this.addSql(
      `drop trigger if exists "TR_price_list_rule_price_list_store_owner" on "price_list_rule";`
    )
    this.addSql(
      `drop trigger if exists "TR_price_rule_price_store_owner" on "price_rule";`
    )
    this.addSql(
      `drop trigger if exists "TR_price_price_list_store_owner" on "price";`
    )
    this.addSql(
      `drop trigger if exists "TR_price_price_set_store_owner" on "price";`
    )
    this.addSql(
      `drop function if exists "medusa_pricing_store_id_immutable"();`
    )
    this.addSql(
      `drop function if exists "medusa_pricing_enforce_store_ownership"();`
    )
  }
}
