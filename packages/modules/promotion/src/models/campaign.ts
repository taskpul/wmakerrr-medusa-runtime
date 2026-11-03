import { model } from "@medusajs/framework/utils"
import CampaignBudget from "./campaign-budget"
import Promotion from "./promotion"
import { PROMOTION_DEDICATED_STORE_ID } from "../store-ownership"

const Campaign = model
  .define(
    { name: "Campaign", tableName: "promotion_campaign" },
    {
      id: model.id({ prefix: "procamp" }).primaryKey(),
      store_id: model.text().default(PROMOTION_DEDICATED_STORE_ID),
      name: model.text().searchable(),
      description: model.text().searchable().nullable(),
      campaign_identifier: model.text(),
      starts_at: model.dateTime().nullable(),
      ends_at: model.dateTime().nullable(),
      budget: model
        .hasOne<() => typeof CampaignBudget>(() => CampaignBudget, {
          mappedBy: "campaign",
        })
        .nullable(),
      promotions: model.hasMany(() => Promotion, {
        mappedBy: "campaign",
      }),
    }
  )
  .cascades({
    delete: ["budget"],
  })
  .indexes([
    {
      on: ["store_id", "campaign_identifier"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_promotion_campaign_store_id_id",
      on: ["store_id", "id"],
      unique: true,
    },
  ])

export default Campaign
