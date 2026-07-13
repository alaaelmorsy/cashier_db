const {
  calculateInvoiceTotals,
  calculateEditedSettlement,
  calculateReturnLines,
  supplierDue,
  allocatedDiscounts,
} = require('../src/shared/purchase-invoice-accounting');

describe('purchase invoice accounting', () => {
  test('calculates exclusive, inclusive, zero-VAT and explicit zero-percent invoices', () => {
    expect(calculateInvoiceTotals({
      lines: [{ line_total: 100 }], discountGeneral: 10, vatPercent: 15, priceMode: 'exclusive', paymentMethod: 'cash',
    })).toMatchObject({ grossExclusive: 100, netExclusive: 90, vatTotal: 13.5, grandTotal: 103.5, amountPaid: 103.5, amountDue: 0 });

    expect(calculateInvoiceTotals({
      lines: [{ line_total: 100 }], discountGeneral: 0, vatPercent: 0, priceMode: 'exclusive', paymentMethod: 'cash',
    }).vatTotal).toBe(0);

    expect(calculateInvoiceTotals({
      lines: [{ line_total: 100 }], discountGeneral: 0, vatPercent: 15, priceMode: 'zero_vat', paymentMethod: 'credit',
    })).toMatchObject({ netExclusive: 100, vatTotal: 0, grandTotal: 100, amountPaid: 0, amountDue: 100 });
  });

  test('preserves valid partial payments when an existing credit invoice is edited', () => {
    expect(calculateEditedSettlement({ payment_method: 'credit', amount_paid: 40 }, 138, 'credit'))
      .toEqual({ amountPaid: 40, amountDue: 98 });
    expect(() => calculateEditedSettlement({ payment_method: 'credit', amount_paid: 140 }, 100, 'credit'))
      .toThrow('EDIT_TOTAL_BELOW_PAID');
  });

  test('supplier balance uses outstanding due rather than the original grand total', () => {
    expect(supplierDue({ payment_method: 'credit', grand_total: 115, amount_paid: 40, amount_due: 75 })).toBe(75);
    expect(supplierDue({ payment_method: 'cash', grand_total: 115, amount_due: 0 })).toBe(0);
  });

  test('purchase returns include proportional general discount and reject invalid quantities', () => {
    const original = { discount_general: 20, vat_percent: 15, price_mode: 'exclusive' };
    const originalLines = [
      { product_id: 1, qty: 2, unit_cost: 50, line_total: 100, ui_unit_cost: 57.5 },
      { product_id: 2, qty: 1, unit_cost: 100, line_total: 100, ui_unit_cost: 115 },
    ];
    expect(calculateReturnLines(original, originalLines, [{ product_id: 1, qty: 1 }])).toMatchObject({
      subTotal: 45, vatTotal: 6.75, grandTotal: 51.75,
    });
    expect(() => calculateReturnLines(original, originalLines, [{ product_id: 1, qty: -1 }])).toThrow('INVALID_RETURN_QUANTITY');
    expect(() => calculateReturnLines(original, originalLines, [{ product_id: 1, qty: 3 }])).toThrow('RETURN_QUANTITY_EXCEEDS_ORIGINAL');
  });

  test('never allocates a discount above the gross line value', () => {
    expect(allocatedDiscounts([{ line_total: 40 }, { line_total: 60 }], 150, 100)).toEqual([40, 60]);
  });
});
