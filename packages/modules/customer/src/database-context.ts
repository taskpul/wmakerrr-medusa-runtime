import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import {
  CUSTOMER_REQUEST_ROLE,
  CUSTOMER_STORE_SETTING,
} from "./store-isolation"

export async function setCustomerStoreDatabaseContext(
  manager: SqlEntityManager,
  storeId: string,
  sharedMode: boolean
): Promise<void> {
  if (sharedMode) {
    await manager.execute(`set local role "${CUSTOMER_REQUEST_ROLE}"`)
  }
  await manager.execute(
    `select set_config('${CUSTOMER_STORE_SETTING}', ?, true)`,
    [storeId]
  )
}
