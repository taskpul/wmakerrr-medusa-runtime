# Product/catalog Store boundary

Phase 7G-5A froze the complete Product/catalog ownership design for the controlled-distribution runtime. The local 7G-5B through 7G-5E implementation now closes that Product-specific design, without enabling shared production or publishing a candidate.

## Decision

The existing `@medusajs/product` module remains the only catalog authority. The implementation must extend its models, generated services, custom repositories, core workflows, module links, events, and Index integration. It must not introduce a parallel catalog module or replace public Medusa IDs and contracts.

The boundary is feasible through supported Medusa extension points, but it is not one safe migration. It is split into 7G-5B through 7G-5E so schema enforcement, service closure, background/index closure, and cross-module proof each have a reviewable owner.

## Frozen inventory

The machine-readable contract records hashes as well as counts so later upstream changes cannot silently escape the boundary:

| Surface                                 | Observed |
| --------------------------------------- | -------: |
| Product tables                          |       15 |
| Explicit model files                    |       12 |
| Existing unique indexes                 |       25 |
| Declared Product module service methods |       42 |
| Product-connected core-flow files       |       61 |
| Product workflow files                  |       32 |
| Product step files                      |       43 |
| Asynchronous Product paths              |        4 |
| Admin catalog routes                    |       35 |
| Store catalog routes                    |       14 |
| Cross-module Product links              |        7 |
| Raw Product persistence paths           |        4 |
| Direct Product jobs/subscribers         |        0 |

The inventory verifier fails whenever one of these surfaces changes without an intentional contract update.

## Persistence ownership

Twelve explicit model tables receive an immutable, non-null `store_id`: Product, category, collection, option, option value, tag, type, the two explicit product-option link entities, image, variant, and variant-image.

Three ORM-managed pivot tables derive ownership from both parents instead of receiving an ORM-unknown column: product-category, product-tag, and variant-option. Database policies and relationship triggers must prove that both parents belong to the active Store. This preserves generated ORM writes and avoids a hidden column that future schema generation could remove or fail to populate.

Store-scoped uniqueness replaces globally shared catalog keys. Product/category/collection handles, tag/type values, reusable option titles, option values, and variant SKU/barcode/EAN/UPC may repeat in different Stores but not in the same Store. A non-exclusive option is therefore global only inside one Store.

The database is the final enforcement boundary. Shared placement uses a restricted request role, transaction-local Store context, immutable ownership, same-Store relationship checks, and forced RLS. Dedicated placement derives one Store from its immutable placement binding. A shared or unbound database cannot guess ownership during backfill.

## Services, workflows, and raw persistence

The Product module's generated CRUD, custom service methods, category service, repositories, raw Knex/native-delete paths, workflows, compensation handlers, and list/count pagination all use the same verified manager context. Store scoping occurs before selection, counting, ordering, or pagination.

Routes remain thin. They authenticate, validate, and call canonical workflows or queries; request filters and UI state never become authorization. Client-supplied ownership is not trusted.

## Asynchronous work and search

Import and export are Store operations. Import chunk processing and paused-workflow resumption retain the initiating Store and reject missing or changed provenance. Export can emit only the active Store's catalog.

The Index module is part of the security boundary, not a cache exemption. Product and variant event provenance, index document IDs/relations, query filters, replay handling, rebuilds, and full synchronization must all be Store-partitioned. Until this is implemented and tested, shared catalog search remains unsafe even if ordinary Product reads have RLS.

## Cross-module links

There are four writable Product links: Sales Channel, Shipping Profile, Variant-to-Inventory Item, and Variant-to-Price Set. Creation and mutation require both endpoints to resolve to the same Store. Pricing's endpoint is already protected; Product's endpoint is completed in this phase family, while an uncertified endpoint keeps that link unavailable in shared placement.

There are three read-only links: Cart-to-Product, Order-to-Product, and Product-to-Translation. Read-only does not mean security-free: graph hydration must never cross a Store boundary.

## Migration and rollback

7G-5B must use generated schema changes plus a focused enforcement migration. Dedicated placement may backfill from its immutable placement binding. Shared placement with pre-existing unowned rows fails closed and requires an explicit, auditable ownership map.

Upgrade proof compares row counts, ownership counts, relationships, and stable catalog digests. Rollback proof must remove enforcement in a controlled order and restore the pre-change schema without leaving partial policies, triggers, roles, or indexes.

## Proof and admission

The contract defines 32 attack cases covering missing context, foreign IDs, owner spoofing/reassignment, uniqueness, every internal relationship family, raw persistence, import/export, Index behavior, all seven module links, both placement modes, direct SQL, concurrency, upgrade, and rollback.

No controlled-distribution gate changes in 7G-5A. Shared production remains disabled. Product admission can be reconsidered only after all four implementation slices pass:

1. 7G-5B — schema ownership and persistence.
2. 7G-5C — service and core-flow closure.
3. 7G-5D — asynchronous work and Index closure.
4. 7G-5E — links and dedicated/shared attack proof.

## Files

- `product-catalog-boundary.json` is the machine-readable contract.
- `verify-product-catalog-inventory.mjs` recomputes and verifies the frozen inventory and structural invariants.

These files are distinct governance responsibilities; neither duplicates Product runtime behavior.

## 7G-5B local result

The persistence slice is implemented locally. The twelve explicit Product
models now carry a non-null dedicated-compatible Store owner and Store-aware
identity/index paths. The three ORM-managed pivots retain their canonical shape
and are protected by same-Store parent triggers and parent-derived RLS.

Four new, not-yet-published migrations own separate responsibilities: the
generated model/index diff, internal relationship plus immutable-owner
enforcement, request-role forced RLS, and RLS-independent composite Store
foreign keys. The rollback proof executes all four down paths, verifies the
boundary is removed, inserts a legacy dedicated row, and executes all up paths
to prove deterministic backfill and restoration.

All 14 Product unit tests and 235 Product PostgreSQL integration tests pass. No
gate is closed by this local result.

## 7G-5C through 7G-5E local result

The canonical Product module service is the sole Product ownership boundary.
Generated CRUD and custom service methods use one manager-context extension,
scope before count and pagination, stamp nested writes, reject foreign parents,
and install transaction-local database Store context. Workflows derive Store
context from the verified request registration, propagate it through steps and
compensation, persist it in continuation metadata, and reject rebinding.

Product and variant events now include verified Store provenance. The Index
module scopes Product queries before pagination, validates event provenance,
partitions stale removal and synchronization, and denies shared global resets.
The active Store is retained across asynchronous continuations and concurrent
executions without global mutable state.

The central Link service validates Product, variant, and Price Set endpoints.
In shared placement, Product links to modules that have not completed their own
Store certification remain unavailable. Read-only hydration is bounded by the
same Product service query scope. Dedicated placement remains backward
compatible and rejects an explicitly mismatched Store.

The 32-case attack contract is retained and mapped to focused persistence,
service, workflow, Index, and Link tests. `verify-product-runtime-isolation.mjs`
checks that the canonical enforcement markers, evidence files, phase statuses,
and no-admission decision remain present. Shared production stays disabled;
this local completion is Product-family evidence, not a release activation.
