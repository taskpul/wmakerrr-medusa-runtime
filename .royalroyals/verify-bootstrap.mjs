import { createHash } from "node:crypto"
import { access, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const metadata = join(root, ".royalroyals")
const lock = JSON.parse(await readFile(join(metadata, "upstream-lock.json")))
const manifest = JSON.parse(
  await readFile(join(metadata, "candidate-manifest.json")),
)
const exclusions = (await readFile(
  join(metadata, "enterprise-exclusions.txt"),
  "utf8",
)).split(/\r?\n/).filter(Boolean)
const enterpriseNotice = await readFile(
  join(root, "ENTERPRISE-LICENSE.md"),
  "utf8",
)
const noticeExclusions = [...enterpriseNotice.matchAll(/^- `([^`]+)`/gm)]
  .map((match) => match[1])

const sha256 = async (path) => createHash("sha256")
  .update(await readFile(path))
  .digest("hex")

const errors = []
if (lock.commit !== manifest.upstreamRevision) {
  errors.push("candidate upstream revision does not match the lock")
}
if (lock.version !== manifest.upstreamVersion) {
  errors.push("candidate upstream version does not match the lock")
}
if (lock.license.excludedPathCount !== exclusions.length) {
  errors.push("enterprise exclusion count does not match the lock")
}
if (JSON.stringify(noticeExclusions) !== JSON.stringify(exclusions)) {
  errors.push("enterprise exclusions do not match the upstream notice")
}
if (await sha256(join(root, "LICENSE")) !== lock.license.licenseSha256) {
  errors.push("MIT license digest does not match the lock")
}
if (
  await sha256(join(root, "ENTERPRISE-LICENSE.md")) !==
  lock.license.enterpriseNoticeSha256
) {
  errors.push("enterprise notice digest does not match the lock")
}
if (await sha256(join(root, "yarn.lock")) !== lock.lockfileSha256) {
  errors.push("upstream lockfile digest does not match the lock")
}

for (const path of exclusions) {
  try {
    await access(join(root, path))
    errors.push(`excluded enterprise path is present: ${path}`)
  } catch (error) {
    if (error?.code !== "ENOENT") throw error
  }
}

if (
  manifest.status !== "draft-unsigned" ||
  manifest.artifactDigest !== null ||
  manifest.sourceRevision !== null ||
  manifest.packages.length !== 0
) {
  errors.push("bootstrap candidate must remain unsigned and unadmitted")
}
for (const [gateId, gate] of Object.entries(manifest.gates)) {
  if (gate.status !== "pending" || gate.evidenceDigest !== null) {
    errors.push(`bootstrap gate is prematurely claimed: ${gateId}`)
  }
}

if (errors.length) {
  throw new Error(errors.join("\n"))
}

console.log(
  `Verified Medusa ${lock.version} bootstrap; ${exclusions.length} enterprise paths excluded; candidate remains unsigned.`,
)
