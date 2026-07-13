const { summarizePurchaseLedger } = require('../src/shared/purchase-report-accounting');

describe('purchase invoice report accounting', () => {
  test('covers paid, partial, unpaid, zero-VAT and positive/negative returns', () => {
    const result = summarizePurchaseLedger([
      { doc_type: 'invoice', payment_method: 'cash', sub_total: 100, vat_total: 15, grand_total: 115, amount_paid: 115 },
      { doc_type: 'invoice', payment_method: 'credit', sub_total: 200, vat_total: 30, grand_total: 230, amount_paid: 80 },
      { doc_type: 'invoice', payment_method: 'credit', price_mode: 'zero_vat', sub_total: 50, vat_total: 99, grand_total: 149, amount_paid: 0 },
      { doc_type: 'return', payment_method: 'cash', sub_total: 20, vat_total: 3, grand_total: 23 },
      { doc_type: 'return', payment_method: 'cash', sub_total: -10, vat_total: -1.5, grand_total: -11.5 },
    ]);
    expect(result).toEqual({ count: 3, returnsCount: 2, pre: 320, vat: 40.5, grand: 360.5, paid: 160.5 });
  });

  test('caps invalid paid amounts and rounds accumulated currency', () => {
    const result = summarizePurchaseLedger([
      { payment_method: 'credit', sub_total: 0.1, vat_total: 0.02, grand_total: 0.12, amount_paid: 9 },
      { payment_method: 'credit', sub_total: 0.2, vat_total: 0.03, grand_total: 0.23, amount_paid: -1 },
    ]);
    expect(result).toEqual({ count: 2, returnsCount: 0, pre: 0.3, vat: 0.05, grand: 0.35, paid: 0.12 });
  });

  test('does not treat a return of an unpaid credit purchase as a cash refund', () => {
    expect(summarizePurchaseLedger([
      { doc_type: 'return', payment_method: 'return', original_payment_method: 'credit', sub_total: 100, vat_total: 15, grand_total: 115 },
    ]).paid).toBe(0);
  });

  test('pre-VAT total reconciles with the stored legal grand total', () => {
    expect(summarizePurchaseLedger([
      { doc_type: 'invoice', payment_method: 'cash', sub_total: 100, vat_total: 12, grand_total: 92, amount_paid: 92 },
    ])).toMatchObject({ pre: 80, vat: 12, grand: 92 });
  });
});
