import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import { ORDER_REQUEST_ROLE, ORDER_STORE_SETTING } from "./store-isolation"

export async function setOrderStoreDatabaseContext(
  manager: SqlEntityManager,
  storeId: string,
  sharedMode: boolean
): Promise<void> {
  if (sharedMode) {
    await manager.execute(`set local role "${ORDER_REQUEST_ROLE}"`)
  }
  await manager.execute(
    `select set_config('${ORDER_STORE_SETTING}', ?, true)`,
    [storeId]
  )
}
