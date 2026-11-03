import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { dirname, join, posix } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const metadata = join(root, ".royalroyals")
const exceptionLedgerPath = join(metadata, "public-api-exceptions.json")
const candidateManifestPath = join(metadata, "candidate-manifest.json")
const upstreamLock = JSON.parse(
  await readFile(join(metadata, "upstream-lock.json"), "utf8")
)
const packageGraph = JSON.parse(
  await readFile(join(metadata, "public-package-graph.json"), "utf8")
)
const exceptionLedgerSource = await readFile(exceptionLedgerPath, "utf8")
const approvedChanges = JSON.parse(exceptionLedgerSource)
const candidateManifest = JSON.parse(
  await readFile(candidateManifestPath, "utf8")
)
const enterpriseExclusions = (
  await readFile(join(metadata, "enterprise-exclusions.txt"), "utf8")
)
  .split(/\r?\n/)
  .filter(Boolean)
  .map((path) => path.replaceAll("\\", "/").replace(/\/$/, ""))

const publicManifestFields = [
  "name",
  "version",
  "type",
  "main",
  "module",
  "types",
  "typings",
  "bin",
  "exports",
  "imports",
  "files",
  "engines",
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
  "peerDependenciesMeta",
]
const scriptPath = fileURLToPath(import.meta.url)
const sha256 = (value) => createHash("sha256").update(value).digest("hex")
const sourceSha256 = (value) => sha256(value.replaceAll("\r\n", "\n"))
const errors = []
const suggestions = []

function git(args, options = {}) {
  return spawnSync("git", args, {
    cwd: root,
    encoding: options.encoding ?? "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
}

function loadUpstreamSources() {
  const tree = spawnSync(
    "git",
    [
      "ls-tree",
      "-r",
      "-z",
      "--format=%(objectname)%x09%(path)",
      upstreamLock.commit,
      "--",
      "packages",
    ],
    { cwd: root, encoding: null, maxBuffer: 64 * 1024 * 1024 }
  )
  if (tree.status !== 0) {
    throw new Error(tree.stderr.toString("utf8"))
  }

  const entries = tree.stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf("\t")
      return {
        oid: entry.slice(0, separator),
        path: entry.slice(separator + 1),
      }
    })
    .filter(
      ({ path }) =>
        !isEnterprisePath(path) &&
        (path.endsWith("package.json") || /\.(?:ts|tsx)$/.test(path))
    )
  const objects = spawnSync("git", ["cat-file", "--batch"], {
    cwd: root,
    input: `${entries.map(({ oid }) => oid).join("\n")}\n`,
    encoding: null,
    maxBuffer: 512 * 1024 * 1024,
  })
  if (objects.status !== 0) {
    throw new Error(objects.stderr.toString("utf8"))
  }

  const sources = new Map()
  let offset = 0
  entries.forEach(({ path }) => {
    const headerEnd = objects.stdout.indexOf(10, offset)
    const header = objects.stdout.subarray(offset, headerEnd).toString("utf8")
    const size = Number(header.split(" ")[2])
    const contentStart = headerEnd + 1
    const contentEnd = contentStart + size
    sources.set(
      path,
      objects.stdout.subarray(contentStart, contentEnd).toString("utf8")
    )
    offset = contentEnd + 1
  })

  return sources
}

async function readCurrent(path) {
  try {
    return await readFile(join(root, path), "utf8")
  } catch (error) {
    if (error?.code === "ENOENT") return null
    throw error
  }
}

function isEnterprisePath(path) {
  return enterpriseExclusions.some(
    (excluded) => path === excluded || path.startsWith(`${excluded}/`)
  )
}

function collectStringTargets(value, targets = new Set()) {
  if (typeof value === "string") {
    targets.add(value)
  } else if (Array.isArray(value)) {
    value.forEach((entry) => collectStringTargets(entry, targets))
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((entry) =>
      collectStringTargets(entry, targets)
    )
  }
  return targets
}

function sourceCandidates(packagePath, target) {
  if (!target.startsWith(".")) return []

  let source = target.replace(/^\.\//, "")
  source = source.replace(/^dist\/(?:esm\/)?/, "src/")
  source = source.replace(/\.d\.(?:cts|mts|ts)$/, "")
  source = source.replace(/\.(?:cjs|js|mjs)$/, "")

  return [
    `${packagePath}/${source}.ts`,
    `${packagePath}/${source}.tsx`,
    `${packagePath}/${source}/index.ts`,
    `${packagePath}/${source}/index.tsx`,
  ].map(posix.normalize)
}

async function firstExisting(candidates, reader) {
  for (const candidate of candidates) {
    if ((await reader(candidate)) !== null) return candidate
  }
  return null
}

function localExportSpecifiers(source) {
  const specifiers = []
  const pattern =
    /\bexport\s+(?:type\s+)?(?:\*|\{[\s\S]*?\})\s+from\s+["'](\.[^"']+)["']/g
  let match
  while ((match = pattern.exec(source)) !== null) {
    specifiers.push(match[1])
  }
  return specifiers
}

function reexportCandidates(path, specifier) {
  const base = posix
    .normalize(posix.join(posix.dirname(path), specifier))
    .replace(/\.(?:cjs|js|mjs)$/, "")
  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]
}

