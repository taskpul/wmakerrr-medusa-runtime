import {
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework"
import { MiddlewareRoute } from "@medusajs/framework/http"
import * as queryConfig from "./query-config"
import {
  AdminCreatePaymentCollection,
  AdminGetPaymentCollectionParams,
  AdminInitializePaymentSession,
  AdminMarkPaymentCollectionPaid,
} from "./validators"

export const adminPaymentCollectionsMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/payment-collections",
    middlewares: [
      validateAndTransformBody(AdminCreatePaymentCollection),
      validateAndTransformQuery(
        AdminGetPaymentCollectionParams,
        queryConfig.retrievePaymentCollectionTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/payment-collections/:id/mark-as-paid",
    middlewares: [
      validateAndTransformBody(AdminMarkPaymentCollectionPaid),
      validateAndTransformQuery(
        AdminGetPaymentCollectionParams,
        queryConfig.retrievePaymentCollectionTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/payment-collections/:id/payment-sessions",
    middlewares: [
      validateAndTransformBody(AdminInitializePaymentSession),
      validateAndTransformQuery(
        AdminGetPaymentCollectionParams,
        queryConfig.retrievePaymentCollectionTransformQueryConfig
      ),
    ],
  },
]
