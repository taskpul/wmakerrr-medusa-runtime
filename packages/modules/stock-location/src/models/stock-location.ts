import { model } from "@medusajs/framework/utils"
import StockLocationAddress from "./stock-location-address"
import { STOCK_LOCATION_DEDICATED_STORE_ID } from "../store-ownership"

const StockLocation = model
  .define("StockLocation", {
    id: model.id({ prefix: "sloc" }).primaryKey(),
    store_id: model.text().default(STOCK_LOCATION_DEDICATED_STORE_ID),
    name: model.text().searchable(),
    metadata: model.json().nullable(),
    address: model
      .belongsTo(() => StockLocationAddress, {
        mappedBy: "stock_locations",
      })
      .searchable()
      .nullable(),
  })
  .indexes([
    {
      name: "IDX_stock_location_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default StockLocation
