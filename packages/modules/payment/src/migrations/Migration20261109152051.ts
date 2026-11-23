import { Migration } from "@medusajs/framework/mikro-orm/migrations"
import { sharedStoreRequestRoleMigrationSql } from "@medusajs/framework/utils"

const requestRoleMigration = sharedStoreRequestRoleMigrationSql({
  tables: ["refund_reason"],
})

export class Migration20261109152051 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "refund_reason" add column if not exists "store_id" text not null default '__medusa_dedicated__';`
    )
    this.addSql(
      `create unique index "IDX_refund_reason_id_store_id" on "refund_reason" ("id", "store_id");`
    )

    this.addSql(`
      insert into "refund_reason" (
        "id", "store_id", "label", "code", "description", "metadata",
        "created_at", "updated_at", "deleted_at"
      )
      select
        'refr_' || substr(md5(reason."id" || refund."store_id"), 1, 26),
        refund."store_id", reason."label", reason."code", reason."description",
        reason."metadata", reason."created_at", reason."updated_at", reason."deleted_at"
      from "refund_reason" reason
      join (
        select distinct "refund_reason_id", "store_id"
        from "refund"
        where "refund_reason_id" is not null
          and "store_id" <> '__medusa_dedicated__'
      ) refund on refund."refund_reason_id" = reason."id"
      on conflict ("id") do nothing;
    `)
    this.addSql(`
      update "refund" refund
      set "refund_reason_id" =
        'refr_' || substr(md5(refund."refund_reason_id" || refund."store_id"), 1, 26)
      where refund."refund_reason_id" is not null
        and refund."store_id" <> '__medusa_dedicated__';
    `)
    this.addSql(
      `alter table "refund" add constraint "refund_refund_reason_id_store_foreign" foreign key ("refund_reason_id", "store_id") references "refund_reason" ("id", "store_id") on update restrict on delete restrict;`
    )
    this.addSql(
      `create trigger "TR_refund_reason_store_owner" before insert or update of "store_id" on "refund_reason" for each row execute function "medusa_payment_store_owner"();`
    )
    this.addSql(`alter table "refund_reason" enable row level security;`)
    this.addSql(`alter table "refund_reason" force row level security;`)
    this.addSql(
      `create policy "POL_refund_reason_store_isolation" on "refund_reason" for all using ("store_id" = "medusa_payment_active_store_id"()) with check ("store_id" = "medusa_payment_active_store_id"());`
    )
    requestRoleMigration.up.forEach((sql) => this.addSql(sql))
  }

  override async down(): Promise<void> {
    requestRoleMigration.down.forEach((sql) => this.addSql(sql))
    this.addSql(
      `drop policy if exists "POL_refund_reason_store_isolation" on "refund_reason";`
    )
    this.addSql(`alter table "refund_reason" no force row level security;`)
    this.addSql(`alter table "refund_reason" disable row level security;`)
    this.addSql(
      `drop trigger if exists "TR_refund_reason_store_owner" on "refund_reason";`
    )
    this.addSql(
      `alter table "refund" drop constraint if exists "refund_refund_reason_id_store_foreign";`
    )
    this.addSql(`drop index if exists "IDX_refund_reason_id_store_id";`)
    this.addSql(
      `alter table if exists "refund_reason" drop column if exists "store_id";`
    )
  }
}
