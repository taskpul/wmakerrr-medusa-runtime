export const StockLocationModule = {
  __definition: {
    key: "stockLocationService",
    registrationName: "stockLocationService",
    defaultPackage: false,
    label: "StockLocationService",
    isRequired: false,
    isQueryable: true,
    dependencies: ["eventBusModuleService"],
    defaultModuleDeclaration: {
      scope: "internal",
    },
  },
  __joinerConfig: {
    serviceName: "stockLocationService",
    primaryKeys: ["id"],
    linkableKeys: { stock_location_id: "StockLocation" },
    alias: [],
  },

  list: jest.fn(async () => []),
  listStockLocations: jest.fn(async (filters) =>
    (filters.id ?? []).map((id) => ({ id }))
  ),
  __storeIsolationMode: jest.fn(() => "dedicated"),
  softDelete: jest.fn(() => {}),
}
