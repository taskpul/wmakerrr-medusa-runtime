import { createHash } from "node:crypto"
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
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

const workspaceAliasPattern =
  /(["'])(?:@\/([a-zA-Z0-9._-]+)|@(models|providers|repositories|services|types|utils))(\/[^"']*)?\1/g
const packedSourcePattern = /\.(?:(?:c|m)?js|d\.(?:c|m)?ts)$/

const pathExists = async (path) => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

const packedTargetExists = async (target) => {
  for (const candidate of [
    target,
    `${target}.js`,
    `${target}.mjs`,
    `${target}.cjs`,
    `${target}.json`,
    `${target}.d.ts`,
    `${target}.d.mts`,
    `${target}.d.cts`,
    join(target, "index.js"),
    join(target, "index.mjs"),
    join(target, "index.cjs"),
    join(target, "index.d.ts"),
    join(target, "index.d.mts"),
    join(target, "index.d.cts"),
  ]) {
    if (await pathExists(candidate)) {
      return true
    }
  }
  return false
}

const resolvePackedAliasTarget = async ({
  distDirectory,
  sourcePath,
  alias,
  suffix,
}) => {
  const relativeSource = relative(distDirectory, sourcePath)
  const sourceSegments = relativeSource.split(/[\\/]/).filter(Boolean)
  const roots = sourceSegments.length > 1
    ? [join(distDirectory, sourceSegments[0]), distDirectory]
    : [distDirectory]

  for (const root of roots) {
    const target = join(
      root,
      alias,
      ...suffix.replace(/^\//, "").split("/").filter(Boolean)
    )
    if (await packedTargetExists(target)) {
      return target
    }
  }

  return null
}

const rewritePackedWorkspaceAliases = async (packageDirectory) => {
  const distDirectory = join(packageDirectory, "dist")
  if (!(await pathExists(distDirectory))) {
    return
  }

  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(path)
        continue
      }
      if (!packedSourcePattern.test(entry.name)) {
        continue
      }

      const source = await readFile(path, "utf8")
      const aliases = [...source.matchAll(workspaceAliasPattern)]
      const aliasTargets = new Map()
      for (const match of aliases) {
        const alias = match[2] ?? match[3]
        const suffix = match[4] ?? ""
        const target = await resolvePackedAliasTarget({
          distDirectory,
          sourcePath: path,
          alias,
          suffix,
        })
        if (!target) {
          throw new Error(
            `Packed workspace alias @${alias}${suffix} in ${path} does not resolve`
          )
        }
        aliasTargets.set(`${alias}\0${suffix}`, target)
      }
      const rewritten = source.replace(
        workspaceAliasPattern,
        (match, quote, rootAlias, directAlias, suffix = "") => {
          const alias = rootAlias ?? directAlias
          const target = aliasTargets.get(`${alias}\0${suffix}`)
          let importPath = relative(dirname(path), target).replaceAll("\\", "/")
          if (!importPath.startsWith(".")) {
            importPath = `./${importPath}`
          }
          return `${quote}${importPath}${quote}`
        }
      )
      if (rewritten !== source) {
        await writeFile(path, rewritten)
      }
    }
  }

  await visit(distDirectory)
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

    await rewritePackedWorkspaceAliases(join(stagingDirectory, "package"))

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
