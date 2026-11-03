import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { basename, dirname, join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const contractPath = join(
  root,
  ".royalroyals/fulfillment-shipping-boundary.json"
)

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
    } else if (entry.isFile()) {
      files.push(path)
    }
  }

  return files
}

function sorted(values) {
  return [...new Set(values)].sort()
}

function inventory(values) {
  const paths = sorted(values)
  return {
    count: paths.length,
    sha256: createHash("sha256").update(paths.join("\n")).digest("hex"),
  }
}

function compareInventory(name, expected, observed, errors) {
  if (
    expected?.count !== observed.count ||
    expected?.sha256 !== observed.sha256
  ) {
    errors.push(
      `${name} changed: expected ${JSON.stringify(
        expected
      )}, observed ${JSON.stringify(observed)}`
    )
  }
}

const modelDirectory = join(root, "packages/modules/fulfillment/src/models")
const modelFiles = (await walk(modelDirectory)).filter(
  (path) => path.endsWith(".ts") && basename(path) !== "index.ts"
)
const fulfillmentTables = []
const modelUniqueIndexes = []
for (const file of modelFiles) {
  const source = await readFile(file, "utf8")
  for (const match of source.matchAll(/model\s*\.define\("([^"]+)"/g)) {
    fulfillmentTables.push(match[1])
  }
  if (/unique:\s*true/.test(source)) {
    modelUniqueIndexes.push(projectPath(file))
  }
}

