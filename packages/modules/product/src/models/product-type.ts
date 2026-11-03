import { model } from "@medusajs/framework/utils"
import { Product } from "@models"
import { PRODUCT_DEDICATED_STORE_ID } from "../store-ownership"

const ProductType = model
  .define("ProductType", {
    id: model.id({ prefix: "ptyp" }).primaryKey(),
    store_id: model.text().default(PRODUCT_DEDICATED_STORE_ID),
    value: model.text().searchable().translatable(),
    external_id: model.text().nullable(),
    metadata: model.json().nullable(),
    products: model.hasMany(() => Product, {
      mappedBy: "type",
    }),
  })
  .indexes([
    {
      name: "IDX_product_type_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_type_value_unique",
      on: ["store_id", "value"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default ProductType
