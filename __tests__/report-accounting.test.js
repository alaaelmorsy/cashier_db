const {
  summarizeDocuments,
  calculateReportTotals,
  isCreditNote,
  summarizeReportPayments,
  outstandingAmount,
  signedReportItem,
  documentBreakdown,
  selectNonCreditPeriodDocuments,
  summarizeReportItems,
} = require('../src/shared/report-accounting');

describe('report accounting', () => {
  test('subtracts credit notes that are already stored as negative values', () => {
    const summary = summarizeDocuments([
      {
        doc_type: 'invoice',
        payment_method: 'cash',
        sub_total: 100,
        vat_total: 15,
        grand_total: 115,
      },
      {
        doc_type: 'credit_note',
        payment_method: 'cash',
        sub_total: -20,
        vat_total: -3,
        grand_total: -23,
      },
    ]);

    expect(summary).toMatchObject({
      documentCount: 2,
      invoiceCount: 1,
      creditNoteCount: 1,
      subTotal: 80,
      vatTotal: 12,
      grandTotal: 92,
    });
    expect(summary.paymentTotals.cash).toBe(92);
  });

  test('normalizes legacy positive credit-note values to deductions', () => {
    const summary = summarizeDocuments([
      {
        invoice_no: 'CN-9',
        payment_method: 'card',
        sub_total: 10,
        vat_total: 1.5,
        grand_total: 11.5,
      },
    ]);

    expect(isCreditNote({ invoice_no: 'CN-9' })).toBe(true);
    expect(summary.grandTotal).toBe(-11.5);
    expect(summary.paymentTotals.card).toBe(-11.5);
  });

  test('never invents a 50/50 split for incomplete mixed-payment data', () => {
    const summary = summarizeDocuments([
      {
        doc_type: 'invoice',
        payment_method: 'mixed',
        grand_total: 100,
        pay_cash_amount: 30,
        pay_card_amount: null,
      },
    ]);

    expect(summary.paymentTotals.cash).toBe(30);
    expect(summary.paymentTotals.card).toBeUndefined();
    expect(summary.paymentTotals.unallocated).toBe(70);
  });

  test('rounds accumulated currency in integer cents', () => {
    const summary = summarizeDocuments([
      { doc_type: 'invoice', payment_method: 'cash', grand_total: 0.1 },
      { doc_type: 'invoice', payment_method: 'cash', grand_total: 0.2 },
    ]);

    expect(summary.grandTotal).toBe(0.3);
    expect(summary.paymentTotals.cash).toBe(0.3);
  });

  test('calculates every detailed-summary row with discount, tobacco, VAT, returns, and purchases', () => {
    const totals = calculateReportTotals({
      sales: [{
        id: 1,
        doc_type: 'invoice',
        payment_method: 'cash',
        payment_status: 'paid',
        sub_total: 100,
        discount_amount: 10,
        tobacco_fee: 5,
        vat_total: 14.25,
        grand_total: 109.25,
      }],
      creditNotes: [{
        id: 2,
        doc_type: 'credit_note',
        payment_method: 'cash',
        sub_total: 20,
        discount_amount: 2,
        tobacco_fee: 1,
        vat_total: 2.85,
        grand_total: 21.85,
      }],
      purchases: [
        { payment_method: 'cash', sub_total: 30, vat_total: 4.5, grand_total: 34.5 },
        { payment_method: 'credit', sub_total: 100, vat_total: 15, grand_total: 115, amount_paid: 57.5 },
      ],
    });

    expect(totals.sales).toEqual({ pre: 100, tobacco: 5, vat: 14.25, after: 119.25 });
    expect(totals.salesAfterDiscount).toEqual({ pre: 90, tobacco: 5, vat: 14.25, after: 109.25 });
    expect(totals.returns).toEqual({ pre: 18, tobacco: 1, vat: 2.85, after: 21.85 });
    expect(totals.purchases).toEqual({ pre: 80, vat: 12, after: 92 });
    expect(totals.net).toEqual({ pre: -8, tobacco: 4, vat: -0.6, after: -4.6 });
  });

  test('excludes unpaid credit and proportionally includes partial credit sale', () => {
    const totals = calculateReportTotals({
      sales: [
        { id: 1, payment_method: 'credit', payment_status: 'unpaid', sub_total: 100, vat_total: 15, grand_total: 115 },
        { id: 2, payment_method: 'credit', payment_status: 'partial', sub_total: 200, vat_total: 30, grand_total: 230 },
      ],
      payments: [{ sale_id: 2, amount: 57.5, payment_method: 'cash' }],
    });

    expect(totals.salesAfterDiscount.after).toBe(57.5);
    expect(totals.salesAfterDiscount.pre).toBe(50);
    expect(totals.salesAfterDiscount.vat).toBe(7.5);
  });

  test('document-basis period totals include unpaid and full partial credit invoices', () => {
    const totals = calculateReportTotals({
      basis: 'document',
      sales: [
        { id: 1, payment_method: 'credit', payment_status: 'unpaid', sub_total: 53.92, vat_total: 8.09, grand_total: 62.01 },
        { id: 2, payment_method: 'credit', payment_status: 'partial', sub_total: 100, vat_total: 15, grand_total: 115 },
      ],
      payments: [{ sale_id: 2, amount: 57.5, payment_method: 'cash' }],
    });

    expect(totals.salesAfterDiscount).toEqual({ pre: 153.92, tobacco: 0, vat: 23.09, after: 177.01 });
    expect(totals.net.after).toBe(177.01);
  });

  test('treats zero-VAT purchases as tax free and excludes unpaid credit purchases', () => {
    const totals = calculateReportTotals({
      purchases: [
        { payment_method: 'cash', price_mode: 'zero_vat', sub_total: 25, vat_total: 99, grand_total: 124 },
        { payment_method: 'credit', sub_total: 100, vat_total: 15, grand_total: 115, amount_paid: 0 },
      ],
    });

    expect(totals.purchases).toEqual({ pre: 25, vat: 0, after: 25 });
  });

  test('subtracts purchase returns stored with either positive or negative signs', () => {
    const totals = calculateReportTotals({
      purchases: [
        { doc_type: 'invoice', payment_method: 'cash', sub_total: 100, vat_total: 15, grand_total: 115 },
        { doc_type: 'return', payment_method: 'cash', sub_total: 20, vat_total: 3, grand_total: 23 },
        { doc_type: 'return', payment_method: 'cash', sub_total: -10, vat_total: -1.5, grand_total: -11.5 },
      ],
    });
    expect(totals.purchases).toEqual({ pre: 70, vat: 10.5, after: 80.5 });
  });

  test('uses legal grand total as authority when historical discount fields do not reconcile', () => {
    const totals = calculateReportTotals({
      sales: [{ sub_total: 100, discount_amount: 20, tobacco_fee: 0, vat_total: 12, grand_total: 92, payment_method: 'cash' }],
    });
    expect(totals.salesAfterDiscount).toEqual({ pre: 80, tobacco: 0, vat: 12, after: 92 });
    expect(totals.net.after).toBe(92);
    expect(totals.net.pre + totals.net.tobacco + totals.net.vat).toBe(totals.net.after);
  });

  test('invoice-list pre-VAT total reconciles to the legal grand total after discounts', () => {
    const summary = summarizeDocuments([
      { doc_type: 'invoice', payment_method: 'cash', sub_total: 100, discount_amount: 20, vat_total: 12, grand_total: 92 },
    ]);
    expect(summary).toMatchObject({ subTotal: 80, vatTotal: 12, grandTotal: 92 });
    expect(summary.subTotal + summary.vatTotal).toBe(summary.grandTotal);
  });

  test('derives the effective discount shown by municipality reports from legal totals', () => {
    expect(documentBreakdown({ sub_total: 100, discount_amount: 18, tobacco_fee: 5, vat_total: 12, grand_total: 92 }))
      .toEqual({ sub: 100, discount: 25, tobacco: 5, vat: 12, grand: 92 });
  });
});

