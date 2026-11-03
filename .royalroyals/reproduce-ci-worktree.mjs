import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"

if (!process.env.CANDIDATE_ROOT) {
  throw new Error("Missing required environment variable: CANDIDATE_ROOT")
}

const candidateRoot = resolve(process.env.CANDIDATE_ROOT)
const evidencePaths = execFileSync(
  "git",
  ["ls-tree", "-r", "-z", "--name-only", "HEAD", "--", ".royalroyals"],
  { cwd: candidateRoot, encoding: "utf8" }
)
  .split("\0")
  .filter(Boolean)

for (const path of evidencePaths) {
  const content = execFileSync("git", ["show", `HEAD:${path}`], {
    cwd: candidateRoot,
    encoding: "buffer",
  })

  await writeFile(join(candidateRoot, path), content)
}

const lock = JSON.parse(
  await readFile(join(candidateRoot, ".royalroyals/upstream-lock.json"))
)
const recordedFiles = [
  ["LICENSE", lock.license.licenseSha256],
  ["ENTERPRISE-LICENSE.md", lock.license.enterpriseNoticeSha256],
]

const sha256 = (content) => createHash("sha256").update(content).digest("hex")

for (const [path, expectedDigest] of recordedFiles) {
  const absolutePath = join(candidateRoot, path)
  const content = await readFile(absolutePath, "utf8")
  const recordedContent = Buffer.from(content.replace(/\r?\n/g, "\r\n"), "utf8")

  if (sha256(recordedContent) !== expectedDigest) {
    throw new Error(`Recorded digest mismatch after normalization: ${path}`)
  }

  await writeFile(absolutePath, recordedContent)
}

console.log("Reproduced recorded evidence and license-file representations.")
