import {
  getActiveMedusaContext,
  mergeActiveMedusaContext,
  runWithMedusaContext,
} from "../decorators/context-parameter"

describe("active Medusa context", () => {
  it("keeps concurrent Store executions isolated", async () => {
    const readStore = (storeId: string) =>
      runWithMedusaContext({ storeId }, async () => {
        await Promise.resolve()
        return getActiveMedusaContext()?.storeId
      })

    await expect(
      Promise.all([readStore("store_a"), readStore("store_b")])
    ).resolves.toEqual(["store_a", "store_b"])
  })

  it("merges missing context and rejects Store rebinding", () => {
    runWithMedusaContext({ storeId: "store_a", requestId: "req_1" }, () => {
      expect(mergeActiveMedusaContext({})).toMatchObject({
        storeId: "store_a",
        requestId: "req_1",
      })
      expect(() => mergeActiveMedusaContext({ storeId: "store_b" })).toThrow(
        "Store context cannot be rebound during workflow execution"
      )
    })
  })
})