describe('report payment-method totals', () => {
  test('covers immediate, mixed, credit collections, refunds, aliases and custom methods', () => {
    const sales = [
      { id: 1, grand_total: 100, payment_method: 'cash', payment_status: 'paid' },
      { id: 2, grand_total: 50, payment_method: 'network', payment_status: 'paid' },
      { id: 3, grand_total: 50, payment_method: 'mixed', pay_cash_amount: 30, pay_card_amount: 20 },
      { id: 4, grand_total: 115, payment_method: 'credit', payment_status: 'unpaid' },
      { id: 5, grand_total: 200, payment_method: 'cash', settled_at: '2026-01-01' },
      { id: 6, grand_total: 40, payment_method: 'tamara' },
    ];
    const creditNotes = [
      { doc_type: 'credit_note', grand_total: 20, payment_method: 'cash' },
      { doc_type: 'credit_note', grand_total: -10, payment_method: 'network' },
    ];
    const payments = [
      { sale_id: 5, amount: 200, payment_method: 'card' },
      { sale_id: 4, amount: 25, payment_method: 'cash' },
      { sale_id: 1, amount: 100, payment_method: 'cash' },
    ];

    expect(summarizeReportPayments({ sales, creditNotes, payments })).toEqual({
      cash: 135,
      card: 260,
      tamara: 40,
    });
  });
});

