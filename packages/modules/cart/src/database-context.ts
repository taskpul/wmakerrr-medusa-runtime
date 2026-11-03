import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import { CART_REQUEST_ROLE, CART_STORE_SETTING } from "./store-isolation"

export async function setCartStoreDatabaseContext(
  manager: SqlEntityManager,
  storeId: string,
  sharedMode: boolean
): Promise<void> {
  if (sharedMode) {
    await manager.execute(`set local role "${CART_REQUEST_ROLE}"`)
  }
  await manager.execute(`select set_config('${CART_STORE_SETTING}', ?, true)`, [
    storeId,
  ])
}
