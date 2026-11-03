import { model } from "@medusajs/framework/utils"
import { DEDICATED_STORE_ID } from "../store-ownership"
import PriceList from "./price-list"

const PriceListRule = model
  .define("PriceListRule", {
    id: model.id({ prefix: "prule" }).primaryKey(),
    store_id: model.text().default(DEDICATED_STORE_ID),
    attribute: model.text(),
    value: model.json().nullable(),
    price_list: model.belongsTo(() => PriceList, {
      mappedBy: "price_list_rules",
    }),
  })
  .indexes([
    {
      name: "IDX_price_list_rule_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      on: ["price_list_id"],
      where: "deleted_at IS NULL",
    },
    {
      on: ["attribute"],
      where: "deleted_at IS NULL",
    },
    {
      on: ["value"],
      where: "deleted_at IS NULL",
      type: "gin",
    },
  ])

export default PriceListRule
