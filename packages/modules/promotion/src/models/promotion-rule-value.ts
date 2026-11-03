import { model } from "@medusajs/framework/utils"
import PromotionRule from "./promotion-rule"
import { PROMOTION_DEDICATED_STORE_ID } from "../store-ownership"

const PromotionRuleValue = model
  .define(
    { name: "PromotionRuleValue", tableName: "promotion_rule_value" },
    {
      id: model.id({ prefix: "prorulval" }).primaryKey(),
      store_id: model.text().default(PROMOTION_DEDICATED_STORE_ID),
      value: model.text(),
      promotion_rule: model.belongsTo(() => PromotionRule, {
        mappedBy: "values",
      }),
    }
  )
  .indexes([
    {
      name: "IDX_promotion_rule_value_store_id_id",
      on: ["store_id", "id"],
      unique: true,
    },
    {
      name: "IDX_promotion_rule_value_rule_id_value",
      on: ["promotion_rule_id", "value"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_promotion_rule_value_value",
      on: ["value"],
      unique: false,
      where: "deleted_at IS NULL",
    },
  ])

export default PromotionRuleValue
