import { model } from "@medusajs/framework/utils"
import { FULFILLMENT_DEDICATED_STORE_ID } from "../store-ownership"

import { Fulfillment } from "./fulfillment"

export const FulfillmentLabel = model
  .define("fulfillment_label", {
    id: model.id({ prefix: "fulla" }).primaryKey(),
    store_id: model.text().default(FULFILLMENT_DEDICATED_STORE_ID),
    tracking_number: model.text(),
    tracking_url: model.text(),
    label_url: model.text(),
    fulfillment: model.belongsTo(() => Fulfillment, {
      mappedBy: "labels",
    }),
  })
  .indexes([
    {
      name: "IDX_fulfillment_label_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])
