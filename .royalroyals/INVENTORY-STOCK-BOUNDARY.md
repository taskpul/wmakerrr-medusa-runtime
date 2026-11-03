# Inventory and Stock Location Store boundary

Phase 7G-7 makes Inventory Items, Inventory Levels, Reservations, Stock
Locations, and Stock Location Addresses Store-native in the controlled Medusa
runtime. It extends the canonical Medusa modules, workflows, Query boundary,
and Link service; it does not add replacement inventory APIs or repositories.

Five tables have immutable `store_id` ownership and forced PostgreSQL RLS.
SKU uniqueness and inventory-level uniqueness are Store-scoped. Composite
foreign keys enforce Inventory Item/Level/Reservation and Location/Address
ownership. Inventory-to-Location ownership is validated by the existing
workflow and certified Link boundaries because those resources belong to
separate Medusa modules.

All quantity and reservation mutations still use the existing Inventory module
transactions and locking. Custom aggregate repository queries explicitly
include the active Store. Product-to-Inventory and Fulfillment-to-Location
links are now admitted only after both endpoints pass their module ownership
checks. Sales Channel links remain fail-closed until that peer group is
certified.

Dedicated placement derives the Store from immutable module configuration.
Shared placement requires verified `Context.storeId`, binds it to the database
transaction, changes to a non-bypass request role, and rejects context-free or
cross-Store work. Deployment must create and grant the two request roles named
in the machine-readable contract; secrets and Store ownership are never read
from request bodies.

The five implementation slices and 24-case attack matrix are recorded in
`inventory-stock-boundary.json` and checked by
`verify-inventory-stock-boundary.mjs`. Shared production remains disabled and
no admission gate is changed by this local completion.
