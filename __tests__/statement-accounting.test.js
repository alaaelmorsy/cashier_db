const {
  summarizeCustomerStatement,
  summarizeSupplierStatement,
} = require('../src/shared/statement-accounting');

describe('customer statement accounting', () => {
  test('normalizes both positive and negative credit notes and separates paid from deferred invoices', () => {
    const result = summarizeCustomerStatement({
      documents: [
        { id: 1, doc_type: 'invoice', payment_method: 'cash', sub_total: 100, vat_total: 15, grand_total: 115 },
        { id: 2, doc_type: 'invoice', payment_method: 'credit', sub_total: 200, vat_total: 30, grand_total: 230 },
        { id: 3, doc_type: 'credit_note', payment_method: 'cash', sub_total: 20, vat_total: 3, grand_total: 23 },
        { id: 4, doc_type: 'credit_note', payment_method: 'credit', sub_total: -40, vat_total: -6, grand_total: -46 },
      ],
    });
    expect(result.invoices).toEqual({ count: 2, pre: 300, vat: 45, grand: 345 });
    expect(result.returns).toEqual({ count: 2, pre: 60, vat: 9, grand: 69 });
    expect(result.netDocuments).toEqual({ count: 0, pre: 240, vat: 36, grand: 276 });
    expect(result.collected).toEqual({ count: 0, pre: 80, vat: 12, grand: 92 });
    expect(result.deferred).toEqual({ count: 0, pre: 160, vat: 24, grand: 184 });
  });

  test('allocates receipt vouchers using the actual deferred tax composition, including exempt sales', () => {
    const result = summarizeCustomerStatement({
      documents: [
        { doc_type: 'invoice', payment_method: 'credit', sub_total: 100, vat_total: 15, grand_total: 115 },
        { doc_type: 'invoice', payment_method: 'credit', sub_total: 100, vat_total: 0, grand_total: 100 },
      ],
      vouchers: [{ amount: 107.50 }],
    });
    expect(result.vouchers).toEqual({ count: 1, pre: 100, vat: 7.5, grand: 107.5 });
    expect(result.balance).toEqual({ pre: 100, vat: 7.5, grand: 107.5 });
  });

  test('does not invent missing mixed-payment allocations', () => {
    const result = summarizeCustomerStatement({
      documents: [{ doc_type: 'invoice', payment_method: 'mixed', sub_total: 100, vat_total: 15, grand_total: 115, pay_cash_amount: 40 }],
    });
    expect(result.paymentTotals).toEqual({ cash: 40, unallocated: 75 });
  });

  test('uses grand total as authority for discounted customer documents', () => {
    const result = summarizeCustomerStatement({
      documents: [{ doc_type: 'invoice', payment_method: 'cash', sub_total: 100, discount_amount: 20, vat_total: 12, grand_total: 92 }],
    });
    expect(result.invoices).toEqual({ count: 1, pre: 80, vat: 12, grand: 92 });
  });
});

describe('supplier statement accounting', () => {
  test('subtracts purchase returns once and preserves a negative net paid balance', () => {
    const result = summarizeSupplierStatement({
      invoices: [{ payment_method: 'cash', sub_total: 50, vat_total: 7.5, grand_total: 57.5 }],
      returns: [{ original_payment_method: 'cash', sub_total: -80, vat_total: -12, grand_total: -92 }],
    });
    expect(result.net).toEqual({ count: 0, pre: -30, vat: -4.5, grand: -34.5 });
    expect(result.paid).toEqual({ count: 0, pre: -30, vat: -4.5, grand: -34.5 });
  });

  test('zero-VAT credit purchases and payment vouchers produce exact balances', () => {
    const result = summarizeSupplierStatement({
      invoices: [{ payment_method: 'credit', price_mode: 'zero_vat', sub_total: 100, vat_total: 99, grand_total: 199 }],
      vouchers: [{ amount: 40 }],
    });
    expect(result.credit).toEqual({ count: 1, pre: 100, vat: 0, grand: 100 });
    expect(result.balance).toEqual({ pre: 60, vat: 0, grand: 60 });
  });

  test('supplier pre-VAT amount reconciles with the stored legal grand total', () => {
    const result = summarizeSupplierStatement({
      invoices: [{ payment_method: 'cash', sub_total: 100, vat_total: 12, grand_total: 92 }],
    });
    expect(result.invoices).toEqual({ count: 1, pre: 80, vat: 12, grand: 92 });
  });
});
