(function exposeStatementAccounting(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StatementAccounting = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createStatementAccounting() {
  const money = (amount) => Number((Math.round((Number(amount || 0) + Number.EPSILON) * 100) / 100).toFixed(2));
  const empty = () => ({ count: 0, pre: 0, vat: 0, grand: 0 });
  const isReturn = (document) => String(document?.doc_type || '').toLowerCase() === 'credit_note'
    || String(document?.invoice_no || '').startsWith('CN-');
  const method = (document, field = 'payment_method') => {
    const paymentMethod = String(document?.[field] || '').trim().toLowerCase();
    return paymentMethod === 'network' ? 'card' : paymentMethod;
  };
  const amounts = (document) => {
    const zeroVat = String(document?.price_mode || '') === 'zero_vat';
    const grand = zeroVat
      ? Math.abs(Number(document?.sub_total || 0))
      : Math.abs(Number(document?.grand_total || 0));
    const vat = zeroVat ? 0 : Math.min(grand, Math.abs(Number(document?.vat_total || 0)));
    return { pre: grand - vat, vat, grand };
  };
  const add = (target, values, sign = 1) => {
    target.count += sign;
    target.pre += values.pre * sign;
    target.vat += values.vat * sign;
    target.grand += values.grand * sign;
  };
  const rounded = (totals) => ({ count: totals.count, pre: money(totals.pre), vat: money(totals.vat), grand: money(totals.grand) });
  const allocate = (grand, composition) => {
    const amount = Math.max(0, Math.min(Math.abs(Number(grand || 0)), Math.abs(composition.grand)));
    if (!composition.grand) return { pre: amount, vat: 0, grand: amount };
    const pre = money(amount * (composition.pre / composition.grand));
    return { pre, vat: money(amount - pre), grand: money(amount) };
  };
  const voucherTotal = (vouchers) => (Array.isArray(vouchers) ? vouchers : [])
    .reduce((sum, voucher) => sum + Math.abs(Number(voucher?.amount || 0)), 0);

  function paymentTotals(documents) {
    const totals = {};
    const addPayment = (key, amount) => {
      if (!key || !amount) return;
      totals[key] = (totals[key] || 0) + amount;
    };
    for (const document of Array.isArray(documents) ? documents : []) {
      const sign = isReturn(document) ? -1 : 1;
      const paymentMethod = method(document);
      const grand = amounts(document).grand * sign;
      if (paymentMethod === 'mixed') {
        const cash = Math.abs(Number(document?.pay_cash_amount || 0));
        const card = Math.abs(Number(document?.pay_card_amount || 0));
        addPayment('cash', cash * sign);
        addPayment('card', card * sign);
        addPayment('unallocated', (Math.abs(grand) - cash - card) * sign);
      } else addPayment(paymentMethod, grand);
    }
    return Object.fromEntries(Object.entries(totals).filter(([, amount]) => amount).map(([key, amount]) => [key, money(amount)]));
  }

  function summarizeCustomerStatement(options = {}) {
    const invoices = empty(); const returns = empty(); const collected = empty(); const deferred = empty();
    for (const document of Array.isArray(options.documents) ? options.documents : []) {
      const values = amounts(document);
      const returned = isReturn(document);
      const paymentMethod = method(document);
      add(returned ? returns : invoices, values, 1);
      const bucket = paymentMethod === 'credit' ? deferred : collected;
      add(bucket, values, returned ? -1 : 1);
    }
    const roundedDeferred = rounded(deferred);
    const netDocuments = { count: invoices.count - returns.count, pre: money(invoices.pre - returns.pre), vat: money(invoices.vat - returns.vat), grand: money(invoices.grand - returns.grand) };
    const allocated = allocate(voucherTotal(options.vouchers), roundedDeferred);
    const vouchers = { count: (options.vouchers || []).length, ...allocated };
    return {
      invoices: rounded(invoices), returns: rounded(returns), netDocuments, collected: rounded(collected), deferred: roundedDeferred,
      vouchers,
      balance: { pre: money(roundedDeferred.pre - allocated.pre), vat: money(roundedDeferred.vat - allocated.vat), grand: money(roundedDeferred.grand - allocated.grand) },
      paymentTotals: paymentTotals(options.documents),
    };
  }

  function summarizeSupplierStatement(options = {}) {
    const invoiceTotals = empty(); const returnTotals = empty(); const paid = empty(); const credit = empty();
    for (const invoice of Array.isArray(options.invoices) ? options.invoices : []) {
      const values = amounts(invoice); add(invoiceTotals, values);
      add(method(invoice) === 'credit' ? credit : paid, values);
    }
    for (const purchaseReturn of Array.isArray(options.returns) ? options.returns : []) {
      const values = amounts(purchaseReturn); add(returnTotals, values);
      const originalMethod = method(purchaseReturn, 'original_payment_method') || method(purchaseReturn);
      add(originalMethod === 'credit' ? credit : paid, values, -1);
    }
    const net = empty();
    net.count = invoiceTotals.count - returnTotals.count;
    net.pre = invoiceTotals.pre - returnTotals.pre; net.vat = invoiceTotals.vat - returnTotals.vat; net.grand = invoiceTotals.grand - returnTotals.grand;
    const roundedCredit = rounded(credit);
    const allocated = allocate(voucherTotal(options.vouchers), roundedCredit);
    return {
      invoices: rounded(invoiceTotals), returns: rounded(returnTotals), net: rounded(net), paid: rounded(paid), credit: roundedCredit,
      vouchers: { count: (options.vouchers || []).length, ...allocated },
      balance: { pre: money(roundedCredit.pre - allocated.pre), vat: money(roundedCredit.vat - allocated.vat), grand: money(roundedCredit.grand - allocated.grand) },
    };
  }

  return { documentAmounts: amounts, summarizeCustomerStatement, summarizeSupplierStatement };
});
