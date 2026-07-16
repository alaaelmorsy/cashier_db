function eligibleProduct(overrides = {}) {
  return { id: 42, name: 'International freight', is_international_transport_service: 1, ...overrides };
}

function localProduct(overrides = {}) {
  return { id: 43, name: 'Local service', is_international_transport_service: 0, ...overrides };
}

function internationalSale(overrides = {}) {
  return {
    tax_treatment: 'international_transport_zero_rate',
    feature_enabled: true,
    can_mutate: true,
    products: [eligibleProduct()],
    ...overrides,
  };
}

function standardSale(overrides = {}) {
  return {
    tax_treatment: 'standard',
    feature_enabled: false,
    can_mutate: false,
    products: [localProduct()],
    ...overrides,
  };
}

module.exports = {
  eligibleProduct,
  localProduct,
  internationalSale,
  standardSale,
};
