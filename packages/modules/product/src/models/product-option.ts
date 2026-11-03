import { model } from "@medusajs/framework/utils"
import { PRODUCT_DEDICATED_STORE_ID } from "../store-ownership"
import { Product } from "./index"
import ProductOptionValue from "./product-option-value"

/**
 * A product option, such as "Color" or "Size", that organizes product variants.
 */
const ProductOption = model
  .define("ProductOption", {
    id: model.id({ prefix: "opt" }).primaryKey(),
    store_id: model.text().default(PRODUCT_DEDICATED_STORE_ID),
    /**
     * The option's display name.
     */
    title: model.text().searchable().translatable(),
    /**
     * Whether the option is exclusive to a single product. Exclusive options
     * are removed when they are no longer associated with any product.
     * @since 2.16.0
     */
    is_exclusive: model.boolean().default(false),
    /**
     * Holds custom key-value pairs associated with the option.
     */
    metadata: model.json().nullable(),
    /**
     * The products associated with this option.
     * @since 2.16.0
     */
    products: model.manyToMany(() => Product),
    /**
     * The option's values.
     */
    values: model.hasMany(() => ProductOptionValue, {
      mappedBy: "option",
    }),
  })
  .cascades({
    delete: ["values"],
    detach: ["products"],
  })
  .indexes([
    {
      name: "IDX_product_option_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_product_option_global_title_unique",
      on: ["store_id", "title"],
      unique: true,
      where: "deleted_at IS NULL AND is_exclusive = false",
    },
  ])

export default ProductOption
