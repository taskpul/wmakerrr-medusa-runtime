import { model } from "@medusajs/framework/utils"
import InventoryItem from "./inventory-item"
import { INVENTORY_DEDICATED_STORE_ID } from "../store-ownership"

const ReservationItem = model
  .define("ReservationItem", {
    id: model.id({ prefix: "resitem" }).primaryKey(),
    store_id: model.text().default(INVENTORY_DEDICATED_STORE_ID),
    line_item_id: model.text().nullable(),
    allow_backorder: model.boolean().default(false),
    location_id: model.text(),
    quantity: model.bigNumber(),
    raw_quantity: model.json(),
    external_id: model.text().nullable(),
    description: model.text().searchable().nullable(),
    created_by: model.text().nullable(),
    metadata: model.json().nullable(),
    inventory_item: model
      .belongsTo(() => InventoryItem, {
        mappedBy: "reservation_items",
      })
      .searchable(),
  })
  .indexes([
    {
      name: "IDX_reservation_item_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_reservation_item_store_line_item_id",
      on: ["store_id", "line_item_id"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_reservation_item_store_location_id",
      on: ["store_id", "location_id"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_reservation_item_store_inventory_item_id",
      on: ["store_id", "inventory_item_id"],
      where: "deleted_at IS NULL",
    },
  ])

export default ReservationItem
