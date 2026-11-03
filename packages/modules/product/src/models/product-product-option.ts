import { model } from "@medusajs/framework/utils"
import { PRODUCT_DEDICATED_STORE_ID } from "../store-ownership"
import Product from "./product"
import ProductOption from "./product-option"
import ProductOptionValue from "./product-option-value"
import ProductProductOptionValue from "./product-product-option-value"

/**
 * @since 2.16.0
 */
const ProductProductOption = model
  .define("ProductProductOption", {
    id: model.id({ prefix: "prodopt" }).primaryKey(),
    store_id: model.text().default(PRODUCT_DEDICATED_STORE_ID),
    product: model.belongsTo(() => Product, {
      mappedBy: "options",
    }),
    product_option: model.belongsTo(() => ProductOption, {
      mappedBy: "products",
    }),
    values: model.manyToMany(() => ProductOptionValue, {
      pivotEntity: () => ProductProductOptionValue,
    }),
  })
  .indexes([
    {
      name: "IDX_product_product_option_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default ProductProductOption
