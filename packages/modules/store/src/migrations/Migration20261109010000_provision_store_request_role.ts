import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261109010000_provision_store_request_role extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      do $$ begin
        if not exists (
          select 1 from pg_roles where rolname = 'medusa_store_request'
        ) then
          create role "medusa_store_request" nologin nosuperuser nobypassrls;
        end if;
      end $$;
    `)
    this.addSql(
      `alter role "medusa_store_request" nologin nosuperuser nobypassrls;`
    )
    this.addSql(`grant usage on schema public to "medusa_store_request";`)
    this.addSql(
      `grant select, insert, update, delete on table "store", "store_currency", "store_locale" to "medusa_store_request";`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `revoke select, insert, update, delete on table "store", "store_currency", "store_locale" from "medusa_store_request";`
    )
  }
}
