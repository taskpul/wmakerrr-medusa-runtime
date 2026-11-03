import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import {
  FULFILLMENT_REQUEST_ROLE,
  FULFILLMENT_STORE_SETTING,
} from "./store-ownership"

export async function setFulfillmentStoreDatabaseContext(
  transactionManager: SqlEntityManager,
  storeId: string,
  sharedMode: boolean
): Promise<void> {
  if (sharedMode) {
    await transactionManager.execute(
      `set local role "${FULFILLMENT_REQUEST_ROLE}"`
    )
  }
  await transactionManager.execute(
    `select set_config('${FULFILLMENT_STORE_SETTING}', ?, true)`,
    [storeId]
  )
}
