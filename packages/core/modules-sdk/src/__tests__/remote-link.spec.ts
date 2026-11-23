import { FulfillmentModule } from "../__mocks__/fulfillment-module"
import { InventoryModule } from "../__mocks__/inventory-module"
import { InventoryStockLocationLink } from "../__mocks__/inventory-stock-location-link"
import { ProductInventoryLinkModule } from "../__mocks__/product-inventory-link"
import { ProductModule } from "../__mocks__/product-module"
import { PricingModule } from "../__mocks__/pricing-module"
import { ProductShippingProfileLink } from "../__mocks__/product-shipping-profile-link"
import { ShippingOptionPriceSetLink } from "../__mocks__/shipping-option-price-set-link"
import { StockLocationFulfillmentSetLink } from "../__mocks__/stock-location-fulfillment-set-link"
import { StockLocationModule } from "../__mocks__/stock-location-module"

import { Link } from "../link"
import { assertStoreSafeLinks } from "../store-link-ownership"

const SalesChannelModule = {
  __definition: { key: "salesChannelService" },
  __joinerConfig: {
    linkableKeys: { sales_channel_id: "SalesChannel" },
  },
  listSalesChannels: jest.fn(async (filters) =>
    (filters.id ?? []).map((id) => ({ id }))
  ),
}

const CommerceOwnershipModule = {
  __definition: { key: "commerceOwnership" },
  __joinerConfig: {
    linkableKeys: {
      commerce_resource_ownership_id: "CommerceResourceOwnership",
    },
  },
  listCommerceResourceOwnerships: jest.fn(async (filters) =>
    (filters.id ?? []).map((id) => ({ id }))
  ),
}

