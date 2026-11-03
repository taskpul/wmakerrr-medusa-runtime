import { model } from "@medusajs/framework/utils"
import { PRODUCT_DEDICATED_STORE_ID } from "../store-ownership"
import Product from "./product"

const ProductCollection = model
  .define("ProductCollection", {
    id: model.id({ prefix: "pcol" }).primaryKey(),
    store_id: model.text().default(PRODUCT_DEDICATED_STORE_ID),
    title: model.text().searchable().translatable(),
    handle: model.text(),
    external_id: model.text().nullable(),
    metadata: model.json().nullable(),
    products: model.hasMany(() => Product, {
      mappedBy: "collection",
    }),
  })
  .indexes([
    {
      name: "IDX_product_collection_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_collection_handle_unique",
      on: ["store_id", "handle"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default ProductCollection
