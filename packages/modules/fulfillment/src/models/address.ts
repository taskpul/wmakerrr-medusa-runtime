import { model } from "@medusajs/framework/utils"
import { FULFILLMENT_DEDICATED_STORE_ID } from "../store-ownership"

export const FulfillmentAddress = model
  .define("fulfillment_address", {
    id: model.id({ prefix: "fuladdr" }).primaryKey(),
    store_id: model.text().default(FULFILLMENT_DEDICATED_STORE_ID),
    company: model.text().nullable(),
    first_name: model.text().nullable(),
    last_name: model.text().nullable(),
    address_1: model.text().nullable(),
    address_2: model.text().nullable(),
    city: model.text().nullable(),
    country_code: model.text().nullable(),
    province: model.text().nullable(),
    postal_code: model.text().nullable(),
    phone: model.text().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_fulfillment_address_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])
