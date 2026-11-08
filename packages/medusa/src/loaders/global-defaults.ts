export const shouldCreateGlobalDefaults = (
  placementMode = process.env.TENANT_PLACEMENT_MODE
) => placementMode !== "shared-cell"
