import { model } from "@medusajs/framework/utils"
import { PRODUCT_DEDICATED_STORE_ID } from "../store-ownership"
import Product from "./product"

const ProductCategory = model
  .define("ProductCategory", {
    id: model.id({ prefix: "pcat" }).primaryKey(),
    store_id: model.text().default(PRODUCT_DEDICATED_STORE_ID),
    name: model.text().searchable().translatable(),
    description: model.text().searchable().translatable().default(""),
    handle: model.text().searchable(),
    mpath: model.text(),
    is_active: model.boolean().default(false),
    is_internal: model.boolean().default(false),
    rank: model.number().default(0),
    external_id: model.text().nullable(),
    metadata: model.json().nullable(),
    parent_category: model
      .belongsTo(() => ProductCategory, {
        mappedBy: "category_children",
      })
      .nullable(),
    category_children: model.hasMany(() => ProductCategory, {
      mappedBy: "parent_category",
    }),
    products: model.manyToMany(() => Product, {
      mappedBy: "categories",
    }),
  })
  .cascades({
    delete: ["category_children"],
  })
  .indexes([
    {
      name: "IDX_product_category_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_product_category_path",
      on: ["store_id", "mpath"],
      unique: false,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_category_handle_unique",
      on: ["store_id", "handle"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default ProductCategory
