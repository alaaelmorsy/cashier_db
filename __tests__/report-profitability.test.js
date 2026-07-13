const {
  buildPaidBySale,
  getProfitCollectionScale,
  calcProfitabilityTotals,
} = require('../src/renderer/reports/profit-utils');

const sale = (overrides = {}) => ({
  id: 1,
  doc_type: 'invoice',
  invoice_no: '1',
  payment_method: 'cash',
  payment_status: 'paid',
  grand_total: 115,
  vat_total: 15,
  ...overrides,
});

const soldItem = (overrides = {}) => ({
  sale_id: 1,
  doc_type: 'invoice',
  qty: 2,
  unit_multiplier: 1,
  cost_price: 23,
  is_vat_exempt: 0,
  ...overrides,
});

describe('report profitability', () => {
  test('calculates paid taxable sale profit when product cost includes VAT', () => {
    const totals = calcProfitabilityTotals({
      allSales: [sale()],
      soldItemsDetailed: [soldItem()],
      vatPercent: 15,
      costIncludesVat: 1,
    });

    expect(totals).toEqual({
      costTotalWithVat: 46,
      costTotalExVat: 40,
      salesTotalWithVat: 115,
      salesTotalExVat: 100,
      profitNetWithVat: 69,
      profitNetExVat: 60,
    });
  });

  test('adds VAT to a taxable product cost stored excluding VAT', () => {
    const totals = calcProfitabilityTotals({
      allSales: [sale()],
      soldItemsDetailed: [soldItem({ cost_price: 20 })],
      vatPercent: 15,
      costIncludesVat: 0,
    });

    expect(totals.costTotalExVat).toBe(40);
    expect(totals.costTotalWithVat).toBe(46);
  });

  test('does not add or remove VAT from exempt product cost', () => {
    const totals = calcProfitabilityTotals({
      allSales: [sale({ grand_total: 100, vat_total: 0 })],
      soldItemsDetailed: [soldItem({ cost_price: 20, is_vat_exempt: 1 })],
      vatPercent: 15,
      costIncludesVat: 0,
    });

    expect(totals.costTotalWithVat).toBe(40);
    expect(totals.costTotalExVat).toBe(40);
  });

  test('multiplies base-unit cost by sold unit multiplier', () => {
    const totals = calcProfitabilityTotals({
      allSales: [sale()],
      soldItemsDetailed: [soldItem({ qty: 2, unit_multiplier: 6, cost_price: 2 })],
      costIncludesVat: 0,
      vatPercent: 0,
    });

    expect(totals.costTotalWithVat).toBe(24);
  });

  test('excludes unpaid credit and scales partial credit by collected amount', () => {
    const unpaid = sale({ id: 1, payment_method: 'credit', payment_status: 'unpaid' });
    const partial = sale({ id: 2, payment_method: 'credit', payment_status: 'partial' });
    const payments = buildPaidBySale([{ sale_id: 2, amount: 57.5, payment_method: 'cash' }]);
    const totals = calcProfitabilityTotals({
      allSales: [unpaid, partial],
      soldItemsDetailed: [soldItem({ sale_id: 1 }), soldItem({ sale_id: 2 })],
      paidBySale: payments,
      costIncludesVat: 1,
    });

    expect(getProfitCollectionScale(unpaid, payments)).toBe(0);
    expect(getProfitCollectionScale(partial, payments)).toBe(0.5);
    expect(totals.salesTotalWithVat).toBe(57.5);
    expect(totals.costTotalWithVat).toBe(23);
  });

  test('document basis includes the full revenue and cost of credit invoices', () => {
    const unpaid = sale({ id: 1, payment_method: 'credit', payment_status: 'unpaid' });
    const partial = sale({ id: 2, payment_method: 'credit', payment_status: 'partial' });
    const totals = calcProfitabilityTotals({
      basis: 'document',
      allSales: [unpaid, partial],
      soldItemsDetailed: [soldItem({ sale_id: 1 }), soldItem({ sale_id: 2 })],
      paidBySale: buildPaidBySale([{ sale_id: 2, amount: 57.5, payment_method: 'cash' }]),
      costIncludesVat: 1,
    });

    expect(totals.salesTotalWithVat).toBe(230);
    expect(totals.costTotalWithVat).toBe(92);
  });

  test.each([
    ['negative stored credit-note quantity', -1],
    ['positive legacy credit-note quantity', 1],
  ])('subtracts returned item cost for %s', (_label, returnedQty) => {
    const invoice = sale();
    const creditNote = sale({
      id: 2,
      doc_type: 'credit_note',
      invoice_no: 'CN-1',
      grand_total: -57.5,
      vat_total: -7.5,
    });
    const totals = calcProfitabilityTotals({
      allSales: [invoice, creditNote],
      creditNotes: [creditNote],
      soldItemsDetailed: [
        soldItem({ qty: 2 }),
        soldItem({ sale_id: 2, doc_type: 'credit_note', qty: returnedQty }),
      ],
      costIncludesVat: 1,
    });

    expect(totals.salesTotalWithVat).toBe(57.5);
    expect(totals.costTotalWithVat).toBe(23);
    expect(totals.profitNetWithVat).toBe(34.5);
  });

  test.each([57.5, -57.5])('subtracts credit-note revenue regardless of stored sign (%s)', (grandTotal) => {
    const invoice = sale();
    const creditNote = sale({
      id: 2,
      doc_type: 'credit_note',
      invoice_no: 'CN-2',
      grand_total: grandTotal,
      vat_total: grandTotal > 0 ? 7.5 : -7.5,
    });
    const totals = calcProfitabilityTotals({
      allSales: [invoice, creditNote],
      creditNotes: [creditNote],
      soldItemsDetailed: [soldItem()],
      costIncludesVat: 1,
    });

    expect(totals.salesTotalWithVat).toBe(57.5);
    expect(totals.salesTotalExVat).toBe(50);
  });
});
