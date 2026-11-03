import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (path) => readFile(join(root, path), "utf8")
const contract = JSON.parse(
  await read(".royalroyals/phase-7-closure-boundary.json")
)
const candidate = JSON.parse(await read(".royalroyals/candidate-manifest.json"))
const errors = []

const sources = {
  manager: await read(
    "packages/core/utils/src/modules-sdk/store-isolation-manager.ts"
  ),
  links: await read("packages/core/modules-sdk/src/store-link-ownership.ts"),
  promotion: await read(
    "packages/modules/promotion/src/migrations/Migration20261103184157_enforce_request_rls.ts"
  ),
  customer: await read(
    "packages/modules/customer/src/migrations/Migration20261103184431_enforce_store_isolation.ts"
  ),
  cart: await read(
    "packages/modules/cart/src/migrations/Migration20261103184610_enforce_store_isolation.ts"
  ),
  payment: await read(
    "packages/modules/payment/src/migrations/Migration20261103184615_enforce_store_isolation.ts"
  ),
  order: await read(
    "packages/modules/order/src/migrations/Migration20261103184720_enforce_store_isolation.ts"
  ),
  apiKey: await read(
    "packages/modules/api-key/src/migrations/Migration20261103184919_enforce_store_owner.ts"
  ),
  salesChannel: await read(
    "packages/modules/sales-channel/src/migrations/Migration20261103184836_enforce_store_isolation.ts"
  ),
  notification: await read(
    "packages/modules/notification/src/migrations/Migration20261103185006_enforce_store_isolation.ts"
  ),
  cache: await read("packages/modules/caching/src/services/cache-module.ts"),
  file: await read("packages/modules/file/src/services/file-module-service.ts"),
  events: await read("packages/core/utils/src/event-bus/index.ts"),
  index: await read(
    "packages/modules/index/src/services/index-module-service.ts"
  ),
}

const required = {
  manager: ["Context.storeId", "store_id", "unscopedModels"],
  links: ["assertCertifiedStoreOwnedEndpoints", "SALES_CHANNEL", "API_KEY"],
  promotion: ["force row level security", "medusa_promotion_request"],
  customer: ["force row level security", "medusa_customer_request"],
  cart: ["force row level security", "medusa_cart_request"],
  payment: ["force row level security", "medusa_payment_request"],
  order: [
    "force row level security",
    "medusa_order_request",
    "order_line_item",
  ],
  apiKey: ["store_id is immutable"],
  salesChannel: ["force row level security", "medusa_sales_channel_request"],
  notification: ["force row level security", "medusa_notification_request"],
  cache: ["store:${storeId}:", "this.computeTags(data)"],
  file: ["stores/${storeId}/"],
  events: ["store_id", "runWithMedusaContext"],
  index: ["store_id", "delete from"],
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
for (const id of [
  "7G-8",
  "7G-9",
  "7G-10",
  "7G-11",
  "7G-12",
  "7G-13",
  "7G-14",
]) {
  if (slices.get(id) !== "local-complete")
    errors.push(`${id} is not local-complete`)
}

const attacks = contract.attackMatrix.map((attack) => attack.id)
if (
  attacks.length !== 24 ||
  new Set(attacks).size !== 24 ||
  attacks.some((id, index) => id !== `P7-${String(index + 1).padStart(2, "0")}`)
) {
  errors.push("Phase 7 attack matrix must retain P7-01..P7-24")
}

for (const path of [
  "packages/modules/promotion/integration-tests/__tests__/store-isolation.spec.ts",
  "packages/modules/customer/integration-tests/__tests__/store-isolation.spec.ts",
  "packages/modules/cart/integration-tests/__tests__/store-isolation.spec.ts",
  "packages/modules/payment/integration-tests/__tests__/store-isolation.spec.ts",
  "packages/modules/order/integration-tests/__tests__/store-isolation.spec.ts",
  "packages/modules/api-key/integration-tests/__tests__/store-isolation.spec.ts",
  "packages/modules/sales-channel/integration-tests/__tests__/store-isolation.spec.ts",
  "packages/modules/notification/integration-tests/__tests__/store-isolation.spec.ts",
  "packages/core/modules-sdk/src/__tests__/store-link-ownership.spec.ts",
  "packages/modules/index/integration-tests/__tests__/data-synchronizer.spec.ts",
]) {
  const proof = await read(path)
  if (!proof.includes("it(") && !proof.includes("it."))
    errors.push(`Missing executable proof: ${path}`)
}

if (
  contract.admission.sharedProduction !== "disabled" ||
  contract.admission.candidateGatesChanged.length
) {
  errors.push("Phase 7 local closure must not activate shared production")
}
if (
  candidate.status !== "draft-unsigned" ||
  candidate.artifactDigest !== null ||
  candidate.packages.length
) {
  errors.push("Candidate must remain unsigned, unpublished, and unconsumed")
}
if (
  Object.values(candidate.gates).some(
    (gate) => gate.status !== "pending" || gate.evidenceDigest !== null
  )
) {
  errors.push("Local closure must not change an admission gate")
}

if (errors.length) throw new Error(errors.join("\n"))
console.log(
  "Verified Phase 7 local closure: seven slices, 24 attacks, shared production disabled."
)
