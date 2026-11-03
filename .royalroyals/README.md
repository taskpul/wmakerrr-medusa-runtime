# Royalroyals Controlled Distribution

This repository is the source boundary for the Royalroyals Medusa runtime. It
starts from the exact official Medusa `v2.22.2` source commit recorded in
`upstream-lock.json`.

The initial branch is an unsigned bootstrap candidate. It is not a released
package, is not admitted by the Royalroyals application, and must not be used
for shared production.

## License boundary

Medusa's public repository contains MIT-licensed core code and separately
licensed Enterprise Edition materials. Royalroyals does not assume a Medusa
commercial license. Every path identified by the upstream
`ENTERPRISE-LICENSE.md` is therefore excluded from this branch and recorded in
`enterprise-exclusions.txt`.

The branch has orphan history so proprietary files in upstream history are not
reachable from the Royalroyals repository. The upstream repository and commit
remain recorded for provenance and future license-safe imports.

Run the bootstrap verification without installing dependencies:

```bash
node .royalroyals/verify-bootstrap.mjs
```

## License-safe baseline

The baseline removes public module, API, workflow, Admin, and package-graph
references to the Enterprise paths that are absent from this repository. The
deterministic public graph is recorded in `public-package-graph.json` and can be
regenerated only through the reviewed verifier:

```bash
node .royalroyals/verify-baseline.mjs --write-graph
node .royalroyals/verify-baseline.mjs
```

The baseline verification is complete only after an immutable install and the
canonical monorepo build also pass:

```bash
yarn install --immutable
yarn build
```

The candidate records this as local reproducibility evidence, not admission
evidence. Protected CI, reviewed immutable artifacts, package digests, and all
remaining isolation gates are still required before release.

## Public API compatibility

The compatibility verifier compares every public manifest field and recursively
follows local re-exports from all 79 public package entry points. It checks 1,321
public source files against the exact upstream commit and accepts only the 28
license-driven changes whose before/after hashes are pinned in
`public-api-exceptions.json`.

The exact upstream commit must exist in the local Git object database. It can be
fetched without checking out Enterprise source into this repository:

```bash
git fetch --filter=blob:none upstream cfff3f57381873097dcc77851038d5dbe8f5839c
node .royalroyals/verify-public-api.mjs
```

This is local compatibility evidence only. The `public-api-compatibility` gate
remains pending until the same command, immutable install, and complete build
run through a trusted protected review/CI path and produce immutable evidence.

## Admission state

`candidate-manifest.json` deliberately contains pending gates and no artifact
or package digest. The source now compiles as a license-safe baseline, but a
later phase must implement Store-native commerce boundaries and produce
immutable CI evidence for every gate before the application can admit a package
set.

## Repository governance

The upstream Medusa workflows and Dependabot configuration are excluded from
this repository. They target Medusa organization secrets, applications, and
external services and must never run under the Royalroyals account. The
bootstrap verifier permits only `controlled-distribution.yml` in the workflows
directory and rejects every other workflow.

The repository is public so GitHub can protect `main` and require the controlled
distribution check without a paid account. The workflow has read-only contents
permission, uses only SHA-pinned GitHub-owned actions, consumes no secrets, and
cannot publish, sign, release, or activate packages. It runs the immutable
install, complete build, and three provenance/compatibility verifiers before
uploading a content-addressed evidence record.
