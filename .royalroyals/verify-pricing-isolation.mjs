import { readdir, readFile } from "node:fs/promises"
import { dirname, join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const coreFlowsRoot = join(root, "packages/core/core-flows/src")
const errors = []

const approvedPricingReferences = [
  "packages/core/core-flows/src/cart/steps/get-variant-price-sets.ts",
  "packages/core/core-flows/src/common/utils/assert-price-set-store-context.ts",
  "packages/core/core-flows/src/fulfillment/steps/add-shipping-options-prices.ts",
  "packages/core/core-flows/src/fulfillment/steps/set-shipping-options-price-sets.ts",
  "packages/core/core-flows/src/fulfillment/steps/set-shipping-options-prices.ts",
  "packages/core/core-flows/src/price-list/steps/create-price-list-prices.ts",
  "packages/core/core-flows/src/price-list/steps/create-price-lists.ts",
  "packages/core/core-flows/src/price-list/steps/delete-price-lists.ts",
  "packages/core/core-flows/src/price-list/steps/get-existing-price-lists-price-ids.ts",
  "packages/core/core-flows/src/price-list/steps/remove-price-list-prices.ts",
  "packages/core/core-flows/src/price-list/steps/update-price-list-prices.ts",
  "packages/core/core-flows/src/price-list/steps/update-price-lists.ts",
  "packages/core/core-flows/src/price-list/steps/validate-price-lists.ts",
  "packages/core/core-flows/src/price-list/workflows/delete-price-lists.ts",
  "packages/core/core-flows/src/pricing/steps/create-price-preferences.ts",
  "packages/core/core-flows/src/pricing/steps/create-price-sets.ts",
  "packages/core/core-flows/src/pricing/steps/delete-price-preferences.ts",
  "packages/core/core-flows/src/pricing/steps/update-price-preferences-as-array.ts",
  "packages/core/core-flows/src/pricing/steps/update-price-preferences.ts",
  "packages/core/core-flows/src/pricing/steps/update-price-sets.ts",
  "packages/core/core-flows/src/pricing/workflows/delete-price-preferences.ts",
  "packages/core/core-flows/src/product/steps/create-variant-pricing-link.ts",
  "packages/core/core-flows/src/product/steps/get-variant-pricing-link.ts",
].sort()

const guardedLinkPaths = new Map([
  [
    "packages/core/core-flows/src/fulfillment/steps/set-shipping-options-price-sets.ts",
    [
      "assertPriceSetStoreContext",
      "remoteLink.dismiss(linksToRemove, context)",
      "remoteLink.create(linksToCreate, context)",
    ],
  ],
  [
    "packages/core/core-flows/src/price-list/steps/validate-variant-price-links.ts",
    ["assertPriceSetStoreContext", "context,"],
  ],
  [
    "packages/core/core-flows/src/product/steps/create-variant-pricing-link.ts",
    [
      "assertPriceSetStoreContext",
      "remoteLink.dismiss(links, context)",
      "context\n    )",
    ],
  ],
  [
    "packages/core/core-flows/src/product/steps/get-variant-pricing-link.ts",
    ["assertPriceSetStoreContext", "context\n    )"],
  ],
])

function projectPath(path) {
  return relative(root, path).split(sep).join("/")
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(path)))
    } else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) {
      files.push(path)
    }
  }

  return files
}

