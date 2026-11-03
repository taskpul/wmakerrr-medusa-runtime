import { model } from "@medusajs/framework/utils"
import { FULFILLMENT_DEDICATED_STORE_ID } from "../store-ownership"

import { Fulfillment } from "./fulfillment"

export const FulfillmentItem = model
  .define("fulfillment_item", {
    id: model.id({ prefix: "fulit" }).primaryKey(),
    store_id: model.text().default(FULFILLMENT_DEDICATED_STORE_ID),
    title: model.text(),
    sku: model.text(),
    barcode: model.text(),
    quantity: model.bigNumber(),
    line_item_id: model.text().nullable(),
    inventory_item_id: model.text().nullable(),
    fulfillment: model.belongsTo(() => Fulfillment, {
      mappedBy: "items",
    }),
  })
  .indexes([
    {
      name: "IDX_fulfillment_item_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      on: ["store_id", "inventory_item_id"],
      where: "deleted_at IS NULL",
    },
    {
      on: ["store_id", "line_item_id"],
      where: "deleted_at IS NULL",
    },
  ])
