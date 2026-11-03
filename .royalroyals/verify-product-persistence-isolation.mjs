import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const read = (path) => readFile(join(root, path), "utf8")

const contract = JSON.parse(
  await read(".royalroyals/product-catalog-boundary.json")
)
const snapshot = JSON.parse(
  await read(
    "packages/modules/product/src/migrations/.snapshot-medusa-product.json"
  )
)
const schemaMigration = await read(
  "packages/modules/product/src/migrations/Migration20261103154512.ts"
)
const ownershipMigration = await read(
  "packages/modules/product/src/migrations/Migration20261103154513_enforce_store_ownership.ts"
)
const rlsMigration = await read(
  "packages/modules/product/src/migrations/Migration20261103154514_enforce_product_request_rls.ts"
)
const relationshipMigration = await read(
  "packages/modules/product/src/migrations/Migration20261103154515_enforce_composite_store_relationships.ts"
)
const persistenceTest = await read(
  "packages/modules/product/integration-tests/__tests__/product-module-service/store-ownership-persistence.spec.ts"
)

const tables = new Map(snapshot.tables.map((table) => [table.name, table]))
const errors = []
const directTables = contract.schema.directStoreOwnedTables
const pivotTables = contract.schema.parentDerivedPivotTables

for (const tableName of directTables) {
  const table = tables.get(tableName)
  const storeColumn = table?.columns?.store_id
  if (
    !storeColumn ||
    storeColumn.nullable ||
    !String(storeColumn.default).includes("__medusa_dedicated__")
  ) {
    errors.push(
      `${tableName} lacks its required non-null dedicated Store owner`
    )
  }
}

for (const marker of [
  `["product_category", "parent_category_id", "product_category"]`,
  `["product", "type_id", "product_type"]`,
  `["product", "collection_id", "product_collection"]`,
  `["product_variant_product_image", "variant_id", "product_variant"]`,
  `["product_variant_product_image", "image_id", "image"]`,
]) {
  if (!relationshipMigration.includes(marker)) {
    errors.push(`composite Store relationship migration lost ${marker}`)
  }
}

for (const tableName of pivotTables) {
  if (tables.get(tableName)?.columns?.store_id) {
    errors.push(`${tableName} must derive Store ownership from its parents`)
  }
}

const storeIdIndexes = [
  "IDX_product_category_store_id_id",
  "IDX_product_collection_store_id_id",
  "IDX_product_option_store_id_id",
  "IDX_product_option_value_store_id_id",
  "IDX_product_tag_store_id_id",
  "IDX_product_type_store_id_id",
  "IDX_product_store_id_id",
  "IDX_product_product_option_store_id_id",
  "IDX_product_product_option_value_store_id_id",
  "IDX_image_store_id_id",
  "IDX_product_variant_store_id_id",
  "IDX_product_variant_product_image_store_id_id",
]
const uniqueBusinessIndexes = [
  "IDX_category_handle_unique",
  "IDX_collection_handle_unique",
  "IDX_product_option_global_title_unique",
  "IDX_option_value_option_id_unique",
  "IDX_tag_value_unique",
  "IDX_type_value_unique",
  "IDX_product_handle_unique",
  "IDX_product_variant_sku_unique",
  "IDX_product_variant_barcode_unique",
  "IDX_product_variant_ean_unique",
  "IDX_product_variant_upc_unique",
]
const snapshotIndexes = new Map(
  snapshot.tables.flatMap((table) =>
    Object.values(table.indexes ?? {}).map((index) => [index.keyName, index])
  )
)

for (const indexName of [...storeIdIndexes, ...uniqueBusinessIndexes]) {
  const expression = snapshotIndexes.get(indexName)?.expression ?? ""
  if (!expression.includes('"store_id"')) {
    errors.push(`${indexName} is not Store-aware in the Product snapshot`)
  }
}

for (const marker of [
  "PRODUCT_DEDICATED_STORE_ID",
  "PRODUCT_REQUEST_ROLE",
  "PRODUCT_STORE_SETTING",
]) {
  const ownershipSource = await read(
    "packages/modules/product/src/store-ownership.ts"
  )
  if (!ownershipSource.includes(marker)) {
    errors.push(`Product ownership source lost ${marker}`)
  }
}

for (const tableName of directTables) {
  if (!ownershipMigration.includes(`"${tableName}"`)) {
    errors.push(`ownership migration does not cover ${tableName}`)
  }
  if (!rlsMigration.includes(`"${tableName}"`)) {
    errors.push(`RLS migration does not cover ${tableName}`)
  }
}

for (const tableName of pivotTables) {
  if (!ownershipMigration.includes(`"${tableName}"`)) {
    errors.push(`pivot enforcement does not cover ${tableName}`)
  }
  if (!rlsMigration.includes(`"${tableName}"`)) {
    errors.push(`pivot RLS does not cover ${tableName}`)
  }
}

for (const marker of [
  "medusa_product_enforce_store_ownership",
  "medusa_product_enforce_pivot_store_ownership",
  "medusa_product_store_id_immutable",
]) {
  if (!ownershipMigration.includes(marker)) {
    errors.push(`ownership migration lost ${marker}`)
  }
}

for (const marker of [
  "medusa_product_active_store_id",
  "enable row level security",
  "force row level security",
  "medusa_product_request",
]) {
  if (!rlsMigration.includes(marker)) {
    errors.push(`RLS migration lost ${marker}`)
  }
}

if (
  /drop constraint[^\n]*product_product_option_value|product_product_option_value[^\n]*drop constraint/.test(
    schemaMigration
  )
) {
  errors.push(
    "generated Store migration must preserve existing option-value foreign keys"
  )
}

for (const marker of [
  "fails closed for the shared request role without Store context",
  "scopes catalog uniqueness to one Store",
  "rejects owner reassignment and cross-Store direct relationships",
  "enforces same-Store ownership for implicit pivots",
  "executes rollback and dedicated legacy backfill before restoring enforcement",
]) {
  if (!persistenceTest.includes(marker)) {
    errors.push(`Product persistence proof lost: ${marker}`)
  }
}

const evidence = contract.implementationEvidence?.["7G-5B"]
if (
  evidence?.status !== "local-complete" ||
  evidence?.admissionEffect !== "none" ||
  evidence?.forcedRlsTables !== 15
) {
  errors.push("7G-5B completion or no-admission evidence is invalid")
}

if (errors.length) {
  throw new Error(errors.join("\n"))
}

console.log(
  `Verified Product persistence isolation: ${directTables.length} direct Store tables, ${pivotTables.length} parent-derived pivots, ${uniqueBusinessIndexes.length} Store-scoped business keys, and 15 forced-RLS tables.`
)
