import { model } from "@medusajs/framework/utils"
import { PAYMENT_DEDICATED_STORE_ID } from "../store-isolation"

const AccountHolder = model
  .define("AccountHolder", {
    id: model.id({ prefix: "acchld" }).primaryKey(),
    store_id: model.text().default(PAYMENT_DEDICATED_STORE_ID),
    provider_id: model.text(),
    external_id: model.text(),
    email: model.text().nullable(),
    data: model.json().default({}),
    metadata: model.json().nullable(),
  })
  .indexes([
    {
      on: ["store_id", "provider_id", "external_id"],
      unique: true,
    },
  ])

export default AccountHolder
