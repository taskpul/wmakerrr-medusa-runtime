import * as QueryConfig from "./query-config"

import {
  AdminCreateInvite,
  AdminGetInviteAcceptParams,
  AdminGetInviteParams,
  AdminGetInvitesParams,
  AdminInviteAccept,
} from "./validators"

import {
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework"
import { MiddlewareRoute } from "@medusajs/framework/http"
import { authenticate } from "../../../utils/middlewares/authenticate-middleware"

export const adminInviteRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/invites",
    middlewares: [
      validateAndTransformQuery(
        AdminGetInvitesParams,
        QueryConfig.listTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/invites",
    middlewares: [
      validateAndTransformBody(AdminCreateInvite),
      validateAndTransformQuery(
        AdminGetInviteParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
    ],
  },
  {
    method: "POST",
    matcher: "/admin/invites/accept",
    middlewares: [
      authenticate("user", ["session", "bearer"], {
        allowUnregistered: true,
      }),
      validateAndTransformBody(AdminInviteAccept),
      validateAndTransformQuery(
        AdminGetInviteAcceptParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
    ],
  },
  {
    method: ["GET"],
    matcher: "/admin/invites/:id",
    middlewares: [
      validateAndTransformQuery(
        AdminGetInviteParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
    ],
  },
  {
    method: "POST",
    matcher: "/admin/invites/:id/resend",
    middlewares: [
      validateAndTransformQuery(
        AdminGetInviteParams,
        QueryConfig.retrieveTransformQueryConfig
      ),
    ],
  },
]
