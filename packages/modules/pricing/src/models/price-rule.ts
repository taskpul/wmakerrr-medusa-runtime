import { model, PricingRuleOperator } from "@medusajs/framework/utils"
import { DEDICATED_STORE_ID } from "../store-ownership"
import Price from "./price"

const PriceRule = model
  .define("PriceRule", {
    id: model.id({ prefix: "prule" }).primaryKey(),
    store_id: model.text().default(DEDICATED_STORE_ID),
    attribute: model.text(),
    value: model.text(),
    operator: model.enum(PricingRuleOperator).default(PricingRuleOperator.EQ),
    priority: model.number().default(0),
    price: model.belongsTo(() => Price, {
      mappedBy: "price_rules",
    }),
  })
  .indexes([
    {
      name: "IDX_price_rule_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      on: ["price_id", "attribute", "operator"],
      where: "deleted_at IS NULL",
      unique: true,
    },
    {
      on: ["attribute"],
      where: "deleted_at IS NULL",
    },
    {
      on: ["attribute", "value"],
      where: "deleted_at IS NULL",
    },
    {
      on: ["operator", "value"],
      where: "deleted_at IS NULL",
    },
    {
      on: ["attribute", "value", "price_id"],
      where: "deleted_at IS NULL",
    },
  ])

export default PriceRule
