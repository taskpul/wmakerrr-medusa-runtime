import { model } from "@medusajs/framework/utils"
import Payment from "./payment"
import { PAYMENT_DEDICATED_STORE_ID } from "../store-isolation"

const Capture = model
  .define("Capture", {
    id: model.id({ prefix: "capt" }).primaryKey(),
    store_id: model.text().default(PAYMENT_DEDICATED_STORE_ID),
    amount: model.bigNumber(),
    payment: model.belongsTo(() => Payment, {
      mappedBy: "captures",
    }),
    metadata: model.json().nullable(),
    created_by: model.text().nullable(),
  })
  .indexes([
    {
      name: "IDX_capture_payment_id",
      on: ["payment_id"],
    },
  ])

export default Capture