describe('outstanding credit invoices', () => {
  test('shows remaining amount after partial payments and never a negative balance', () => {
    expect(outstandingAmount({ grand_total: 115, remaining_amount: 75, paid_amount: 40 })).toBe(75);
    expect(outstandingAmount({ grand_total: 115, paid_amount: 40 })).toBe(75);
    expect(outstandingAmount({ grand_total: 115, remaining_amount: -1, paid_amount: 120 })).toBe(0);
  });
});

describe('detailed item report signs', () => {
  test('normalizes invoice and both historical credit-note representations', () => {
    expect(signedReportItem({ doc_type: 'invoice', qty: -2, line_total: -20 })).toEqual({ qty: 2, amount: 20 });
    expect(signedReportItem({ doc_type: 'credit_note', qty: 2, line_total: 20 })).toEqual({ qty: -2, amount: -20 });
    expect(signedReportItem({ doc_type: 'credit_note', qty: -2, line_total: -20 })).toEqual({ qty: -2, amount: -20 });
  });

  test('period selection excludes credit invoices and their linked returns', () => {
    const documents = [
      { id: 1, doc_type: 'invoice', payment_method: 'cash' },
      { id: 2, doc_type: 'invoice', payment_method: 'credit' },
      { id: 3, doc_type: 'credit_note', ref_base_sale_id: 1, payment_method: 'cash' },
      { id: 4, doc_type: 'credit_note', ref_base_sale_id: 2, payment_method: 'credit' },
    ];

    expect(selectNonCreditPeriodDocuments(documents)).toEqual({
      sales: [documents[0]],
      creditNotes: [documents[2]],
    });
  });

  test('period item summary contains only the selected non-credit documents', () => {
    const summary = summarizeReportItems(
      [{ product_id: 10, name: 'منتج', cost_price: 3, stock_qty: 8 }],
      [
        { sale_id: 1, product_id: 10, doc_type: 'invoice', qty: 2, line_total: 20 },
        { sale_id: 2, product_id: 10, doc_type: 'invoice', qty: 5, line_total: 50 },
        { sale_id: 3, product_id: 10, doc_type: 'credit_note', qty: 1, line_total: 10 },
      ],
      new Set([1, 3]),
    );

    expect(summary).toEqual([{ product_id: 10, name: 'منتج', cost_price: 3, stock_qty: 8, qty_total: 1, amount_total: 10 }]);
  });
});
