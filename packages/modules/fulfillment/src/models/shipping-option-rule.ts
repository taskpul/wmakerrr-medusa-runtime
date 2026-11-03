import { model, RuleOperator } from "@medusajs/framework/utils"
import { FULFILLMENT_DEDICATED_STORE_ID } from "../store-ownership"
import { ShippingOption } from "./shipping-option"

export const ShippingOptionRule = model
  .define("shipping_option_rule", {
    id: model.id({ prefix: "sorul" }).primaryKey(),
    store_id: model.text().default(FULFILLMENT_DEDICATED_STORE_ID),
    attribute: model.text(),
    operator: model.enum(RuleOperator),
    value: model.json().nullable(),
    shipping_option: model.belongsTo(() => ShippingOption, {
      mappedBy: "rules",
    }),
  })
  .indexes([
    {
      name: "IDX_shipping_option_rule_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])
