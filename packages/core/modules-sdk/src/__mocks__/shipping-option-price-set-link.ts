export const ShippingOptionPriceSetLink = {
  __definition: {
    key: "shippingOptionPriceSetLink",
    registrationName: "shippingOptionPriceSetLink",
    defaultPackage: "",
    label: "shippingOptionPriceSetLink",
    isRequired: false,
    isQueryable: true,
    defaultModuleDeclaration: { scope: "internal" },
  },
  __joinerConfig: {
    serviceName: "shippingOptionPriceSetLink",
    isLink: true,
    primaryKeys: ["shipping_option_id", "price_set_id"],
    relationships: [
      {
        serviceName: "fulfillmentService",
        primaryKey: "id",
        foreignKey: "shipping_option_id",
        alias: "shipping_option",
        args: {},
      },
      {
        serviceName: "pricingService",
        primaryKey: "id",
        foreignKey: "price_set_id",
        alias: "price_set",
        args: {},
        deleteCascade: true,
      },
    ],
    extends: [],
  },
  create: jest.fn(async () => {}),
  list: jest.fn(async () => []),
  softDelete: jest.fn(() => {}),
}
