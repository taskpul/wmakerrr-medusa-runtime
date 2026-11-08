import {
  Context,
  ILinkModule,
  LinkDefinition,
  LoadedModule,
} from "@medusajs/types"
import {
  arrayDifference,
  deduplicate,
  MedusaError,
  Modules,
  promiseAll,
} from "@medusajs/utils"

type LoadedLinkModule = LoadedModule & ILinkModule
type ModuleMap = Map<string, LoadedLinkModule>

const values = (value: unknown) =>
  Array.isArray(value) ? value : value ? [value] : []

const findModule = (
  modulesMap: ModuleMap,
  moduleKey: Modules | undefined,
  matches: (linkableKeys: string[]) => boolean
) =>
  ((moduleKey ? modulesMap.get(moduleKey) : undefined) ??
    [...modulesMap.values()].find((module) =>
      matches(Object.keys(module.__joinerConfig.linkableKeys ?? {}))
    )) as any

async function assertStoreSafeProductLinks(
  modulesMap: ModuleMap,
  links: LinkDefinition[],
  sharedContext: Context
): Promise<void> {
  const productService = findModule(
    modulesMap,
    Modules.PRODUCT,
    (keys) => keys.includes("product_id") && keys.includes("variant_id")
  )
  if (!productService) {
    return
  }
  const productServiceName = productService.__definition.key
  const productLinks = links.filter((link) => link[productServiceName])
  if (!productLinks.length) {
    return
  }

  const productIds = deduplicate(
    productLinks.flatMap((link) =>
      values(link[productServiceName].product_id)
    ) as string[]
  )
  const variantIds = deduplicate(
    productLinks.flatMap((link) =>
      values(link[productServiceName].variant_id)
    ) as string[]
  )

  const [products, variants] = await promiseAll([
    productIds.length
      ? productService.listProducts(
          { id: productIds },
          { select: ["id"] },
          sharedContext
        )
      : Promise.resolve([]),
    variantIds.length
      ? productService.listProductVariants(
          { id: variantIds },
          { select: ["id"] },
          sharedContext
        )
      : Promise.resolve([]),
  ])
  if (
    arrayDifference(
      productIds,
      products.map((product) => product.id)
    ).length ||
    arrayDifference(
      variantIds,
      variants.map((variant) => variant.id)
    ).length
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Product link endpoint does not belong to the active Store"
    )
  }

  const pricingService = findModule(modulesMap, Modules.PRICING, (keys) =>
    keys.includes("price_set_id")
  )
  const pricingServiceName = pricingService?.__definition.key
  const fulfillmentService = findModule(
    modulesMap,
    Modules.FULFILLMENT,
    (keys) =>
      keys.includes("shipping_profile_id") &&
      keys.includes("shipping_option_id")
  )
  const fulfillmentServiceName = fulfillmentService?.__definition.key
  const inventoryService = findModule(modulesMap, Modules.INVENTORY, (keys) =>
    keys.includes("inventory_item_id")
  )
  const inventoryServiceName = inventoryService?.__definition.key
  const salesChannelService = findModule(
    modulesMap,
    Modules.SALES_CHANNEL,
    (keys) => keys.includes("sales_channel_id")
  )
  const salesChannelServiceName = salesChannelService?.__definition.key
  const commerceOwnershipService = findModule(
    modulesMap,
    undefined,
    (keys) => keys.includes("commerce_resource_ownership_id")
  )
  const commerceOwnershipServiceName =
    commerceOwnershipService?.__definition.key
  const linkedModules = deduplicate(
    productLinks.flatMap((link) =>
      Object.keys(link).filter(
        (moduleName) =>
          moduleName !== "data" && moduleName !== productServiceName
      )
    )
  )
  if (
    productService.__storeIsolationMode?.() === "shared" &&
    linkedModules.some(
      (moduleName) =>
        moduleName !== pricingServiceName &&
        moduleName !== fulfillmentServiceName &&
        moduleName !== inventoryServiceName &&
        moduleName !== salesChannelServiceName &&
        moduleName !== commerceOwnershipServiceName
    )
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "This Product link endpoint is not certified for shared Store placement"
    )
  }

  const commerceOwnershipIds = deduplicate(
    commerceOwnershipServiceName
      ? (productLinks.flatMap((link) =>
          values(
            link[commerceOwnershipServiceName]
              ?.commerce_resource_ownership_id
          )
        ) as string[])
      : []
  )
  if (commerceOwnershipIds.length) {
    const ownerships =
      await commerceOwnershipService.listCommerceResourceOwnerships(
        {
          id: commerceOwnershipIds,
          store_id: sharedContext.storeId,
        },
        { select: ["id"] },
        sharedContext
      )
    if (
      arrayDifference(
        commerceOwnershipIds,
        ownerships.map((ownership) => ownership.id)
      ).length
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Commerce ownership link endpoint does not belong to the active Store"
      )
    }
  }

  const priceSetIds = deduplicate(
    pricingServiceName
      ? (productLinks.flatMap((link) =>
          values(link[pricingServiceName]?.price_set_id)
        ) as string[])
      : []
  )
  if (!priceSetIds.length) {
    // Continue with Inventory validation below.
  } else {
    const priceSets = await pricingService.listPriceSets(
      { id: priceSetIds },
      { select: ["id"] },
      sharedContext
    )
    if (
      arrayDifference(
        priceSetIds,
        priceSets.map((priceSet) => priceSet.id)
      ).length
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Price-set link endpoint does not belong to the active Store"
      )
    }
  }

  const inventoryItemIds = deduplicate(
    inventoryServiceName
      ? (productLinks.flatMap((link) =>
          values(link[inventoryServiceName]?.inventory_item_id)
        ) as string[])
      : []
  )
  if (!inventoryItemIds.length) {
    return
  }
  const inventoryItems = await inventoryService.listInventoryItems(
    { id: inventoryItemIds },
    { select: ["id"] },
    sharedContext
  )
  if (
    arrayDifference(
      inventoryItemIds,
      inventoryItems.map((item) => item.id)
    ).length
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Inventory link endpoint does not belong to the active Store"
    )
  }
}

