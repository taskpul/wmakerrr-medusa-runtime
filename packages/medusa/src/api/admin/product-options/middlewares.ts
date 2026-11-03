import {
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework"
import { MiddlewareRoute } from "@medusajs/framework/http"
import * as QueryConfig from "./query-config"
import {
  AdminCreateProductOption,
  AdminGetProductOptionParams,
  AdminGetProductOptionsParams,
  AdminGetProductOptionValueParams,
  AdminGetProductOptionValuesParams,
  AdminUpdateProductOption,
  AdminUpdateProductOptionValue,
} from "./validators"

export const adminProductOptionRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/product-options",
    middlewares: [
      validateAndTransformQuery(
        AdminGetProductOptionsParams,
        QueryConfig.listProductOptionsTransformQueryConfig
      ),
    ],
  },
  {
    method: ["GET"],
    matcher: "/admin/product-options/:id",
    middlewares: [
      validateAndTransformQuery(
        AdminGetProductOptionParams,
        QueryConfig.retrieveProductOptionsTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/product-options",
    middlewares: [
      validateAndTransformBody(AdminCreateProductOption),
      validateAndTransformQuery(
        AdminGetProductOptionParams,
        QueryConfig.retrieveProductOptionsTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/product-options/:id",
    middlewares: [
      validateAndTransformBody(AdminUpdateProductOption),
      validateAndTransformQuery(
        AdminGetProductOptionParams,
        QueryConfig.retrieveProductOptionsTransformQueryConfig
      ),
    ],
  },
  {
    method: ["GET"],
    matcher: "/admin/product-options/:id/values",
    middlewares: [
      validateAndTransformQuery(
        AdminGetProductOptionValuesParams,
        QueryConfig.listProductOptionValuesTransformQueryConfig
      ),
    ],
  },
  {
    method: ["GET"],
    matcher: "/admin/product-options/:id/values/:value_id",
    middlewares: [
      validateAndTransformQuery(
        AdminGetProductOptionValueParams,
        QueryConfig.retrieveProductOptionValuesTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/product-options/:id/values/:value_id",
    middlewares: [
      validateAndTransformBody(AdminUpdateProductOptionValue),
      validateAndTransformQuery(
        AdminGetProductOptionValueParams,
        QueryConfig.retrieveProductOptionValuesTransformQueryConfig
      ),
    ],
  },
]
