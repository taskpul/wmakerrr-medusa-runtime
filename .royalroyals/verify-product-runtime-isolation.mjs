import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (path) => readFile(join(root, path), "utf8")
const contract = JSON.parse(
  await read(".royalroyals/product-catalog-boundary.json")
)
const errors = []

const sources = {
  service: await read(
    "packages/modules/product/src/services/product-module-service.ts"
  ),
  ownership: await read("packages/modules/product/src/store-ownership.ts"),
  workflow: await read(
    "packages/core/workflows-sdk/src/helper/workflow-export.ts"
  ),
  continuation: await read(
    "packages/core/orchestration/src/workflow/local-workflow.ts"
  ),
  event: await read(
    "packages/core/utils/src/modules-sdk/event-builder-factory.ts"
  ),
  activeContext: await read(
    "packages/core/utils/src/modules-sdk/decorators/context-parameter.ts"
  ),
  index: await read(
    "packages/modules/index/src/services/index-module-service.ts"
  ),
  indexSync: await read(
    "packages/modules/index/src/services/data-synchronizer.ts"
  ),
  link: await read("packages/core/modules-sdk/src/store-link-ownership.ts"),
}

const requiredMarkers = {
  service: [
    "withManagerContext_",
    "prepareGeneratedMethodArgs_",
    "this.storeOwnership_.scope(normalizedFilters ?? {}, sharedContext)",
  ],
  ownership: [
    "Product operations in shared mode require Context.storeId",
    "assertOwnedIds",
    "assertGeneratedParentOwnership",
  ],
  workflow: ["resolveWorkflowStoreId", "storeId,"],
  continuation: [
    "Workflow Store context cannot be rebound during continuation",
  ],
  event: ["store_id: sharedContext.storeId"],
  activeContext: [
    "AsyncLocalStorage<Context>",
    "Store context cannot be rebound during workflow execution",
  ],
  index: ["scopeStoreOwnedIndexQuery_", `where "data"->>'store_id' = ?`],
  indexSync: [
    "Shared index synchronization requires a Store context",
    "filters.store_id = storeId",
    `"data"->>'store_id'`,
  ],
  link: [
    "assertStoreSafeProductLinks",
    "Product link endpoint does not belong to the active Store",
    "This Product link endpoint is not certified for shared Store placement",
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
for (const slice of ["7G-5B", "7G-5C", "7G-5D", "7G-5E"]) {
  if (slices.get(slice) !== "local-complete") {
    errors.push(`${slice} is not recorded as local-complete`)
  }
}

const attackIds = contract.attackMatrix.map((attack) => attack.id)
if (
  attackIds.length !== 32 ||
  new Set(attackIds).size !== 32 ||
  attackIds.some(
    (id, index) => id !== `PC-${String(index + 1).padStart(2, "0")}`
  )
) {
  errors.push("Product attack matrix must retain the ordered PC-01..PC-32 set")
}

if (
  contract.admission.sharedProduction !== "disabled" ||
  contract.admission.candidateGatesChanged.length
) {
  errors.push("Product local completion must not activate shared production")
}

const evidenceFiles = [
  "packages/modules/product/integration-tests/__tests__/product-module-service/store-ownership-service.spec.ts",
  "packages/modules/product/integration-tests/__tests__/product-module-service/store-ownership-dedicated.spec.ts",
  "packages/modules/product/integration-tests/__tests__/product-module-service/store-ownership-persistence.spec.ts",
  "packages/core/utils/src/modules-sdk/__tests__/active-medusa-context.spec.ts",
  "packages/modules/index/src/services/__tests__/store-isolation.spec.ts",
  "packages/core/modules-sdk/src/__tests__/remote-link.spec.ts",
]
for (const path of evidenceFiles) {
  if (!(await read(path)).includes("it(")) {
    errors.push(`Product proof file has no executable case: ${path}`)
  }
}

if (errors.length) {
  throw new Error(errors.join("\n"))
}

console.log(
  `Verified Product runtime isolation: four local slices, ${attackIds.length} frozen attacks, ${evidenceFiles.length} executable proof surfaces, and shared production disabled.`
)
