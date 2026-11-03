import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import { PAYMENT_REQUEST_ROLE, PAYMENT_STORE_SETTING } from "./store-isolation"

export async function setPaymentStoreDatabaseContext(
  manager: SqlEntityManager,
  storeId: string,
  sharedMode: boolean
): Promise<void> {
  if (sharedMode) {
    await manager.execute(`set local role "${PAYMENT_REQUEST_ROLE}"`)
  }
  await manager.execute(
    `select set_config('${PAYMENT_STORE_SETTING}', ?, true)`,
    [storeId]
  )
}
