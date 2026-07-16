const {
  TAX_TREATMENTS,
  ZERO_RATE,
  VALIDATION_ERRORS,
  normalizeTaxTreatment,
  effectiveVatPercent,
  validateInternationalTransportSale,
  createTaxSnapshot,
  calculateTaxTotals,
  zeroRateTotalsMatch,
} = require('../src/shared/international-transport-tax');
const {
  internationalSale,
  standardSale,
  eligibleProduct,
  localProduct,
} = require('./helpers/international-transport-fixtures.cjs');

describe('international transport tax rules', () => {
  test('normalizes unknown and missing treatments to standard', () => {
    expect(normalizeTaxTreatment()).toBe(TAX_TREATMENTS.STANDARD);
    expect(normalizeTaxTreatment('unexpected')).toBe(TAX_TREATMENTS.STANDARD);
    expect(normalizeTaxTreatment(TAX_TREATMENTS.INTERNATIONAL_TRANSPORT_ZERO_RATE))
      .toBe(TAX_TREATMENTS.INTERNATIONAL_TRANSPORT_ZERO_RATE);
  });

  test('uses zero only for the explicit international treatment', () => {
    expect(effectiveVatPercent(TAX_TREATMENTS.STANDARD, 15)).toBe(15);
    expect(effectiveVatPercent(TAX_TREATMENTS.INTERNATIONAL_TRANSPORT_ZERO_RATE, 15)).toBe(0);
  });

  test('accepts an eligible international sale without route fields', () => {
    expect(validateInternationalTransportSale(internationalSale())).toEqual([]);
  });

  test.each([
    ['disabled feature', { feature_enabled: false }, VALIDATION_ERRORS.DISABLED],
    ['secondary device', { can_mutate: false }, VALIDATION_ERRORS.PRIMARY_REQUIRED],
  ])('rejects %s', (_name, saleOverride, expectedCode) => {
    expect(validateInternationalTransportSale(internationalSale(saleOverride))).toContain(expectedCode);
  });

  test('rejects empty, local, and mixed product lists', () => {
    expect(validateInternationalTransportSale(internationalSale({ products: [] })))
      .toContain(VALIDATION_ERRORS.INELIGIBLE_ITEM);
    expect(validateInternationalTransportSale(internationalSale({ products: [localProduct()] })))
      .toContain(VALIDATION_ERRORS.INELIGIBLE_ITEM);
    expect(validateInternationalTransportSale(internationalSale({ products: [eligibleProduct(), localProduct()] })))
      .toContain(VALIDATION_ERRORS.INELIGIBLE_ITEM);
  });

  test('does not apply international requirements to a standard sale', () => {
    expect(validateInternationalTransportSale(standardSale())).toEqual([]);
  });

  test('builds an immutable zero-rate snapshot without route data', () => {
    const sale = internationalSale();
    const snapshot = createTaxSnapshot({
      tax_treatment: sale.tax_treatment,
      standard_vat_percent: 15,
    });

    expect(snapshot).toEqual({
      tax_treatment: TAX_TREATMENTS.INTERNATIONAL_TRANSPORT_ZERO_RATE,
      tax_percent_applied: 0,
      zero_rate_reason_code: ZERO_RATE.REASON_CODE,
      zero_rate_reason: ZERO_RATE.REASON_TEXT,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  test('calculates zero-rate totals in integer cents without extracting standard VAT', () => {
    expect(calculateTaxTotals({
      tax_treatment: TAX_TREATMENTS.INTERNATIONAL_TRANSPORT_ZERO_RATE,
      taxable_amount: 1000,
      standard_vat_percent: 15,
    })).toEqual({ taxable_amount: 1000, vat_total: 0, grand_total: 1000 });

    expect(calculateTaxTotals({
      tax_treatment: TAX_TREATMENTS.STANDARD,
      taxable_amount: 1000,
      standard_vat_percent: 15,
    })).toEqual({ taxable_amount: 1000, vat_total: 150, grand_total: 1150 });
  });

  test('reconciles zero-rate items, extras, discounts, fees, VAT and grand total in cents', () => {
    const validSale = {
      items: [
        { price: 100.10, qty: 2, line_total: 200.20 },
        { price: 50, qty: 1, line_total: 50 },
      ],
      extra_value: 10,
      sub_total: 260.20,
      discount_amount: 20.20,
      tobacco_fee: 5,
      sub_after_discount: 245,
      vat_total: 0,
      grand_total: 245,
    };
    expect(zeroRateTotalsMatch(validSale)).toBe(true);
    expect(zeroRateTotalsMatch({ ...validSale, sub_total: 999 })).toBe(false);
    expect(zeroRateTotalsMatch({ ...validSale, grand_total: 244.99 })).toBe(false);
    expect(zeroRateTotalsMatch({
      ...validSale,
      items: [{ ...validSale.items[0], line_total: 1 }, validSale.items[1]],
    })).toBe(false);
  });
});
