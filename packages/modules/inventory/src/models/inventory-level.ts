import { model } from "@medusajs/framework/utils"
import InventoryItem from "./inventory-item"
import { INVENTORY_DEDICATED_STORE_ID } from "../store-ownership"

const InventoryLevel = model
  .define("InventoryLevel", {
    id: model.id({ prefix: "ilev" }).primaryKey(),
    store_id: model.text().default(INVENTORY_DEDICATED_STORE_ID),
    location_id: model.text(),
    stocked_quantity: model.bigNumber().default(0),
    reserved_quantity: model.bigNumber().default(0),
    incoming_quantity: model.bigNumber().default(0),
    metadata: model.json().nullable(),
    inventory_item: model.belongsTo(() => InventoryItem, {
      mappedBy: "location_levels",
    }),
    available_quantity: model.bigNumber().computed(),
  })
  .indexes([
    {
      name: "IDX_inventory_level_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_inventory_level_store_inventory_item_id",
      on: ["store_id", "inventory_item_id"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_inventory_level_store_location_id",
      on: ["store_id", "location_id"],
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_inventory_level_store_location_inventory_item",
      on: ["store_id", "inventory_item_id", "location_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default InventoryLevel
