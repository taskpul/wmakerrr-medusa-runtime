import {
  IPricingModuleService,
  PricingWorkflow,
} from "@medusajs/framework/types"
import {
  Modules,
  getSelectsAndRelationsFromObjectArray,
} from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"

export const updatePricePreferencesStepId = "update-price-preferences"
/**
 * This step updates price preferences matching the specified filters.
 *
 * @example
 * const data = updatePricePreferencesStep({
 *   selector: {
 *     id: ["pp_123"]
 *   },
 *   update: {
 *     is_tax_inclusive: true
 *   }
 * })
 */
export const updatePricePreferencesStep = createStep(
  updatePricePreferencesStepId,
  async (
    input: PricingWorkflow.UpdatePricePreferencesWorkflowInput,
    { container, context }
  ) => {
    const service = container.resolve<IPricingModuleService>(Modules.PRICING)

    const { selects, relations } = getSelectsAndRelationsFromObjectArray([
      input.update,
    ])

    const prevData = await service.listPricePreferences(
      input.selector,
      {
        select: selects,
        relations,
      },
      context
    )

    const updatedPricePreferences = await service.updatePricePreferences(
      input.selector,
      input.update,
      context
    )

    return new StepResponse(updatedPricePreferences, prevData)
  },
  async (prevData, { container, context }) => {
    if (!prevData?.length) {
      return
    }

    const service = container.resolve<IPricingModuleService>(Modules.PRICING)

    await service.upsertPricePreferences(prevData, context)
  }
)
