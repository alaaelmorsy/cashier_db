// Profitability helpers: cash-basis with proportional partial credit collections (matches daily summary scaling)
(function(global){
  function buildPaidBySale(payments){
    const paidBySale = new Map();
    (payments || []).forEach(tx => {
      const m = String(tx.payment_method || '').toLowerCase();
      const val = Number(tx.amount || 0);
      if(!isFinite(val) || val <= 0) return;
      const sid = Number(tx.sale_id || 0);
      if(sid > 0){ paidBySale.set(sid, Number(paidBySale.get(sid) || 0) + val); }
    });
    return paidBySale;
  }

  /** Collection ratio for profitability (0..1), aligned with daily report scaleForPartial. */
  function getProfitCollectionScale(sale, paidBySale){
    if(!sale) return 0;
    const isCN = String(sale.doc_type || '') === 'credit_note' || String(sale.invoice_no || '').startsWith('CN-');
    if(isCN) return 1;
    const pm = String(sale.payment_method || '').toLowerCase();
    const ps = String(sale.payment_status || '').toLowerCase();
    if(pm === 'credit' && ps === 'unpaid') return 0;
    if(pm === 'credit' && ps === 'partial'){
      const grand = Number(sale.grand_total || 0);
      const paid = Number(paidBySale.get(Number(sale.id)) || 0);
      if(!(grand > 0) || !(paid > 0)) return 0;
      return Math.min(1, paid / grand);
    }
    return 1;
  }

  function itemCostParts(cost, isVatExempt, vatPct, costIncludesVat){
    const isEx = Number(isVatExempt ?? 0) === 1;
    const itemVatPct = isEx ? 0 : vatPct;
    if(costIncludesVat){
      return {
        withVat: cost,
        exVat: itemVatPct > 0 ? cost / (1 + itemVatPct) : cost
      };
    }
    return {
      exVat: cost,
      withVat: cost * (1 + itemVatPct)
    };
  }

  function calcProfitabilityTotals(opts){
    const {
      allSales = [],
      creditNotes = [],
      soldItemsDetailed = [],
      paidBySale = new Map(),
      vatPercent = 15,
      costIncludesVat = 1
    } = opts || {};

    const vatPct = Number(vatPercent || 15) / 100;
    const costIncl = Boolean(Number(costIncludesVat ?? 1));
    const saleById = new Map();
    (allSales || []).forEach(s => {
      if(s && s.id != null){ saleById.set(Number(s.id), s); }
    });

    let costTotalWithVat = 0;
    let costTotalExVat = 0;
    (soldItemsDetailed || []).forEach(it => {
      const sale = saleById.get(Number(it.sale_id));
      if(!sale) return;
      const isCN = String(it.doc_type || sale.doc_type || '') === 'credit_note'
        || String(sale.invoice_no || '').startsWith('CN-');
      const scale = getProfitCollectionScale(sale, paidBySale);
      if(scale <= 0) return;
      const sign = isCN ? -1 : 1;
      const qty = sign * Number(it.qty || 0) * scale;
      if(!qty) return;
      const cost = Number(it.cost_price || 0);
      const parts = itemCostParts(cost, it.is_vat_exempt, vatPct, costIncl);
      costTotalWithVat += qty * parts.withVat;
      costTotalExVat += qty * parts.exVat;
    });

    let profitSalesWithVat = 0;
    let profitSalesExVat = 0;
    (allSales || []).forEach(sv => {
      const isCN = String(sv.doc_type || '') === 'credit_note' || String(sv.invoice_no || '').startsWith('CN-');
      if(isCN) return;
      const scale = getProfitCollectionScale(sv, paidBySale);
      if(scale <= 0) return;
      const grand = Number(sv.grand_total || 0);
      const vat = Number(sv.vat_total || 0);
      profitSalesWithVat += grand * scale;
      profitSalesExVat += (grand - vat) * scale;
    });
    (creditNotes || []).forEach(sv => {
      const grand = Math.abs(Number(sv.grand_total || 0));
      const vat = Math.abs(Number(sv.vat_total || 0));
      profitSalesWithVat -= grand;
      profitSalesExVat -= (grand - vat);
    });

    const salesTotalWithVat = profitSalesWithVat;
    const salesTotalExVat = profitSalesExVat;
    return {
      costTotalWithVat,
      costTotalExVat,
      salesTotalWithVat,
      salesTotalExVat,
      profitNetWithVat: Number(salesTotalWithVat - costTotalWithVat),
      profitNetExVat: Number(salesTotalExVat - costTotalExVat)
    };
  }

  global.ReportProfitUtils = {
    buildPaidBySale,
    getProfitCollectionScale,
    calcProfitabilityTotals
  };
})(typeof window !== 'undefined' ? window : globalThis);
