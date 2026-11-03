import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import {
  INVENTORY_REQUEST_ROLE,
  INVENTORY_STORE_SETTING,
} from "./store-ownership"

export async function setInventoryStoreDatabaseContext(
  transactionManager: SqlEntityManager,
  storeId: string,
  sharedMode: boolean
): Promise<void> {
  if (sharedMode) {
    await transactionManager.execute(
      `set local role "${INVENTORY_REQUEST_ROLE}"`
    )
  }
  await transactionManager.execute(
    `select set_config('${INVENTORY_STORE_SETTING}', ?, true)`,
    [storeId]
  )
}
