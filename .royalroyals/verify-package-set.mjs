import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const packageSetDirectory = process.argv[2]

if (!packageSetDirectory) {
  throw new Error("Usage: node .royalroyals/verify-package-set.mjs <package-set-directory>")
}

const directory = resolve(packageSetDirectory)
const graph = JSON.parse(
  await readFile(join(root, ".royalroyals/public-package-graph.json"), "utf8")
)
const manifest = JSON.parse(
  await readFile(join(directory, "controlled-distribution-release.json"), "utf8")
)
const errors = []
const sha256 = async (path) =>
  createHash("sha256").update(await readFile(path)).digest("hex")
const packageTargets = (value) => {
  if (typeof value === "string") {
    return [value]
  }
  if (Array.isArray(value)) {
    return value.flatMap(packageTargets)
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(packageTargets)
  }
  return []
}
const upstreamMissingDeclaredContent = new Map([
  ["@medusajs/medusa", new Set(["oas"])],
  ["@medusajs/ui", new Set(["styles.css"])],
])
const isUpstreamMissingDeclaredContent = (packageName, target) =>
  upstreamMissingDeclaredContent.get(packageName)?.has(target) ?? false
const targetExists = (target, archiveEntries) => {
  const normalizedTarget = target.replace(/^\.\//, "")
  const archiveTarget = `package/${normalizedTarget}`
  const wildcard = archiveTarget.indexOf("*")
  if (wildcard !== -1) {
    const prefix = archiveTarget.slice(0, wildcard)
    return [...archiveEntries].some((path) => path.startsWith(prefix))
  }
  return archiveEntries.has(archiveTarget) ||
    [...archiveEntries].some((path) => path.startsWith(`${archiveTarget}/`))
}
const unresolvedWorkspaceAlias =
  /(?:require\(\s*|from\s+|import\(\s*)["'](@models|@providers|@repositories|@services|@types|@utils)(?:\/[^"']*)?["']/
const findUnresolvedWorkspaceAlias = async (archive) => {
  const stagingDirectory = await mkdtemp(join(tmpdir(), "rr-verify-package-"))
  try {
    const unpack = spawnSync(
      "tar",
      ["-xzf", archive, "-C", stagingDirectory],
      { encoding: "utf8" }
    )
    if (unpack.status !== 0) {
      throw new Error("archive cannot be extracted")
    }

    const visit = async (directory) => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) {
          const match = await visit(path)
          if (match) {
            return match
          }
          continue
        }
        if (!/\.(c|m)?js$/.test(entry.name)) {
          continue
        }
        const source = await readFile(path, "utf8")
        const match = source.match(unresolvedWorkspaceAlias)
        if (match) {
          return { alias: match[1], path }
        }
      }
    }

    return await visit(join(stagingDirectory, "package"))
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true })
  }
}

if (manifest.contractVersion !== 1 || manifest.status !== "unsigned") {
  errors.push("release manifest must be an unsigned contract version 1 candidate")
}
if (!/^[a-f0-9]{40}$/.test(manifest.sourceRevision)) {
  errors.push("release manifest source revision is not immutable")
}
if (manifest.upstreamVersion !== graph.upstreamVersion) {
  errors.push("release manifest upstream version does not match the public graph")
}
if (!Array.isArray(manifest.packages)) {
  errors.push("release manifest packages are missing")
}
if (
  manifest.sourceRepository !==
  "https://github.com/taskpul/wmakerrr-medusa-runtime.git"
) {
  errors.push("release manifest source repository is not controlled")
}
if (
  manifest.distributionVersion !==
  `${graph.upstreamVersion}-rr.${manifest.sourceRevision?.slice(0, 12)}`
) {
  errors.push("release manifest distribution version is not source-bound")
}
if (
  !manifest.gates ||
  typeof manifest.gates !== "object" ||
  Array.isArray(manifest.gates) ||
  Object.keys(manifest.gates).length
) {
  errors.push("unsigned release manifest must not declare passing gates")
}

