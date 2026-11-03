import {
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework"
import { MiddlewareRoute } from "@medusajs/framework/http"
import * as queryConfig from "./query-config"
import {
  AdminCreatePaymentRefundReason,
  AdminGetRefundReasonParams,
  AdminGetRefundReasonsParams,
  AdminUpdatePaymentRefundReason,
} from "./validators"

export const adminRefundReasonsRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/refund-reasons",
    middlewares: [
      validateAndTransformQuery(
        AdminGetRefundReasonsParams,
        queryConfig.listTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/refund-reasons",
    middlewares: [
      validateAndTransformBody(AdminCreatePaymentRefundReason),
      validateAndTransformQuery(
        AdminGetRefundReasonsParams,
        queryConfig.retrieveTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/refund-reasons/:id",
    middlewares: [
      validateAndTransformBody(AdminUpdatePaymentRefundReason),
      validateAndTransformQuery(
        AdminGetRefundReasonParams,
        queryConfig.retrieveTransformQueryConfig
      ),
    ],
  },
  {
    method: ["GET"],
    matcher: "/admin/refund-reasons/:id",
    middlewares: [
      validateAndTransformQuery(
        AdminGetRefundReasonsParams,
        queryConfig.retrieveTransformQueryConfig
      ),
    ],
  },
  {
    method: ["DELETE"],
    matcher: "/admin/refund-reasons/:id",
    middlewares: [
      validateAndTransformQuery(
        AdminGetRefundReasonsParams,
        queryConfig.retrieveTransformQueryConfig
      ),
    ],
  },
]
