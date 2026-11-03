import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261103173322_AddStoreOwnership extends Migration {

  override async up(): Promise<void> {
    this.addSql(`drop index if exists "IDX_inventory_item_sku";`);

    this.addSql(`alter table if exists "inventory_item" add column if not exists "store_id" text not null default '__medusa_dedicated__';`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_inventory_item_store_id_id" ON "inventory_item" ("store_id", "id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_inventory_item_store_id_sku" ON "inventory_item" ("store_id", "sku") WHERE deleted_at IS NULL AND sku IS NOT NULL;`);

    this.addSql(`drop index if exists "IDX_inventory_level_location_id";`);
    this.addSql(`drop index if exists "IDX_inventory_level_location_id_inventory_item_id";`);

    this.addSql(`alter table if exists "inventory_level" add column if not exists "store_id" text not null default '__medusa_dedicated__';`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_inventory_level_store_id_id" ON "inventory_level" ("store_id", "id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_inventory_level_store_inventory_item_id" ON "inventory_level" ("store_id", "inventory_item_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_inventory_level_store_location_id" ON "inventory_level" ("store_id", "location_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_inventory_level_store_location_inventory_item" ON "inventory_level" ("store_id", "inventory_item_id", "location_id") WHERE deleted_at IS NULL;`);

    this.addSql(`drop index if exists "IDX_reservation_item_line_item_id";`);
    this.addSql(`drop index if exists "IDX_reservation_item_location_id";`);

    this.addSql(`alter table if exists "reservation_item" add column if not exists "store_id" text not null default '__medusa_dedicated__';`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_reservation_item_store_id_id" ON "reservation_item" ("store_id", "id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_reservation_item_store_line_item_id" ON "reservation_item" ("store_id", "line_item_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_reservation_item_store_location_id" ON "reservation_item" ("store_id", "location_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_reservation_item_store_inventory_item_id" ON "reservation_item" ("store_id", "inventory_item_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_inventory_item_store_id_id";`);
    this.addSql(`drop index if exists "IDX_inventory_item_store_id_sku";`);
    this.addSql(`alter table if exists "inventory_item" drop column if exists "store_id";`);

    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_inventory_item_sku" ON "inventory_item" ("sku") WHERE deleted_at IS NULL;`);

    this.addSql(`drop index if exists "IDX_inventory_level_store_id_id";`);
    this.addSql(`drop index if exists "IDX_inventory_level_store_inventory_item_id";`);
    this.addSql(`drop index if exists "IDX_inventory_level_store_location_id";`);
    this.addSql(`drop index if exists "IDX_inventory_level_store_location_inventory_item";`);
    this.addSql(`alter table if exists "inventory_level" drop column if exists "store_id";`);

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_inventory_level_location_id" ON "inventory_level" ("location_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_inventory_level_location_id_inventory_item_id" ON "inventory_level" ("inventory_item_id", "location_id") WHERE deleted_at IS NULL;`);

    this.addSql(`drop index if exists "IDX_reservation_item_store_id_id";`);
    this.addSql(`drop index if exists "IDX_reservation_item_store_line_item_id";`);
    this.addSql(`drop index if exists "IDX_reservation_item_store_location_id";`);
    this.addSql(`drop index if exists "IDX_reservation_item_store_inventory_item_id";`);
    this.addSql(`alter table if exists "reservation_item" drop column if exists "store_id";`);

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_reservation_item_line_item_id" ON "reservation_item" ("line_item_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_reservation_item_location_id" ON "reservation_item" ("location_id") WHERE deleted_at IS NULL;`);
  }

}