function extractCall(source, openParenthesis) {
  let depth = 0
  let quote = null
  let escaped = false

  for (let index = openParenthesis; index < source.length; index++) {
    const character = source[index]

    if (quote) {
      if (escaped) {
        escaped = false
      } else if (character === "\\") {
        escaped = true
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === '"' || character === "'" || character === "`") {
      quote = character
      continue
    }
    if (character === "(") depth++
    if (character === ")" && --depth === 0) {
      return source.slice(openParenthesis + 1, index)
    }
  }

  return null
}

function pricingServiceNames(source) {
  return new Set(
    [
      ...source.matchAll(
        /const\s+(\w+)\s*=\s*container\.resolve<IPricingModuleService>/g
      ),
    ].map((match) => match[1])
  )
}

function pricingCalls(source, serviceNames) {
  const calls = []
  const pattern = /\b(\w+)\.(\w+)\s*\(/g
  let match

  while ((match = pattern.exec(source))) {
    if (!serviceNames.has(match[1])) continue

    const openParenthesis = pattern.lastIndex - 1
    const argumentsSource = extractCall(source, openParenthesis)
    if (argumentsSource !== null) {
      calls.push({
        name: `${match[1]}.${match[2]}`,
        argumentsSource,
      })
    }
  }

  return calls
}

const coreFlowFiles = await walk(coreFlowsRoot)
const observedPricingReferences = []
let verifiedPricingCalls = 0

for (const file of coreFlowFiles) {
  const source = await readFile(file, "utf8")
  const path = projectPath(file)

  if (
    !path.includes("/__tests__/") &&
    /Modules\.PRICING|IPricingModuleService|PricingModuleService/.test(source)
  ) {
    observedPricingReferences.push(path)
  }

  for (const call of pricingCalls(source, pricingServiceNames(source))) {
    verifiedPricingCalls++
    if (!/(?:^|,)\s*(?:sharedContext|context)\s*$/.test(call.argumentsSource)) {
      errors.push(`${path}: ${call.name} does not end with verified context`)
    }
  }
}

observedPricingReferences.sort()
if (
  JSON.stringify(observedPricingReferences) !==
  JSON.stringify(approvedPricingReferences)
) {
  errors.push(
    `Pricing core-flow inventory changed:\nexpected ${approvedPricingReferences.join(
      "\n"
    )}\nobserved ${observedPricingReferences.join("\n")}`
  )
}

for (const [path, markers] of guardedLinkPaths) {
  const source = await readFile(join(root, path), "utf8")
  for (const marker of markers) {
    if (!source.includes(marker)) {
      errors.push(`${path}: missing cross-module isolation marker ${marker}`)
    }
  }
}

const packageFiles = await walk(join(root, "packages"))
const backgroundPricingReferences = []
for (const file of packageFiles) {
  const path = projectPath(file)
  if (!/(?:^|\/)\b(?:jobs|subscribers)\b\//.test(path)) continue

  const source = await readFile(file, "utf8")
  if (
    /Modules\.PRICING|IPricingModuleService|PricingModuleService/.test(source)
  ) {
    backgroundPricingReferences.push(path)
  }
}
if (backgroundPricingReferences.length) {
  errors.push(
    `Unreviewed Pricing background callers require signed Store context:\n${backgroundPricingReferences.join(
      "\n"
    )}`
  )
}

const workflowExport = await readFile(
  join(root, "packages/core/workflows-sdk/src/helper/workflow-export.ts"),
  "utf8"
)
const localWorkflow = await readFile(
  join(root, "packages/core/orchestration/src/workflow/local-workflow.ts"),
  "utf8"
)
for (const marker of ["storeId,", "const flowMetadata = {"]) {
  if (!workflowExport.includes(marker)) {
    errors.push(`workflow-export.ts: missing Store provenance marker ${marker}`)
  }
}
for (const marker of [
  "metadata.storeId !== this.medusaContext.storeId",
  "Workflow Store context cannot be rebound during continuation",
  "this.medusaContext.storeId = metadata.storeId",
]) {
  if (!localWorkflow.includes(marker)) {
    errors.push(
      `local-workflow.ts: missing Store continuation marker ${marker}`
    )
  }
}

if (errors.length) {
  throw new Error(errors.join("\n"))
}

console.log(
  `Verified ${observedPricingReferences.length} Pricing core-flow references, ${verifiedPricingCalls} context-bound Pricing calls, ${guardedLinkPaths.size} guarded link paths, and no unreviewed Pricing jobs/subscribers.`
)
