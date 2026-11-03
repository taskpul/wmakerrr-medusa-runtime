import {
  MiddlewareRoute,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import {
  AdminPostOrderEditsAddItemsReqSchema,
  AdminPostOrderEditsItemsActionReqSchema,
  AdminPostOrderEditsReqSchema,
  AdminPostOrderEditsRequestReqSchema,
  AdminPostOrderEditsShippingActionReqSchema,
  AdminPostOrderEditsShippingReqSchema,
  AdminPostOrderEditsUpdateItemQuantityReqSchema,
} from "./validators"

export const adminOrderEditRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/order-edits",
    middlewares: [validateAndTransformBody(AdminPostOrderEditsReqSchema)],
  },

  {
    method: ["POST"],
    matcher: "/admin/order-edits/:id/items",
    middlewares: [
      validateAndTransformBody(AdminPostOrderEditsAddItemsReqSchema),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/order-edits/:id/items/:action_id",
    middlewares: [
      validateAndTransformBody(AdminPostOrderEditsItemsActionReqSchema),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/order-edits/:id/items/item/:item_id",
    middlewares: [
      validateAndTransformBody(AdminPostOrderEditsUpdateItemQuantityReqSchema),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/order-edits/:id/shipping-method",
    middlewares: [
      validateAndTransformBody(AdminPostOrderEditsShippingReqSchema),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/order-edits/:id/shipping-method/:action_id",
    middlewares: [
      validateAndTransformBody(AdminPostOrderEditsShippingActionReqSchema),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/order-edits/:id/request",
    middlewares: [
      validateAndTransformBody(AdminPostOrderEditsRequestReqSchema),
    ],
  },
]