async function assertStoreSafeFulfillmentLinks(
  modulesMap: ModuleMap,
  links: LinkDefinition[],
  sharedContext: Context
): Promise<void> {
  const fulfillmentService = findModule(
    modulesMap,
    Modules.FULFILLMENT,
    (keys) =>
      keys.includes("fulfillment_id") && keys.includes("shipping_option_id")
  )
  if (!fulfillmentService) {
    return
  }
  const fulfillmentServiceName = fulfillmentService.__definition.key
  const fulfillmentLinks = links.filter((link) => link[fulfillmentServiceName])
  if (!fulfillmentLinks.length) {
    return
  }

  const endpointMethods = {
    fulfillment_id: "listFulfillments",
    fulfillment_set_id: "listFulfillmentSets",
    shipping_option_id: "listShippingOptions",
    shipping_option_rule_id: "listShippingOptionRules",
    shipping_profile_id: "listShippingProfiles",
  } as const
  for (const [key, method] of Object.entries(endpointMethods)) {
    const ids = deduplicate(
      fulfillmentLinks.flatMap((link) =>
        values(link[fulfillmentServiceName][key])
      ) as string[]
    )
    if (!ids.length) {
      continue
    }
    const records = await fulfillmentService[method](
      { id: ids },
      { select: ["id"] },
      sharedContext
    )
    if (
      arrayDifference(
        ids,
        records.map((record) => record.id)
      ).length
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Fulfillment link endpoint does not belong to the active Store"
      )
    }
  }

  if (fulfillmentService.__storeIsolationMode?.() !== "shared") {
    return
  }

  const productService = findModule(
    modulesMap,
    Modules.PRODUCT,
    (keys) => keys.includes("product_id") && keys.includes("variant_id")
  )
  const productServiceName = productService?.__definition.key
  const pricingService = findModule(modulesMap, Modules.PRICING, (keys) =>
    keys.includes("price_set_id")
  )
  const pricingServiceName = pricingService?.__definition.key
  const stockLocationService = findModule(
    modulesMap,
    Modules.STOCK_LOCATION,
    (keys) => keys.includes("stock_location_id")
  )
  const stockLocationServiceName = stockLocationService?.__definition.key

  for (const link of fulfillmentLinks) {
    const fulfillmentEndpoint = link[fulfillmentServiceName]
    const productLink =
      productServiceName &&
      link[productServiceName]?.product_id &&
      fulfillmentEndpoint.shipping_profile_id
    const pricingLink =
      pricingServiceName &&
      link[pricingServiceName]?.price_set_id &&
      fulfillmentEndpoint.shipping_option_id
    const stockLocationLink =
      stockLocationServiceName &&
      link[stockLocationServiceName]?.stock_location_id &&
      (fulfillmentEndpoint.fulfillment_set_id ||
        fulfillmentEndpoint.fulfillment_provider_id)
    if (!productLink && !pricingLink && !stockLocationLink) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This Fulfillment link endpoint is not certified for shared Store placement"
      )
    }
  }

  const priceSetIds = deduplicate(
    pricingServiceName
      ? (fulfillmentLinks.flatMap((link) =>
          values(link[pricingServiceName]?.price_set_id)
        ) as string[])
      : []
  )
  if (!priceSetIds.length) {
    // Continue with Stock Location validation below.
  } else {
    const priceSets = await pricingService.listPriceSets(
      { id: priceSetIds },
      { select: ["id"] },
      sharedContext
    )
    if (
      arrayDifference(
        priceSetIds,
        priceSets.map((priceSet) => priceSet.id)
      ).length
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Price-set link endpoint does not belong to the active Store"
      )
    }
  }

  const stockLocationIds = deduplicate(
    stockLocationServiceName
      ? (fulfillmentLinks.flatMap((link) =>
          values(link[stockLocationServiceName]?.stock_location_id)
        ) as string[])
      : []
  )
  if (!stockLocationIds.length) {
    return
  }
  const stockLocations = await stockLocationService.listStockLocations(
    { id: stockLocationIds },
    { select: ["id"] },
    sharedContext
  )
  if (
    arrayDifference(
      stockLocationIds,
      stockLocations.map((location) => location.id)
    ).length
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Stock Location link endpoint does not belong to the active Store"
    )
  }
}