const graphPackages = new Map(
  graph.packages.map((entry) => [entry.name, entry.version])
)
const releasePackages = Array.isArray(manifest.packages) ? manifest.packages : []
const packageNames = new Set()
const archiveNames = new Set()
for (const entry of releasePackages) {
  if (packageNames.has(entry.name)) {
    errors.push(`duplicate release package ${entry.name}`)
  }
  packageNames.add(entry.name)
  if (graphPackages.get(entry.name) !== entry.version) {
    errors.push(`release package ${entry.name} does not match the public graph`)
  }
  if (
    typeof entry.file !== "string" ||
    !/^[a-zA-Z0-9._-]+\.tgz$/.test(entry.file)
  ) {
    errors.push(`release package ${entry.name} has an unsafe archive name`)
    continue
  }
  if (archiveNames.has(entry.file)) {
    errors.push(`duplicate release archive ${entry.file}`)
  }
  archiveNames.add(entry.file)
  try {
    const archive = join(directory, entry.file)
    if ((await sha256(archive)) !== entry.digest) {
      errors.push(`release package ${entry.name} digest does not match`)
    }
    const archiveEntries = spawnSync("tar", ["-tf", archive], {
      encoding: "utf8",
    })
    if (archiveEntries.status !== 0) {
      errors.push(`release package ${entry.name} archive cannot be listed`)
      continue
    }
    const packedEntries = new Set(archiveEntries.stdout
      .split(/\r?\n/)
      .filter(Boolean))
    const unsafeEntry = [...packedEntries]
      .find((path) => !path.startsWith("package/") || path.includes("../"))
    if (unsafeEntry) {
      errors.push(`release package ${entry.name} contains unsafe path ${unsafeEntry}`)
    } else {
      const unresolvedAlias = await findUnresolvedWorkspaceAlias(archive)
      if (unresolvedAlias) {
        errors.push(
          `release package ${entry.name} contains unresolved workspace alias ${unresolvedAlias.alias}`
        )
      }
    }
    const packedManifest = spawnSync(
      "tar",
      ["-xOf", archive, "package/package.json"],
      { encoding: "utf8" }
    )
    if (packedManifest.status !== 0) {
      errors.push(`release package ${entry.name} has no package manifest`)
      continue
    }
    const packedPackage = JSON.parse(packedManifest.stdout)
    if (
      packedPackage.name !== entry.name ||
      packedPackage.version !== entry.version
    ) {
      errors.push(`release package ${entry.name} archive identity does not match`)
    }
    const declaredTargets = packageTargets(packedPackage.files)
      .filter((target) => !target.startsWith("!"))
    for (const target of new Set(declaredTargets)) {
      if (
        !isUpstreamMissingDeclaredContent(entry.name, target) &&
        !targetExists(target, packedEntries)
      ) {
        errors.push(`release package ${entry.name} is missing declared package content ${target}`)
      }
    }
  } catch {
    errors.push(`release package ${entry.name} archive is invalid or missing`)
  }
}

for (const name of graphPackages.keys()) {
  if (!packageNames.has(name)) {
    errors.push(`public package ${name} is missing from the release`)
  }
}
for (const name of packageNames) {
  if (!graphPackages.has(name)) {
    errors.push(`release contains unreviewed package ${name}`)
  }
}

const expectedFiles = new Set([
  "controlled-distribution-release.json",
  ...archiveNames,
])
for (const file of await readdir(directory)) {
  if (!expectedFiles.has(file)) {
    errors.push(`release contains unreviewed file ${file}`)
  }
}

const digestInput = {
  schemaVersion: 1,
  sourceRevision: manifest.sourceRevision,
  upstreamVersion: manifest.upstreamVersion,
  packages: releasePackages,
}
const artifactDigest = createHash("sha256")
  .update(JSON.stringify(digestInput))
  .digest("hex")
if (manifest.artifactDigest !== artifactDigest) {
  errors.push("release package-set digest does not match")
}

if (errors.length) {
  throw new Error(`Package-set verification failed:\n- ${errors.join("\n- ")}`)
}
console.log(
  `Verified ${releasePackages.length}-package candidate ${artifactDigest}`
)
