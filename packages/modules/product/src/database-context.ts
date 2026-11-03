import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import { PRODUCT_REQUEST_ROLE, PRODUCT_STORE_SETTING } from "./store-ownership"

export async function setProductStoreDatabaseContext(
  transactionManager: SqlEntityManager,
  storeId: string,
  sharedMode: boolean
): Promise<void> {
  if (sharedMode) {
    await transactionManager.execute(`set local role "${PRODUCT_REQUEST_ROLE}"`)
  }

  await transactionManager.execute(
    `select set_config('${PRODUCT_STORE_SETTING}', ?, true)`,
    [storeId]
  )
}
