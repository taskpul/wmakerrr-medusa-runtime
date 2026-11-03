import { model } from "@medusajs/framework/utils"
import { DEDICATED_STORE_ID } from "../store-ownership"

const PricePreference = model
  .define("PricePreference", {
    id: model.id({ prefix: "prpref" }).primaryKey(),
    store_id: model.text().default(DEDICATED_STORE_ID),
    attribute: model.text(),
    value: model.text().nullable(),
    is_tax_inclusive: model.boolean().default(false),
  })
  .indexes([
    {
      name: "IDX_price_preference_store_attribute_value",
      on: ["store_id", "attribute", "value"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default PricePreference
