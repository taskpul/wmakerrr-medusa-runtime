import { createHash } from "node:crypto"
import { access, readFile, readdir, writeFile } from "node:fs/promises"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const metadata = join(root, ".royalroyals")
const graphPath = join(metadata, "public-package-graph.json")
const manifestPath = join(metadata, "candidate-manifest.json")
const scriptPath = fileURLToPath(import.meta.url)
const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
]
const ignoredDirectories = new Set([".git", ".medusa", "dist", "node_modules"])
const sourceExtensions = new Set([".cjs", ".js", ".json", ".mjs", ".ts", ".tsx"])
const forbiddenReferences = [
  /@medusajs\/auth-oidc/,
  /@medusajs\/medusa\/auth-oidc/,
  /@medusajs\/medusa\/rbac/,
  /\bModules\.RBAC\b/,
  /\bI?Rbac[A-Z]/,
  /\bAdminRbac[A-Z]/,
  /\brbac_role(?:_id)?\b/,
  /\bPolicyDefinition\b/,
  /\bPolicyOperation\b/,
  /\bdefinePolicies\b/,
  /\bpoliciesLoader\b/,
]

const toPosix = (path) => path.replaceAll("\\", "/")
const sha256 = (value) => createHash("sha256").update(value).digest("hex")
const sortObject = (value) => Object.fromEntries(
  Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
)

async function walk(directory, accept) {
  const files = []

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue
    }

    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walk(path, accept))
    } else if (accept(path)) {
      files.push(path)
    }
  }

  return files
}

async function createPublicPackageGraph() {
  const manifests = await walk(
    join(root, "packages"),
    (path) => path.endsWith("package.json")
  )
  const packages = await Promise.all(manifests.map(async (path) => ({
    path,
    manifest: JSON.parse(await readFile(path, "utf8")),
  })))
  const publicPackages = packages.filter(({ manifest }) => !manifest.private)
  const workspaceNames = new Set(packages.map(({ manifest }) => manifest.name))

  const nodes = publicPackages.map(({ path, manifest }) => {
    const workspaceDependencies = {}

    for (const field of dependencyFields) {
      const dependencies = Object.fromEntries(
        Object.entries(manifest[field] ?? {})
          .filter(([name]) => workspaceNames.has(name))
          .sort(([left], [right]) => left.localeCompare(right))
      )

      if (Object.keys(dependencies).length) {
        workspaceDependencies[field] = dependencies
      }
    }

    return {
      name: manifest.name,
      path: toPosix(relative(root, dirname(path))),
      version: manifest.version,
      workspaceDependencies: sortObject(workspaceDependencies),
    }
  }).sort(({ name: left }, { name: right }) => left.localeCompare(right))

  return {
    schemaVersion: 1,
    upstreamVersion: "2.22.2",
    packageCount: nodes.length,
    packages: nodes,
  }
}

async function verifySourceReferences(errors) {
  const sourceFiles = await walk(join(root, "packages"), (path) => {
    const normalized = toPosix(path)
    const extension = normalized.slice(normalized.lastIndexOf("."))

    return sourceExtensions.has(extension) &&
      !normalized.includes("/__tests__/") &&
      !normalized.includes("/i18n/translations/") &&
      !normalized.endsWith(".spec.ts") &&
      !normalized.endsWith(".spec.tsx")
  })

  for (const path of sourceFiles) {
    const source = await readFile(path, "utf8")
    if (forbiddenReferences.some((pattern) => pattern.test(source))) {
      errors.push(`excluded Enterprise reference remains in ${toPosix(relative(root, path))}`)
    }
  }
}

const graph = await createPublicPackageGraph()
const graphJson = `${JSON.stringify(graph, null, 2)}\n`

if (process.argv.includes("--write-graph")) {
  await writeFile(graphPath, graphJson)
  console.log(`Wrote ${graph.packageCount} public packages to ${relative(root, graphPath)}.`)
  process.exit(0)
}

const errors = []
const recordedGraph = await readFile(graphPath, "utf8")
const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
const exclusions = (await readFile(join(metadata, "enterprise-exclusions.txt"), "utf8"))
  .split(/\r?\n/)
  .filter(Boolean)

if (recordedGraph !== graphJson) {
  errors.push("public package graph is stale")
}
if (graph.packageCount !== 79) {
  errors.push(`expected 79 public packages, found ${graph.packageCount}`)
}
if (graph.packages.some(({ name }) => ["@medusajs/auth-oidc", "@medusajs/rbac"].includes(name))) {
  errors.push("public package graph contains an excluded Enterprise package")
}
for (const path of exclusions) {
  try {
    await access(join(root, path))
    errors.push(`excluded Enterprise path is present: ${path}`)
  } catch (error) {
    if (error?.code !== "ENOENT") throw error
  }
}

await verifySourceReferences(errors)

const evidence = manifest.baselineEvidence
if (manifest.status !== "draft-unsigned" || manifest.artifactDigest !== null || manifest.packages.length) {
  errors.push("baseline candidate must remain unsigned and unpublished")
}
if (evidence?.status !== "local-reproducible") {
  errors.push("candidate does not identify local reproducible baseline evidence")
} else {
  if (evidence.publicPackageGraph.sha256 !== sha256(recordedGraph)) {
    errors.push("candidate public package graph digest is stale")
  }
  if (evidence.verifier.sha256 !== sha256(await readFile(scriptPath))) {
    errors.push("candidate baseline verifier digest is stale")
  }
}
for (const [gateId, gate] of Object.entries(manifest.gates)) {
  if (gate.status !== "pending" || gate.evidenceDigest !== null) {
    errors.push(`admission gate is prematurely claimed: ${gateId}`)
  }
}

if (errors.length) {
  throw new Error(errors.join("\n"))
}

console.log(
  `Verified license-safe baseline with ${graph.packageCount} public packages; admission gates remain pending.`
)
