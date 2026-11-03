---
"@medusajs/utils": patch
"@medusajs/pricing": patch
"@medusajs/orchestration": patch
"@medusajs/workflows-sdk": patch
"@medusajs/core-flows": patch
---

Add generated CRUD and manager-context boundary hooks, then enforce Pricing
Store ownership across generated methods, raw calculation queries, PostgreSQL
persistence, transaction-local Store context, and request-role RLS.
Persist immutable Store provenance across workflow continuation, forward it
through every Pricing core-flow call, and reject foreign Price Sets before
cross-module link mutations.
