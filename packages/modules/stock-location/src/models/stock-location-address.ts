import { model } from "@medusajs/framework/utils"
import { StockLocation } from "@models"
import { STOCK_LOCATION_DEDICATED_STORE_ID } from "../store-ownership"

const StockLocationAddress = model
  .define("StockLocationAddress", {
    id: model.id({ prefix: "laddr" }).primaryKey(),
    store_id: model.text().default(STOCK_LOCATION_DEDICATED_STORE_ID),
    address_1: model.text().searchable(),
    address_2: model.text().searchable().nullable(),
    company: model.text().nullable(),
    city: model.text().searchable().nullable(),
    country_code: model.text().searchable(),
    phone: model.text().nullable(),
    province: model.text().searchable().nullable(),
    postal_code: model.text().searchable().nullable(),
    metadata: model.json().nullable(),
    stock_locations: model.hasOne(() => StockLocation, {
      mappedBy: "address",
    }),
  })
  .cascades({
    delete: ["stock_locations"],
  })
  .indexes([
    {
      name: "IDX_stock_location_address_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default StockLocationAddress
