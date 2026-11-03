import { model } from "@medusajs/framework/utils"
import { PRODUCT_DEDICATED_STORE_ID } from "../store-ownership"
import ProductVariant from "./product-variant"
import ProductImage from "./product-image"

/**
 * @since 2.11.2
 */
const ProductVariantProductImage = model
  .define("ProductVariantProductImage", {
    id: model.id({ prefix: "pvpi" }).primaryKey(),
    store_id: model.text().default(PRODUCT_DEDICATED_STORE_ID),
    variant: model.belongsTo(() => ProductVariant, {
      mappedBy: "images",
    }),
    image: model.belongsTo(() => ProductImage, {
      mappedBy: "variants",
    }),
  })
  .indexes([
    {
      name: "IDX_product_variant_product_image_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])

export default ProductVariantProductImage
