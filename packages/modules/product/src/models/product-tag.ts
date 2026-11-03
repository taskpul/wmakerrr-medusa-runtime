import { model } from "@medusajs/framework/utils"
import { PRODUCT_DEDICATED_STORE_ID } from "../store-ownership"
import Product from "./product"

const ProductTag = model
  .define(
    { tableName: "product_tag", name: "ProductTag" },
    {
      id: model.id({ prefix: "ptag" }).primaryKey(),
      store_id: model.text().default(PRODUCT_DEDICATED_STORE_ID),
      value: model.text().searchable().translatable(),
      external_id: model.text().nullable(),
      metadata: model.json().nullable(),
      products: model.manyToMany(() => Product, {
        mappedBy: "tags",
      }),
    }
  )
  .indexes([
    {
      name: "IDX_product_tag_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_tag_value_unique",
      on: ["store_id", "value"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default ProductTag
