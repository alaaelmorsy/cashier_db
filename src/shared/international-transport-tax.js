const TAX_TREATMENTS = Object.freeze({
  STANDARD: 'standard',
  INTERNATIONAL_TRANSPORT_ZERO_RATE: 'international_transport_zero_rate',
});

const ZERO_RATE = Object.freeze({
  CATEGORY: 'Z',
  PERCENT: 0,
  REASON_CODE: 'VATEX-SA-34-1',
  REASON_TEXT: 'The international transport of Goods',
});

const VALIDATION_ERRORS = Object.freeze({
  DISABLED: 'INTERNATIONAL_TRANSPORT_DISABLED',
  PRIMARY_REQUIRED: 'PRIMARY_DEVICE_REQUIRED',
  INELIGIBLE_ITEM: 'INELIGIBLE_INTERNATIONAL_TRANSPORT_ITEM',
  TOTAL_MISMATCH: 'INTERNATIONAL_TRANSPORT_TOTAL_MISMATCH',
});

function normalizeTaxTreatment(rawTreatment) {
  return rawTreatment === TAX_TREATMENTS.INTERNATIONAL_TRANSPORT_ZERO_RATE
    ? TAX_TREATMENTS.INTERNATIONAL_TRANSPORT_ZERO_RATE
    : TAX_TREATMENTS.STANDARD;
}

function effectiveVatPercent(taxTreatment, standardVatPercent) {
  if (normalizeTaxTreatment(taxTreatment) === TAX_TREATMENTS.INTERNATIONAL_TRANSPORT_ZERO_RATE) return 0;
  const normalizedPercent = Number(standardVatPercent);
  return Number.isFinite(normalizedPercent) && normalizedPercent >= 0 ? normalizedPercent : 0;
}

function allProductsEligible(products) {
  return Array.isArray(products)
    && products.length > 0
    && products.every((product) => Number(product?.is_international_transport_service) === 1);
}

function validateInternationalTransportSale(saleRequest = {}) {
  if (normalizeTaxTreatment(saleRequest.tax_treatment) !== TAX_TREATMENTS.INTERNATIONAL_TRANSPORT_ZERO_RATE) return [];
  const errors = [];
  if (!saleRequest.feature_enabled) errors.push(VALIDATION_ERRORS.DISABLED);
  if (!saleRequest.can_mutate) errors.push(VALIDATION_ERRORS.PRIMARY_REQUIRED);
  if (!allProductsEligible(saleRequest.products)) errors.push(VALIDATION_ERRORS.INELIGIBLE_ITEM);
  return errors;
}

function zeroRateSnapshot() {
  return Object.freeze({
    tax_treatment: TAX_TREATMENTS.INTERNATIONAL_TRANSPORT_ZERO_RATE,
    tax_percent_applied: ZERO_RATE.PERCENT,
    zero_rate_reason_code: ZERO_RATE.REASON_CODE,
    zero_rate_reason: ZERO_RATE.REASON_TEXT,
  });
}

function createTaxSnapshot(snapshotRequest = {}) {
  const treatment = normalizeTaxTreatment(snapshotRequest.tax_treatment);
  if (treatment === TAX_TREATMENTS.INTERNATIONAL_TRANSPORT_ZERO_RATE) {
    return zeroRateSnapshot();
  }
  return Object.freeze({
    tax_treatment: TAX_TREATMENTS.STANDARD,
    tax_percent_applied: effectiveVatPercent(treatment, snapshotRequest.standard_vat_percent),
    zero_rate_reason_code: null,
    zero_rate_reason: null,
  });
}

function moneyFromCents(cents) {
  return Number((cents / 100).toFixed(2));
}

function amountCents(rawAmount) {
  const amount = Number(rawAmount);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function zeroRateTotalsMatch(saleRequest = {}) {
  if (!Array.isArray(saleRequest.items) || saleRequest.items.length === 0) return false;
  let itemTotalCents = 0;
  for (const item of saleRequest.items) {
    const calculatedLineCents = amountCents(Number(item?.price) * Number(item?.qty));
    const submittedLineCents = amountCents(item?.line_total);
    if (calculatedLineCents === null || submittedLineCents !== calculatedLineCents) return false;
    itemTotalCents += calculatedLineCents;
  }
  const subTotalCents = itemTotalCents + (amountCents(saleRequest.extra_value || 0) ?? 0);
  const discountCents = amountCents(saleRequest.discount_amount || 0);
  const feeCents = amountCents(saleRequest.tobacco_fee || 0);
  const afterDiscountCents = subTotalCents - discountCents + feeCents;
  return discountCents !== null && feeCents !== null && discountCents >= 0 && discountCents <= subTotalCents
    && amountCents(saleRequest.sub_total) === subTotalCents
    && amountCents(saleRequest.sub_after_discount) === afterDiscountCents
    && amountCents(saleRequest.vat_total) === 0
    && amountCents(saleRequest.grand_total) === afterDiscountCents;
}

function calculateTaxTotals(calculation = {}) {
  const taxableCents = Math.round(Number(calculation.taxable_amount || 0) * 100);
  const vatPercent = effectiveVatPercent(calculation.tax_treatment, calculation.standard_vat_percent);
  const vatCents = Math.round(taxableCents * vatPercent / 100);
  return {
    taxable_amount: moneyFromCents(taxableCents),
    vat_total: moneyFromCents(vatCents),
    grand_total: moneyFromCents(taxableCents + vatCents),
  };
}

module.exports = {
  TAX_TREATMENTS,
  ZERO_RATE,
  VALIDATION_ERRORS,
  normalizeTaxTreatment,
  effectiveVatPercent,
  validateInternationalTransportSale,
  createTaxSnapshot,
  calculateTaxTotals,
  zeroRateTotalsMatch,
};
