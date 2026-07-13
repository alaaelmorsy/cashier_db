(function exposePurchaseInvoiceAccounting(root, factory) {
  const accounting = factory();
  if (typeof module === 'object' && module.exports) module.exports = accounting;
  if (root) root.PurchaseInvoiceAccounting = accounting;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPurchaseInvoiceAccounting() {
  const money = (amount) => Number((Math.round((Number(amount || 0) + Number.EPSILON) * 100) / 100).toFixed(2));
  const isCredit = (method) => ['credit', '\u0622\u062c\u0644', '\u0627\u062c\u0644'].includes(String(method || '').trim().toLowerCase());

  function allocatedDiscounts(lines, discountGeneral, grossExclusive) {
    if (!grossExclusive) return lines.map(() => 0);
    const allocatableDiscount = Math.min(grossExclusive, Math.max(0, Number(discountGeneral || 0)));
    const allocations = lines.map((line) => money(allocatableDiscount * (Number(line.line_total || 0) / grossExclusive)));
    const drift = money(allocatableDiscount - allocations.reduce((sum, amount) => sum + amount, 0));
    if (allocations.length) allocations[allocations.length - 1] = money(allocations[allocations.length - 1] + drift);
    return allocations;
  }

  function calculateInvoiceTotals(options = {}) {
    const lines = Array.isArray(options.lines) ? options.lines : [];
    const grossExclusive = money(lines.reduce((sum, line) => sum + Number(line.line_total || 0), 0));
    const discountGeneral = Math.min(grossExclusive, Math.max(0, money(options.discountGeneral)));
    const netExclusive = money(grossExclusive - discountGeneral);
    const vatPercent = Math.max(0, Number(options.vatPercent ?? 15));
    const allocations = allocatedDiscounts(lines, discountGeneral, grossExclusive);
    const vatTotal = String(options.priceMode || '') === 'zero_vat' ? 0 : money(lines.reduce((sum, line, index) => {
      const taxableLine = money(Number(line.line_total || 0) - allocations[index]);
      return sum + money(taxableLine * vatPercent / 100);
    }, 0));
    const grandTotal = money(netExclusive + vatTotal);
    const amountPaid = isCredit(options.paymentMethod) ? 0 : grandTotal;
    return { grossExclusive, discountGeneral, netExclusive, vatPercent, vatTotal, grandTotal, amountPaid, amountDue: money(grandTotal - amountPaid) };
  }

  function calculateEditedSettlement(oldInvoice, newGrandTotal, newPaymentMethod) {
    if (!isCredit(newPaymentMethod)) return { amountPaid: money(newGrandTotal), amountDue: 0 };
    const previousPaid = isCredit(oldInvoice?.payment_method) ? Math.max(0, Number(oldInvoice?.amount_paid || 0)) : 0;
    if (previousPaid > Number(newGrandTotal || 0)) throw new Error('EDIT_TOTAL_BELOW_PAID');
    const amountPaid = money(previousPaid);
    return { amountPaid, amountDue: money(Math.max(0, Number(newGrandTotal || 0) - amountPaid)) };
  }

  function supplierDue(invoice) {
    if (!isCredit(invoice?.payment_method)) return 0;
    const grand = Math.max(0, Math.abs(Number(invoice?.grand_total || 0)));
    const explicitDue = Number(invoice?.amount_due);
    return money(Number.isFinite(explicitDue) ? Math.max(0, Math.min(grand, explicitDue)) : Math.max(0, grand - Number(invoice?.amount_paid || 0)));
  }

  function calculateReturnLines(original, originalLines, selectedLines) {
    const sourceLines = Array.isArray(originalLines) ? originalLines : [];
    const gross = sourceLines.reduce((sum, line) => sum + Math.abs(Number(line.line_total || 0)), 0);
    const generalDiscount = Math.min(gross, Math.max(0, Number(original?.discount_general || 0)));
    const vatPercent = String(original?.price_mode || '') === 'zero_vat' ? 0 : Math.max(0, Number(original?.vat_percent ?? 0));
    const lines = (selectedLines || []).map((selected) => returnLine(sourceLines, selected, generalDiscount, gross));
    const subTotal = money(lines.reduce((sum, line) => sum + line.line_total, 0));
    const vatTotal = money(lines.reduce((sum, line) => sum + money(line.line_total * vatPercent / 100), 0));
    return { lines, subTotal, vatTotal, grandTotal: money(subTotal + vatTotal) };
  }

  function returnLine(originalLines, selected, generalDiscount, gross) {
    const original = originalLines.find((line) => Number(line.product_id) === Number(selected.product_id));
    const qty = Number(selected.qty);
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('INVALID_RETURN_QUANTITY');
    if (!original || qty > Number(original.qty || 0)) throw new Error('RETURN_QUANTITY_EXCEEDS_ORIGINAL');
    const originalLineTotal = Math.abs(Number(original.line_total || 0));
    const netOriginalLine = money(originalLineTotal - (gross ? generalDiscount * originalLineTotal / gross : 0));
    const lineTotal = money(netOriginalLine * qty / Number(original.qty || 1));
    const uiUnitCost = Math.abs(Number(original.ui_unit_cost ?? original.unit_cost ?? 0));
    return { product_id: Number(selected.product_id), description: original.description || null, qty, unit_cost: money(lineTotal / qty), discount_line: 0, line_total: lineTotal, ui_unit_cost: uiUnitCost, ui_line_total: money(uiUnitCost * qty) };
  }

  return { allocatedDiscounts, calculateInvoiceTotals, calculateEditedSettlement, calculateReturnLines, supplierDue };
});
