import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { access, readFile, readdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const metadata = join(root, ".royalroyals")
const lock = JSON.parse(await readFile(join(metadata, "upstream-lock.json")))
const manifest = JSON.parse(
  await readFile(join(metadata, "candidate-manifest.json"))
)
const exclusions = (
  await readFile(join(metadata, "enterprise-exclusions.txt"), "utf8")
)
  .split(/\r?\n/)
  .filter(Boolean)
const repositoryExclusions = (
  await readFile(join(metadata, "repository-exclusions.txt"), "utf8")
)
  .split(/\r?\n/)
  .filter(Boolean)
const allowedWorkflows = new Set(["controlled-distribution.yml"])
const enterpriseNotice = await readFile(
  join(root, "ENTERPRISE-LICENSE.md"),
  "utf8"
)
const noticeExclusions = [...enterpriseNotice.matchAll(/^- `([^`]+)`/gm)].map(
  (match) => match[1]
)

const sha256Content = (content) =>
  createHash("sha256").update(content).digest("hex")
const withCrLf = (content) =>
  Buffer.from(content.toString("utf8").replace(/\r?\n/g, "\r\n"), "utf8")

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
if (
  sha256Content(withCrLf(await readFile(join(root, "LICENSE")))) !==
  lock.license.licenseSha256
) {
  errors.push("MIT license digest does not match the lock")
}
if (
  sha256Content(
    withCrLf(await readFile(join(root, "ENTERPRISE-LICENSE.md")))
  ) !== lock.license.enterpriseNoticeSha256
) {
  errors.push("enterprise notice digest does not match the lock")
}
const bootstrapLockfile = execFileSync(
  "git",
  ["show", "dd0e628077a9bc1ed0e504ea0d5ea207540ee2ab:yarn.lock"],
  { cwd: root }
)
// The provenance digest was recorded from the Windows bootstrap worktree.
// Reconstruct its CRLF representation from Git's canonical LF blob.
const bootstrapLockfileWorktree = Buffer.from(
  bootstrapLockfile.toString("utf8").replaceAll("\n", "\r\n"),
  "utf8"
)
const bootstrapLockfileSha256 = createHash("sha256")
  .update(bootstrapLockfileWorktree)
  .digest("hex")
if (bootstrapLockfileSha256 !== lock.lockfileSha256) {
  errors.push("bootstrap lockfile digest does not match the upstream lock")
}

for (const path of exclusions) {
  try {
    await access(join(root, path))
    errors.push(`excluded enterprise path is present: ${path}`)
  } catch (error) {
    if (error?.code !== "ENOENT") throw error
  }
}
for (const path of repositoryExclusions) {
  if (path === ".github/workflows/") {
    let workflows
    try {
      workflows = await readdir(join(root, path))
    } catch (error) {
      if (error?.code === "ENOENT") continue
      throw error
    }

    for (const workflow of workflows) {
      if (!allowedWorkflows.has(workflow)) {
        errors.push(`unapproved repository workflow is present: ${workflow}`)
      }
    }
    continue
  }

  try {
    await access(join(root, path))
    errors.push(`excluded upstream repository automation is present: ${path}`)
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
  `Verified Medusa ${lock.version} bootstrap; ${exclusions.length} enterprise paths excluded; candidate remains unsigned.`
)
