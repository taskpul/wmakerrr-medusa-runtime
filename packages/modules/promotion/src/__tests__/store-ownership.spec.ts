import { MedusaError } from "@medusajs/framework/utils"
import { PromotionStoreOwnership } from "../store-ownership"

const service = (rows: { id: string; store_id: string }[] = []) => ({
  list: jest.fn(async (filter: any) =>
    rows.filter(
      (row) =>
        row.store_id === filter.store_id &&
        (!filter.id || filter.id.includes(row.id))
    )
  ),
})

const services = (rows: { id: string; store_id: string }[] = []) => ({
  Promotion: service(rows),
  ApplicationMethod: service(rows),
  Campaign: service(rows),
  CampaignBudget: service(rows),
  CampaignBudgetUsage: service(rows),
  PromotionRule: service(rows),
  PromotionRuleValue: service(rows),
})

describe("PromotionStoreOwnership", () => {
  it("fails closed in shared mode without Store context", () => {
    const ownership = new PromotionStoreOwnership(
      { store_isolation: { mode: "shared" } },
      services()
    )

    expect(() => ownership.resolveStoreId({})).toThrow(MedusaError)
  })

  it("scopes reads and overrides client Store ownership", async () => {
    const ownership = new PromotionStoreOwnership(
      { store_isolation: { mode: "shared" } },
      services()
    )
    const context = { storeId: "store_a" }

    await expect(
      ownership.prepareGeneratedMethodArgs({
        method: "list",
        methodName: "listPromotions",
        modelName: "Promotion",
        args: [{ store_id: "store_b", code: "SAVE" }, {}],
        context,
      })
    ).resolves.toEqual([{ store_id: "store_a", code: "SAVE" }, {}])

    await expect(
      ownership.prepareGeneratedMethodArgs({
        method: "create",
        methodName: "createPromotions",
        modelName: "Promotion",
        args: [{ store_id: "store_b", code: "SAVE" }],
        context,
      })
    ).resolves.toEqual([{ store_id: "store_a", code: "SAVE" }])
  })

  it("rejects foreign identifiers and mismatched results", async () => {
    const ownership = new PromotionStoreOwnership(
      { store_isolation: { mode: "shared" } },
      services([{ id: "promo_a", store_id: "store_a" }])
    )
    const context = { storeId: "store_b" }

    await expect(
      ownership.prepareGeneratedMethodArgs({
        method: "retrieve",
        methodName: "retrievePromotion",
        modelName: "Promotion",
        args: ["promo_a", {}],
        context,
      })
    ).rejects.toMatchObject({ type: MedusaError.Types.NOT_FOUND })

    expect(() =>
      ownership.validateGeneratedMethodResult({
        method: "list",
        methodName: "listPromotions",
        modelName: "Promotion",
        args: [],
        context,
        result: [{ id: "promo_a", store_id: "store_a" }],
      })
    ).toThrow(MedusaError)
  })

  it("preserves dedicated compatibility and rejects mismatched context", () => {
    const ownership = new PromotionStoreOwnership(
      { store_isolation: { mode: "dedicated", store_id: "store_a" } },
      services()
    )

    expect(ownership.resolveStoreId({})).toBe("store_a")
    expect(() => ownership.resolveStoreId({ storeId: "store_b" })).toThrow(
      MedusaError
    )
  })
})
