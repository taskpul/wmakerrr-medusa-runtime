import { model } from "@medusajs/framework/utils"
import { DEDICATED_STORE_ID } from "../store-ownership"
import Price from "./price"

const PriceSet = model
  .define("PriceSet", {
    id: model.id({ prefix: "pset" }).primaryKey(),
    store_id: model.text().default(DEDICATED_STORE_ID),
    prices: model.hasMany(() => Price, {
      mappedBy: "price_set",
    }),
  })
  .cascades({
    delete: ["prices"],
  })
  .indexes([
    {
      name: "IDX_price_set_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default PriceSet
