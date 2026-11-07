import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const outputDirectory = process.argv[2]

if (!outputDirectory) {
  throw new Error("Usage: node .royalroyals/create-package-set.mjs <output-directory>")
}

const revisionResult = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
})
if (revisionResult.status !== 0) {
  throw new Error(`Unable to resolve candidate revision: ${revisionResult.stderr}`)
}

const sourceRevision = revisionResult.stdout.trim()
if (!/^[a-f0-9]{40}$/.test(sourceRevision)) {
  throw new Error("Candidate revision is not an immutable Git commit")
}
if (
  process.env.CANDIDATE_REVISION &&
  process.env.CANDIDATE_REVISION !== sourceRevision
) {
  throw new Error("Checked-out revision does not match CANDIDATE_REVISION")
}

const graph = JSON.parse(
  await readFile(join(root, ".royalroyals/public-package-graph.json"), "utf8")
)
if (graph.packageCount !== graph.packages.length || !graph.packages.length) {
  throw new Error("Public package graph count is invalid")
}

const output = resolve(outputDirectory)
await mkdir(output)

const sha256 = async (path) =>
  createHash("sha256").update(await readFile(path)).digest("hex")

const packageFileName = ({ name, version }) => {
  const normalizedName = name.replace(/^@/, "").replaceAll("/", "-")
  return `${normalizedName}-${version}.tgz`
}

const entries = []
const names = new Set()
const files = new Set()
for (const packageEntry of [...graph.packages].sort((left, right) =>
  left.name.localeCompare(right.name)
)) {
  if (names.has(packageEntry.name)) {
    throw new Error(`Duplicate package in public graph: ${packageEntry.name}`)
  }
  names.add(packageEntry.name)

  const manifest = JSON.parse(
    await readFile(join(root, packageEntry.path, "package.json"), "utf8")
  )
  if (
    manifest.name !== packageEntry.name ||
    manifest.version !== packageEntry.version
  ) {
    throw new Error(`Public graph does not match ${packageEntry.path}/package.json`)
  }

  const file = packageFileName(packageEntry)
  if (files.has(file)) {
    throw new Error(`Duplicate package archive name: ${file}`)
  }
  files.add(file)
  const archive = join(output, file)
  const pack = spawnSync(
    process.execPath,
    [
      join(root, ".yarn/releases/yarn-3.2.1.cjs"),
      "workspace",
      packageEntry.name,
      "pack",
      "--out",
      archive,
    ],
    { cwd: root, stdio: ["ignore", "ignore", "inherit"] }
  )
  if (pack.status !== 0) {
    throw new Error(`Failed to pack ${packageEntry.name}`)
  }
  entries.push({
    name: packageEntry.name,
    version: packageEntry.version,
    file,
    digest: await sha256(archive),
  })
}

const digestInput = {
  schemaVersion: 1,
  sourceRevision,
  upstreamVersion: graph.upstreamVersion,
  packages: entries,
}
const artifactDigest = createHash("sha256")
  .update(JSON.stringify(digestInput))
  .digest("hex")
const releaseManifest = {
  contractVersion: 1,
  status: "unsigned",
  distributionVersion: `${graph.upstreamVersion}-rr.${sourceRevision.slice(0, 12)}`,
  upstreamVersion: graph.upstreamVersion,
  sourceRepository: "https://github.com/taskpul/wmakerrr-medusa-runtime.git",
  sourceRevision,
  artifactDigest,
  packages: entries,
  gates: {},
}

await writeFile(
  join(output, "controlled-distribution-release.json"),
  `${JSON.stringify(releaseManifest, null, 2)}\n`,
  { flag: "wx" }
)
console.log(
  `Created ${entries.length}-package candidate ${artifactDigest} for ${sourceRevision}`
)
