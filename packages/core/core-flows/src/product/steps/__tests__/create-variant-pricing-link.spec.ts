import { MedusaContainer } from "@medusajs/framework"
import { asValue, createContainer } from "@medusajs/framework/awilix"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createWorkflow, WorkflowResponse } from "@medusajs/workflows-sdk"
import { createVariantPricingLinkStep } from "../create-variant-pricing-link"

const createLinkWorkflow = createWorkflow(
  "create-variant-pricing-link-store-context-test",
  (input: { links: { variant_id: string; price_set_id: string }[] }) => {
    return new WorkflowResponse(createVariantPricingLinkStep(input))
  }
)

describe("createVariantPricingLinkStep Store isolation", () => {
  const context = { storeId: "store_a" }
  const input = {
    links: [{ variant_id: "variant_a", price_set_id: "pset_a" }],
  }

  function createTestContainer(ownedPriceSets: { id: string }[]) {
    const container = createContainer() as unknown as MedusaContainer
    const pricing = {
      listPriceSets: jest.fn().mockResolvedValue(ownedPriceSets),
    }
    const remoteLink = {
      create: jest.fn().mockResolvedValue([]),
      dismiss: jest.fn().mockResolvedValue([]),
    }

    container.register(Modules.PRICING, asValue(pricing))
    container.register(ContainerRegistrationKeys.LINK, asValue(remoteLink))

    return { container, pricing, remoteLink }
  }

  it("rejects a foreign Price Set before creating the link", async () => {
    const { container, pricing, remoteLink } = createTestContainer([])

    const { errors } = await createLinkWorkflow(container).run({
      input,
      context,
      throwOnError: false,
    })

    expect(errors).toEqual([
      expect.objectContaining({
        error: expect.objectContaining({
          message: "Price sets do not belong to the active Store",
        }),
      }),
    ])
    expect(pricing.listPriceSets).toHaveBeenCalledWith(
      { id: ["pset_a"] },
      { select: ["id"] },
      expect.objectContaining(context)
    )
    expect(remoteLink.create).not.toHaveBeenCalled()
  })

  it("creates an owned link with the verified Store context", async () => {
    const { container, remoteLink } = createTestContainer([{ id: "pset_a" }])

    await createLinkWorkflow(container).run({
      input,
      context,
      throwOnError: true,
    })

    expect(remoteLink.create).toHaveBeenCalledWith(
      [
        {
          [Modules.PRODUCT]: { variant_id: "variant_a" },
          [Modules.PRICING]: { price_set_id: "pset_a" },
        },
      ],
      expect.objectContaining(context)
    )
  })
})
