(function exposePurchaseReportAccounting(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PurchaseReportAccounting = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPurchaseReportAccounting() {
  const money = (amount) => Number((Math.round((Number(amount || 0) + Number.EPSILON) * 100) / 100).toFixed(2));
  const isReturn = (document) => String(document?.doc_type || '').toLowerCase() === 'return';
  const isCredit = (document) => {
    const method = String(isReturn(document) ? (document?.original_payment_method || document?.payment_method || '') : (document?.payment_method || '')).trim().toLowerCase();
    return method === 'credit' || method === '\u0622\u062c\u0644' || method === '\u0627\u062c\u0644';
  };
  function purchaseAmounts(document) {
    const zeroVat = String(document?.price_mode || '') === 'zero_vat';
    const rawPre = Math.abs(Number(document?.sub_total || 0));
    const grand = zeroVat ? rawPre : Math.abs(Number(document?.grand_total || 0));
    const vat = zeroVat ? 0 : Math.min(grand, Math.abs(Number(document?.vat_total || 0)));
    const pre = grand - vat;
    let paid;
    if (isReturn(document)) paid = isCredit(document) ? 0 : grand;
    else if (zeroVat && !isCredit(document)) paid = grand;
    else paid = Math.max(0, Math.min(grand, Number(document?.amount_paid || 0)));
    return { pre, vat, grand, paid };
  }
  function summarizePurchaseLedger(documents) {
    const totals = { count: 0, returnsCount: 0, pre: 0, vat: 0, grand: 0, paid: 0 };
    for (const document of Array.isArray(documents) ? documents : []) {
      const returned = isReturn(document); const sign = returned ? -1 : 1; const amounts = purchaseAmounts(document);
      if (returned) totals.returnsCount += 1; else totals.count += 1;
      totals.pre += amounts.pre * sign; totals.vat += amounts.vat * sign; totals.grand += amounts.grand * sign; totals.paid += amounts.paid * sign;
    }
    return { ...totals, pre: money(totals.pre), vat: money(totals.vat), grand: money(totals.grand), paid: money(totals.paid) };
  }
  return { purchaseAmounts, summarizePurchaseLedger };
});
