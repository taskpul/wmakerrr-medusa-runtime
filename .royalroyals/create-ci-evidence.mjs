import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"

const requiredEnvironment = [
  "CANDIDATE_ROOT",
  "CANDIDATE_REVISION",
  "EVIDENCE_OUTPUT",
  "GITHUB_RUN_ATTEMPT",
  "GITHUB_RUN_ID",
  "GITHUB_SERVER_URL",
  "GITHUB_REPOSITORY",
  "GITHUB_SHA",
  "GITHUB_WORKFLOW_REF",
]

for (const name of requiredEnvironment) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
}

const candidateRoot = resolve(process.env.CANDIDATE_ROOT)
const outputPath = resolve(process.env.EVIDENCE_OUTPUT)
const manifest = JSON.parse(
  await readFile(join(candidateRoot, ".royalroyals/candidate-manifest.json"))
)

const evidenceFiles = [
  ".royalroyals/candidate-manifest.json",
  ".royalroyals/public-api-exceptions.json",
  ".royalroyals/public-package-graph.json",
  ".royalroyals/upstream-lock.json",
  ".royalroyals/verify-baseline.mjs",
  ".royalroyals/verify-bootstrap.mjs",
  ".royalroyals/verify-public-api.mjs",
  ".royalroyals/verify-pricing-isolation.mjs",
  ".royalroyals/verify-product-catalog-inventory.mjs",
  ".royalroyals/verify-product-persistence-isolation.mjs",
  ".royalroyals/verify-product-runtime-isolation.mjs",
  ".royalroyals/verify-fulfillment-shipping-inventory.mjs",
  ".royalroyals/verify-fulfillment-runtime-isolation.mjs",
  ".royalroyals/verify-inventory-stock-boundary.mjs",
  ".royalroyals/verify-phase-7-closure.mjs",
  ".royalroyals/create-package-set.mjs",
  ".royalroyals/verify-package-set.mjs",
  ".royalroyals/product-catalog-boundary.json",
  ".royalroyals/fulfillment-shipping-boundary.json",
  ".royalroyals/inventory-stock-boundary.json",
  ".royalroyals/phase-7-closure-boundary.json",
  "packages/modules/pricing/integration-tests/__tests__/services/pricing-module/store-ownership.spec.ts",
  "packages/modules/pricing/src/migrations/Migration20261103120215.ts",
  "packages/modules/pricing/src/store-ownership.ts",
  "yarn.lock",
]

const sha256 = async (path) =>
  createHash("sha256")
    .update(await readFile(join(candidateRoot, path)))
    .digest("hex")

const fileDigests = Object.fromEntries(
  await Promise.all(
    evidenceFiles.map(async (path) => [path, await sha256(path)])
  )
)

const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
const evidence = {
  schemaVersion: 1,
  candidateRevision: process.env.CANDIDATE_REVISION,
  upstreamRevision: manifest.upstreamRevision,
  workflowRevision: process.env.GITHUB_SHA,
  workflowRef: process.env.GITHUB_WORKFLOW_REF,
  run: {
    id: process.env.GITHUB_RUN_ID,
    attempt: Number(process.env.GITHUB_RUN_ATTEMPT),
    url: runUrl,
  },
  commands: [
    "yarn install --immutable",
    "yarn build",
    "node .royalroyals/verify-bootstrap.mjs",
    "node .royalroyals/verify-baseline.mjs",
    "node .royalroyals/verify-public-api.mjs",
    "node .royalroyals/verify-pricing-isolation.mjs",
    "node .royalroyals/verify-product-catalog-inventory.mjs",
    "node .royalroyals/verify-product-persistence-isolation.mjs",
    "node .royalroyals/verify-product-runtime-isolation.mjs",
    "node .royalroyals/verify-fulfillment-shipping-inventory.mjs",
    "node .royalroyals/verify-fulfillment-runtime-isolation.mjs",
    "node .royalroyals/verify-inventory-stock-boundary.mjs",
    "node .royalroyals/verify-phase-7-closure.mjs",
    "node .royalroyals/create-package-set.mjs <output-directory>",
    "node .royalroyals/verify-package-set.mjs <output-directory>",
    "focused Store-isolation integration tests for Pricing, Product, Fulfillment, Inventory, Stock Location, Promotion, Customer, Cart, Payment, Order, API Key, Sales Channel, Notification, Index, and module links",
  ],
  result: "passed",
  fileDigests,
}

await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, {
  flag: "wx",
})

console.log(`Created evidence for candidate ${evidence.candidateRevision}`)
