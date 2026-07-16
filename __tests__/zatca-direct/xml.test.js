'use strict';

const { ensureRequiredCustomerParty, injectZeroRateReason } = require('../../src/main/zatca/xml');

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

describe('zero-rate reason XML injection', () => {
  const subtotal = '<cac:TaxSubtotal><cac:TaxCategory><cbc:ID>Z</cbc:ID><cbc:Percent>0</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>';

  test('injects escaped reason metadata before TaxScheme and is idempotent', () => {
    const once = injectZeroRateReason(`<Invoice>${subtotal}</Invoice>`, 'VATEX-SA-34-1', 'Goods & freight');
    const twice = injectZeroRateReason(once, 'VATEX-SA-34-1', 'Goods & freight');

    expect(once).toContain('<cbc:TaxExemptionReasonCode>VATEX-SA-34-1</cbc:TaxExemptionReasonCode>');
    expect(once).toContain('<cbc:TaxExemptionReason>Goods &amp; freight</cbc:TaxExemptionReason>');
    expect(once.indexOf('TaxExemptionReasonCode')).toBeLessThan(once.indexOf('<cac:TaxScheme>'));
    expect(twice).toBe(once);
  });

  test('fails closed when no Z subtotal exists', () => {
    const standard = subtotal.replace('<cbc:ID>Z</cbc:ID>', '<cbc:ID>S</cbc:ID>');
    expect(() => injectZeroRateReason(`<Invoice>${standard}</Invoice>`, 'VATEX-SA-34-1', 'Reason'))
      .toThrow(/Z/);
  });
});
