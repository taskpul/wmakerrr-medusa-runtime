import {
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework"
import { MiddlewareRoute } from "@medusajs/framework/http"
import * as QueryConfig from "./query-config"
import {
  AdminOrderChangeParams,
  AdminPostOrderChangesReqSchema,
} from "./validators"

export const adminOrderChangesRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/order-changes/:id",
    middlewares: [
      validateAndTransformBody(AdminPostOrderChangesReqSchema),
      validateAndTransformQuery(
        AdminOrderChangeParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
    ],
  },
]
