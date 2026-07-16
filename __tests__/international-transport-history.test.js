'use strict';

const { summarizeTaxTreatments } = require('../src/shared/report-accounting');

test('legacy zero-VAT rows without a persisted treatment remain standard', () => {
  expect(summarizeTaxTreatments([
    { doc_type: 'invoice', grand_total: 100, vat_total: 0 },
  ])).toEqual({
    standard: { pre: 100, vat: 0, grand: 100 },
    internationalTransportZeroRate: { pre: 0, vat: 0, grand: 0 },
  });
});
