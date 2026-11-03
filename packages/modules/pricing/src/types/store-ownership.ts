/**
 * Store ownership options for the Pricing module.
 */
export type PricingModuleOptions = {
  store_isolation?:
    | {
        mode: "shared"
        store_id?: never
      }
    | {
        mode?: "dedicated"
        store_id?: string
      }
}
