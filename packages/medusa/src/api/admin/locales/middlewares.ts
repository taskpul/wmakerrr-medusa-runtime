import { validateAndTransformQuery } from "@medusajs/framework"
import { MiddlewareRoute } from "@medusajs/framework/http"
import * as QueryConfig from "./query-config"
import { AdminGetLocaleParams, AdminGetLocalesParams } from "./validators"

export const adminLocalesRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/locales",
    middlewares: [
      validateAndTransformQuery(
        AdminGetLocalesParams,
        QueryConfig.listTransformQueryConfig
      ),
    ],
  },
  {
    method: ["GET"],
    matcher: "/admin/locales/:code",
    middlewares: [
      validateAndTransformQuery(
        AdminGetLocaleParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
    ],
  },
]
