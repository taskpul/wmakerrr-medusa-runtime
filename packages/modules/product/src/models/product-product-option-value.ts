import { model } from "@medusajs/framework/utils"
import { PRODUCT_DEDICATED_STORE_ID } from "../store-ownership"
import ProductOptionValue from "./product-option-value"
import ProductProductOption from "./product-product-option"

/**
 * @since 2.16.0
 */
const ProductProductOptionValue = model
  .define("ProductProductOptionValue", {
    id: model.id({ prefix: "prodoptval" }).primaryKey(),
    store_id: model.text().default(PRODUCT_DEDICATED_STORE_ID),
    product_product_option: model.belongsTo(() => ProductProductOption, {
      mappedBy: "values",
    }),
    product_option_value: model.belongsTo(() => ProductOptionValue, {
      mappedBy: "product_options",
    }),
  })
  .indexes([
    {
      name: "IDX_product_product_option_value_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      /**
       * Non-partial companion to the partial index generated for the
       * `product_product_option` relationship. Postgres runs the ON UPDATE /
       * ON DELETE CASCADE checks for this foreign key without a deleted_at
       * predicate, so it can only use an index that is not scoped to
       * `deleted_at IS NULL`.
       */
      name: "IDX_product_product_option_value_product_product_option_id_fk",
      on: ["product_product_option_id"],
      where: null,
    },
  ])

export default ProductProductOptionValue
