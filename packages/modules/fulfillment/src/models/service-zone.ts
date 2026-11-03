import {
  BelongsTo,
  DmlEntity,
  DMLEntitySchemaBuilder,
  HasMany,
  IdProperty,
  JSONProperty,
  model,
  NullableModifier,
  PrimaryKeyModifier,
  TextProperty,
} from "@medusajs/framework/utils"

import { FulfillmentSet } from "./fulfillment-set"
import { GeoZone } from "./geo-zone"
import { ShippingOption } from "./shipping-option"
import { FULFILLMENT_DEDICATED_STORE_ID } from "../store-ownership"

export type ServiceZoneSchema = {
  id: PrimaryKeyModifier<string, IdProperty>
  store_id: TextProperty
  name: TextProperty
  fulfillment_set: BelongsTo<() => typeof FulfillmentSet>
  geo_zones: HasMany<() => typeof GeoZone>
  shipping_options: HasMany<() => typeof ShippingOption>
  metadata: NullableModifier<Record<string, unknown>, JSONProperty>
}

export const ServiceZone = model
  .define("service_zone", {
    id: model.id({ prefix: "serzo" }).primaryKey(),
    store_id: model.text().default(FULFILLMENT_DEDICATED_STORE_ID),
    name: model.text(),
    fulfillment_set: model.belongsTo<() => typeof FulfillmentSet>(
      () => FulfillmentSet,
      {
        mappedBy: "service_zones",
      }
    ),
    geo_zones: model.hasMany<() => typeof GeoZone>(() => GeoZone, {
      mappedBy: "service_zone",
    }),
    shipping_options: model.hasMany<() => typeof ShippingOption>(
      () => ShippingOption,
      {
        mappedBy: "service_zone",
      }
    ),
    metadata: model.json().nullable(),
  })
  .indexes([
    {
      name: "IDX_service_zone_store_id_id",
      on: ["store_id", "id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      name: "IDX_service_zone_name_unique",
      on: ["store_id", "name"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])
  .cascades({
    delete: ["geo_zones", "shipping_options"],
  }) as unknown as DmlEntity<
  DMLEntitySchemaBuilder<ServiceZoneSchema>,
  "ServiceZone"
>
