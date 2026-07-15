'use strict';

const { ensureRequiredCustomerParty } = require('../../src/main/zatca/xml');

describe('ZATCA generated XML compatibility', () => {
  test('adds an empty customer party before PaymentMeans for simplified credit notes', () => {
    const generatedXml = [
      '<Invoice>',
      '<cac:AccountingSupplierParty></cac:AccountingSupplierParty>',
      '<cac:PaymentMeans></cac:PaymentMeans>',
      '</Invoice>',
    ].join('');

    const compatibleXml = ensureRequiredCustomerParty(generatedXml);

    expect(compatibleXml).toContain('<cac:AccountingCustomerParty>');
    expect(compatibleXml.indexOf('<cac:AccountingCustomerParty>'))
      .toBeLessThan(compatibleXml.indexOf('<cac:PaymentMeans>'));
  });

  test('keeps XML unchanged when the customer party already exists', () => {
    const generatedXml = '<Invoice><cac:AccountingCustomerParty></cac:AccountingCustomerParty></Invoice>';

    expect(ensureRequiredCustomerParty(generatedXml)).toBe(generatedXml);
  });
});
