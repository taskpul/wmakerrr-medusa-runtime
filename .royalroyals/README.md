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
license-driven changes and 24 reviewed controlled-distribution extensions whose
before/after hashes and reasons are pinned in `public-api-exceptions.json`.

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

### Pricing Store-ownership slice

The first controlled-distribution slice adds a non-null `store_id` to every
Pricing table, Store-aware unique indexes, a reversible generated migration,
and dedicated/shared placement options. The existing high-level price-set,
price-list, price-preference, and calculation paths stamp and filter the active
Store. Shared mode rejects missing Store context and price-list relationships
to another Store's price set before mutation.

Pull requests build only affected packages and run the focused Pricing
Store-ownership integration suite when this boundary changes. Documentation-only
pull requests do not rebuild Medusa, and superseded runs are cancelled. A full
workspace build and immutable candidate evidence are created only for an exact,
manually dispatched candidate revision.

The focused suite proves fail-closed context, filtering before pagination,
foreign calculation denial, generated CRUD isolation, raw calculation-query
isolation, cross-Store relationship denial, and PostgreSQL rejection of
cross-Store parent references and owner reassignment. It also proves that
shared Pricing operations assume a fixed non-bypass request role, bind the
verified Store transaction-locally, deny missing Store context at the database
layer, reject rebinding a transaction to another Store, and cleanly reverse the
RLS migration. Dedicated mode is tested separately for no-context compatibility,
fixed Store stamping, and rebinding denial.

Workflow flow metadata now persists the initiating Store across async
continuation and rejects Store rebinding. Every inventoried direct Pricing
core-flow call forwards verified context, while Product/Price Set and Shipping
Option/Price Set paths validate Price Set ownership before link work. The
deterministic isolation verifier pins 23 Pricing references, checks 40
context-bound calls and four guarded link paths, and rejects unreviewed Pricing
jobs or subscribers.

This slice does not complete an admission gate. The Pricing boundary is closed
locally in both placement modes, but ownership at the Product and Fulfillment
ends of cross-module links, the next commerce resource groups, upgrade
rehearsal, repair evidence, immutable review evidence, and the broader Phase 7
attack matrix still require certification. The candidate therefore remains
unsigned, unpublished, unconsumed, and forbidden for shared production.

### Product/catalog Store boundary

Phase 7G-5A inventories and freezes the Product/catalog Store-ownership
boundary before implementation. The machine contract covers all 15 Product
tables, 42 declared service methods, 61 Product-connected core-flow files, 49
catalog routes, four asynchronous paths, seven module links, five raw
persistence paths, and the Product Index surfaces. Its 32-case attack matrix
defines the required dedicated/shared, database, relationship, workflow,
background, search, link, upgrade, and rollback proof.

Run the deterministic design verifier with:

```bash
node .royalroyals/verify-product-catalog-inventory.mjs
```

The implementation remains split into schema/persistence (7G-5B),
service/core-flow closure (7G-5C), async/Index closure (7G-5D), and
link/two-mode proof (7G-5E). All four slices are locally complete, but this
deliberately changes no candidate gate and does not admit shared production.

Phase 7G-5B now completes the local Product persistence slice. Twelve explicit
Product tables have immutable Store ownership and Store-aware indexes; three
implicit pivot tables derive ownership from same-Store parents. Reversible
migrations enforce internal relationships, request-role forced RLS,
RLS-independent composite Store foreign keys, dedicated legacy backfill, and
rollback. Existing option-value foreign keys remain intact.

```bash
node .royalroyals/verify-product-persistence-isolation.mjs
```

The service and workflow slice scopes generated and custom Product paths through
one canonical manager boundary and retains Store context through compensation
and continuation. Shared-placement events carry Store provenance while default
dedicated payloads remain compatible. Index queries, pagination,
events, stale removal, synchronization, and rebuilds are Store-partitioned, and
shared global reset is denied. Product and Price Set link endpoints are checked;
links to uncertified modules remain closed in shared placement.

```bash
node .royalroyals/verify-product-runtime-isolation.mjs
```

Focused shared, dedicated, persistence, continuation, Index, and Link tests map
to the frozen 32-case attack contract. Completion is local evidence only: the
runtime is unsigned, unpublished, not activated by the application, and still
forbidden for shared production until all remaining commerce modules and final
candidate gates are certified.

### Fulfillment and shipping Store boundary

Phase 7G-6 closes the installed Fulfillment surface locally: 12 tables, 52
declared custom service methods, 43 direct core-flow callers, 21
workflows, 28 steps, 40 routes, eight links, two provider-boundary files, and no
direct Fulfillment job, subscriber, raw-persistence, or asynchronous path. Its
35-case attack contract covers schema ownership, nested relationships,
provider invocation, calculations, events, Query hydration, all links, both
placement modes, concurrency, upgrade, and rollback.

Eleven tables are Store-owned. `fulfillment_provider` remains a cell-level
reference because it represents configured provider implementations, but it
does not grant merchant access: an owned Shipping Option or later-certified
Stock Location association is required before provider invocation. Product to
Shipping Profile and Shipping Option to Price Set can be certified using the
already closed Product and Pricing endpoints. Stock Location, Cart, Order, and
Return links remain fail-closed until their resource groups are certified.

```bash
node .royalroyals/verify-fulfillment-shipping-inventory.mjs
node .royalroyals/verify-fulfillment-runtime-isolation.mjs
```

The five implementation slices and four internal gates are locally complete.
That evidence adds immutable Store owners, same-Store relationships,
request-role RLS, one generated/custom service context path, provider guards,
two certified links, fail-closed peer links, dedicated/shared tests, and
upgrade/rollback proof. No admission gate changes and shared production remains
disabled until the remaining commerce resource groups and final gates close.

### Inventory and Stock Location Store boundary

Phase 7G-7 closes the canonical Inventory and Stock Location surfaces for five
Store-owned tables: inventory items, levels, reservations, stock locations, and
location addresses. Store-scoped SKU and level keys allow independent merchant
catalogs while composite relationships, immutable-owner triggers, and two
request roles enforce same-Store persistence and forced RLS.

Shared service operations require verified Store context; dedicated placement
derives its immutable configured Store. Quantity aggregates filter in SQL,
reservation changes remain atomic with inventory levels, and create, batch, and
update workflows validate their Stock Location endpoints. Product/Inventory and
Fulfillment/Stock Location links are certified; uncertified peers remain closed.
Transaction-delayed ORM events preserve the upstream Medusa event contract.

```bash
node .royalroyals/verify-inventory-stock-boundary.mjs
```

The 24-case attack contract is backed by 47 Inventory integration tests, 15
Stock Location integration tests, 14 link tests, and 20 affected context/event
tests. Persistence tests execute dedicated backfill, missing-context denial,
immutable ownership, unsafe SKU-collapse refusal, rollback, and forward
restoration. This is local evidence only; shared production and all candidate
admission gates remain unchanged.

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
cannot publish, sign, release, or activate packages. It runs the focused
PostgreSQL Store-ownership suite, immutable install, complete build, and three
provenance/compatibility verifiers before uploading a content-addressed evidence
record.
