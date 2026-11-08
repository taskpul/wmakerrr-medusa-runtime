import { shouldCreateGlobalDefaults } from "../global-defaults"

describe("global defaults loader", () => {
  it("creates global defaults for dedicated runtimes", () => {
    expect(shouldCreateGlobalDefaults("dedicated")).toBe(true)
  })

  it("skips global defaults for shared-cell runtimes", () => {
    expect(shouldCreateGlobalDefaults("shared-cell")).toBe(false)
  })
})
