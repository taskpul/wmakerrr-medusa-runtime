import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const packageSetDirectory = process.argv[2]
const registryValue = process.env.CONTROLLED_NPM_REGISTRY
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm"

if (!packageSetDirectory || !registryValue) {
  throw new Error(
    "Usage: CONTROLLED_NPM_REGISTRY=<internal-registry> node .royalroyals/publish-package-set.mjs <package-set-directory>"
  )
}

const registry = new URL(registryValue)
const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(registry.hostname)
if (registry.protocol !== "https:" && !isLoopback) {
  throw new Error("Controlled package registries must use HTTPS")
}
if (["registry.npmjs.org", "npmjs.org"].includes(registry.hostname)) {
  throw new Error(
    "Controlled packages must not be published to the public npm registry"
  )
}

const directory = resolve(packageSetDirectory)
const verify = spawnSync(
  process.execPath,
  [join(root, ".royalroyals/verify-package-set.mjs"), directory],
  { cwd: root, stdio: "inherit" }
)
if (verify.status !== 0) {
  throw new Error("Package-set verification failed before publication")
}

const manifest = JSON.parse(
  await readFile(
    join(directory, "controlled-distribution-release.json"),
    "utf8"
  )
)
const sha256 = async (path) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex")
const npm = (arguments_, options = {}) =>
  spawnSync(npmCommand, arguments_, {
    cwd: root,
    encoding: "utf8",
    ...options,
  })

for (const packageEntry of manifest.packages) {
  const spec = `${packageEntry.name}@${packageEntry.version}`
  const lookup = npm([
    "view",
    spec,
    "version",
    "--json",
    "--registry",
    registry.href,
  ])
  if (lookup.status === 0) {
    const downloadDirectory = await mkdtemp(join(tmpdir(), "sellmatter-npm-"))
    try {
      const download = npm([
        "pack",
        spec,
        "--json",
        "--ignore-scripts",
        "--pack-destination",
        downloadDirectory,
        "--registry",
        registry.href,
      ])
      if (download.status !== 0) {
        throw new Error(`Unable to verify published package ${spec}`)
      }
      const [{ filename }] = JSON.parse(download.stdout)
      const publishedDigest = await sha256(join(downloadDirectory, filename))
      if (publishedDigest !== packageEntry.digest) {
        throw new Error(
          `Published package ${spec} does not match the candidate`
        )
      }
      console.log(`Verified existing ${spec}`)
    } finally {
      await rm(downloadDirectory, { recursive: true, force: true })
    }
    continue
  }
  if (!/E404|404 Not Found/i.test(`${lookup.stdout}\n${lookup.stderr}`)) {
    throw new Error(`Unable to query ${spec} in the controlled registry`)
  }

  const publish = npm(
    [
      "publish",
      join(directory, packageEntry.file),
      "--ignore-scripts",
      "--tag",
      "sellmatter",
      "--registry",
      registry.href,
    ],
    { stdio: "inherit" }
  )
  if (publish.status !== 0) {
    throw new Error(`Failed to publish ${spec}`)
  }
}

console.log(
  `Published controlled release ${manifest.distributionVersion} to ${registry.origin}`
)
