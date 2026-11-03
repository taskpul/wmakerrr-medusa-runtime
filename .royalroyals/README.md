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

## Admission state

`candidate-manifest.json` deliberately contains pending gates and no artifact
or package digest. A later phase must make the license-safe source compile,
implement Store-native commerce boundaries, and produce immutable CI evidence
for every gate before the application can admit a package set.
