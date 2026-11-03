import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import {
  STOCK_LOCATION_REQUEST_ROLE,
  STOCK_LOCATION_STORE_SETTING,
} from "./store-ownership"

export async function setStockLocationStoreDatabaseContext(
  transactionManager: SqlEntityManager,
  storeId: string,
  sharedMode: boolean
): Promise<void> {
  if (sharedMode) {
    await transactionManager.execute(
      `set local role "${STOCK_LOCATION_REQUEST_ROLE}"`
    )
  }
  await transactionManager.execute(
    `select set_config('${STOCK_LOCATION_STORE_SETTING}', ?, true)`,
    [storeId]
  )
}
