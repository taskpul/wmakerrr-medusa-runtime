import { model } from "@medusajs/framework/utils"
import CustomerAddress from "./address"
import CustomerGroup from "./customer-group"
import CustomerGroupCustomer from "./customer-group-customer"
import { CUSTOMER_DEDICATED_STORE_ID } from "../store-isolation"

const Customer = model
  .define("Customer", {
    id: model.id({ prefix: "cus" }).primaryKey(),
    store_id: model.text().default(CUSTOMER_DEDICATED_STORE_ID),
    company_name: model.text().searchable().nullable(),
    first_name: model.text().searchable().nullable(),
    last_name: model.text().searchable().nullable(),
    email: model.text().searchable().nullable(),
    phone: model.text().searchable().nullable(),
    has_account: model.boolean().default(false),
    metadata: model.json().nullable(),
    created_by: model.text().nullable(),
    groups: model.manyToMany(() => CustomerGroup, {
      mappedBy: "customers",
      pivotEntity: () => CustomerGroupCustomer,
    }),
    addresses: model.hasMany(() => CustomerAddress, {
      mappedBy: "customer",
    }),
  })
  .cascades({
    delete: ["addresses"],
    detach: ["groups"],
  })
  .indexes([
    {
      on: ["store_id", "email", "has_account"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_customer_store_id_id",
      on: ["store_id", "id"],
      unique: true,
    },
  ])

export default Customer
