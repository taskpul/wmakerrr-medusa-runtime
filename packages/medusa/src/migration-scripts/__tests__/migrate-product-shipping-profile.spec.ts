const runMock = jest.fn()

jest.mock("@medusajs/framework/modules-sdk", () => ({
  MedusaModule: {
    isInstalled: jest.fn(() => true),
  },
}))

jest.mock("@medusajs/framework/workflows-sdk", () => ({
  createWorkflow: jest.fn(() => jest.fn(() => ({ run: runMock }))),
  transform: jest.fn(),
  when: jest.fn(),
  WorkflowResponse: jest.fn(),
}))

jest.mock("@medusajs/core-flows", () => ({
  createRemoteLinkStep: jest.fn(),
  createShippingProfilesStep: jest.fn(),
  useQueryGraphStep: jest.fn(),
}))

import assignProductsToShippingProfile from "../migrate-product-shipping-profile"

describe("migrate product shipping profile", () => {
  const originalPlacementMode = process.env.TENANT_PLACEMENT_MODE

  afterEach(() => {
    jest.clearAllMocks()
    if (originalPlacementMode === undefined) {
      delete process.env.TENANT_PLACEMENT_MODE
    } else {
      process.env.TENANT_PLACEMENT_MODE = originalPlacementMode
    }
  })

  it("skips the global migration in shared-cell mode", async () => {
    process.env.TENANT_PLACEMENT_MODE = "shared-cell"
    const logger = { info: jest.fn() }
    const container = { resolve: jest.fn(() => logger) }

    await assignProductsToShippingProfile({ container } as never)

    expect(runMock).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(
      "Skipping global product shipping profile migration in shared-cell mode"
    )
  })
})