async function collectExportGraph(entrypoints, reader) {
  const visited = new Set()
  const queue = [...entrypoints]

  while (queue.length) {
    const path = queue.shift()
    if (visited.has(path) || isEnterprisePath(path)) continue

    const source = await reader(path)
    if (source === null) continue
    visited.add(path)

    for (const specifier of localExportSpecifiers(source)) {
      const target = await firstExisting(
        reexportCandidates(path, specifier),
        reader
      )
      if (target && !visited.has(target)) queue.push(target)
    }
  }

  return visited
}

function normalizeManifest(manifest, { upstream = false } = {}) {
  const normalized = Object.fromEntries(
    publicManifestFields
      .filter((field) => manifest[field] !== undefined)
      .map((field) => [field, manifest[field]])
  )

  if (upstream && normalized.name === "@medusajs/medusa") {
    normalized.dependencies = { ...normalized.dependencies }
    delete normalized.dependencies["@medusajs/auth-oidc"]
    delete normalized.dependencies["@medusajs/rbac"]
  }

  return normalized
}

const upstreamObject = git([
  "cat-file",
  "-e",
  `${upstreamLock.commit}^{commit}`,
])
if (upstreamObject.status !== 0) {
  throw new Error(
    `Pinned upstream commit ${upstreamLock.commit} is unavailable. Fetch that exact commit before verification.`
  )
}
const upstreamSources = loadUpstreamSources()
const readUpstream = (path) => upstreamSources.get(path) ?? null

if (approvedChanges.upstreamCommit !== upstreamLock.commit) {
  errors.push("public API exception ledger targets the wrong upstream commit")
}
if (approvedChanges.packageCount !== packageGraph.packageCount) {
  errors.push("public API exception ledger has a stale package count")
}

const exceptionByPath = new Map(
  approvedChanges.changes.map((change) => [change.path, change])
)
const hasApprovedReason = (change) =>
  change?.reason.startsWith("License-driven ") ||
  change?.reason.startsWith("Controlled-distribution ")
const observedExceptions = new Set()
const currentPublicFiles = new Set()

for (const packageEntry of packageGraph.packages) {
  const manifestPath = `${packageEntry.path}/package.json`
  const currentManifestSource = await readCurrent(manifestPath)
  const upstreamManifestSource = readUpstream(manifestPath)

  if (!currentManifestSource || !upstreamManifestSource) {
    errors.push(`public package manifest is missing: ${manifestPath}`)
    continue
  }

  const currentManifest = JSON.parse(currentManifestSource)
  const upstreamManifest = JSON.parse(upstreamManifestSource)
  if (
    JSON.stringify(normalizeManifest(currentManifest)) !==
    JSON.stringify(normalizeManifest(upstreamManifest, { upstream: true }))
  ) {
    errors.push(`public package manifest changed incompatibly: ${manifestPath}`)
  }

  const targetFields = [
    currentManifest.main,
    currentManifest.module,
    currentManifest.types,
    currentManifest.typings,
    currentManifest.bin,
    currentManifest.exports,
  ]
  const upstreamTargetFields = [
    upstreamManifest.main,
    upstreamManifest.module,
    upstreamManifest.types,
    upstreamManifest.typings,
    upstreamManifest.bin,
    upstreamManifest.exports,
  ]
  const currentTargets = new Set()
  const upstreamTargets = new Set()
  targetFields.forEach((value) => collectStringTargets(value, currentTargets))
  upstreamTargetFields.forEach((value) =>
    collectStringTargets(value, upstreamTargets)
  )

  const currentEntrypoints = new Set()
  for (const target of currentTargets) {
    const entrypoint = await firstExisting(
      sourceCandidates(packageEntry.path, target),
      readCurrent
    )
    if (entrypoint) currentEntrypoints.add(entrypoint)
  }
  const upstreamEntrypoints = new Set()
  for (const target of upstreamTargets) {
    const entrypoint = await firstExisting(
      sourceCandidates(packageEntry.path, target),
      async (path) => readUpstream(path)
    )
    if (entrypoint) upstreamEntrypoints.add(entrypoint)
  }

  const currentGraph = await collectExportGraph(currentEntrypoints, readCurrent)
  const upstreamGraph = await collectExportGraph(
    upstreamEntrypoints,
    async (path) => readUpstream(path)
  )
  currentGraph.forEach((path) => currentPublicFiles.add(path))

  for (const path of new Set([...currentGraph, ...upstreamGraph])) {
    if (isEnterprisePath(path)) continue

    const currentSource = await readCurrent(path)
    const upstreamSource = readUpstream(path)
    const exception = exceptionByPath.get(path)
    if (currentSource === null && upstreamSource !== null) {
      const upstreamDigest = sourceSha256(upstreamSource)
      if (
        exception?.upstreamSha256 === upstreamDigest &&
        exception.currentSha256 === null &&
        hasApprovedReason(exception)
      ) {
        observedExceptions.add(path)
      } else {
        suggestions.push({
          path,
          upstreamSha256: upstreamDigest,
          currentSha256: null,
          reason: "License-driven removal of an excluded Enterprise contract.",
        })
        errors.push(`unapproved public API source removal: ${path}`)
      }
      continue
    }
    if (currentSource !== null && upstreamSource === null) {
      const currentDigest = sourceSha256(currentSource)
      if (
        exception?.upstreamSha256 === null &&
        exception.currentSha256 === currentDigest &&
        hasApprovedReason(exception)
      ) {
        observedExceptions.add(path)
      } else {
        suggestions.push({
          path,
          upstreamSha256: null,
          currentSha256: currentDigest,
          reason: "Controlled-distribution public extension.",
        })
        errors.push(`unapproved public API source addition: ${path}`)
      }
      continue
    }
    if (currentSource === null || upstreamSource === null) continue

    const currentDigest = sourceSha256(currentSource)
    const upstreamDigest = sourceSha256(upstreamSource)

    if (currentDigest === upstreamDigest) {
      if (exception) errors.push(`public API exception is stale: ${path}`)
      continue
    }
    if (!exception) {
      suggestions.push({
        path,
        upstreamSha256: upstreamDigest,
        currentSha256: currentDigest,
        reason: "License-driven removal of an excluded Enterprise contract.",
      })
      errors.push(
        `unapproved public API source change: ${path} (${upstreamDigest} -> ${currentDigest})`
      )
      continue
    }
    if (
      exception.upstreamSha256 !== upstreamDigest ||
      exception.currentSha256 !== currentDigest ||
      !hasApprovedReason(exception)
    ) {
      errors.push(`public API exception digest or reason is invalid: ${path}`)
      continue
    }
    observedExceptions.add(path)
  }
}

