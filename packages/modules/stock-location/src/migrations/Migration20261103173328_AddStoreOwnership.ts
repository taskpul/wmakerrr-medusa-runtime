import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261103173328_AddStoreOwnership extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "stock_location_address" add column if not exists "store_id" text not null default '__medusa_dedicated__';`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_stock_location_address_store_id_id" ON "stock_location_address" ("store_id", "id") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "stock_location" add column if not exists "store_id" text not null default '__medusa_dedicated__';`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_stock_location_store_id_id" ON "stock_location" ("store_id", "id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_stock_location_address_store_id_id";`);
    this.addSql(`alter table if exists "stock_location_address" drop column if exists "store_id";`);

    this.addSql(`drop index if exists "IDX_stock_location_store_id_id";`);
    this.addSql(`alter table if exists "stock_location" drop column if exists "store_id";`);
  }

}