async function assertStoreSafeInventoryLinks(
  modulesMap: ModuleMap,
  links: LinkDefinition[],
  sharedContext: Context
): Promise<void> {
  const inventoryService = findModule(modulesMap, Modules.INVENTORY, (keys) =>
    keys.includes("inventory_item_id")
  )
  if (!inventoryService) return
  const serviceName = inventoryService.__definition.key
  const inventoryLinks = links.filter((link) => link[serviceName])
  if (!inventoryLinks.length) return

  const methodByKey = {
    inventory_item_id: "listInventoryItems",
    inventory_level_id: "listInventoryLevels",
    reservation_item_id: "listReservationItems",
  } as const
  for (const [key, method] of Object.entries(methodByKey)) {
    const ids = deduplicate(
      inventoryLinks.flatMap((link) =>
        values(link[serviceName][key])
      ) as string[]
    )
    if (!ids.length) continue
    const records = await inventoryService[method](
      { id: ids },
      { select: ["id"] },
      sharedContext
    )
    if (
      arrayDifference(
        ids,
        records.map((record) => record.id)
      ).length
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Inventory link endpoint does not belong to the active Store"
      )
    }
  }

  if (inventoryService.__storeIsolationMode?.() !== "shared") return
  const product = findModule(modulesMap, Modules.PRODUCT, (keys) =>
    keys.includes("variant_id")
  )
  const stock = findModule(modulesMap, Modules.STOCK_LOCATION, (keys) =>
    keys.includes("stock_location_id")
  )
  const commerceOwnershipService = findModule(
    modulesMap,
    undefined,
    (keys) => keys.includes("commerce_resource_ownership_id")
  )
  const commerceOwnershipServiceName =
    commerceOwnershipService?.__definition.key
  const allowed = new Set(
    [
      product?.__definition.key,
      stock?.__definition.key,
      commerceOwnershipServiceName,
    ].filter(Boolean)
  )
  if (
    inventoryLinks.some((link) =>
      Object.keys(link).some(
        (key) => key !== "data" && key !== serviceName && !allowed.has(key)
      )
    )
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "This Inventory link endpoint is not certified for shared Store placement"
    )
  }

  const commerceOwnershipIds = deduplicate(
    commerceOwnershipServiceName
      ? (inventoryLinks.flatMap((link) =>
          values(
            link[commerceOwnershipServiceName]
              ?.commerce_resource_ownership_id
          )
        ) as string[])
      : []
  )
  if (commerceOwnershipIds.length) {
    const ownerships =
      await commerceOwnershipService.listCommerceResourceOwnerships(
        {
          id: commerceOwnershipIds,
          store_id: sharedContext.storeId,
        },
        { select: ["id"] },
        sharedContext
      )
    if (
      arrayDifference(
        commerceOwnershipIds,
        ownerships.map((ownership) => ownership.id)
      ).length
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Commerce ownership link endpoint does not belong to the active Store"
      )
    }
  }
}