const allModules = [
  // modules
  ProductModule,
  InventoryModule,
  StockLocationModule,
  FulfillmentModule,
  PricingModule,
  // links
  ProductInventoryLinkModule,
  InventoryStockLocationLink,
  StockLocationFulfillmentSetLink,
  ProductShippingProfileLink,
  ShippingOptionPriceSetLink,
]
describe("Remote Link", function () {
  it("Should get all loaded modules and compose their relationships", async function () {
    const remoteLink = new Link(allModules as any)

    const relations = remoteLink.getRelationships()

    const prodInventoryLink = relations.get(
      "productVariantInventoryInventoryItemLink"
    )
    const prodModule = relations.get("productService")
    const inventoryModule = relations.get("inventoryService")

    expect(prodInventoryLink?.get("variant_id")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceName: "productService",
          primaryKey: "id",
          foreignKey: "variant_id",
          alias: "variant",
          deleteCascade: true,
          isPrimary: false,
          isForeign: true,
        }),
      ])
    )

    expect(prodInventoryLink?.get("inventory_item_id")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceName: "inventoryService",
          primaryKey: "id",
          foreignKey: "inventory_item_id",
          alias: "inventory",
          deleteCascade: true,
          isPrimary: false,
          isForeign: true,
        }),
      ])
    )

    expect(prodModule?.get("variant_id")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceName: "productVariantInventoryInventoryItemLink",
          primaryKey: "variant_id",
          foreignKey: "id",
          alias: "inventory_items",
          isList: true,
          isPrimary: true,
          isForeign: false,
        }),
      ])
    )

    expect(inventoryModule?.get("inventory_item_id")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceName: "productVariantInventoryInventoryItemLink",
          primaryKey: "inventory_item_id",
          foreignKey: "id",
          alias: "variant_link",
          isPrimary: true,
          isForeign: false,
        }),
      ])
    )
  })

  it("Should throw when creating the same hasMany: false link twice across separate calls", async function () {
    const remoteLink = new Link(allModules as any)

    await remoteLink.create({
      productService: {
        variant_id: "var_999",
      },
      inventoryService: {
        inventory_item_id: "inv_999",
      },
    })

    ProductInventoryLinkModule.list.mockResolvedValueOnce([{}] as any)

    await expect(
      remoteLink.create({
        productService: {
          variant_id: "var_999",
        },
        inventoryService: {
          inventory_item_id: "inv_888",
        },
      })
    ).rejects.toThrow(
      "Cannot create multiple links between 'productService' and 'inventoryService'"
    )
  })

  it("Should throw when a single create() call contains two links targeting the same hasMany: false entity", async function () {
    const remoteLink = new Link(allModules as any)

    await expect(
      remoteLink.create([
        {
          productService: {
            variant_id: "var_111",
          },
          inventoryService: {
            inventory_item_id: "inv_111",
          },
        },
        {
          productService: {
            variant_id: "var_222",
          },
          inventoryService: {
            inventory_item_id: "inv_111",
          },
        },
      ])
    ).rejects.toThrow(
      "Cannot create multiple links between 'productService' and 'inventoryService'"
    )
  })

  it("Should throw when a single create() call links a hasMany: false entity to two different entities on the hasMany: true side", async function () {
    const remoteLink = new Link(allModules as any)

    await expect(
      remoteLink.create([
        {
          stockLocationService: {
            stock_location_id: "loc_111",
          },
          fulfillmentService: {
            fulfillment_set_id: "fset_111",
          },
        },
        {
          stockLocationService: {
            stock_location_id: "loc_222",
          },
          fulfillmentService: {
            fulfillment_set_id: "fset_111",
          },
        },
      ])
    ).rejects.toThrow(
      "Cannot create multiple links between 'stockLocationService' and 'fulfillmentService'"
    )
  })

  it("Should call the correct link module to create relation between 2 keys", async function () {
    const remoteLink = new Link(allModules as any)

    await remoteLink.create([
      {
        productService: {
          variant_id: "var_123",
        },
        inventoryService: {
          inventory_item_id: "inv_123",
        },
      },
      {
        productService: {
          variant_id: "var_abc",
        },
        inventoryService: {
          inventory_item_id: "inv_abc",
        },
      },
      {
        inventoryService: {
          inventory_level_id: "ilev_123",
        },
        stockLocationService: {
          stock_location_id: "loc_123",
        },
      },
    ])

    expect(ProductInventoryLinkModule.create).toHaveBeenCalledWith(
      [
        ["var_123", "inv_123"],
        ["var_abc", "inv_abc"],
      ],
      undefined,
      undefined,
      {}
    )
    expect(InventoryStockLocationLink.create).toHaveBeenCalledWith(
      [["ilev_123", "loc_123"]],
      undefined,
      undefined,
      {}
    )
  })

  it("Should call delete in cascade all the modules involved in the link", async function () {
    const remoteLink = new Link(allModules as any)

    ProductInventoryLinkModule.softDelete.mockImplementation(() => {
      return {
        variant_id: ["var_123"],
        inventory_item_id: ["inv_123"],
      }
    })

    ProductModule.softDelete.mockImplementation(() => {
      return {
        product_id: ["prod_123", "prod_abc"],
        variant_id: ["var_123", "var_abc"],
      }
    })

    InventoryModule.softDelete.mockImplementation(() => {
      return {
        inventory_item_id: ["inv_123"],
        inventory_level_id: ["ilev_123"],
      }
    })

    InventoryStockLocationLink.softDelete.mockImplementation(() => {
      return {
        inventory_level_id: ["ilev_123"],
        stock_location_id: ["loc_123"],
      }
    })

    await remoteLink.delete({
      productService: {
        variant_id: "var_123",
      },
    })

    expect(ProductInventoryLinkModule.softDelete).toHaveBeenCalledTimes(2)
    expect(ProductModule.softDelete).toHaveBeenCalledTimes(1)
    expect(InventoryModule.softDelete).toHaveBeenCalledTimes(1)
    expect(InventoryStockLocationLink.softDelete).toHaveBeenCalledTimes(1)

    expect(ProductInventoryLinkModule.softDelete).toHaveBeenNthCalledWith(
      1,
      { variant_id: ["var_123"] },
      { returnLinkableKeys: ["variant_id", "inventory_item_id"] },
      {}
    )

    expect(ProductInventoryLinkModule.softDelete).toHaveBeenNthCalledWith(
      2,
      { variant_id: ["var_abc"] },
      { returnLinkableKeys: ["variant_id", "inventory_item_id"] },
      {}
    )

    expect(ProductModule.softDelete).toHaveBeenCalledWith(
      { id: ["var_123"] },
      { returnLinkableKeys: ["product_id", "variant_id"] },
      {}
    )

    expect(InventoryModule.softDelete).toHaveBeenCalledWith(
      { id: ["inv_123"] },
      {
        returnLinkableKeys: [
          "inventory_item_id",
          "inventory_level_id",
          "reservation_item_id",
        ],
      },
      {}
    )

    expect(InventoryStockLocationLink.softDelete).toHaveBeenCalledWith(
      {
        inventory_level_id: ["ilev_123"],
      },
      { returnLinkableKeys: ["inventory_level_id", "stock_location_id"] },
      {}
    )
  })

  it("rejects a foreign Product endpoint before writing a link", async function () {
    const remoteLink = new Link(allModules as any)
    ProductModule.listProductVariants.mockResolvedValueOnce([])

    await expect(
      remoteLink.create(
        {
          productService: { variant_id: "var_foreign" },
          inventoryService: { inventory_item_id: "inv_local" },
        },
        { storeId: "store_a" }
      )
    ).rejects.toThrow(
      "Product link endpoint does not belong to the active Store"
    )
    expect(ProductInventoryLinkModule.create).not.toHaveBeenCalledWith(
      expect.arrayContaining([["var_foreign", "inv_local"]]),
      expect.anything(),
      expect.anything(),
      expect.anything()
    )
  })

  it("allows certified Product-to-Inventory links in shared placement", async function () {
    const remoteLink = new Link(allModules as any)
    ProductModule.__storeIsolationMode.mockReturnValueOnce("shared")

    await expect(
      remoteLink.create(
        {
          productService: { variant_id: "var_local" },
          inventoryService: { inventory_item_id: "inv_local" },
        },
        { storeId: "store_a" }
      )
    ).resolves.toEqual([undefined])
  })

  it("rejects a foreign Inventory endpoint before writing a link", async function () {
    const remoteLink = new Link(allModules as any)
    InventoryModule.listInventoryItems.mockResolvedValueOnce([])
    await expect(
      remoteLink.create(
        {
          productService: { variant_id: "var_local" },
          inventoryService: { inventory_item_id: "inv_foreign" },
        },
        { storeId: "store_a" }
      )
    ).rejects.toThrow(
      "Inventory link endpoint does not belong to the active Store"
    )
  })

  it("allows a Store-owned Inventory ownership link in shared placement", async function () {
    InventoryModule.__storeIsolationMode.mockReturnValueOnce("shared")

    await expect(
      assertStoreSafeLinks(
        new Map(
          [...allModules, CommerceOwnershipModule].map((module) => [
            module.__definition.key,
            module,
          ])
        ) as any,
        [
          {
            inventoryService: { inventory_item_id: "inv_local" },
            commerceOwnership: {
              commerce_resource_ownership_id: "ownership_local",
            },
          },
        ],
        { storeId: "store_a" }
      )
    ).resolves.toBeUndefined()
  })

  it("rejects a foreign Inventory ownership link in shared placement", async function () {
    InventoryModule.__storeIsolationMode.mockReturnValueOnce("shared")
    CommerceOwnershipModule.listCommerceResourceOwnerships.mockResolvedValueOnce(
      []
    )

    await expect(
      assertStoreSafeLinks(
        new Map(
          [...allModules, CommerceOwnershipModule].map((module) => [
            module.__definition.key,
            module,
          ])
        ) as any,
        [
          {
            inventoryService: { inventory_item_id: "inv_local" },
            commerceOwnership: {
              commerce_resource_ownership_id: "ownership_foreign",
            },
          },
        ],
        { storeId: "store_a" }
      )
    ).rejects.toThrow(
      "Commerce ownership link endpoint does not belong to the active Store"
    )
  })

  it("rejects a foreign Fulfillment endpoint before writing a link", async function () {
    const remoteLink = new Link(allModules as any)
    FulfillmentModule.listFulfillmentSets.mockResolvedValueOnce([])

    await expect(
      remoteLink.create(
        {
          stockLocationService: { stock_location_id: "loc_local" },
          fulfillmentService: { fulfillment_set_id: "fset_foreign" },
        },
        { storeId: "store_a" }
      )
    ).rejects.toThrow(
      "Fulfillment link endpoint does not belong to the active Store"
    )
  })

  it("allows certified Fulfillment-to-Stock-Location links in shared placement", async function () {
    const remoteLink = new Link(allModules as any)
    FulfillmentModule.__storeIsolationMode.mockReturnValueOnce("shared")

    await expect(
      remoteLink.create(
        {
          stockLocationService: { stock_location_id: "loc_local" },
          fulfillmentService: { fulfillment_set_id: "fset_local" },
        },
        { storeId: "store_a" }
      )
    ).resolves.toEqual([undefined])
  })

  it("rejects a foreign Stock Location endpoint before writing a link", async function () {
    const remoteLink = new Link(allModules as any)
    StockLocationModule.listStockLocations.mockResolvedValueOnce([])
    await expect(
      remoteLink.create(
        {
          stockLocationService: { stock_location_id: "loc_foreign" },
          fulfillmentService: { fulfillment_set_id: "fset_local" },
        },
        { storeId: "store_a" }
      )
    ).rejects.toThrow(
      "Stock Location link endpoint does not belong to the active Store"
    )
  })

  it("allows the certified Product-to-Shipping-Profile link for one Store", async function () {
    const remoteLink = new Link(allModules as any)
    ProductModule.__storeIsolationMode.mockReturnValueOnce("shared")
    FulfillmentModule.__storeIsolationMode.mockReturnValueOnce("shared")

    await expect(
      remoteLink.create(
        {
          productService: { product_id: "prod_local" },
          fulfillmentService: { shipping_profile_id: "sp_local" },
        },
        { storeId: "store_a" }
      )
    ).resolves.toBeDefined()
  })

  it("allows a certified Product-to-Sales-Channel link for one Store", async function () {
    ProductModule.__storeIsolationMode.mockReturnValueOnce("shared")

    await expect(
      assertStoreSafeLinks(
        new Map(
          [...allModules, SalesChannelModule].map((module) => [
            module.__definition.key,
            module,
          ])
        ) as any,
        [
          {
            productService: { product_id: "prod_local" },
            salesChannelService: { sales_channel_id: "sc_local" },
          },
        ],
        { storeId: "store_a" }
      )
    ).resolves.toBeUndefined()
  })

  it("rejects a foreign Sales Channel before writing a Product link", async function () {
    ProductModule.__storeIsolationMode.mockReturnValueOnce("shared")
    SalesChannelModule.listSalesChannels.mockResolvedValueOnce([])

    await expect(
      assertStoreSafeLinks(
        new Map(
          [...allModules, SalesChannelModule].map((module) => [
            module.__definition.key,
            module,
          ])
        ) as any,
        [
          {
            productService: { product_id: "prod_local" },
            salesChannelService: { sales_channel_id: "sc_foreign" },
          },
        ],
        { storeId: "store_a" }
      )
    ).rejects.toThrow(
      "sales_channel link endpoint does not belong to the active Store"
    )
  })

  it("allows a Store-owned Product ownership link in shared placement", async function () {
    ProductModule.__storeIsolationMode.mockReturnValueOnce("shared")

    await expect(
      assertStoreSafeLinks(
        new Map(
          [...allModules, CommerceOwnershipModule].map((module) => [
            module.__definition.key,
            module,
          ])
        ) as any,
        [
          {
            productService: { product_id: "prod_local" },
            commerceOwnership: {
              commerce_resource_ownership_id: "ownership_local",
            },
          },
        ],
        { storeId: "store_a" }
      )
    ).resolves.toBeUndefined()
  })

  it("rejects a foreign Product ownership link in shared placement", async function () {
    ProductModule.__storeIsolationMode.mockReturnValueOnce("shared")
    CommerceOwnershipModule.listCommerceResourceOwnerships.mockResolvedValueOnce(
      []
    )

    await expect(
      assertStoreSafeLinks(
        new Map(
          [...allModules, CommerceOwnershipModule].map((module) => [
            module.__definition.key,
            module,
          ])
        ) as any,
        [
          {
            productService: { product_id: "prod_local" },
            commerceOwnership: {
              commerce_resource_ownership_id: "ownership_foreign",
            },
          },
        ],
        { storeId: "store_a" }
      )
    ).rejects.toThrow(
      "Commerce ownership link endpoint does not belong to the active Store"
    )
  })

  it("allows the certified Shipping-Option-to-Price-Set link for one Store", async function () {
    const remoteLink = new Link(allModules as any)
    FulfillmentModule.__storeIsolationMode.mockReturnValueOnce("shared")

    await expect(
      remoteLink.create(
        {
          fulfillmentService: { shipping_option_id: "so_local" },
          pricingService: { price_set_id: "pset_local" },
        },
        { storeId: "store_a" }
      )
    ).resolves.toBeDefined()
  })
})