for (const path of exceptionByPath.keys()) {
  if (!observedExceptions.has(path)) {
    errors.push(`public API exception was not observed: ${path}`)
  }
}

const evidence = approvedChanges.evidence
if (evidence?.verifierSha256 !== sha256(await readFile(scriptPath))) {
  errors.push("public API verifier digest is stale")
}
if (evidence?.publicFileCount !== currentPublicFiles.size) {
  errors.push(
    `public API file count is stale: expected ${evidence?.publicFileCount}, found ${currentPublicFiles.size}`
  )
}

const candidateEvidence =
  candidateManifest.baselineEvidence?.publicApiCompatibility
const observedLicenseExceptions = [...observedExceptions].filter((path) =>
  exceptionByPath.get(path).reason.startsWith("License-driven ")
).length
const observedControlledDistributionExtensions =
  observedExceptions.size - observedLicenseExceptions
if (
  candidateEvidence?.status !== "local-verified" ||
  candidateEvidence.upstreamRevision !== upstreamLock.commit ||
  candidateEvidence.packageCount !== packageGraph.packageCount ||
  candidateEvidence.publicSourceFileCount !== currentPublicFiles.size ||
  candidateEvidence.approvedLicenseExceptions !== observedLicenseExceptions ||
  candidateEvidence.approvedControlledDistributionExtensions !==
    observedControlledDistributionExtensions
) {
  errors.push("candidate public API compatibility summary is stale")
}
if (
  candidateEvidence?.verifier?.path !== ".royalroyals/verify-public-api.mjs" ||
  candidateEvidence.verifier.sha256 !== sha256(await readFile(scriptPath))
) {
  errors.push("candidate public API verifier evidence is stale")
}
if (
  candidateEvidence?.exceptionLedger?.path !==
    ".royalroyals/public-api-exceptions.json" ||
  candidateEvidence.exceptionLedger.sha256 !== sha256(exceptionLedgerSource)
) {
  errors.push("candidate public API exception ledger evidence is stale")
}

if (process.argv.includes("--suggest")) {
  console.log(
    JSON.stringify(
      {
        schemaVersion: 1,
        upstreamCommit: upstreamLock.commit,
        packageCount: packageGraph.packageCount,
        changes: suggestions.sort(({ path: left }, { path: right }) =>
          left.localeCompare(right)
        ),
        evidence: {
          publicFileCount: currentPublicFiles.size,
          verifierSha256: sha256(await readFile(scriptPath)),
        },
      },
      null,
      2
    )
  )
  process.exit(0)
}
if (process.argv.includes("--report")) {
  console.log(errors.join("\n"))
  process.exit(errors.length ? 1 : 0)
}
if (errors.length) {
  throw new Error(errors.join("\n"))
}

console.log(
  `Verified ${packageGraph.packageCount} public package manifests and ${currentPublicFiles.size} transitive public source files against Medusa ${upstreamLock.version}; ${observedLicenseExceptions} license exclusions and ${observedControlledDistributionExtensions} controlled-distribution extensions approved.`
)
