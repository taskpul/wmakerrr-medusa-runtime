import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (path) => readFile(join(root, path), "utf8")
const contract = JSON.parse(
  await read(".royalroyals/inventory-stock-boundary.json")
)
const errors = []

const sources = {
  inventoryService: await read(
    "packages/modules/inventory/src/services/inventory-module.ts"
  ),
  inventoryOwnership: await read(
    "packages/modules/inventory/src/store-ownership.ts"
  ),
  inventoryRepository: await read(
    "packages/modules/inventory/src/repositories/inventory-level.ts"
  ),
  inventorySchema: await read(
    "packages/modules/inventory/src/migrations/Migration20261103173323_enforce_store_ownership.ts"
  ),
  inventoryRls: await read(
    "packages/modules/inventory/src/migrations/Migration20261103173324_enforce_inventory_request_rls.ts"
  ),
  stockService: await read(
    "packages/modules/stock-location/src/services/stock-location-module.ts"
  ),
  stockOwnership: await read(
    "packages/modules/stock-location/src/store-ownership.ts"
  ),
  stockSchema: await read(
    "packages/modules/stock-location/src/migrations/Migration20261103173329_enforce_store_ownership.ts"
  ),
  stockRls: await read(
    "packages/modules/stock-location/src/migrations/Migration20261103173330_enforce_stock_location_request_rls.ts"
  ),
  links: await read("packages/core/modules-sdk/src/store-link-ownership.ts"),
  batchWorkflow: await read(
    "packages/core/core-flows/src/inventory/workflows/batch-inventory-item-levels.ts"
  ),
  managerEvents: await read(
    "packages/core/utils/src/modules-sdk/decorators/inject-manager.ts"
  ),
}

const required = {
  inventoryService: [
    "withManagerContext_",
    "prepareGeneratedMethodArgs_",
    "assertInventoryItems",
  ],
  inventoryOwnership: [
    "require Context.storeId",
    "Inventory context does not match the dedicated Store",
  ],
  inventoryRepository: ['andWhere("store_id", storeId)'],
  inventorySchema: ["medusa_inventory_store_id_immutable", "_store_foreign"],
  inventoryRls: [
    "medusa_inventory_active_store_id",
    "force row level security",
  ],
  stockService: ["withManagerContext_", "stampLocations", "assertAddresses"],
  stockOwnership: [
    "require Context.storeId",
    "Stock Location context does not match the dedicated Store",
  ],
  stockSchema: [
    "medusa_stock_location_store_id_immutable",
    "address_id_store_foreign",
  ],
  stockRls: [
    "medusa_stock_location_active_store_id",
    "force row level security",
  ],
  links: ["assertStoreSafeInventoryLinks", "assertStoreSafeStockLocationLinks"],
  batchWorkflow: ["validate-updated-inventory-locations"],
  managerEvents: ["FlushEmittedEventsSymbol", "flushEvents"],
}

for (const [name, markers] of Object.entries(required)) {
  for (const marker of markers) {
    if (!sources[name].includes(marker))
      errors.push(`${name} lost marker: ${marker}`)
  }
}

const slices = new Map(
  contract.implementationSlices.map((slice) => [slice.id, slice.status])
)
for (const id of ["7G-7A", "7G-7B", "7G-7C", "7G-7D", "7G-7E"]) {
  if (slices.get(id) !== "local-complete")
    errors.push(`${id} is not local-complete`)
}

const attacks = contract.attackMatrix.map((attack) => attack.id)
if (
  attacks.length !== 24 ||
  new Set(attacks).size !== 24 ||
  attacks.some((id, index) => id !== `IS-${String(index + 1).padStart(2, "0")}`)
) {
  errors.push("Inventory attack matrix must retain IS-01..IS-24")
}

if (
  contract.admission.sharedProduction !== "disabled" ||
  contract.admission.candidateGatesChanged.length
) {
  errors.push("7G-7 must not activate shared production")
}

for (const path of [
  "packages/modules/inventory/integration-tests/__tests__/store-ownership.spec.ts",
  "packages/modules/inventory/integration-tests/__tests__/store-ownership-persistence.spec.ts",
  "packages/modules/stock-location/integration-tests/__tests__/store-ownership.spec.ts",
  "packages/modules/stock-location/integration-tests/__tests__/store-ownership-persistence.spec.ts",
  "packages/core/modules-sdk/src/__tests__/remote-link.spec.ts",
  "packages/core/utils/src/modules-sdk/decorators/__tests__/emit-events.ts",
]) {
  if (!(await read(path)).includes("it("))
    errors.push(`Missing executable proof: ${path}`)
}

if (errors.length) throw new Error(errors.join("\n"))
console.log(
  "Verified 7G-7 Inventory and Stock Location boundary: five slices, 24 attacks, shared production disabled."
)
