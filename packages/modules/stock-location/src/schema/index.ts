export default `
type StockLocationAddress {
  id: ID
  store_id: String!
  address_1: String!
  address_2: String
  company: String
  country_code: String!
  city: String
  phone: String
  postal_code: String
  province: String
  metadata: JSON
  stock_locations: StockLocation
  created_at: DateTime!
  updated_at: DateTime!
  deleted_at: DateTime
}

type StockLocation {
  id: ID!
  store_id: String!
  name: String!
  metadata: JSON
  address_id: ID!
  address: StockLocationAddress
  created_at: DateTime!
  updated_at: DateTime!
  deleted_at: DateTime
}

`
