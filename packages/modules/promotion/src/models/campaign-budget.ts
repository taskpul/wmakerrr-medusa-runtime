import { PromotionUtils, model } from "@medusajs/framework/utils"
import Campaign from "./campaign"
import CampaignBudgetUsage from "./campaign-budget-usage"
import { PROMOTION_DEDICATED_STORE_ID } from "../store-ownership"

const CampaignBudget = model
  .define(
    { name: "CampaignBudget", tableName: "promotion_campaign_budget" },
    {
      id: model.id({ prefix: "probudg" }).primaryKey(),
      store_id: model.text().default(PROMOTION_DEDICATED_STORE_ID),
      type: model
        .enum(PromotionUtils.CampaignBudgetType)
        .index("IDX_campaign_budget_type"),
      currency_code: model.text().nullable(),
      limit: model.bigNumber().nullable(),
      used: model.bigNumber().default(0),
      campaign: model.belongsTo(() => Campaign, {
        mappedBy: "budget",
      }),

      /**
       * @since 2.11.0
       */
      attribute: model.text().nullable(), // e.g. "customer_id", "customer_email"

      // usages when budget type is "limit/use by attribute"
      /**
       * @since 2.11.0
       */
      usages: model.hasMany(() => CampaignBudgetUsage, {
        mappedBy: "budget",
      }),
    }
  )
  .cascades({
    delete: ["usages"],
  })
  .indexes([
    {
      name: "IDX_promotion_campaign_budget_store_id_id",
      on: ["store_id", "id"],
      unique: true,
    },
  ])

export default CampaignBudget
