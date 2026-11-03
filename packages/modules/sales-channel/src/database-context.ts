import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import {
  SALES_CHANNEL_REQUEST_ROLE,
  SALES_CHANNEL_STORE_SETTING,
} from "./store-isolation"

export async function setSalesChannelStoreDatabaseContext(
  manager: SqlEntityManager,
  storeId: string,
  sharedMode: boolean
): Promise<void> {
  if (sharedMode) {
    await manager.execute(`set local role "${SALES_CHANNEL_REQUEST_ROLE}"`)
  }
  await manager.execute(
    `select set_config('${SALES_CHANNEL_STORE_SETTING}', ?, true)`,
    [storeId]
  )
}
