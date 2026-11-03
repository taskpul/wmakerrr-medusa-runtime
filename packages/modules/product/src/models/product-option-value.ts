import { model } from "@medusajs/framework/utils"
import { PRODUCT_DEDICATED_STORE_ID } from "../store-ownership"
import ProductOption from "./product-option"
import ProductProductOption from "./product-product-option"
import ProductProductOptionValue from "./product-product-option-value"
import ProductVariant from "./product-variant"

const ProductOptionValue = model
  .define("ProductOptionValue", {
    id: model.id({ prefix: "optval" }).primaryKey(),
    store_id: model.text().default(PRODUCT_DEDICATED_STORE_ID),
    value: model.text().searchable().translatable(),
    /**
     * @since 2.16.0
     */
    rank: model.number().nullable(),
    metadata: model.json().nullable(),
    option: model
      .belongsTo(() => ProductOption, {
        mappedBy: "values",
      })
      .nullable(),
    variants: model.manyToMany(() => ProductVariant, {
      mappedBy: "options",
    }),
    /**
     * @since 2.16.0
     */
    product_options: model.manyToMany(() => ProductProductOption, {
      pivotEntity: () => ProductProductOptionValue,
      mappedBy: "values",
    }),
  })
  .indexes([
    {
      name: "IDX_product_option_value_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_option_value_option_id_unique",
      on: ["store_id", "option_id", "value"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default ProductOptionValue
