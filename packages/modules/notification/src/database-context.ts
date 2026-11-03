import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import {
  NOTIFICATION_REQUEST_ROLE,
  NOTIFICATION_STORE_SETTING,
} from "./store-isolation"

export async function setNotificationStoreDatabaseContext(
  manager: SqlEntityManager,
  storeId: string,
  sharedMode: boolean
): Promise<void> {
  if (sharedMode) {
    await manager.execute(`set local role "${NOTIFICATION_REQUEST_ROLE}"`)
  }
  await manager.execute(
    `select set_config('${NOTIFICATION_STORE_SETTING}', ?, true)`,
    [storeId]
  )
}
