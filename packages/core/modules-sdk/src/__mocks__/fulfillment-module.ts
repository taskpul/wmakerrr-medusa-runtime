export const FulfillmentModule = {
  __definition: {
    key: "fulfillmentService",
    registrationName: "fulfillmentService",
    defaultPackage: false,
    label: "FulfillmentService",
    isRequired: false,
    isQueryable: true,
    defaultModuleDeclaration: {
      scope: "internal",
    },
  },
  __joinerConfig: {
    serviceName: "fulfillmentService",
    primaryKeys: ["id"],
    linkableKeys: {
      fulfillment_id: "Fulfillment",
      fulfillment_set_id: "FulfillmentSet",
      shipping_option_id: "ShippingOption",
      shipping_option_rule_id: "ShippingOptionRule",
      shipping_profile_id: "ShippingProfile",
    },
    alias: [],
  },

  list: jest.fn(async () => []),
  listFulfillments: jest.fn(async (filters) =>
    (filters.id ?? []).map((id) => ({ id }))
  ),
  listFulfillmentSets: jest.fn(async (filters) =>
    (filters.id ?? []).map((id) => ({ id }))
  ),
  listShippingOptions: jest.fn(async (filters) =>
    (filters.id ?? []).map((id) => ({ id }))
  ),
  listShippingOptionRules: jest.fn(async (filters) =>
    (filters.id ?? []).map((id) => ({ id }))
  ),
  listShippingProfiles: jest.fn(async (filters) =>
    (filters.id ?? []).map((id) => ({ id }))
  ),
  __storeIsolationMode: jest.fn(() => "dedicated"),
  softDelete: jest.fn(() => {}),
}
