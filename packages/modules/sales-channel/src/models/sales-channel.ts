import { model } from "@medusajs/framework/utils"
import { SALES_CHANNEL_DEDICATED_STORE_ID } from "../store-isolation"

const SalesChannel = model.define("SalesChannel", {
  id: model.id({ prefix: "sc" }).primaryKey(),
  store_id: model.text().default(SALES_CHANNEL_DEDICATED_STORE_ID),
  name: model.text().searchable(),
  description: model.text().searchable().nullable(),
  is_disabled: model.boolean().default(false),
  metadata: model.json().nullable(),
})

export default SalesChannel
