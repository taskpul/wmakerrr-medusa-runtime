import { model } from "@medusajs/framework/utils"
import { FULFILLMENT_DEDICATED_STORE_ID } from "../store-ownership"

import { ServiceZone } from "./service-zone"

export const FulfillmentSet = model
  .define("fulfillment_set", {
    id: model.id({ prefix: "fuset" }).primaryKey(),
    store_id: model.text().default(FULFILLMENT_DEDICATED_STORE_ID),
    name: model.text(),
    type: model.text(),
    service_zones: model.hasMany(() => ServiceZone, {
      mappedBy: "fulfillment_set",
    }),
    metadata: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_fulfillment_set_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_fulfillment_set_name_unique",
      on: ["store_id", "name"],
      where: "deleted_at IS NULL",
      unique: true,
    },
  ])
  .cascades({
    delete: ["service_zones"],
  })
