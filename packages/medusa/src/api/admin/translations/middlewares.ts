import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { DEFAULT_BATCH_ENDPOINTS_SIZE_LIMIT } from "../../../utils"
import * as QueryConfig from "./query-config"
import {
  AdminBatchTranslations,
  AdminBatchTranslationSettings,
  AdminGetTranslationsParams,
  AdminTranslationEntitiesParams,
  AdminTranslationSettingsParams,
  AdminTranslationStatisticsParams,
} from "./validators"

export const adminTranslationsRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/translations",
    middlewares: [
      validateAndTransformQuery(
        AdminGetTranslationsParams,
        QueryConfig.listTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/translations/batch",
    bodyParser: {
      sizeLimit: DEFAULT_BATCH_ENDPOINTS_SIZE_LIMIT,
    },
    middlewares: [validateAndTransformBody(AdminBatchTranslations)],
  },
  {
    method: ["GET"],
    matcher: "/admin/translations/statistics",
    middlewares: [
      validateAndTransformQuery(AdminTranslationStatisticsParams, {}),
    ],
  },
  {
    method: ["GET"],
    matcher: "/admin/translations/settings",
    middlewares: [
      validateAndTransformQuery(AdminTranslationSettingsParams, {}),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/translations/settings/batch",
    middlewares: [validateAndTransformBody(AdminBatchTranslationSettings)],
  },
  {
    method: ["GET"],
    matcher: "/admin/translations/entities",
    middlewares: [
      validateAndTransformQuery(
        AdminTranslationEntitiesParams,
        QueryConfig.listTransformQueryConfig
      ),
    ],
  },
]
