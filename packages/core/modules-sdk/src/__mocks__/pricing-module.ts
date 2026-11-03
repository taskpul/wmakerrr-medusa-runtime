export const PricingModule = {
  __definition: {
    key: "pricingService",
    registrationName: "pricingService",
    defaultPackage: false,
    label: "PricingService",
    isRequired: false,
    isQueryable: true,
    defaultModuleDeclaration: { scope: "internal" },
  },
  __joinerConfig: {
    serviceName: "pricingService",
    primaryKeys: ["id"],
    linkableKeys: { price_set_id: "PriceSet" },
    alias: [],
  },
  list: jest.fn(async () => []),
  listPriceSets: jest.fn(async (filters) =>
    (filters.id ?? []).map((id) => ({ id }))
  ),
  softDelete: jest.fn(() => {}),
}
