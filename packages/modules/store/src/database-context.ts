import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import { STORE_REQUEST_ROLE, STORE_SETTING } from "./store-isolation"

export async function setStoreDatabaseContext(
  manager: SqlEntityManager,
  storeId: string,
  sharedMode: boolean
): Promise<void> {
  if (sharedMode) {
    await manager.execute(`set local role "${STORE_REQUEST_ROLE}"`)
  }
  await manager.execute(`select set_config('${STORE_SETTING}', ?, true)`, [
    storeId,
  ])
}
