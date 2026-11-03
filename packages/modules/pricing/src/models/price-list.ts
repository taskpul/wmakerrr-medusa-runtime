import {
  model,
  PriceListStatus,
  PriceListType,
} from "@medusajs/framework/utils"
import { DEDICATED_STORE_ID } from "../store-ownership"
import Price from "./price"
import PriceListRule from "./price-list-rule"

const PriceList = model
  .define("PriceList", {
    id: model.id({ prefix: "plist" }).primaryKey(),
    store_id: model.text().default(DEDICATED_STORE_ID),
    title: model.text().searchable(),
    description: model.text().searchable(),
    status: model.enum(PriceListStatus).default(PriceListStatus.DRAFT),
    type: model.enum(PriceListType).default(PriceListType.SALE),
    starts_at: model.dateTime().nullable(),
    ends_at: model.dateTime().nullable(),
    rules_count: model.number().default(0).nullable(),
    prices: model.hasMany(() => Price, {
      mappedBy: "price_list",
    }),
    price_list_rules: model.hasMany(() => PriceListRule, {
      mappedBy: "price_list",
    }),
    metadata: model.json().nullable(),
  })
  .cascades({
    delete: ["price_list_rules", "prices"],
  })
  .indexes([
    {
      name: "IDX_price_list_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      on: ["id", "status", "starts_at", "ends_at"],
      where: "deleted_at IS NULL AND status = 'active'",
    },
  ])

export default PriceList
