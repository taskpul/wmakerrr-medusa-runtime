/**
 * Store ownership options for the Product module in the controlled runtime.
 */
export type ProductModuleOptions = {
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
