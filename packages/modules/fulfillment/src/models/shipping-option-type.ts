import { model } from "@medusajs/framework/utils"
import { FULFILLMENT_DEDICATED_STORE_ID } from "../store-ownership"

import { ShippingOption } from "./shipping-option"

export const ShippingOptionType = model
  .define("shipping_option_type", {
    id: model.id({ prefix: "sotype" }).primaryKey(),
    store_id: model.text().default(FULFILLMENT_DEDICATED_STORE_ID),
    label: model.text().searchable().translatable(),
    description: model.text().searchable().translatable().nullable(),
    code: model.text().searchable(),
    shipping_options: model.hasMany(() => ShippingOption, {
      mappedBy: "type",
    }),
  })
  .indexes([
    {
      name: "IDX_shipping_option_type_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])
