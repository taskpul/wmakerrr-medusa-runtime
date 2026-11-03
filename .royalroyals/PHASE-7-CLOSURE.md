# Phase 7 local closure

Phase 7 is locally complete as an engineering boundary for the controlled
Medusa runtime. The existing canonical Medusa modules were extended; no
parallel commerce implementation was introduced.

The closure covers Pricing, Product, Fulfillment, Inventory, Stock Location,
Promotions, Customers, Cart, Payment, Orders, API keys, Sales Channels,
Notifications, cross-module links, Cache, File, Event Bus, and Index. Shared
placement requires an explicit Store context and fails closed. Dedicated
placement retains one configured owner.

## Persistence boundary

Merchant-owned aggregate tables carry immutable `store_id` ownership. Composite
relationships reject cross-Store parents and children. Request roles use forced
PostgreSQL RLS for tenant-facing reads and writes. Order child tables use
parent-derived policies where duplicating `store_id` would corrupt the canonical
Medusa model. Payment Provider and Refund Reason remain platform references and
do not grant access to tenant-owned payment aggregates.

API-key secret authentication is the deliberate exception to request-role RLS:
the exact secret must be resolved before its Store is known. The returned key
supplies the owner; every management path remains Store-scoped, and its owner is
immutable.

Deployments must provision and grant the request roles named in
`phase-7-closure-boundary.json`. Migrations define policies but do not create
cluster-level roles.

## Shared services

- Cache keys, explicit tags, and automatically computed tags are Store-prefixed.
- File keys are contained under `stores/<store-id>/` and foreign prefixes fail.
- Events carry Store provenance and subscribers restore it before execution.
- Index queries, pagination, synchronization, stale cleanup, and reset are
  Store-partitioned. Index schema/status metadata remains a cell-level control
  surface and contains no merchant documents.
- Notification records and idempotency keys are Store-scoped.

## Meaning of “closed”

The code, migrations, local builds, focused tests, direct RLS attacks, and
machine-readable contract are complete. This does **not** authorize production
shared placement. The candidate remains unsigned and unconsumed, all admission
gates remain pending, and no source or artifact was pushed or published.

Run the local static closure check with:

```bash
node .royalroyals/verify-phase-7-closure.mjs
```

Activation requires protected immutable CI evidence, independent review,
upgrade/rollback rehearsal, signing, and explicit application admission of the
exact package digest.
