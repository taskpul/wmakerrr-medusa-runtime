# Fulfillment and shipping Store boundary

Phase 7G-6 implements and locally proves the complete Fulfillment and shipping
ownership boundary in the controlled Medusa runtime. It keeps
`@medusajs/fulfillment` as the only authority and preserves Medusa's public
services, workflows, provider interface, events, links, and entity IDs.

## Ownership decision

Eleven merchant-specific tables require immutable Store ownership:
Fulfillment Set, Service Zone, Geo Zone, Shipping Profile, Shipping Option Type,
Shipping Option, Shipping Option Rule, Fulfillment, Fulfillment Address,
Fulfillment Item, and Fulfillment Label. `fulfillment_provider` remains a
cell-level reference because the loader synchronizes configured provider
implementations rather than merchant resources.

A global provider is not global authorization. A Store can use a provider only
through an owned Shipping Option or a later-certified Stock Location/provider
association. Provider validation, price calculation, fulfillment creation,
returns, and cancellation must run only after every Store-owned input is
authorized.

The three currently global merchant business keys become Store-scoped:

- Fulfillment Set name
- Service Zone name
- Shipping Profile name

Every internal relationship includes the owner in its persistence constraint.
Nested replacement operations cannot attach or delete another Store's zones,
geo zones, options, rules, addresses, items, or labels.

## Frozen inventory

| Surface                              | Observed |
| ------------------------------------ | -------: |
| Fulfillment tables                   |       12 |
| Explicit model files                 |       12 |
| Model files declaring unique indexes |       11 |
| Declared custom service methods      |       52 |
| Core-flow files calling Fulfillment  |       43 |
| Fulfillment/shipping workflows       |       21 |
| Fulfillment/shipping steps           |       28 |
| HTTP routes                          |       40 |
| Cross-module links                   |        8 |
| Provider boundary files              |        2 |
| Direct jobs/subscribers              |        0 |
| Direct async Fulfillment paths       |        0 |
| Module integration suites            |       10 |

The machine-readable contract stores a count and SHA-256 digest for every
inventory so an upstream or local surface change cannot silently bypass the
design.

## Cross-module boundary

Product/Shipping Profile and Shipping Option/Price Set can be certified now
because Product and Pricing are already Store-owned in the controlled runtime.
The Stock Location, Order, Return, Cart, and read-only Shipping Option paths
remain fail-closed in shared placement until their peer resource groups are
independently certified. Dedicated mode retains upstream behavior while using
its immutable placement Store.

Fulfillment Item `inventory_item_id` and `line_item_id`, and Fulfillment
`location_id`, are external identifiers without database foreign keys in this
module. They require explicit same-Store validation before persistence and
before any provider call; they cannot be treated as trusted strings.

## Implementation gates

Phase 7G-6 is one user-facing phase with four internal review gates:

1. Schema and persistence: eleven immutable Store owners, Store-scoped keys,
   composite same-Store relationships, request-role RLS, dedicated backfill,
   upgrade, and executed rollback.
2. Service, workflow, and provider: generated and custom services, nested
   replacement, compensation, calculations, events, and provider calls use one
   verified Store path.
3. Links, Query, and background: all eight links and read-only traversals are
   bounded; newly introduced async work is rejected until signed Store context
   is designed.
4. Two-mode proof: dedicated and shared placement pass the full 35-case attack,
   concurrency, upgrade, and rollback matrix.

All four internal gates are locally complete. Shared production remains
disabled, no candidate admission gate changes, and no package is published,
signed, consumed, or activated. Completion of this resource group does not
certify its blocked Stock Location, Cart, Order, or Return peers.

## Evidence

- `fulfillment-shipping-boundary.json` is the machine-readable ownership,
  relationship, link, provider, and attack contract.
- `verify-fulfillment-shipping-inventory.mjs` recomputes the installed Medusa
  2.22.2 surface and fails if it changes without review.
- `verify-fulfillment-runtime-isolation.mjs` checks the runtime enforcement
  markers, five implementation slices, 35 ordered attacks, executable proof
  surfaces, and the disabled shared-production admission state.

These files govern the existing canonical Fulfillment implementation; they do
not introduce a parallel shipping module.
