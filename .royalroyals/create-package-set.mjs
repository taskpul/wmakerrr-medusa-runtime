import { createHash } from "node:crypto"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const outputDirectory = process.argv[2]

if (!outputDirectory) {
  throw new Error(
    "Usage: node .royalroyals/create-package-set.mjs <output-directory>"
  )
}

const revisionResult = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
})
if (revisionResult.status !== 0) {
  throw new Error(
    `Unable to resolve candidate revision: ${revisionResult.stderr}`
  )
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

const worktreeResult = spawnSync(
  "git",
  ["status", "--porcelain", "--untracked-files=all"],
  { cwd: root, encoding: "utf8" }
)
if (worktreeResult.status !== 0) {
  throw new Error(
    `Unable to inspect candidate worktree: ${worktreeResult.stderr}`
  )
}
if (worktreeResult.stdout.trim()) {
  throw new Error(
    "Controlled packages must be built from a clean immutable commit"
  )
}

const graph = JSON.parse(
  await readFile(join(root, ".royalroyals/public-package-graph.json"), "utf8")
)
if (graph.packageCount !== graph.packages.length || !graph.packages.length) {
  throw new Error("Public package graph count is invalid")
}

const output = resolve(outputDirectory)
await mkdir(output)

const releaseVersion = `${graph.upstreamVersion}-sellmatter.${sourceRevision.slice(0, 12)}`
const controlledPackageNames = new Set(
  graph.packages.map((entry) => entry.name)
)

const sha256 = async (path) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex")

const packageFileName = ({ name, version }) => {
  const normalizedName = name.replace(/^@/, "").replaceAll("/", "-")
  return `${normalizedName}-${version}.tgz`
}

const hiddenPackageContent = new Map([
  ["@medusajs/draft-order", [".medusa/server"]],
  ["@medusajs/loyalty-plugin", [".medusa/server"]],
])

const rewriteControlledDependencies = (manifest) => {
  for (const field of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    if (!manifest[field]) {
      continue
    }
    for (const dependency of Object.keys(manifest[field])) {
      if (controlledPackageNames.has(dependency)) {
        manifest[field][dependency] = releaseVersion
      }
    }
  }
}

const rewritePackage = async ({ archive, packageEntry }) => {
  const content = hiddenPackageContent.get(packageEntry.name)
  const stagingDirectory = await mkdtemp(join(tmpdir(), "rr-package-"))
  try {
    const unpack = spawnSync("tar", ["-xzf", archive, "-C", stagingDirectory], {
      cwd: root,
      stdio: "inherit",
    })
    if (unpack.status !== 0) {
      throw new Error(`Failed to unpack ${packageEntry.name}`)
    }

    for (const target of content ?? []) {
      await cp(
        join(root, packageEntry.path, target),
        join(stagingDirectory, "package", target),
        { recursive: true }
      )
    }

    const packedManifestPath = join(stagingDirectory, "package", "package.json")
    const packedManifest = JSON.parse(
      await readFile(packedManifestPath, "utf8")
    )
    if (
      packedManifest.name !== packageEntry.name ||
      packedManifest.version !== packageEntry.version
    ) {
      throw new Error(`Packed identity does not match ${packageEntry.name}`)
    }
    packedManifest.version = releaseVersion
    rewriteControlledDependencies(packedManifest)
    await writeFile(
      packedManifestPath,
      `${JSON.stringify(packedManifest, null, 2)}\n`
    )

    await rm(archive, { force: true })
    const deterministicOptions = [
      "--format=ustar",
      "--mtime=2000-01-01",
      ...(process.platform === "win32"
        ? []
        : ["--sort=name", "--owner=0", "--group=0", "--numeric-owner"]),
    ]
    const uncompressedArchive = join(stagingDirectory, "package.tar")
    const repack = spawnSync(
      "tar",
      [
        ...deterministicOptions,
        "-cf",
        uncompressedArchive,
        "-C",
        stagingDirectory,
        "package",
      ],
      { cwd: root, stdio: "inherit" }
    )
    if (repack.status !== 0) {
      throw new Error(`Failed to repack ${packageEntry.name}`)
    }
    await writeFile(
      archive,
      gzipSync(await readFile(uncompressedArchive), { level: 9, mtime: 0 })
    )
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true })
  }
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
    throw new Error(
      `Public graph does not match ${packageEntry.path}/package.json`
    )
  }

  const file = packageFileName({
    name: packageEntry.name,
    version: releaseVersion,
  })
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
  await rewritePackage({ archive, packageEntry })
  entries.push({
    name: packageEntry.name,
    version: releaseVersion,
    baseVersion: packageEntry.version,
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
  distributionVersion: releaseVersion,
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