const fulfillmentServicePath = join(
  root,
  "packages/modules/fulfillment/src/services/fulfillment-module-service.ts"
)
const fulfillmentServiceSource = await readFile(fulfillmentServicePath, "utf8")
const declaredServiceMethods = [
  ...fulfillmentServiceSource.matchAll(
    /^  (?:protected )?async ([A-Za-z0-9_]+)\(/gm
  ),
].map((match) => match[1])

const coreFlowFiles = (
  await walk(join(root, "packages/core/core-flows/src"))
).filter(
  (path) => path.endsWith(".ts") && !path.includes(`${sep}__tests__${sep}`)
)
const coreFlowFulfillmentReferences = []
const asynchronousFulfillmentPaths = []
for (const file of coreFlowFiles) {
  const source = await readFile(file, "utf8")
  const isFulfillmentPath =
    /Modules\.FULFILLMENT|IFulfillmentModuleService|FulfillmentModuleService/.test(
      source
    )
  if (isFulfillmentPath) {
    coreFlowFulfillmentReferences.push(projectPath(file))
    if (/async:\s*true|backgroundExecution:\s*true/.test(source)) {
      asynchronousFulfillmentPaths.push(projectPath(file))
    }
  }
}

const fulfillmentDomainRoots = [
  "packages/core/core-flows/src/fulfillment",
  "packages/core/core-flows/src/shipping-options",
  "packages/core/core-flows/src/shipping-profile",
]
const fulfillmentWorkflowFiles = []
const fulfillmentStepFiles = []
for (const domainRoot of fulfillmentDomainRoots) {
  for (const file of await walk(join(root, domainRoot))) {
    if (!file.endsWith(".ts") || basename(file) === "index.ts") {
      continue
    }
    const path = projectPath(file)
    if (path.includes("/workflows/")) {
      fulfillmentWorkflowFiles.push(path)
    } else if (path.includes("/steps/")) {
      fulfillmentStepFiles.push(path)
    }
  }
}

const routeFiles = (await walk(join(root, "packages/medusa/src/api"))).filter(
  (path) => basename(path) === "route.ts"
)
const fulfillmentRoutes = []
for (const file of routeFiles) {
  const path = projectPath(file)
  const source = await readFile(file, "utf8")
  if (
    /(?:^|\/)(?:fulfillment-sets|fulfillment-providers|fulfillments|shipping-options|shipping-option-types|shipping-profiles)(?:\/|$)/.test(
      path
    ) ||
    /Modules\.FULFILLMENT|Fulfillment.*Workflow|Shipping.*Workflow/.test(source)
  ) {
    fulfillmentRoutes.push(path)
  }
}

const linkDefinitionFiles = await walk(
  join(root, "packages/modules/link-modules/src/definitions")
)
const fulfillmentLinkDefinitions = []
for (const file of linkDefinitionFiles.filter((path) => path.endsWith(".ts"))) {
  const source = await readFile(file, "utf8")
  if (/Modules\.FULFILLMENT/.test(source)) {
    fulfillmentLinkDefinitions.push(projectPath(file))
  }
}

const fulfillmentSourceFiles = (
  await walk(join(root, "packages/modules/fulfillment/src"))
).filter(
  (path) =>
    path.endsWith(".ts") &&
    !path.includes(`${sep}migrations${sep}`) &&
    !path.includes(`${sep}__tests__${sep}`)
)
const rawPersistencePaths = []
for (const file of fulfillmentSourceFiles) {
  if (file.endsWith(`${sep}database-context.ts`)) {
    continue
  }
  const source = await readFile(file, "utf8")
  if (
    /raw\(|\.execute\(|\bknex\b|createQueryBuilder|nativeUpdate|nativeDelete/.test(
      source
    )
  ) {
    rawPersistencePaths.push(projectPath(file))
  }
}

const packageTypeScriptFiles = (await walk(join(root, "packages"))).filter(
  (path) => path.endsWith(".ts")
)
const fulfillmentJobSubscriberPaths = []
for (const file of packageTypeScriptFiles) {
  const path = projectPath(file)
  if (
    !/(?:^|\/)(?:jobs|subscribers)\//.test(path) ||
    path.includes("/__tests__/") ||
    path.includes("/__fixtures__/")
  ) {
    continue
  }
  const source = await readFile(file, "utf8")
  if (
    /Modules\.FULFILLMENT|IFulfillmentModuleService|fulfillment\.(?:created|updated|deleted|canceled)/.test(
      source
    )
  ) {
    fulfillmentJobSubscriberPaths.push(path)
  }
}

const providerBoundaryFiles = [
  "packages/modules/fulfillment/src/loaders/providers.ts",
  "packages/modules/fulfillment/src/services/fulfillment-provider.ts",
]
const queryBoundaryFiles = [
  "packages/modules/fulfillment/src/joiner-config.ts",
  "packages/modules/fulfillment/src/schema/index.ts",
]

const integrationTestFiles = (
  await walk(
    join(root, "packages/modules/fulfillment/integration-tests/__tests__")
  )
)
  .filter((path) => path.endsWith(".spec.ts"))
  .map(projectPath)

const observed = {
  fulfillmentTables: inventory(fulfillmentTables),
  modelFiles: inventory(modelFiles.map(projectPath)),
  modelUniqueIndexes: inventory(modelUniqueIndexes),
  declaredServiceMethods: inventory(declaredServiceMethods),
  coreFlowFulfillmentReferences: inventory(coreFlowFulfillmentReferences),
  fulfillmentWorkflowFiles: inventory(fulfillmentWorkflowFiles),
  fulfillmentStepFiles: inventory(fulfillmentStepFiles),
  asynchronousFulfillmentPaths: inventory(asynchronousFulfillmentPaths),
  fulfillmentRoutes: inventory(fulfillmentRoutes),
  fulfillmentLinkDefinitions: inventory(fulfillmentLinkDefinitions),
  rawPersistencePaths: inventory(rawPersistencePaths),
  fulfillmentJobSubscriberPaths: inventory(fulfillmentJobSubscriberPaths),
  providerBoundaryFiles: inventory(providerBoundaryFiles),
  queryBoundaryFiles: inventory(queryBoundaryFiles),
  integrationTestFiles: inventory(integrationTestFiles),
}

if (process.argv.includes("--snapshot")) {
  console.log(JSON.stringify(observed, null, 2))
  process.exit(0)
}

const contract = JSON.parse(await readFile(contractPath, "utf8"))
const upstreamLock = JSON.parse(
  await readFile(join(root, ".royalroyals/upstream-lock.json"), "utf8")
)
const errors = []
if (
  contract.upstreamVersion !== upstreamLock.version ||
  contract.upstreamRevision !== upstreamLock.commit
) {
  errors.push("Fulfillment contract does not match the pinned upstream source")
}
if (
  contract.phase !== "7G-6" ||
  contract.admission.candidateGatesChanged.length
) {
  errors.push("Fulfillment design phase or no-admission invariant changed")
}
for (const [name, expected] of Object.entries(contract.inventory)) {
  compareInventory(name, expected, observed[name], errors)
}

const direct = sorted(contract.schema.directStoreOwnedTables)
const global = sorted(contract.schema.globalReferenceTables)
if (
  JSON.stringify(sorted([...direct, ...global])) !==
  JSON.stringify(sorted(fulfillmentTables))
) {
  errors.push(
    "schema ownership classification does not cover every Fulfillment table"
  )
}
if (direct.some((table) => global.includes(table))) {
  errors.push("Fulfillment table cannot be both Store-owned and global")
}
if (direct.length !== 11 || global.length !== 1) {
  errors.push(
    "Fulfillment ownership classification must retain 11 direct and 1 global table"
  )
}
if (contract.attackMatrix.length < 30) {
  errors.push(
    "Fulfillment attack matrix must retain at least thirty named cases"
  )
}
if (contract.internalGates.some((gate) => gate.status !== "local-complete")) {
  errors.push("Fulfillment inventory requires locally complete internal gates")
}

const coreFlowAgent = await readFile(
  join(root, "packages/core/core-flows/AGENTS.md"),
  "utf8"
)
if (!/Shipping\s+Option\/Price Set/.test(coreFlowAgent)) {
  errors.push("existing Pricing-side Shipping Option link guard is missing")
}

if (errors.length) {
  throw new Error(errors.join("\n"))
}

console.log(
  `Verified Fulfillment/shipping inventory: ${observed.fulfillmentTables.count} tables, ${observed.coreFlowFulfillmentReferences.count} core-flow references, ${observed.fulfillmentRoutes.count} routes, ${observed.fulfillmentLinkDefinitions.count} links, and ${contract.attackMatrix.length} attack cases.`
)
