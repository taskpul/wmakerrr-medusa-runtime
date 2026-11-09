import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import { SHARED_STORE_REQUEST_ROLE } from "@medusajs/framework/utils"

export const PRICING_REQUEST_ROLE = SHARED_STORE_REQUEST_ROLE
export const PRICING_STORE_SETTING = "medusa.store_id"

export async function setPricingStoreDatabaseContext(
  transactionManager: SqlEntityManager,
  storeId: string,
  sharedMode: boolean
): Promise<void> {
  if (sharedMode) {
    await transactionManager.execute(`set local role "${PRICING_REQUEST_ROLE}"`)
  }

  await transactionManager.execute(
    `select set_config('${PRICING_STORE_SETTING}', ?, true)`,
    [storeId]
  )
}
