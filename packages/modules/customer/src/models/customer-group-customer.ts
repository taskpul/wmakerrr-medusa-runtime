import { model } from "@medusajs/framework/utils"
import Customer from "./customer"
import CustomerGroup from "./customer-group"
import { CUSTOMER_DEDICATED_STORE_ID } from "../store-isolation"

const CustomerGroupCustomer = model
  .define("CustomerGroupCustomer", {
    id: model.id({ prefix: "cusgc" }).primaryKey(),
    store_id: model.text().default(CUSTOMER_DEDICATED_STORE_ID),
    created_by: model.text().nullable(),
    metadata: model.json().nullable(),
    customer: model.belongsTo(() => Customer, {
      mappedBy: "groups",
    }),
    customer_group: model.belongsTo(() => CustomerGroup, {
      mappedBy: "customers",
    }),
  })
  .indexes([
    {
      name: "IDX_customer_group_customer_store_id_id",
      on: ["store_id", "id"],
      unique: true,
    },
  ])

export default CustomerGroupCustomer
