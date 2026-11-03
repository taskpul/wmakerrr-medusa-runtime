import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261103184919_enforce_store_owner extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create unique index "IDX_api_key_id_store_id" on "api_key" ("id", "store_id");`
    )
    this.addSql(`
      create function "medusa_api_key_store_owner_immutable"()
      returns trigger language plpgsql as $$
      begin
        if new."store_id" is distinct from old."store_id" then
          raise check_violation using message = 'api_key.store_id is immutable';
        end if;
        return new;
      end
      $$;
    `)
    this.addSql(
      `create trigger "TR_api_key_store_owner_immutable" before update of "store_id" on "api_key" for each row execute function "medusa_api_key_store_owner_immutable"();`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `drop trigger if exists "TR_api_key_store_owner_immutable" on "api_key";`
    )
    this.addSql(
      `drop function if exists "medusa_api_key_store_owner_immutable"();`
    )
    this.addSql(`drop index if exists "IDX_api_key_id_store_id";`)
  }
}
