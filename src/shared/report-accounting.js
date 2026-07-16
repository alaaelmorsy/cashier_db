(function exposeReportAccounting(root, factory) {
  const accounting = factory();
  if (typeof module === 'object' && module.exports) module.exports = accounting;
  if (root) root.ReportAccounting = accounting;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createReportAccounting() {
  function isCreditNote(document) {
    return String(document?.doc_type || '') === 'credit_note'
      || String(document?.invoice_no || '').startsWith('CN-');
  }

  function toCents(rawAmount) {
    const amount = Number(rawAmount || 0);
    return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
  }

  function fromCents(cents) {
    return Number((cents / 100).toFixed(2));
  }

  function signedCents(document, field) {
    const cents = Math.abs(toCents(document?.[field]));
    return isCreditNote(document) ? -cents : cents;
  }

  function signedPreTaxCents(document) {
    return signedCents(document, 'grand_total') - signedCents(document, 'vat_total');
  }

  function normalizePaymentMethod(method) {
    const normalized = String(method || '').trim().toLowerCase();
    return normalized === 'network' ? 'card' : normalized;
  }

  function addPayment(paymentCents, method, cents) {
    const normalized = normalizePaymentMethod(method);
    if (!normalized || !cents) return;
    paymentCents[normalized] = (paymentCents[normalized] || 0) + cents;
  }

  function addDocumentPayment(paymentCents, document) {
    const method = normalizePaymentMethod(document?.payment_method);
    const grandCents = signedCents(document, 'grand_total');
    if (method !== 'mixed') {
      addPayment(paymentCents, method, grandCents);
      return;
    }

    const sign = isCreditNote(document) ? -1 : 1;
    const cashCents = Math.abs(toCents(document?.pay_cash_amount)) * sign;
    const cardCents = Math.abs(toCents(document?.pay_card_amount)) * sign;
    addPayment(paymentCents, 'cash', cashCents);
    addPayment(paymentCents, 'card', cardCents);

    const allocatedCents = cashCents + cardCents;
    const remainderCents = grandCents - allocatedCents;
    addPayment(paymentCents, 'unallocated', remainderCents);
  }

  function summarizeDocuments(documents) {
    const totals = {
      documentCount: 0,
      invoiceCount: 0,
      creditNoteCount: 0,
      subTotalCents: 0,
      vatTotalCents: 0,
      grandTotalCents: 0,
      paymentCents: {},
    };

    for (const document of Array.isArray(documents) ? documents : []) {
      const creditNote = isCreditNote(document);
      totals.documentCount += 1;
      totals.invoiceCount += creditNote ? 0 : 1;
      totals.creditNoteCount += creditNote ? 1 : 0;
      totals.subTotalCents += signedPreTaxCents(document);
      totals.vatTotalCents += signedCents(document, 'vat_total');
      totals.grandTotalCents += signedCents(document, 'grand_total');
      addDocumentPayment(totals.paymentCents, document);
    }

    return {
      documentCount: totals.documentCount,
      invoiceCount: totals.invoiceCount,
      creditNoteCount: totals.creditNoteCount,
      subTotal: fromCents(totals.subTotalCents),
      vatTotal: fromCents(totals.vatTotalCents),
      grandTotal: fromCents(totals.grandTotalCents),
      paymentTotals: Object.fromEntries(
        Object.entries(totals.paymentCents).map(([method, cents]) => [method, fromCents(cents)])
      ),
    };
  }

  function documentAmounts(document) {
    return {
      pre: fromCents(signedPreTaxCents(document)),
      vat: fromCents(signedCents(document, 'vat_total')),
      grand: fromCents(signedCents(document, 'grand_total')),
    };
  }

  function documentBreakdown(document) {
    const sub = fromCents(Math.abs(toCents(document?.sub_total)));
    const tobacco = fromCents(Math.abs(toCents(document?.tobacco_fee)));
    const vat = fromCents(Math.abs(toCents(document?.vat_total)));
    const grand = fromCents(Math.abs(toCents(document?.grand_total)));
    return { sub, discount: fromCents(toCents(sub + tobacco + vat - grand)), tobacco, vat, grand };
  }

  function summarizeTaxTreatments(documents, options = {}) {
    const groups = {
      standard: { preCents: 0, vatCents: 0, grandCents: 0 },
      internationalTransportZeroRate: { preCents: 0, vatCents: 0, grandCents: 0 },
    };
    const paidBySale = paymentAmountsBySale(options.payments);
    for (const document of Array.isArray(documents) ? documents : []) {
      const key = document?.tax_treatment === 'international_transport_zero_rate'
        ? 'internationalTransportZeroRate'
        : 'standard';
      const scale = options.basis === 'collection' && !isCreditNote(document)
        ? saleCollectionScale(document, paidBySale)
        : 1;
      groups[key].preCents += Math.round(signedPreTaxCents(document) * scale);
      groups[key].vatCents += Math.round(signedCents(document, 'vat_total') * scale);
      groups[key].grandCents += Math.round(signedCents(document, 'grand_total') * scale);
    }
    return Object.fromEntries(Object.entries(groups).map(([key, values]) => [key, {
      pre: fromCents(values.preCents),
      vat: fromCents(values.vatCents),
      grand: fromCents(values.grandCents),
    }]));
  }

  function paymentAmountsBySale(payments) {
    const paid = new Map();
    for (const payment of Array.isArray(payments) ? payments : []) {
      const saleId = Number(payment?.sale_id || 0);
      const cents = Math.max(0, toCents(payment?.amount));
      if (saleId && cents) paid.set(saleId, (paid.get(saleId) || 0) + cents);
    }
    return paid;
  }

  function saleCollectionScale(sale, paidBySale) {
    const method = String(sale?.payment_method || '').toLowerCase();
    const status = String(sale?.payment_status || '').toLowerCase();
    if (method !== 'credit') return 1;
    if (status === 'unpaid') return 0;
    if (status !== 'partial') return 1;
    const grandCents = Math.abs(toCents(sale?.grand_total));
    return grandCents ? Math.min(1, (paidBySale.get(Number(sale?.id)) || 0) / grandCents) : 0;
  }

  function emptySalesTotals() {
    return { pre: 0, tobacco: 0, vat: 0, after: 0 };
  }

  function addSaleTotals(target, sale, scale) {
    const pre = Math.abs(Number(sale?.sub_total || 0)) * scale;
    const tobacco = Math.abs(Number(sale?.tobacco_fee || 0)) * scale;
    const vat = Math.abs(Number(sale?.vat_total || 0)) * scale;
    const after = Math.abs(Number(sale?.grand_total || 0)) * scale;
    target.sales.pre += pre;
    target.sales.tobacco += tobacco;
    target.sales.vat += vat;
    target.sales.after += pre + tobacco + vat;
    target.afterDiscount.pre += after - tobacco - vat;
    target.afterDiscount.tobacco += tobacco;
    target.afterDiscount.vat += vat;
    target.afterDiscount.after += after;
  }

  function summarizeSales(sales, payments, basis) {
    const totals = { sales: emptySalesTotals(), afterDiscount: emptySalesTotals() };
    const paidBySale = paymentAmountsBySale(payments);
    for (const sale of Array.isArray(sales) ? sales : []) {
      if (isCreditNote(sale)) continue;
      const scale = basis === 'document' ? 1 : saleCollectionScale(sale, paidBySale);
      addSaleTotals(totals, sale, scale);
    }
    return totals;
  }

  function summarizeReturns(creditNotes) {
    const returns = emptySalesTotals();
    for (const creditNote of Array.isArray(creditNotes) ? creditNotes : []) {
      const pre = Math.abs(Number(creditNote?.sub_total || 0));
      const discount = Math.abs(Number(creditNote?.discount_amount || 0));
      returns.pre += Math.max(0, pre - discount);
      returns.tobacco += Math.abs(Number(creditNote?.tobacco_fee || 0));
      returns.vat += Math.abs(Number(creditNote?.vat_total || 0));
      returns.after += Math.abs(Number(creditNote?.grand_total || 0));
    }
    return returns;
  }

  function purchaseScale(purchase, grand) {
    const method = String(purchase?.payment_method || '').toLowerCase();
    if (method !== 'credit' && method !== 'آجل' && method !== 'اجل') return 1;
    return grand > 0 ? Math.min(1, Math.max(0, Number(purchase?.amount_paid || 0)) / grand) : 0;
  }

  function summarizePurchases(purchases) {
    const totals = { pre: 0, vat: 0, after: 0 };
    for (const purchase of Array.isArray(purchases) ? purchases : []) {
      const sign = String(purchase?.doc_type || '').toLowerCase() === 'return' ? -1 : 1;
      const zeroVat = String(purchase?.price_mode || '') === 'zero_vat';
      const pre = Math.abs(Number(purchase?.sub_total || 0));
      const vat = zeroVat ? 0 : Math.abs(Number(purchase?.vat_total || 0));
      const grand = zeroVat ? pre : Math.abs(Number(purchase?.grand_total || 0));
      const scale = purchaseScale(purchase, grand);
      totals.pre += pre * scale * sign;
      totals.vat += vat * scale * sign;
      totals.after += grand * scale * sign;
    }
    return totals;
  }

  function roundTotals(totals) {
    return Object.fromEntries(Object.entries(totals).map(([key, amount]) => [key, fromCents(toCents(amount))]));
  }

  function calculateReportTotals(options = {}) {
    const salesTotals = summarizeSales(options.sales, options.payments, options.basis);
    const returns = summarizeReturns(options.creditNotes);
    const purchases = summarizePurchases(options.purchases);
    const afterDiscount = salesTotals.afterDiscount;
    const net = {
      pre: afterDiscount.pre - returns.pre - purchases.pre,
      tobacco: afterDiscount.tobacco - returns.tobacco,
      vat: afterDiscount.vat - returns.vat - purchases.vat,
    };
    net.after = afterDiscount.after - returns.after - purchases.after;
    return {
      sales: roundTotals(salesTotals.sales),
      salesAfterDiscount: roundTotals(afterDiscount),
      returns: roundTotals(returns),
      purchases: roundTotals(purchases),
      net: roundTotals(net),
    };
  }

  function summarizeReportPayments(options = {}) {
    const paymentCents = {};
    const sales = Array.isArray(options.sales) ? options.sales : [];
    const salesById = new Map(sales.map((sale) => [Number(sale?.id || 0), sale]));
    for (const sale of sales) {
      if (isCreditNote(sale)) continue;
      const method = normalizePaymentMethod(sale?.payment_method);
      if (method === 'credit' || sale?.settled_at) continue;
      addDocumentPayment(paymentCents, sale);
    }
    for (const creditNote of Array.isArray(options.creditNotes) ? options.creditNotes : []) {
      addDocumentPayment(paymentCents, { ...creditNote, doc_type: 'credit_note' });
    }
    for (const payment of Array.isArray(options.payments) ? options.payments : []) {
      const sale = salesById.get(Number(payment?.sale_id || 0));
      if (!sale || (normalizePaymentMethod(sale?.payment_method) !== 'credit' && !sale?.settled_at)) continue;
      addPayment(paymentCents, payment?.payment_method, Math.max(0, toCents(payment?.amount)));
    }
    return Object.fromEntries(
      Object.entries(paymentCents)
        .filter(([, cents]) => cents !== 0)
        .map(([method, cents]) => [method, fromCents(cents)])
    );
  }

  function outstandingAmount(invoice) {
    const grand = Math.abs(Number(invoice?.grand_total || 0));
    const hasExplicit = invoice?.remaining_amount !== null && invoice?.remaining_amount !== undefined && invoice?.remaining_amount !== '';
    const explicit = Number(invoice?.remaining_amount);
    const remaining = hasExplicit && Number.isFinite(explicit) ? explicit : grand - Math.max(0, Number(invoice?.paid_amount || 0));
    return fromCents(Math.max(0, Math.min(toCents(grand), toCents(remaining))));
  }

  function signedReportItem(reportItem) {
    const sign = isCreditNote(reportItem) ? -1 : 1;
    return { qty: Math.abs(Number(reportItem?.qty || 0)) * sign, amount: Math.abs(Number(reportItem?.line_total || 0)) * sign };
  }

  function selectNonCreditPeriodDocuments(documents) {
    const allDocuments = Array.isArray(documents) ? documents : [];
    const invoices = allDocuments.filter((document) => !isCreditNote(document));
    const creditSaleIds = new Set(invoices
      .filter((invoice) => normalizePaymentMethod(invoice?.payment_method) === 'credit')
      .map((invoice) => Number(invoice?.id || 0)));
    const sales = invoices.filter((invoice) => normalizePaymentMethod(invoice?.payment_method) !== 'credit');
    const creditNotes = allDocuments.filter((document) => isCreditNote(document))
      .filter((creditNote) => normalizePaymentMethod(creditNote?.payment_method) !== 'credit'
        && !creditSaleIds.has(Number(creditNote?.ref_base_sale_id || 0)));
    return { sales, creditNotes };
  }

  function summarizeReportItems(summaryItems, detailedItems, allowedSaleIds) {
    const metadataByProduct = new Map((summaryItems || []).map((item) => [Number(item?.product_id || 0), item]));
    const totalsByProduct = new Map();
    for (const item of Array.isArray(detailedItems) ? detailedItems : []) {
      if (!allowedSaleIds.has(Number(item?.sale_id || 0))) continue;
      const productId = Number(item?.product_id || 0);
      const totals = totalsByProduct.get(productId) || { qty: 0, amountCents: 0 };
      const signed = signedReportItem(item);
      totals.qty += signed.qty;
      totals.amountCents += toCents(signed.amount);
      totalsByProduct.set(productId, totals);
    }
    return Array.from(totalsByProduct, ([productId, totals]) => ({
      ...(metadataByProduct.get(productId) || { product_id: productId }),
      qty_total: Number(totals.qty.toFixed(3)),
      amount_total: fromCents(totals.amountCents),
    }));
  }

  return {
    isCreditNote, documentAmounts, documentBreakdown, summarizeDocuments, summarizeTaxTreatments, calculateReportTotals,
    summarizeReportPayments, outstandingAmount, signedReportItem, selectNonCreditPeriodDocuments, summarizeReportItems,
  };
});
