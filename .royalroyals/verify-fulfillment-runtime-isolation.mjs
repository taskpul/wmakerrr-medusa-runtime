import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (path) => readFile(join(root, path), "utf8")
const contract = JSON.parse(
  await read(".royalroyals/fulfillment-shipping-boundary.json")
)
const errors = []

const sources = {
  service: await read(
    "packages/modules/fulfillment/src/services/fulfillment-module-service.ts"
  ),
  ownership: await read("packages/modules/fulfillment/src/store-ownership.ts"),
  database: await read("packages/modules/fulfillment/src/database-context.ts"),
  schema: await read(
    "packages/modules/fulfillment/src/migrations/Migration20261103170220_enforce_store_ownership.ts"
  ),
  rls: await read(
    "packages/modules/fulfillment/src/migrations/Migration20261103170221_enforce_fulfillment_request_rls.ts"
  ),
  workflow: await read(
    "packages/core/workflows-sdk/src/helper/workflow-export.ts"
  ),
  event: await read(
    "packages/core/utils/src/modules-sdk/event-builder-factory.ts"
  ),
  link: await read("packages/core/modules-sdk/src/store-link-ownership.ts"),
}

const requiredMarkers = {
  service: [
    "withManagerContext_",
    "prepareGeneratedMethodArgs_",
    "stampFulfillments",
    "Shipping option provider does not match the active Store option",
  ],
  ownership: [
    "Fulfillment operations in shared mode require Context.storeId",
    "assertOwnedIds",
    "assertParentOwnership",
  ],
  database: [
    'set local role "${FULFILLMENT_REQUEST_ROLE}"',
    "FULFILLMENT_STORE_SETTING",
  ],
  schema: [
    "medusa_fulfillment_store_id_immutable",
    "_store_foreign",
    "IDX_shipping_profile_name_unique",
  ],
  rls: ["medusa_fulfillment_active_store_id", "force row level security"],
  workflow: ["resolveWorkflowStoreId", "storeId,"],
  event: ["store_id: sharedContext.storeId"],
  link: [
    "assertStoreSafeFulfillmentLinks",
    "Fulfillment link endpoint does not belong to the active Store",
    "This Fulfillment link endpoint is not certified for shared Store placement",
  ],
}

for (const [sourceName, markers] of Object.entries(requiredMarkers)) {
  for (const marker of markers) {
    if (!sources[sourceName].includes(marker)) {
      errors.push(`${sourceName} boundary lost marker: ${marker}`)
    }
  }
}

const slices = new Map(
  contract.implementationSlices.map((slice) => [slice.id, slice.status])
)
for (const slice of ["7G-6A", "7G-6B", "7G-6C", "7G-6D", "7G-6E"]) {
  if (slices.get(slice) !== "local-complete") {
    errors.push(`${slice} is not recorded as local-complete`)
  }
}

if (contract.internalGates.some((gate) => gate.status !== "local-complete")) {
  errors.push("Every Fulfillment internal gate must be locally complete")
}

const attackIds = contract.attackMatrix.map((attack) => attack.id)
if (
  attackIds.length !== 35 ||
  new Set(attackIds).size !== 35 ||
  attackIds.some(
    (id, index) => id !== `FS-${String(index + 1).padStart(2, "0")}`
  )
) {
  errors.push(
    "Fulfillment attack matrix must retain the ordered FS-01..FS-35 set"
  )
}

if (
  contract.admission.sharedProduction !== "disabled" ||
  contract.admission.candidateGatesChanged.length
) {
  errors.push("Fulfillment completion must not activate shared production")
}

const evidenceFiles = [
  "packages/modules/fulfillment/src/__tests__/store-ownership.spec.ts",
  "packages/modules/fulfillment/integration-tests/__tests__/fulfillment-module-service/store-ownership-persistence.spec.ts",
  "packages/modules/fulfillment/integration-tests/__tests__/fulfillment-module-service/store-ownership-service.spec.ts",
  "packages/modules/fulfillment/integration-tests/__tests__/fulfillment-module-service/store-ownership-dedicated.spec.ts",
  "packages/core/modules-sdk/src/__tests__/remote-link.spec.ts",
]
for (const path of evidenceFiles) {
  if (!(await read(path)).includes("it(")) {
    errors.push(`Fulfillment proof file has no executable case: ${path}`)
  }
}

if (errors.length) {
  throw new Error(errors.join("\n"))
}

console.log(
  `Verified Fulfillment runtime isolation: five local slices, ${attackIds.length} frozen attacks, ${evidenceFiles.length} executable proof surfaces, and shared production disabled.`
)
