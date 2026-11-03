import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { basename, dirname, join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const contractPath = join(root, ".royalroyals/product-catalog-boundary.json")

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

const snapshot = JSON.parse(
  await readFile(
    join(
      root,
      "packages/modules/product/src/migrations/.snapshot-medusa-product.json"
    ),
    "utf8"
  )
)
const productTables = snapshot.tables.map((table) => table.name)
const uniqueIndexes = snapshot.tables.flatMap((table) =>
  Object.values(table.indexes ?? {}).flatMap((index) => {
    const expression = index.expression ?? ""
    if (!index.unique && !/create\s+unique\s+index/i.test(expression)) {
      return []
    }

    const expressionName = expression.match(
      /index(?:\s+if\s+not\s+exists)?\s+"([^"]+)"/i
    )?.[1]
    return [`${table.name}:${index.name ?? expressionName ?? "primary"}`]
  })
)

const modelFiles = (
  await walk(join(root, "packages/modules/product/src/models"))
)
  .filter((path) => path.endsWith(".ts") && basename(path) !== "index.ts")
  .map(projectPath)

const productServiceSource = await readFile(
  join(root, "packages/modules/product/src/services/product-module-service.ts"),
  "utf8"
)
const declaredServiceMethods = [
  ...productServiceSource.matchAll(/^  async ([A-Za-z0-9_]+)\(/gm),
].map((match) => match[1])

const coreFlowFiles = (
  await walk(join(root, "packages/core/core-flows/src"))
).filter(
  (path) => path.endsWith(".ts") && !path.includes(`${sep}__tests__${sep}`)
)
const coreFlowProductReferences = []
for (const file of coreFlowFiles) {
  const source = await readFile(file, "utf8")
  if (
    /Modules\.PRODUCT|IProductModuleService|ProductModuleService/.test(source)
  ) {
    coreFlowProductReferences.push(projectPath(file))
  }
}

const productWorkflowDirectory = join(
  root,
  "packages/core/core-flows/src/product/workflows"
)
const productStepDirectory = join(
  root,
  "packages/core/core-flows/src/product/steps"
)
const productWorkflowFiles = (await readdir(productWorkflowDirectory))
  .filter((name) => name.endsWith(".ts") && name !== "index.ts")
  .map((name) => projectPath(join(productWorkflowDirectory, name)))
const productStepFiles = (await readdir(productStepDirectory))
  .filter((name) => name.endsWith(".ts") && name !== "index.ts")
  .map((name) => projectPath(join(productStepDirectory, name)))

const asynchronousProductPaths = []
for (const file of [
  ...productWorkflowFiles.map((path) => join(root, path)),
  ...productStepFiles.map((path) => join(root, path)),
]) {
  const source = await readFile(file, "utf8")
  if (/async:\s*true|backgroundExecution:\s*true/.test(source)) {
    asynchronousProductPaths.push(projectPath(file))
  }
}

const catalogRouteSegments = new Set([
  "collections",
  "product-categories",
  "product-options",
  "product-tags",
  "product-types",
  "product-variants",
  "products",
])
async function catalogRoutes(audience) {
  const routeRoot = join(root, `packages/medusa/src/api/${audience}`)
  return (await walk(routeRoot))
    .filter((path) => basename(path) === "route.ts")
    .filter((path) =>
      projectPath(path)
        .split("/")
        .some((segment) => catalogRouteSegments.has(segment))
    )
    .map(projectPath)
}

const linkDefinitionFiles = await walk(
  join(root, "packages/modules/link-modules/src/definitions")
)
const productLinkDefinitions = []
for (const file of linkDefinitionFiles.filter((path) => path.endsWith(".ts"))) {
  const source = await readFile(file, "utf8")
  if (/Modules\.PRODUCT/.test(source)) {
    productLinkDefinitions.push(projectPath(file))
  }
}

const productSourceFiles = (
  await walk(join(root, "packages/modules/product/src"))
)
  .filter((path) => path.endsWith(".ts"))
  .filter(
    (path) =>
      !path.includes(`${sep}migrations${sep}`) &&
      !path.includes(`${sep}__tests__${sep}`)
  )
const rawPersistencePaths = []
for (const file of productSourceFiles) {
  const source = await readFile(file, "utf8")
  if (
    /raw\(|execute\(|\bknex\b|createQueryBuilder|nativeUpdate|nativeDelete/.test(
      source
    )
  ) {
    rawPersistencePaths.push(projectPath(file))
  }
}

const packageTypeScriptFiles = (await walk(join(root, "packages"))).filter(
  (path) => path.endsWith(".ts")
)
const productJobSubscriberPaths = []
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
    /Modules\.PRODUCT|IProductModuleService|ProductModuleService|product\.(?:created|updated|deleted|restored)/.test(
      source
    )
  ) {
    productJobSubscriberPaths.push(path)
  }
}

const observed = {
  productTables: inventory(productTables),
  uniqueIndexes: inventory(uniqueIndexes),
  modelFiles: inventory(modelFiles),
  declaredServiceMethods: inventory(declaredServiceMethods),
  coreFlowProductReferences: inventory(coreFlowProductReferences),
  productWorkflowFiles: inventory(productWorkflowFiles),
  productStepFiles: inventory(productStepFiles),
  asynchronousProductPaths: inventory(asynchronousProductPaths),
  adminRoutes: inventory(await catalogRoutes("admin")),
  storeRoutes: inventory(await catalogRoutes("store")),
  productLinkDefinitions: inventory(productLinkDefinitions),
  rawPersistencePaths: inventory(rawPersistencePaths),
  productJobSubscriberPaths: inventory(productJobSubscriberPaths),
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
  errors.push("Product contract does not match the pinned upstream source")
}
if (
  contract.phase !== "7G-5A" ||
  contract.admission.candidateGatesChanged.length
) {
  errors.push("Product design phase or no-admission invariant changed")
}
for (const [name, expected] of Object.entries(contract.inventory)) {
  compareInventory(name, expected, observed[name], errors)
}

const direct = sorted(contract.schema.directStoreOwnedTables)
const derived = sorted(contract.schema.parentDerivedPivotTables)
if (
  JSON.stringify(sorted([...direct, ...derived])) !==
  JSON.stringify(sorted(productTables))
) {
  errors.push(
    "schema ownership classification does not cover every Product table"
  )
}
if (direct.some((table) => derived.includes(table))) {
  errors.push("Product table cannot be both direct-owned and parent-derived")
}
if (direct.length !== 12 || derived.length !== 3) {
  errors.push(
    "Product ownership classification must retain 12 direct and 3 derived tables"
  )
}
if (contract.attackMatrix.length < 20) {
  errors.push("Product attack matrix must retain at least twenty named cases")
}
if (
  JSON.stringify(contract.implementationSlices.map((slice) => slice.id)) !==
  JSON.stringify(["7G-5B", "7G-5C", "7G-5D", "7G-5E"])
) {
  errors.push("Product implementation slices changed or are out of order")
}

const defaultIndexSchema = await readFile(
  join(root, "packages/modules/index/src/utils/default-schema.ts"),
  "utf8"
)
for (const marker of [
  "Modules.PRODUCT}.product.created",
  "Modules.PRODUCT}.product-variant.created",
]) {
  if (!defaultIndexSchema.includes(marker)) {
    errors.push(`default Product index schema lost marker ${marker}`)
  }
}

const workflowExport = await readFile(
  join(root, "packages/core/workflows-sdk/src/helper/workflow-export.ts"),
  "utf8"
)
if (!workflowExport.includes("storeId,")) {
  errors.push("async workflow Store provenance is not installed")
}

if (errors.length) {
  throw new Error(errors.join("\n"))
}

console.log(
  `Verified Product/catalog design inventory: ${observed.productTables.count} tables, ${observed.coreFlowProductReferences.count} core-flow references, ${observed.adminRoutes.count + observed.storeRoutes.count} routes, ${observed.productLinkDefinitions.count} link definitions, and ${contract.attackMatrix.length} attack cases.`
)
