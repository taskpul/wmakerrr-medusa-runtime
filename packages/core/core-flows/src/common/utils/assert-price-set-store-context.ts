import type {
  Context,
  IPricingModuleService,
  MedusaContainer,
} from "@medusajs/framework/types"
import {
  arrayDifference,
  deduplicate,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"

export async function assertPriceSetStoreContext({
  priceSetIds,
  container,
  context,
}: {
  priceSetIds: string[]
  container: MedusaContainer
  context: Context
}): Promise<void> {
  const uniqueIds = deduplicate(priceSetIds.filter(Boolean))

  if (!uniqueIds.length) {
    return
  }

  const pricingModule = container.resolve<IPricingModuleService>(
    Modules.PRICING
  )
  const ownedPriceSets = await pricingModule.listPriceSets(
    { id: uniqueIds },
    { select: ["id"] },
    context
  )
  const missing = arrayDifference(
    uniqueIds,
    ownedPriceSets.map((priceSet) => priceSet.id)
  )

  if (missing.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Price sets do not belong to the active Store"
    )
  }
}
