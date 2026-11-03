export const ProductShippingProfileLink = {
  __definition: {
    key: "productShippingProfileLink",
    registrationName: "productShippingProfileLink",
    defaultPackage: "",
    label: "productShippingProfileLink",
    isRequired: false,
    isQueryable: true,
    defaultModuleDeclaration: { scope: "internal" },
  },
  __joinerConfig: {
    serviceName: "productShippingProfileLink",
    isLink: true,
    primaryKeys: ["product_id", "shipping_profile_id"],
    relationships: [
      {
        serviceName: "productService",
        primaryKey: "id",
        foreignKey: "product_id",
        alias: "product",
        args: {},
        hasMany: true,
      },
      {
        serviceName: "fulfillmentService",
        primaryKey: "id",
        foreignKey: "shipping_profile_id",
        alias: "shipping_profile",
        args: {},
      },
    ],
    extends: [],
  },
  create: jest.fn(async () => {}),
  list: jest.fn(async () => []),
  softDelete: jest.fn(() => {}),
}
