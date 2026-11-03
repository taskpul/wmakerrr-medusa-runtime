import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import {
  PROMOTION_REQUEST_ROLE,
  PROMOTION_STORE_SETTING,
} from "./store-ownership"

export async function setPromotionStoreDatabaseContext(
  transactionManager: SqlEntityManager,
  storeId: string,
  sharedMode: boolean
): Promise<void> {
  if (sharedMode) {
    await transactionManager.execute(
      `set local role "${PROMOTION_REQUEST_ROLE}"`
    )
  }
  await transactionManager.execute(
    `select set_config('${PROMOTION_STORE_SETTING}', ?, true)`,
    [storeId]
  )
}
