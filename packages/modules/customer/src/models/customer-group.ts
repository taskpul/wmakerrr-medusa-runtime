import { model } from "@medusajs/framework/utils"
import Customer from "./customer"
import { CustomerGroupCustomer } from "@models"
import { CUSTOMER_DEDICATED_STORE_ID } from "../store-isolation"

const CustomerGroup = model
  .define("CustomerGroup", {
    id: model.id({ prefix: "cusgroup" }).primaryKey(),
    store_id: model.text().default(CUSTOMER_DEDICATED_STORE_ID),
    name: model.text().searchable().translatable(),
    metadata: model.json().nullable(),
    created_by: model.text().nullable(),
    customers: model.manyToMany(() => Customer, {
      mappedBy: "groups",
      pivotEntity: () => CustomerGroupCustomer,
    }),
  })
  .indexes([
    {
      on: ["store_id", "name"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_customer_group_store_id_id",
      on: ["store_id", "id"],
      unique: true,
    },
  ])
  .cascades({
    detach: ["customers"],
  })

export default CustomerGroup
