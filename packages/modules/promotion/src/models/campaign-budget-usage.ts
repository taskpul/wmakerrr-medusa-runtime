import { model } from "@medusajs/framework/utils"
import CampaignBudget from "./campaign-budget"
import { PROMOTION_DEDICATED_STORE_ID } from "../store-ownership"

/**
 * @since 2.11.0
 */
const CampaignBudgetUsage = model
  .define(
    {
      name: "CampaignBudgetUsage",
      tableName: "promotion_campaign_budget_usage",
    },
    {
      id: model.id({ prefix: "probudgus" }).primaryKey(),
      store_id: model.text().default(PROMOTION_DEDICATED_STORE_ID),
      attribute_value: model.text(), // e.g. "cus_123" | "john.smith@gmail.com"
      used: model.bigNumber().default(0),
      budget: model.belongsTo(() => CampaignBudget, {
        mappedBy: "usages",
      }),
    }
  )
  .indexes([
    {
      on: ["store_id", "attribute_value", "budget_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_promotion_campaign_budget_usage_store_id_id",
      on: ["store_id", "id"],
      unique: true,
    },
  ])

export default CampaignBudgetUsage
