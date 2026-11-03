import { model } from "@medusajs/framework/utils"
import { FULFILLMENT_DEDICATED_STORE_ID } from "../store-ownership"

import { ShippingOption } from "./shipping-option"

export const ShippingProfile = model
  .define("shipping_profile", {
    id: model.id({ prefix: "sp" }).primaryKey(),
    store_id: model.text().default(FULFILLMENT_DEDICATED_STORE_ID),
    name: model.text(),
    type: model.text(),
    shipping_options: model.hasMany(() => ShippingOption, {
      mappedBy: "shipping_profile",
    }),
    metadata: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_shipping_profile_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_shipping_profile_name_unique",
      on: ["store_id", "name"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])