async function assertStoreSafeStockLocationLinks(
  modulesMap: ModuleMap,
  links: LinkDefinition[],
  sharedContext: Context
): Promise<void> {
  const service = findModule(modulesMap, Modules.STOCK_LOCATION, (keys) =>
    keys.includes("stock_location_id")
  )
  if (!service) return
  const serviceName = service.__definition.key
  const stockLinks = links.filter((link) => link[serviceName])
  if (!stockLinks.length) return
  const ids = deduplicate(
    stockLinks.flatMap((link) =>
      values(link[serviceName].stock_location_id)
    ) as string[]
  )
  const records = await service.listStockLocations(
    { id: ids },
    { select: ["id"] },
    sharedContext
  )
  if (
    arrayDifference(
      ids,
      records.map((record) => record.id)
    ).length
  ) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Stock Location link endpoint does not belong to the active Store"
    )
  }
}

async function assertCertifiedStoreOwnedEndpoints(
  modulesMap: ModuleMap,
  links: LinkDefinition[],
  sharedContext: Context
): Promise<void> {
  const definitions = [
    [Modules.PROMOTION, "promotion_id", "listPromotions"],
    [Modules.CUSTOMER, "customer_id", "listCustomers"],
    [Modules.CART, "cart_id", "listCarts"],
    [Modules.PAYMENT, "payment_collection_id", "listPaymentCollections"],
    [Modules.PAYMENT, "account_holder_id", "listAccountHolders"],
    [Modules.ORDER, "order_id", "listOrders"],
    [Modules.ORDER, "return_id", "listReturns"],
    [Modules.ORDER, "claim_id", "listOrderClaims"],
    [Modules.ORDER, "exchange_id", "listOrderExchanges"],
    [Modules.API_KEY, "publishable_key_id", "listApiKeys"],
    [Modules.API_KEY, "api_key_id", "listApiKeys"],
    [Modules.SALES_CHANNEL, "sales_channel_id", "listSalesChannels"],
  ] as const

  for (const [moduleKey, endpointKey, method] of definitions) {
    const service = findModule(modulesMap, moduleKey, (keys) =>
      keys.includes(endpointKey)
    )
    if (!service) {
      continue
    }
    const serviceName = service.__definition.key
    const ids = deduplicate(
      links.flatMap((link) =>
        values(link[serviceName]?.[endpointKey])
      ) as string[]
    )
    if (!ids.length) {
      continue
    }
    const records = await service[method](
      { id: ids },
      { select: ["id"] },
      sharedContext
    )
    if (
      arrayDifference(
        ids,
        records.map((record) => record.id)
      ).length
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `${moduleKey} link endpoint does not belong to the active Store`
      )
    }
  }
}

export async function assertStoreSafeLinks(
  modulesMap: ModuleMap,
  links: LinkDefinition[],
  sharedContext: Context
): Promise<void> {
  await assertStoreSafeProductLinks(modulesMap, links, sharedContext)
  await assertStoreSafeFulfillmentLinks(modulesMap, links, sharedContext)
  await assertStoreSafeInventoryLinks(modulesMap, links, sharedContext)
  await assertStoreSafeStockLocationLinks(modulesMap, links, sharedContext)
  await assertCertifiedStoreOwnedEndpoints(modulesMap, links, sharedContext)
}
