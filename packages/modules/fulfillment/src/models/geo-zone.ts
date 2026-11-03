import {
  BelongsTo,
  DmlEntity,
  DMLEntitySchemaBuilder,
  GeoZoneType,
  IdProperty,
  JSONProperty,
  model,
  NullableModifier,
  PrimaryKeyModifier,
  TextProperty,
} from "@medusajs/framework/utils"

import { ServiceZone } from "./service-zone"
import { FULFILLMENT_DEDICATED_STORE_ID } from "../store-ownership"

export type GeoZoneSchema = {
  id: PrimaryKeyModifier<string, IdProperty>
  store_id: TextProperty
  type: TextProperty
  country_code: TextProperty
  province_code?: NullableModifier<string, TextProperty>
  city?: NullableModifier<string, TextProperty>
  postal_expression?: NullableModifier<Record<string, unknown>, JSONProperty>
  service_zone: BelongsTo<() => typeof ServiceZone>
  metadata?: NullableModifier<Record<string, unknown>, JSONProperty>
}

export const GeoZone = model
  .define("geo_zone", {
    id: model.id({ prefix: "fgz" }).primaryKey(),
    store_id: model.text().default(FULFILLMENT_DEDICATED_STORE_ID),
    type: model.enum(GeoZoneType).default(GeoZoneType.COUNTRY),
    country_code: model.text(),
    province_code: model.text().nullable(),
    city: model.text().nullable(),
    postal_expression: model.json().nullable(),
    service_zone: model.belongsTo<() => typeof ServiceZone>(() => ServiceZone, {
      mappedBy: "geo_zones",
    }),
    metadata: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_geo_zone_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      on: ["store_id", "country_code"],
      where: "deleted_at IS NULL",
    },
    {
      on: ["store_id", "province_code"],
      where: "deleted_at IS NULL",
    },
    {
      on: ["store_id", "city"],
      where: "deleted_at IS NULL",
    },
  ]) as unknown as DmlEntity<DMLEntitySchemaBuilder<GeoZoneSchema>, "GeoZone">
