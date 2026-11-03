import {
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework"
import { MiddlewareRoute } from "@medusajs/framework/http"
import * as QueryConfig from "./query-config"
import {
  AdminCreateProductType,
  AdminGetProductTypeParams,
  AdminGetProductTypesParams,
  AdminUpdateProductType,
} from "./validators"

export const adminProductTypeRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/product-types",
    middlewares: [
      validateAndTransformQuery(
        AdminGetProductTypesParams,
        QueryConfig.listProductTypesTransformQueryConfig
      ),
    ],
  },
  {
    method: ["GET"],
    matcher: "/admin/product-types/:id",
    middlewares: [
      validateAndTransformQuery(
        AdminGetProductTypeParams,
        QueryConfig.retrieveProductTypeTransformQueryConfig
      ),
    ],
  },
  // Create/update/delete methods are new in v2
  {
    method: ["POST"],
    matcher: "/admin/product-types",
    middlewares: [
      validateAndTransformBody(AdminCreateProductType),
      validateAndTransformQuery(
        AdminGetProductTypeParams,
        QueryConfig.retrieveProductTypeTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/product-types/:id",
    middlewares: [
      validateAndTransformBody(AdminUpdateProductType),
      validateAndTransformQuery(
        AdminGetProductTypeParams,
        QueryConfig.retrieveProductTypeTransformQueryConfig
      ),
    ],
  },
]
