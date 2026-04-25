const fmt = (n) => Number(n || 0).toFixed(2);
const rangeEl = document.getElementById('range');
const fromAtEl = document.getElementById('fromAt');
const toAtEl = document.getElementById('toAt');
const btnBack = document.getElementById('btnBack');
const applyRangeBtn = document.getElementById('applyRangeBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const exportExcelBtn = document.getElementById('exportExcelBtn');

let __zatcaLang = 'ar';
let __zatcaT = null;
let _invSumPre = 0;
let _invSumVat = 0;
let _invSumGrand = 0;
let _cnSumPre = 0;
let _cnSumVat = 0;
let _cnSumGrand = 0;
let _expSumPre = 0;
let _expSumVat = 0;
let _expSumGrand = 0;
let _salesInvoices = [];
let _creditNotes = [];
let _simplePurchases = [];
let _invoicePurchases = [];
let _currentRangeStart = '';
let _currentRangeEnd = '';

const TRANSLATIONS = {
  ar: {
    pageTitle: 'تقرير هيئة الزكاة والضريبة',
    reportTitle: 'تقرير هيئة الزكاة والضريبة والجمارك',
    backBtn: 'الرجوع',
    fromLabel: 'من:',
    toLabel: 'إلى:',
    applyBtn: 'تطبيق',
    exportPdfBtn: 'تصدير PDF',
    exportExcelBtn: 'تصدير Excel',
    rangeText: 'الفترة: {{start}} — {{end}}',
    invoicesSection: 'الفواتير (مدفوعة وغير مدفوعة) ضمن الفترة',
    invoicesSectionWithCount: 'الفواتير (مدفوعة وغير مدفوعة) ضمن الفترة — العدد: {{count}}',
    creditNotesSection: 'الفواتير المرتجعة (إشعارات دائنة) ضمن الفترة',
    creditNotesSectionWithCount: 'الفواتير المرتجعة (إشعارات دائنة) — العدد: {{count}}',
    expensesSection: 'المصروفات ضمن الفترة',
    expensesSectionWithCount: 'المصروفات ضمن الفترة — العدد: {{count}}',
    summarySection: 'ملخص الإجماليات',
    invoiceNo: 'رقم الفاتورة',
    creditNoteNo: 'رقم الإشعار',
    date: 'التاريخ',
    customer: 'العميل',
    paymentMethod: 'طريقة الدفع',
    status: 'الحالة',
    preVatAmount: 'المبلغ قبل الضريبة',
    preVat: 'قبل الضريبة',
    vat: 'الضريبة',
    total: 'الإجمالي',
    statement: 'البيان',
    originalInvoiceNo: 'رقم الفاتورة الأصلية',
    invoicesTotal: 'إجمالي الفواتير',
    returnsTotal: 'إجمالي المرتجعات',
    expensesTotal: 'إجمالي المصروفات',
    summaryLabel: 'البيان',
    afterVat: 'بعد الضريبة',
    sales: 'المبيعات',
    minusReturns: 'ناقص: المرتجعات',
    salesAfterReturns: 'المبيعات بعد خصم المرتجعات',
    minusExpenses: 'ناقص: المصروفات',
    finalTotal: 'الإجمالي النهائي',
    finalTotalDetailed: 'الإجمالي النهائي (المبيعات − المرتجعات − المصروفات)',
    noInvoicesInRange: 'لا توجد فواتير ضمن الفترة',
    noCreditNotesInRange: 'لا توجد مرتجعات ضمن الفترة',
    noExpensesInRange: 'لا توجد مصروفات ضمن الفترة',
    noInvoices: 'لا توجد فواتير',
    noCreditNotes: 'لا توجد مرتجعات',
    noExpenses: 'لا توجد مصروفات',
    paid: 'مدفوعة',
    unpaid: 'غير مدفوعة',
    cash: 'نقدًا',
    card: 'شبكة',
    credit: 'آجل',
    tamara: 'تمارا',
    tabby: 'تابي',
    bankTransfer: 'تحويل بنكي',
    mixed: 'مختلط',
    purchaseInvoice: 'فاتورة شراء',
    purchaseInvoiceWithNo: 'فاتورة شراء {{number}}',
    periodRequired: 'يرجى تحديد الفترة (من وإلى)',
    periodRequiredFull: 'يرجى تحديد الفترة كاملة',
    pdfError: 'تعذر إنشاء PDF',
    excelError: 'تعذر إنشاء Excel',
    address: 'العنوان',
    mobile: 'الجوال',
    email: 'الإيميل',
    vatNumber: 'الرقم الضريبي',
    commercialRegister: 'السجل التجاري',
    period: 'الفترة',
    invoices: 'الفواتير',
    returns: 'المرتجعات',
    expenses: 'المصروفات',
    totalsSummary: 'ملخص الإجماليات',
    companyMobile: 'جوال: {{value}}',
    companyEmail: 'إيميل: {{value}}',
    companyVat: 'الرقم الضريبي: {{value}}',
    companyCr: 'السجل التجاري: {{value}}'
  },
  en: {
    pageTitle: 'ZATCA Report',
    reportTitle: 'ZATCA Report',
    backBtn: 'Back',
    fromLabel: 'From:',
    toLabel: 'To:',
    applyBtn: 'Apply',
    exportPdfBtn: 'Export PDF',
    exportExcelBtn: 'Export Excel',
    rangeText: 'Period: {{start}} — {{end}}',
    invoicesSection: 'Invoices (paid and unpaid) in period',
    invoicesSectionWithCount: 'Invoices (paid and unpaid) in period — Count: {{count}}',
    creditNotesSection: 'Returned invoices (credit notes) in period',
    creditNotesSectionWithCount: 'Returned invoices (credit notes) — Count: {{count}}',
    expensesSection: 'Expenses in period',
    expensesSectionWithCount: 'Expenses in period — Count: {{count}}',
    summarySection: 'Totals Summary',
    invoiceNo: 'Invoice No.',
    creditNoteNo: 'Credit Note No.',
    date: 'Date',
    customer: 'Customer',
    paymentMethod: 'Payment Method',
    status: 'Status',
    preVatAmount: 'Amount before VAT',
    preVat: 'Before VAT',
    vat: 'VAT',
    total: 'Total',
    statement: 'Statement',
    originalInvoiceNo: 'Original Invoice No.',
    invoicesTotal: 'Invoices Total',
    returnsTotal: 'Returns Total',
    expensesTotal: 'Expenses Total',
    summaryLabel: 'Statement',
    afterVat: 'After VAT',
    sales: 'Sales',
    minusReturns: 'Less: Returns',
    salesAfterReturns: 'Sales after returns',
    minusExpenses: 'Less: Expenses',
    finalTotal: 'Final Total',
    finalTotalDetailed: 'Final total (sales − returns − expenses)',
    noInvoicesInRange: 'No invoices in the selected period',
    noCreditNotesInRange: 'No returns in the selected period',
    noExpensesInRange: 'No expenses in the selected period',
    noInvoices: 'No invoices',
    noCreditNotes: 'No returns',
    noExpenses: 'No expenses',
    paid: 'Paid',
    unpaid: 'Unpaid',
    cash: 'Cash',
    card: 'Card',
    credit: 'Credit',
    tamara: 'Tamara',
    tabby: 'Tabby',
    bankTransfer: 'Bank Transfer',
    mixed: 'Mixed',
    purchaseInvoice: 'Purchase Invoice',
    purchaseInvoiceWithNo: 'Purchase Invoice {{number}}',
    periodRequired: 'Please select the period (from and to)',
    periodRequiredFull: 'Please select the full period',
    pdfError: 'Failed to create PDF',
    excelError: 'Failed to create Excel',
    address: 'Address',
    mobile: 'Mobile',
    email: 'Email',
    vatNumber: 'VAT Number',
    commercialRegister: 'Commercial Register',
    period: 'Period',
    invoices: 'Invoices',
    returns: 'Returns',
    expenses: 'Expenses',
    totalsSummary: 'Totals Summary',
    companyMobile: 'Mobile: {{value}}',
    companyEmail: 'Email: {{value}}',
    companyVat: 'VAT No: {{value}}',
    companyCr: 'CR No: {{value}}'
  }
};

__zatcaT = TRANSLATIONS.ar;

function isArabicLocale() {
  return String(__zatcaLang || 'ar').toLowerCase().startsWith('ar');
}

function _t(key, vars = null) {
  const value = (__zatcaT && __zatcaT[key] !== undefined) ? __zatcaT[key] : key;
  if (!vars) return value;
  return String(value).replace(/\{\{(\w+)\}\}/g, (_, name) => vars[name] ?? '');
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function bindDatePicker(input, labelSelector) {
  if (!input) return;
  const openPicker = () => {
    try { input.showPicker(); } catch (_) {}
    try { input.focus(); } catch (_) {}
  };
  input.addEventListener('click', openPicker);
  input.addEventListener('focus', openPicker);
  const label = labelSelector ? document.querySelector(labelSelector) : null;
  if (label) label.addEventListener('click', openPicker);
}

bindDatePicker(fromAtEl, 'label[for="fromAt"]');
bindDatePicker(toAtEl, 'label[for="toAt"]');

if (btnBack) {
  btnBack.onclick = () => { window.location.href = './index.html'; };
}

function toStr(d) {
  const p = (v) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

function fromInputToStr(input) {
  const v = (input?.value || '').trim();
  if (!v) return '';
  return v.replace('T', ' ') + ':00';
}

function labelPaymentMethod(method) {
  const m = String(method || '').toLowerCase();
  if (m === 'cash') return _t('cash');
  if (m === 'card' || m === 'network') return _t('card');
  if (m === 'credit') return _t('credit');
  if (m === 'tamara') return _t('tamara');
  if (m === 'tabby') return _t('tabby');
  if (m === 'bank_transfer') return _t('bankTransfer');
  if (m === 'mixed') return _t('mixed');
  return method || '';
}

function formatDate(val) {
  if (!val) return '';
  let d = new Date(val);
  if (isNaN(d.getTime())) {
    try {
      d = new Date(String(val).replace(' ', 'T'));
    } catch (_) {
      d = null;
    }
  }
  if (!d || isNaN(d.getTime())) return String(val);
  return new Intl.DateTimeFormat(isArabicLocale() ? 'ar-EG-u-ca-gregory' : 'en-GB-u-ca-gregory', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
}

function updateRangeText(startStr, endStr) {
  if (rangeEl) rangeEl.textContent = _t('rangeText', { start: startStr, end: endStr });
}

function applyLocale(lang) {
  __zatcaLang = String(lang || 'ar');
  __zatcaT = isArabicLocale() ? TRANSLATIONS.ar : TRANSLATIONS.en;

  document.documentElement.lang = isArabicLocale() ? 'ar' : 'en';
  document.documentElement.dir = isArabicLocale() ? 'rtl' : 'ltr';
  document.title = _t('pageTitle');

  setText('pageTitle', _t('reportTitle'));
  setText('btnBack', _t('backBtn'));
  setText('fromAtLabel', _t('fromLabel'));
  setText('toAtLabel', _t('toLabel'));
  setText('applyRangeBtn', _t('applyBtn'));
  setText('exportPdfBtn', _t('exportPdfBtn'));
  setText('exportExcelBtn', _t('exportExcelBtn'));

  setText('invSectionTitle', _t('invoicesSection'));
  setText('invHeadNo', _t('invoiceNo'));
  setText('invHeadDate', _t('date'));
  setText('invHeadCustomer', _t('customer'));
  setText('invHeadPayment', _t('paymentMethod'));
  setText('invHeadStatus', _t('status'));
  setText('invHeadPreVat', _t('preVatAmount'));
  setText('invHeadVat', _t('vat'));
  setText('invHeadTotal', _t('total'));
  setText('invFooterLabel', _t('invoicesTotal'));

  setText('cnSectionTitle', _t('creditNotesSection'));
  setText('cnHeadNo', _t('creditNoteNo'));
  setText('cnHeadDate', _t('date'));
  setText('cnHeadCustomer', _t('customer'));
  setText('cnHeadBaseInvoice', _t('originalInvoiceNo'));
  setText('cnHeadPreVat', _t('preVatAmount'));
  setText('cnHeadVat', _t('vat'));
  setText('cnHeadTotal', _t('total'));
  setText('cnFooterLabel', _t('returnsTotal'));

  setText('expSectionTitle', _t('expensesSection'));
  setText('expHeadTitle', _t('statement'));
  setText('expHeadDate', _t('date'));
  setText('expHeadPayment', _t('paymentMethod'));
  setText('expHeadPreVat', _t('preVat'));
  setText('expHeadVat', _t('vat'));
  setText('expHeadTotal', _t('total'));
  setText('expFooterLabel', _t('expensesTotal'));

  setText('summarySectionTitle', _t('summarySection'));
  setText('summaryHeadLabel', _t('summaryLabel'));
  setText('summaryHeadPreVat', _t('preVat'));
  setText('summaryHeadVat', _t('vat'));
  setText('summaryHeadAfterVat', _t('afterVat'));
  setText('summaryRowSales', _t('sales'));
  setText('summaryRowReturns', _t('minusReturns'));
  setText('summaryRowNetSales', _t('salesAfterReturns'));
  setText('summaryRowExpenses', _t('minusExpenses'));
  setText('summaryFooterLabel', _t('finalTotalDetailed'));

  if (_currentRangeStart && _currentRangeEnd) {
    updateRangeText(_currentRangeStart, _currentRangeEnd);
  }

  renderInvoices(_salesInvoices);
  renderCreditNotes(_creditNotes);
  renderExpenses(_simplePurchases, _invoicePurchases);
  renderTotals();
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = fmt(val);
}

async function loadRange(startStr, endStr) {
  _currentRangeStart = startStr;
  _currentRangeEnd = endStr;
  updateRangeText(startStr, endStr);

  try {
    const [resInv, resCN, resSimplePur, resInvPur] = await Promise.all([
      window.api.sales_list({ date_from: startStr, date_to: endStr, pageSize: 999999, page: 1 }),
      window.api.sales_list_credit_notes({ date_from: startStr, date_to: endStr, pageSize: 999999 }),
      window.api.purchases_list({ from_at: startStr, to_at: endStr }),
      window.api.purchase_invoices_list({ from: startStr, to: endStr })
    ]);

    const allInvoices = (resInv && resInv.ok) ? (resInv.items || []) : [];
    _salesInvoices = allInvoices.filter(s => !(String(s.doc_type || '') === 'credit_note' || String(s.invoice_no || '').startsWith('CN-')));

    _creditNotes = (resCN && resCN.ok) ? (resCN.items || []) : [];
    if (_creditNotes.length === 0) {
      _creditNotes = allInvoices.filter(s => String(s.doc_type || '') === 'credit_note' || String(s.invoice_no || '').startsWith('CN-'));
    }

    _simplePurchases = (resSimplePur && resSimplePur.ok) ? (resSimplePur.items || []) : [];
    _invoicePurchases = (resInvPur && resInvPur.ok) ? (resInvPur.items || []) : [];

    renderInvoices(_salesInvoices);
    renderCreditNotes(_creditNotes);
    renderExpenses(_simplePurchases, _invoicePurchases);
    renderTotals();
  } catch (e) {
    console.error(e);
  }
}

function renderInvoices(items) {
  _invSumPre = 0;
  _invSumVat = 0;
  _invSumGrand = 0;

  const tbody = document.getElementById('invTbody');
  if (!tbody) return;

  setText('invSectionTitle', _t('invoicesSection'));

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted" style="text-align:center">${_t('noInvoicesInRange')}</td></tr>`;
    setEl('invSumPre', 0);
    setEl('invSumVat', 0);
    setEl('invSumGrand', 0);
    return;
  }

  setText('invSectionTitle', _t('invoicesSectionWithCount', { count: items.length }));

  const rows = items.map((s) => {
    const pre = Number(s.sub_total || 0);
    const vat = Number(s.vat_total || 0);
    const grand = Number(s.grand_total || 0);
    _invSumPre += pre;
    _invSumVat += vat;
    _invSumGrand += grand;

    const pm = String(s.payment_method || '').toLowerCase();
    const isUnpaid = pm === 'credit' && Number(s.amount_paid || 0) <= 0;
    const statusLabel = isUnpaid
      ? `<span style="color:#dc2626">${_t('unpaid')}</span>`
      : `<span style="color:#16a34a">${_t('paid')}</span>`;
    const rowClass = isUnpaid ? 'class="unpaid-row"' : '';
    const cust = s.customer_phone || s.disp_customer_phone || s.customer_name || s.disp_customer_name || '';

    return `<tr ${rowClass}>
      <td>${String(s.invoice_no || '').replace(/\s+/g, ' ').trim()}</td>
      <td>${formatDate(s.created_at)}</td>
      <td>${cust}</td>
      <td>${labelPaymentMethod(pm)}</td>
      <td>${statusLabel}</td>
      <td>${fmt(pre)}</td>
      <td>${fmt(vat)}</td>
      <td>${fmt(grand)}</td>
    </tr>`;
  }).join('');

  tbody.innerHTML = rows;
  setEl('invSumPre', _invSumPre);
  setEl('invSumVat', _invSumVat);
  setEl('invSumGrand', _invSumGrand);
}

function renderCreditNotes(items) {
  _cnSumPre = 0;
  _cnSumVat = 0;
  _cnSumGrand = 0;

  const tbody = document.getElementById('cnTbody');
  if (!tbody) return;

  setText('cnSectionTitle', _t('creditNotesSection'));

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted" style="text-align:center">${_t('noCreditNotesInRange')}</td></tr>`;
    setEl('cnSumPre', 0);
    setEl('cnSumVat', 0);
    setEl('cnSumGrand', 0);
    return;
  }

  setText('cnSectionTitle', _t('creditNotesSectionWithCount', { count: items.length }));

  const rows = items.map((s) => {
    const pre = Math.abs(Number(s.sub_total || 0));
    const vat = Math.abs(Number(s.vat_total || 0));
    const grand = Math.abs(Number(s.grand_total || 0));
    _cnSumPre += pre;
    _cnSumVat += vat;
    _cnSumGrand += grand;
    const cust = s.customer_phone || s.disp_customer_phone || s.customer_name || s.disp_customer_name || '';
    const baseNo = s.base_invoice_no || s.ref_base_invoice_no || '';

    return `<tr class="credit-row">
      <td>${String(s.invoice_no || '').replace(/\s+/g, ' ').trim()}</td>
      <td>${formatDate(s.created_at)}</td>
      <td>${cust}</td>
      <td>${baseNo}</td>
      <td>${fmt(pre)}</td>
      <td>${fmt(vat)}</td>
      <td>${fmt(grand)}</td>
    </tr>`;
  }).join('');

  tbody.innerHTML = rows;
  setEl('cnSumPre', _cnSumPre);
  setEl('cnSumVat', _cnSumVat);
  setEl('cnSumGrand', _cnSumGrand);
}

function getPurchaseInvoiceName(invoiceNo) {
  const m = String(invoiceNo || '').match(/^PI-\d{6}-(\d+)$/);
  const printed = m ? String(Number(m[1])) : (invoiceNo || '');
  return printed ? _t('purchaseInvoiceWithNo', { number: printed }) : _t('purchaseInvoice');
}

function renderExpenses(simplePur, invPur) {
  _expSumPre = 0;
  _expSumVat = 0;
  _expSumGrand = 0;

  const tbody = document.getElementById('expTbody');
  if (!tbody) return;

  setText('expSectionTitle', _t('expensesSection'));

  const normalized = [
    ...simplePur.map((p) => ({
      name: p.title || p.name || '',
      payment_method: p.payment_method || 'cash',
      sub_total: Number(p.sub_total || 0),
      vat_total: Number(p.vat_total || 0),
      grand_total: Number(p.grand_total || 0),
      at: p.purchase_at || p.created_at || null
    })),
    ...invPur.map((pi) => {
      const sub = Number(pi.sub_total || 0);
      const priceMode = String(pi.price_mode || 'inclusive');
      const vat = priceMode === 'zero_vat' ? 0 : Number(pi.vat_total || 0);
      const grand = priceMode === 'zero_vat' ? sub : Number(pi.grand_total || 0);
      return {
        name: getPurchaseInvoiceName(pi.invoice_no),
        payment_method: pi.payment_method || 'cash',
        sub_total: sub,
        vat_total: vat,
        grand_total: grand,
        at: pi.invoice_at || pi.created_at || null
      };
    })
  ].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

  if (!normalized.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center">${_t('noExpensesInRange')}</td></tr>`;
    setEl('expSumPre', 0);
    setEl('expSumVat', 0);
    setEl('expSumGrand', 0);
    return;
  }

  setText('expSectionTitle', _t('expensesSectionWithCount', { count: normalized.length }));

  const rows = normalized.map((p) => {
    const pre = Number(p.sub_total || 0);
    const vat = Number(p.vat_total || 0);
    const grand = Number(p.grand_total || 0);
    _expSumPre += pre;
    _expSumVat += vat;
    _expSumGrand += grand;

    return `<tr>
      <td>${p.name}</td>
      <td>${formatDate(p.at)}</td>
      <td>${labelPaymentMethod(p.payment_method)}</td>
      <td>${fmt(pre)}</td>
      <td>${fmt(vat)}</td>
      <td>${fmt(grand)}</td>
    </tr>`;
  }).join('');

  tbody.innerHTML = rows;
  setEl('expSumPre', _expSumPre);
  setEl('expSumVat', _expSumVat);
  setEl('expSumGrand', _expSumGrand);
}

function renderTotals() {
  const absCnPre = Math.abs(_cnSumPre);
  const absCnVat = Math.abs(_cnSumVat);
  const absCnGrand = Math.abs(_cnSumGrand);

  const netSalesPre = _invSumPre - absCnPre;
  const netSalesVat = _invSumVat - absCnVat;
  const netSalesGrand = _invSumGrand - absCnGrand;

  const netPre = netSalesPre - _expSumPre;
  const netVat = netSalesVat - _expSumVat;
  const netGrand = netSalesGrand - _expSumGrand;

  setEl('sumInvPre2', _invSumPre);
  setEl('sumInvVat2', _invSumVat);
  setEl('sumInvGrand2', _invSumGrand);
  setEl('sumCnPre2', absCnPre);
  setEl('sumCnVat2', absCnVat);
  setEl('sumCnGrand2', absCnGrand);
  setEl('sumNetSalesPre', netSalesPre);
  setEl('sumNetSalesVat', netSalesVat);
  setEl('sumNetSalesGrand', netSalesGrand);
  setEl('sumExpPre2', _expSumPre);
  setEl('sumExpVat2', _expSumVat);
  setEl('sumExpGrand2', _expSumGrand);
  setEl('sumNetPre', netPre);
  setEl('sumNetVat', netVat);
  setEl('sumNetGrand', netGrand);
}

function initDefaultRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const s = toStr(start);
  const e = toStr(now);
  if (fromAtEl) fromAtEl.value = s.replace(' ', 'T').slice(0, 16);
  if (toAtEl) toAtEl.value = e.replace(' ', 'T').slice(0, 16);
}

if (applyRangeBtn) {
  applyRangeBtn.addEventListener('click', () => {
    const s = fromInputToStr(fromAtEl);
    const e = fromInputToStr(toAtEl);
    if (!s || !e) {
      alert(_t('periodRequired'));
      return;
    }
    loadRange(s, e);
  });
}

async function exportZatcaPDF() {
  const periodText = rangeEl?.textContent || '';
  const fromStr = fromInputToStr(fromAtEl);
  const toStr2 = fromInputToStr(toAtEl);
  if (!fromStr || !toStr2) {
    alert(_t('periodRequiredFull'));
    return;
  }

  const [resInv, resCN, resSimplePur, resInvPur, resSt, resLg] = await Promise.all([
    window.api.sales_list({ date_from: fromStr, date_to: toStr2, pageSize: 999999, page: 1 }),
    window.api.sales_list_credit_notes({ date_from: fromStr, date_to: toStr2, pageSize: 999999 }),
    window.api.purchases_list({ from_at: fromStr, to_at: toStr2 }),
    window.api.purchase_invoices_list({ from: fromStr, to: toStr2 }),
    window.api.settings_get(),
    window.api.settings_image_get()
  ]);

  const settings = (resSt && resSt.ok) ? resSt.item : {};
  const lg = resLg;

  let logoHtml = '';
  if (lg && lg.ok && lg.base64) {
    logoHtml = `<img src="data:${lg.mime || 'image/png'};base64,${lg.base64}" alt="" style="width:70px;height:70px;border-radius:8px;object-fit:contain;border:1px solid #cbd5e1;background:#fff;" />`;
  } else if (settings.logo_path) {
    const lp = settings.logo_path.startsWith('assets/') ? `../../../${settings.logo_path}` : settings.logo_path;
    logoHtml = `<img src="${lp}" alt="" style="width:70px;height:70px;border-radius:8px;object-fit:contain;border:1px solid #cbd5e1;background:#fff;" />`;
  }

  const arName = settings.seller_legal_name || '';
  const enName = settings.seller_legal_name_en || arName;
  const arInfo = [];
  const enInfo = [];
  if (settings.company_location) arInfo.push(settings.company_location);
  if (settings.company_location_en || settings.company_location) enInfo.push(settings.company_location_en || settings.company_location);
  if (settings.company_site) {
    arInfo.push(settings.company_site);
    enInfo.push(settings.company_site);
  }
  if (settings.mobile) {
    arInfo.push(_t('companyMobile', { value: settings.mobile }));
    enInfo.push(`Mobile: ${settings.mobile}`);
  }
  if (settings.email && (typeof settings.show_email_in_invoice === 'undefined' || settings.show_email_in_invoice)) {
    arInfo.push(_t('companyEmail', { value: settings.email }));
    enInfo.push(`Email: ${settings.email}`);
  }
  if (settings.seller_vat_number) {
    arInfo.push(_t('companyVat', { value: settings.seller_vat_number }));
    enInfo.push(`VAT No: ${settings.seller_vat_number}`);
  }
  if (settings.commercial_register) {
    arInfo.push(_t('companyCr', { value: settings.commercial_register }));
    enInfo.push(`CR No: ${settings.commercial_register}`);
  }

  const companyHeaderHtml = `
    <div style="border-bottom:3px solid #0b3daa;padding-bottom:14px;margin-bottom:16px;">
      <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="text-align:right;direction:rtl;">
          <div style="font-size:18px;font-weight:800;margin:0 0 4px 0;">${arName}</div>
          <div style="white-space:pre-wrap;font-size:12px;line-height:1.6;">${arInfo.join('\n')}</div>
        </div>
        <div style="text-align:center;">${logoHtml}</div>
        <div style="text-align:left;direction:ltr;">
          <div style="font-size:18px;font-weight:800;margin:0 0 4px 0;">${enName}</div>
          <div style="white-space:pre-wrap;font-size:12px;line-height:1.6;">${enInfo.join('\n')}</div>
        </div>
      </div>
      <div style="text-align:center;border-top:1px solid #e6eaf0;padding-top:10px;">
        <div style="font-size:20px;font-weight:700;color:#0b3daa;margin:0 0 4px 0;">${_t('reportTitle')}</div>
        <div style="font-size:13px;color:#64748b;">${periodText}</div>
      </div>
    </div>`;

  const allInvoices = (resInv && resInv.ok) ? (resInv.items || []) : [];
  const salesInvoices = allInvoices.filter((s) => !(String(s.doc_type || '') === 'credit_note' || String(s.invoice_no || '').startsWith('CN-')));
  let cnItems = (resCN && resCN.ok) ? (resCN.items || []) : [];
  if (!cnItems.length) {
    cnItems = allInvoices.filter((s) => String(s.doc_type || '') === 'credit_note' || String(s.invoice_no || '').startsWith('CN-'));
  }
  const simplePur = (resSimplePur && resSimplePur.ok) ? (resSimplePur.items || []) : [];
  const invPur = (resInvPur && resInvPur.ok) ? (resInvPur.items || []) : [];

  let sumInvPre = 0;
  let sumInvVat = 0;
  let sumInvGrand = 0;
  const invRows = salesInvoices.map((s) => {
    const pre = Number(s.sub_total || 0);
    const vat = Number(s.vat_total || 0);
    const grand = Number(s.grand_total || 0);
    sumInvPre += pre;
    sumInvVat += vat;
    sumInvGrand += grand;
    const pm = String(s.payment_method || '').toLowerCase();
    const isUnpaid = pm === 'credit' && Number(s.amount_paid || 0) <= 0;
    const cust = s.customer_phone || s.customer_name || s.disp_customer_name || '';

    return `<tr style="${isUnpaid ? 'background:#fef2f2' : ''}">
      <td>${String(s.invoice_no || '').replace(/\s+/g, ' ').trim()}</td>
      <td>${formatDate(s.created_at)}</td>
      <td>${cust}</td>
      <td>${labelPaymentMethod(pm)}</td>
      <td>${isUnpaid ? _t('unpaid') : _t('paid')}</td>
      <td>${fmt(pre)}</td><td>${fmt(vat)}</td><td>${fmt(grand)}</td>
    </tr>`;
  }).join('');

  let sumCnPre = 0;
  let sumCnVat = 0;
  let sumCnGrand = 0;
  const cnRows = cnItems.map((s) => {
    const pre = Math.abs(Number(s.sub_total || 0));
    const vat = Math.abs(Number(s.vat_total || 0));
    const grand = Math.abs(Number(s.grand_total || 0));
    sumCnPre += pre;
    sumCnVat += vat;
    sumCnGrand += grand;
    const cust = s.customer_phone || s.customer_name || s.disp_customer_name || '';
    return `<tr style="background:#fff7ed">
      <td>${String(s.invoice_no || '').replace(/\s+/g, ' ').trim()}</td>
      <td>${formatDate(s.created_at)}</td>
      <td>${cust}</td>
      <td>${s.base_invoice_no || s.ref_base_invoice_no || ''}</td>
      <td>${fmt(pre)}</td>
      <td>${fmt(vat)}</td>
      <td>${fmt(grand)}</td>
    </tr>`;
  }).join('');

  const normalizedPur = [
    ...simplePur.map((p) => ({
      name: p.title || p.name || '',
      payment_method: p.payment_method || 'cash',
      sub_total: Number(p.sub_total || 0),
      vat_total: Number(p.vat_total || 0),
      grand_total: Number(p.grand_total || 0),
      at: p.purchase_at || p.created_at
    })),
    ...invPur.map((pi) => {
      const sub = Number(pi.sub_total || 0);
      const priceMode = String(pi.price_mode || 'inclusive');
      const vat = priceMode === 'zero_vat' ? 0 : Number(pi.vat_total || 0);
      const grand = priceMode === 'zero_vat' ? sub : Number(pi.grand_total || 0);
      return {
        name: getPurchaseInvoiceName(pi.invoice_no),
        payment_method: pi.payment_method || 'cash',
        sub_total: sub,
        vat_total: vat,
        grand_total: grand,
        at: pi.invoice_at || pi.created_at
      };
    })
  ].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

  let sumExpPre = 0;
  let sumExpVat = 0;
  let sumExpGrand = 0;
  const expRows = normalizedPur.map((p) => {
    const pre = Number(p.sub_total || 0);
    const vat = Number(p.vat_total || 0);
    const grand = Number(p.grand_total || 0);
    sumExpPre += pre;
    sumExpVat += vat;
    sumExpGrand += grand;
    return `<tr><td>${p.name}</td><td>${formatDate(p.at)}</td><td>${labelPaymentMethod(p.payment_method)}</td><td>${fmt(pre)}</td><td>${fmt(vat)}</td><td>${fmt(grand)}</td></tr>`;
  }).join('');

  const absCnPrePdf = Math.abs(sumCnPre);
  const absCnVatPdf = Math.abs(sumCnVat);
  const absCnGrandPdf = Math.abs(sumCnGrand);
  const netSalesPdfPre = sumInvPre - absCnPrePdf;
  const netSalesPdfVat = sumInvVat - absCnVatPdf;
  const netSalesPdfGrand = sumInvGrand - absCnGrandPdf;
  const netPdfPre = netSalesPdfPre - sumExpPre;
  const netPdfVat = netSalesPdfVat - sumExpVat;
  const netPdfGrand = netSalesPdfGrand - sumExpGrand;

  const thStyle = `background:#eef2ff;color:#0b3daa;padding:8px;border:1px solid #e6eaf0;text-align:${isArabicLocale() ? 'right' : 'left'};font-size:12px;`;
  const tdStyle = `padding:8px;border:1px solid #e6eaf0;text-align:${isArabicLocale() ? 'right' : 'left'};font-size:12px;`;
  const tfStyle = `background:#f1f5f9;padding:8px;border:1px solid #000;border-top:2px solid #3b82f6;text-align:${isArabicLocale() ? 'right' : 'left'};font-size:12px;font-weight:700;`;

  const html = `<!doctype html><html lang="${isArabicLocale() ? 'ar' : 'en'}" dir="${isArabicLocale() ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
  <style>
    @font-face{font-family:'Cairo';src:url('../../../assets/fonts/Cairo-Bold.ttf') format('truetype');font-weight:700;}
    *{font-family:'Cairo',Arial,sans-serif;font-weight:700;box-sizing:border-box;}
    body{background:#fff;margin:0;padding:15px 20px;color:#0f172a;}
    .section{border:1px solid #e6eaf0;border-radius:8px;padding:12px;margin:12px 0;page-break-inside:avoid;}
    h3{font-size:14px;margin:0 0 8px 0;color:#0f172a;}
    table{width:100%;border-collapse:collapse;margin:6px 0;}
    thead{display:table-header-group;}
    tr{page-break-inside:avoid;}
    .totals-section{background:#f8fafc;border:2px solid #3b82f6;border-radius:8px;padding:14px;margin:12px 0;}
  </style></head><body>
  ${companyHeaderHtml}

  <div class="section">
    <h3>${_t('invoicesSectionWithCount', { count: salesInvoices.length })}</h3>
    <table>
      <thead><tr>
        <th style="${thStyle}">${_t('invoiceNo')}</th>
        <th style="${thStyle}">${_t('date')}</th>
        <th style="${thStyle}">${_t('customer')}</th>
        <th style="${thStyle}">${_t('paymentMethod')}</th>
        <th style="${thStyle}">${_t('status')}</th>
        <th style="${thStyle}">${_t('preVat')}</th>
        <th style="${thStyle}">${_t('vat')}</th>
        <th style="${thStyle}">${_t('total')}</th>
      </tr></thead>
      <tbody>${invRows || `<tr><td colspan="8" style="${tdStyle}text-align:center">${_t('noInvoices')}</td></tr>`}</tbody>
      <tfoot><tr>
        <th colspan="5" style="${tfStyle}">${_t('invoicesTotal')}</th>
        <th style="${tfStyle}">${fmt(sumInvPre)}</th>
        <th style="${tfStyle}">${fmt(sumInvVat)}</th>
        <th style="${tfStyle}">${fmt(sumInvGrand)}</th>
      </tr></tfoot>
    </table>
  </div>

  <div class="section">
    <h3>${_t('creditNotesSectionWithCount', { count: cnItems.length })}</h3>
    <table>
      <thead><tr>
        <th style="${thStyle}">${_t('creditNoteNo')}</th>
        <th style="${thStyle}">${_t('date')}</th>
        <th style="${thStyle}">${_t('customer')}</th>
        <th style="${thStyle}">${_t('originalInvoiceNo')}</th>
        <th style="${thStyle}">${_t('preVat')}</th>
        <th style="${thStyle}">${_t('vat')}</th>
        <th style="${thStyle}">${_t('total')}</th>
      </tr></thead>
      <tbody>${cnRows || `<tr><td colspan="7" style="${tdStyle}text-align:center">${_t('noCreditNotes')}</td></tr>`}</tbody>
      <tfoot><tr>
        <th colspan="4" style="${tfStyle}">${_t('returnsTotal')}</th>
        <th style="${tfStyle}">${fmt(sumCnPre)}</th>
        <th style="${tfStyle}">${fmt(sumCnVat)}</th>
        <th style="${tfStyle}">${fmt(sumCnGrand)}</th>
      </tr></tfoot>
    </table>
  </div>

  <div class="section">
    <h3>${_t('expensesSectionWithCount', { count: normalizedPur.length })}</h3>
    <table>
      <thead><tr>
        <th style="${thStyle}">${_t('statement')}</th>
        <th style="${thStyle}">${_t('date')}</th>
        <th style="${thStyle}">${_t('paymentMethod')}</th>
        <th style="${thStyle}">${_t('preVat')}</th>
        <th style="${thStyle}">${_t('vat')}</th>
        <th style="${thStyle}">${_t('total')}</th>
      </tr></thead>
      <tbody>${expRows || `<tr><td colspan="6" style="${tdStyle}text-align:center">${_t('noExpenses')}</td></tr>`}</tbody>
      <tfoot><tr>
        <th colspan="3" style="${tfStyle}">${_t('expensesTotal')}</th>
        <th style="${tfStyle}">${fmt(sumExpPre)}</th>
        <th style="${tfStyle}">${fmt(sumExpVat)}</th>
        <th style="${tfStyle}">${fmt(sumExpGrand)}</th>
      </tr></tfoot>
    </table>
  </div>

  <div class="totals-section">
    <h3 style="text-align:center;font-size:16px;margin:0 0 12px 0;">${_t('summarySection')}</h3>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th style="${thStyle}font-size:13px;">${_t('summaryLabel')}</th>
        <th style="${thStyle}font-size:13px;">${_t('preVat')}</th>
        <th style="${thStyle}font-size:13px;">${_t('vat')}</th>
        <th style="${thStyle}font-size:13px;">${_t('afterVat')}</th>
      </tr></thead>
      <tbody>
        <tr>
          <td style="${tdStyle}">${_t('sales')}</td>
          <td style="${tdStyle}">${fmt(sumInvPre)}</td>
          <td style="${tdStyle}">${fmt(sumInvVat)}</td>
          <td style="${tdStyle}font-weight:700;">${fmt(sumInvGrand)}</td>
        </tr>
        <tr style="background:#fff7ed">
          <td style="${tdStyle}">${_t('minusReturns')}</td>
          <td style="${tdStyle}">${fmt(absCnPrePdf)}</td>
          <td style="${tdStyle}">${fmt(absCnVatPdf)}</td>
          <td style="${tdStyle}font-weight:700;">${fmt(absCnGrandPdf)}</td>
        </tr>
        <tr style="background:#f0fdf4;font-weight:700;">
          <td style="${tdStyle}font-weight:700;">${_t('salesAfterReturns')}</td>
          <td style="${tdStyle}font-weight:700;">${fmt(netSalesPdfPre)}</td>
          <td style="${tdStyle}font-weight:700;">${fmt(netSalesPdfVat)}</td>
          <td style="${tdStyle}font-weight:700;color:#16a34a;">${fmt(netSalesPdfGrand)}</td>
        </tr>
        <tr style="background:#fffbeb">
          <td style="${tdStyle}">${_t('minusExpenses')}</td>
          <td style="${tdStyle}">${fmt(sumExpPre)}</td>
          <td style="${tdStyle}">${fmt(sumExpVat)}</td>
          <td style="${tdStyle}font-weight:700;">${fmt(sumExpGrand)}</td>
        </tr>
      </tbody>
      <tfoot><tr>
        <th style="${tfStyle}font-size:13px;">${_t('finalTotal')}</th>
        <th style="${tfStyle}font-size:13px;">${fmt(netPdfPre)}</th>
        <th style="${tfStyle}font-size:13px;">${fmt(netPdfVat)}</th>
        <th style="${tfStyle}font-size:14px;color:#16a34a;">${fmt(netPdfGrand)}</th>
      </tr></tfoot>
    </table>
  </div>
  </body></html>`;

  const period = periodText.replace(/[^0-9_\-–: ]+/g, '').replace(/\s+/g, ' ').trim();
  const safe = String(period || '').replace(/[: ]/g, '_');
  const filename = `zatca-report-${safe || Date.now()}.pdf`;
  await window.api.pdf_export(html, { saveMode: 'auto', filename, pageSize: 'A4' });
}

async function exportZatcaExcel() {
  const lines = [];
  const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';

  try {
    const resSt = await window.api.settings_get();
    const settings = (resSt && resSt.ok) ? resSt.item : {};
    if (settings.seller_legal_name) lines.push(esc(settings.seller_legal_name));
    if (settings.company_location) lines.push([esc(_t('address')), esc(settings.company_location)].join(','));
    if (settings.mobile) lines.push([esc(_t('mobile')), esc(settings.mobile)].join(','));
    if (settings.email) lines.push([esc(_t('email')), esc(settings.email)].join(','));
    if (settings.seller_vat_number) lines.push([esc(_t('vatNumber')), esc(settings.seller_vat_number)].join(','));
    if (settings.commercial_register) lines.push([esc(_t('commercialRegister')), esc(settings.commercial_register)].join(','));
    lines.push('');
  } catch (_) {}

  if (rangeEl && rangeEl.textContent) {
    lines.push(esc(_t('period')), esc(rangeEl.textContent.trim()));
    lines.push('');
  }

  const addTable = (title, tbodyId) => {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const table = tbody.closest('table');
    if (!table) return;
    lines.push(esc(title));
    const ths = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim());
    if (ths.length) lines.push(ths.map(esc).join(','));
    Array.from(table.querySelectorAll('tbody tr')).forEach((tr) => {
      const tds = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim());
      if (tds.length) lines.push(tds.map(esc).join(','));
    });
    const footCells = Array.from(table.querySelectorAll('tfoot th')).map((th) => th.textContent.trim());
    if (footCells.length) lines.push(footCells.map(esc).join(','));
    lines.push('');
  };

  addTable(_t('invoices'), 'invTbody');
  addTable(_t('returns'), 'cnTbody');
  addTable(_t('expenses'), 'expTbody');

  const netPre = _invSumPre - Math.abs(_cnSumPre) - _expSumPre;
  const netVat = _invSumVat - Math.abs(_cnSumVat) - _expSumVat;
  const netGrand = _invSumGrand - Math.abs(_cnSumGrand) - _expSumGrand;
  const exAbsCnPre = Math.abs(_cnSumPre);
  const exAbsCnVat = Math.abs(_cnSumVat);
  const exAbsCnGrand = Math.abs(_cnSumGrand);
  const exNetSalesPre = _invSumPre - exAbsCnPre;
  const exNetSalesVat = _invSumVat - exAbsCnVat;
  const exNetSalesGrand = _invSumGrand - exAbsCnGrand;

  lines.push(esc(_t('totalsSummary')));
  lines.push([esc(_t('summaryLabel')), esc(_t('preVat')), esc(_t('vat')), esc(_t('afterVat'))].join(','));
  lines.push([esc(_t('sales')), esc(fmt(_invSumPre)), esc(fmt(_invSumVat)), esc(fmt(_invSumGrand))].join(','));
  lines.push([esc(_t('minusReturns')), esc(fmt(exAbsCnPre)), esc(fmt(exAbsCnVat)), esc(fmt(exAbsCnGrand))].join(','));
  lines.push([esc(_t('salesAfterReturns')), esc(fmt(exNetSalesPre)), esc(fmt(exNetSalesVat)), esc(fmt(exNetSalesGrand))].join(','));
  lines.push([esc(_t('minusExpenses')), esc(fmt(_expSumPre)), esc(fmt(_expSumVat)), esc(fmt(_expSumGrand))].join(','));
  lines.push([esc(_t('finalTotal')), esc(fmt(netPre)), esc(fmt(netVat)), esc(fmt(netGrand))].join(','));

  const period = (rangeEl?.textContent || '').replace(/[^0-9_\-–: ]+/g, '').replace(/\s+/g, ' ').trim();
  const filename = `zatca-report-${String(period || '').replace(/[: ]/g, '_') || Date.now()}.xlsx`;
  await window.api.csv_export(lines.join('\n'), { saveMode: 'auto', filename });
}

(function attachExportHandlers() {
  let exporting = false;

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', async () => {
      if (exporting) return;
      exporting = true;
      exportPdfBtn.disabled = true;
      try {
        await exportZatcaPDF();
      } catch (e) {
        console.error(e);
        alert(_t('pdfError'));
      } finally {
        exporting = false;
        exportPdfBtn.disabled = false;
      }
    });
  }

  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', async () => {
      if (exporting) return;
      exporting = true;
      exportExcelBtn.disabled = true;
      try {
        await exportZatcaExcel();
      } catch (e) {
        console.error(e);
        alert(_t('excelError'));
      } finally {
        exporting = false;
        exportExcelBtn.disabled = false;
      }
    });
  }
})();

(async () => {
  try {
    const result = await window.api.app_get_locale();
    applyLocale((result && result.lang) || 'ar');
  } catch (_) {
    applyLocale('ar');
  }
  const originalBurst = window.__i18n_burst;
  window.__i18n_burst = (lang) => {
    try {
      applyLocale(lang);
    } catch (_) {}
    try {
      originalBurst && originalBurst(lang);
    } catch (_) {}
  };
})();

initDefaultRange();
loadRange(fromInputToStr(fromAtEl), fromInputToStr(toAtEl));
