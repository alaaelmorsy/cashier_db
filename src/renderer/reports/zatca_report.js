// تقرير هيئة الزكاة والضريبة والجمارك
// يعرض جميع الفواتير (مدفوعة وغير مدفوعة) حسب تاريخ الإنشاء + المرتجعات + المصروفات + الإجماليات

const fmt = (n) => Number(n || 0).toFixed(2);
const rangeEl = document.getElementById('range');
const fromAtEl = document.getElementById('fromAt');
const toAtEl = document.getElementById('toAt');

function bindDatePicker(input, labelSelector) {
  if (!input) return;
  const openPicker = () => {
    try { input.showPicker(); } catch (_) { }
    try { input.focus(); } catch (_) { }
  };
  input.addEventListener('click', openPicker);
  input.addEventListener('focus', openPicker);
  const label = labelSelector ? document.querySelector(labelSelector) : null;
  if (label) label.addEventListener('click', openPicker);
}

bindDatePicker(fromAtEl, 'label[for="fromAt"]');
bindDatePicker(toAtEl, 'label[for="toAt"]');

const btnBack = document.getElementById('btnBack');
if (btnBack) { btnBack.onclick = () => { window.location.href = './index.html'; }; }

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
  if (m === 'cash') return 'نقدًا';
  if (m === 'card' || m === 'network') return 'شبكة';
  if (m === 'credit') return 'آجل';
  if (m === 'tamara') return 'تمارا';
  if (m === 'tabby') return 'تابي';
  if (m === 'bank_transfer') return 'تحويل بنكي';
  if (m === 'mixed') return 'مختلط';
  return method || '';
}

function formatDate(val) {
  if (!val) return '';
  let d = new Date(val);
  if (isNaN(d.getTime())) {
    try { d = new Date(String(val).replace(' ', 'T')); } catch (_) { d = null; }
  }
  if (!d || isNaN(d.getTime())) return String(val);
  return new Intl.DateTimeFormat('en-GB-u-ca-gregory', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: true
  }).format(d);
}

// ---------------------- تحميل البيانات ----------------------

async function loadRange(startStr, endStr) {
  if (rangeEl) rangeEl.textContent = `الفترة: ${startStr} — ${endStr}`;

  try {
    const [resInv, resCN, resSimplePur, resInvPur] = await Promise.all([
      window.api.sales_list({ date_from: startStr, date_to: endStr, pageSize: 999999, page: 1 }),
      window.api.sales_list_credit_notes({ date_from: startStr, date_to: endStr, pageSize: 999999 }),
      window.api.purchases_list({ from_at: startStr, to_at: endStr }),
      window.api.purchase_invoices_list({ from: startStr, to: endStr })
    ]);

    const allInvoices = (resInv && resInv.ok) ? (resInv.items || []) : [];
    const salesInvoices = allInvoices.filter(s =>
      !(String(s.doc_type || '') === 'credit_note' || String(s.invoice_no || '').startsWith('CN-'))
    );

    let cnItems = (resCN && resCN.ok) ? (resCN.items || []) : [];
    if (cnItems.length === 0) {
      cnItems = allInvoices.filter(s =>
        String(s.doc_type || '') === 'credit_note' || String(s.invoice_no || '').startsWith('CN-')
      );
    }

    const simplePur = (resSimplePur && resSimplePur.ok) ? (resSimplePur.items || []) : [];
    const invPur = (resInvPur && resInvPur.ok) ? (resInvPur.items || []) : [];

    renderInvoices(salesInvoices);
    renderCreditNotes(cnItems);
    renderExpenses(simplePur, invPur);
    renderTotals();
  } catch (e) {
    console.error(e);
  }
}

// ---------------------- عرض الفواتير ----------------------

let _invSumPre = 0, _invSumVat = 0, _invSumGrand = 0;

function renderInvoices(items) {
  _invSumPre = 0; _invSumVat = 0; _invSumGrand = 0;
  const tbody = document.getElementById('invTbody');
  if (!tbody) return;

  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="muted" style="text-align:center">لا توجد فواتير ضمن الفترة</td></tr>';
    setEl('invSumPre', 0); setEl('invSumVat', 0); setEl('invSumGrand', 0);
    return;
  }

  const rows = items.map(s => {
    const pre = Number(s.sub_total || 0);
    const vat = Number(s.vat_total || 0);
    const grand = Number(s.grand_total || 0);
    _invSumPre += pre; _invSumVat += vat; _invSumGrand += grand;

    const pm = String(s.payment_method || '').toLowerCase();
    const isUnpaid = (pm === 'credit' && Number(s.amount_paid || 0) <= 0);
    const statusLabel = isUnpaid ? '<span style="color:#dc2626">غير مدفوعة</span>' : '<span style="color:#16a34a">مدفوعة</span>';
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

// ---------------------- عرض المرتجعات ----------------------

let _cnSumPre = 0, _cnSumVat = 0, _cnSumGrand = 0;

function renderCreditNotes(items) {
  _cnSumPre = 0; _cnSumVat = 0; _cnSumGrand = 0;
  const tbody = document.getElementById('cnTbody');
  if (!tbody) return;

  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="muted" style="text-align:center">لا توجد مرتجعات ضمن الفترة</td></tr>';
    setEl('cnSumPre', 0); setEl('cnSumVat', 0); setEl('cnSumGrand', 0);
    return;
  }

  const rows = items.map(s => {
    const pre   = Math.abs(Number(s.sub_total   || 0));
    const vat   = Math.abs(Number(s.vat_total   || 0));
    const grand = Math.abs(Number(s.grand_total || 0));
    _cnSumPre += pre; _cnSumVat += vat; _cnSumGrand += grand;
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
  setEl('cnSumPre', _cnSumPre); setEl('cnSumVat', _cnSumVat); setEl('cnSumGrand', _cnSumGrand);
}

// ---------------------- عرض المصروفات ----------------------

let _expSumPre = 0, _expSumVat = 0, _expSumGrand = 0;

function renderExpenses(simplePur, invPur) {
  _expSumPre = 0; _expSumVat = 0; _expSumGrand = 0;
  const tbody = document.getElementById('expTbody');
  if (!tbody) return;

  const labelPay = (m) => {
    const x = String(m || '').toLowerCase();
    if (x === 'network' || x === 'card') return 'شبكة';
    if (x === 'credit' || m === 'آجل' || m === 'اجل') return 'آجل';
    return 'نقدًا';
  };

  const normalized = [
    ...simplePur.map(p => ({
      name: p.title || p.name || '',
      payment_method: p.payment_method || 'cash',
      sub_total: Number(p.sub_total || 0),
      vat_total: Number(p.vat_total || 0),
      grand_total: Number(p.grand_total || 0),
      at: p.purchase_at || p.created_at || null
    })),
    ...invPur.map(pi => {
      const sub = Number(pi.sub_total || 0);
      const priceMode = String(pi.price_mode || 'inclusive');
      const vat = priceMode === 'zero_vat' ? 0 : Number(pi.vat_total || 0);
      const grand = priceMode === 'zero_vat' ? sub : Number(pi.grand_total || 0);
      const m = String(pi.invoice_no || '').match(/^PI-\d{6}-(\d+)$/);
      const printed = m ? String(Number(m[1])) : (pi.invoice_no || '');
      return {
        name: printed ? `فاتورة شراء ${printed}` : 'فاتورة شراء',
        payment_method: pi.payment_method || 'cash',
        sub_total: sub,
        vat_total: vat,
        grand_total: grand,
        at: pi.invoice_at || pi.created_at || null
      };
    })
  ].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

  if (!normalized.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center">لا توجد مصروفات ضمن الفترة</td></tr>';
    setEl('expSumPre', 0); setEl('expSumVat', 0); setEl('expSumGrand', 0);
    return;
  }

  const rows = normalized.map(p => {
    const pre = Number(p.sub_total || 0);
    const vat = Number(p.vat_total || 0);
    const grand = Number(p.grand_total || 0);
    _expSumPre += pre; _expSumVat += vat; _expSumGrand += grand;

    return `<tr>
      <td>${p.name}</td>
      <td>${formatDate(p.at)}</td>
      <td>${labelPay(p.payment_method)}</td>
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

// ---------------------- ملخص الإجماليات ----------------------

function renderTotals() {
  // قيم المرتجعات قد تكون سالبة من قاعدة البيانات — نأخذ القيمة المطلقة للعرض والحسابات
  const absCnPre   = Math.abs(_cnSumPre);
  const absCnVat   = Math.abs(_cnSumVat);
  const absCnGrand = Math.abs(_cnSumGrand);

  const netSalesPre   = _invSumPre   - absCnPre;
  const netSalesVat   = _invSumVat   - absCnVat;
  const netSalesGrand = _invSumGrand - absCnGrand;

  const netPre   = netSalesPre   - _expSumPre;
  const netVat   = netSalesVat   - _expSumVat;
  const netGrand = netSalesGrand - _expSumGrand;

  setEl('sumInvPre2',   _invSumPre);
  setEl('sumInvVat2',   _invSumVat);
  setEl('sumInvGrand2', _invSumGrand);

  setEl('sumCnPre2',    absCnPre);
  setEl('sumCnVat2',    absCnVat);
  setEl('sumCnGrand2',  absCnGrand);

  setEl('sumNetSalesPre',   netSalesPre);
  setEl('sumNetSalesVat',   netSalesVat);
  setEl('sumNetSalesGrand', netSalesGrand);

  setEl('sumExpPre2',   _expSumPre);
  setEl('sumExpVat2',   _expSumVat);
  setEl('sumExpGrand2', _expSumGrand);

  setEl('sumNetPre',   netPre);
  setEl('sumNetVat',   netVat);
  setEl('sumNetGrand', netGrand);
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = fmt(val);
}

// ---------------------- تطبيق النطاق ----------------------

function initDefaultRange() {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const s = toStr(start), e = toStr(now);
  if (fromAtEl) fromAtEl.value = s.replace(' ', 'T').slice(0, 16);
  if (toAtEl) toAtEl.value = e.replace(' ', 'T').slice(0, 16);
}

(function wireRange() {
  const btn = document.getElementById('applyRangeBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      const s = fromInputToStr(fromAtEl);
      const e = fromInputToStr(toAtEl);
      if (!s || !e) { alert('يرجى تحديد الفترة (من وإلى)'); return; }
      loadRange(s, e);
    });
  }
})();

initDefaultRange();

// ---------------------- تصدير PDF ----------------------

async function exportZatcaPDF() {
  const periodText = rangeEl?.textContent || '';
  const fromStr = fromInputToStr(fromAtEl);
  const toStr2 = fromInputToStr(toAtEl);
  if (!fromStr || !toStr2) { alert('يرجى تحديد الفترة كاملة'); return; }

  const [resInv, resCN, resSimplePur, resInvPur] = await Promise.all([
    window.api.sales_list({ date_from: fromStr, date_to: toStr2, pageSize: 999999, page: 1 }),
    window.api.sales_list_credit_notes({ date_from: fromStr, date_to: toStr2, pageSize: 999999 }),
    window.api.purchases_list({ from_at: fromStr, to_at: toStr2 }),
    window.api.purchase_invoices_list({ from: fromStr, to: toStr2 })
  ]);

  const allInvoices = (resInv && resInv.ok) ? (resInv.items || []) : [];
  const salesInvoices = allInvoices.filter(s =>
    !(String(s.doc_type || '') === 'credit_note' || String(s.invoice_no || '').startsWith('CN-'))
  );
  let cnItems = (resCN && resCN.ok) ? (resCN.items || []) : [];
  if (!cnItems.length) {
    cnItems = allInvoices.filter(s =>
      String(s.doc_type || '') === 'credit_note' || String(s.invoice_no || '').startsWith('CN-')
    );
  }
  const simplePur = (resSimplePur && resSimplePur.ok) ? (resSimplePur.items || []) : [];
  const invPur = (resInvPur && resInvPur.ok) ? (resInvPur.items || []) : [];

  let sumInvPre = 0, sumInvVat = 0, sumInvGrand = 0;
  const invRows = salesInvoices.map(s => {
    const pre = Number(s.sub_total || 0);
    const vat = Number(s.vat_total || 0);
    const grand = Number(s.grand_total || 0);
    sumInvPre += pre; sumInvVat += vat; sumInvGrand += grand;
    const pm = String(s.payment_method || '').toLowerCase();
    const isUnpaid = pm === 'credit' && Number(s.amount_paid || 0) <= 0;
    const cust = s.customer_phone || s.customer_name || s.disp_customer_name || '';
    return `<tr style="${isUnpaid ? 'background:#fef2f2' : ''}">
      <td>${String(s.invoice_no || '').replace(/\s+/g, ' ').trim()}</td>
      <td>${formatDate(s.created_at)}</td>
      <td>${cust}</td>
      <td>${labelPaymentMethod(pm)}</td>
      <td>${isUnpaid ? 'غير مدفوعة' : 'مدفوعة'}</td>
      <td>${fmt(pre)}</td><td>${fmt(vat)}</td><td>${fmt(grand)}</td>
    </tr>`;
  }).join('');

  let sumCnPre = 0, sumCnVat = 0, sumCnGrand = 0;
  const cnRows = cnItems.map(s => {
    const pre   = Math.abs(Number(s.sub_total   || 0));
    const vat   = Math.abs(Number(s.vat_total   || 0));
    const grand = Math.abs(Number(s.grand_total || 0));
    sumCnPre += pre; sumCnVat += vat; sumCnGrand += grand;
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

  const labelPay2 = (m) => {
    const x = String(m || '').toLowerCase();
    if (x === 'network' || x === 'card') return 'شبكة';
    if (x === 'credit' || m === 'آجل' || m === 'اجل') return 'آجل';
    return 'نقدًا';
  };
  const normalizedPur = [
    ...simplePur.map(p => ({ name: p.title || p.name || '', payment_method: p.payment_method || 'cash', sub_total: Number(p.sub_total || 0), vat_total: Number(p.vat_total || 0), grand_total: Number(p.grand_total || 0), at: p.purchase_at || p.created_at })),
    ...invPur.map(pi => {
      const sub = Number(pi.sub_total || 0);
      const priceMode = String(pi.price_mode || 'inclusive');
      const vat = priceMode === 'zero_vat' ? 0 : Number(pi.vat_total || 0);
      const grand = priceMode === 'zero_vat' ? sub : Number(pi.grand_total || 0);
      const m2 = String(pi.invoice_no || '').match(/^PI-\d{6}-(\d+)$/);
      return { name: m2 ? `فاتورة شراء ${Number(m2[1])}` : 'فاتورة شراء', payment_method: pi.payment_method || 'cash', sub_total: sub, vat_total: vat, grand_total: grand, at: pi.invoice_at || pi.created_at };
    })
  ].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));

  let sumExpPre = 0, sumExpVat = 0, sumExpGrand = 0;
  const expRows = normalizedPur.map(p => {
    const pre = Number(p.sub_total || 0); const vat = Number(p.vat_total || 0); const grand = Number(p.grand_total || 0);
    sumExpPre += pre; sumExpVat += vat; sumExpGrand += grand;
    return `<tr><td>${p.name}</td><td>${formatDate(p.at)}</td><td>${labelPay2(p.payment_method)}</td><td>${fmt(pre)}</td><td>${fmt(vat)}</td><td>${fmt(grand)}</td></tr>`;
  }).join('');

  const absCnPre_pdf   = Math.abs(sumCnPre);
  const absCnVat_pdf   = Math.abs(sumCnVat);
  const absCnGrand_pdf = Math.abs(sumCnGrand);

  const netSalesPdf_Pre   = sumInvPre   - absCnPre_pdf;
  const netSalesPdf_Vat   = sumInvVat   - absCnVat_pdf;
  const netSalesPdf_Grand = sumInvGrand - absCnGrand_pdf;

  const netPdf_Pre   = netSalesPdf_Pre   - sumExpPre;
  const netPdf_Vat   = netSalesPdf_Vat   - sumExpVat;
  const netPdf_Grand = netSalesPdf_Grand - sumExpGrand;

  const thStyle = 'background:#eef2ff;color:#0b3daa;padding:8px;border:1px solid #e6eaf0;text-align:right;font-size:12px;';
  const tdStyle = 'padding:8px;border:1px solid #e6eaf0;text-align:right;font-size:12px;';
  const tfStyle = 'background:#f1f5f9;padding:8px;border:1px solid #000;border-top:2px solid #3b82f6;text-align:right;font-size:12px;font-weight:700;';

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
  <style>
    @font-face{font-family:'Cairo';src:url('../../../assets/fonts/Cairo-Bold.ttf') format('truetype');font-weight:700;}
    *{font-family:'Cairo',Arial,sans-serif;font-weight:700;box-sizing:border-box;}
    body{background:#fff;margin:0;padding:15px 20px;color:#0f172a;}
    .pdf-header{text-align:center;border-bottom:3px solid #3b82f6;padding-bottom:12px;margin-bottom:16px;}
    .pdf-title{font-size:24px;font-weight:700;color:#0f172a;margin:0 0 6px 0;}
    .pdf-period{font-size:13px;color:#64748b;}
    .section{border:1px solid #e6eaf0;border-radius:8px;padding:12px;margin:12px 0;page-break-inside:avoid;}
    h3{font-size:14px;margin:0 0 8px 0;color:#0f172a;}
    table{width:100%;border-collapse:collapse;margin:6px 0;}
    thead{display:table-header-group;}
    tr{page-break-inside:avoid;}
    .totals-section{background:#f8fafc;border:2px solid #3b82f6;border-radius:8px;padding:14px;margin:12px 0;}
    .totals-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
    .total-card{background:#fff;border:1px solid #e6eaf0;border-radius:6px;padding:10px;text-align:center;}
    .total-val{font-size:16px;font-weight:700;margin-bottom:3px;}
    .total-lbl{font-size:11px;color:#64748b;}
  </style></head><body>
  <div class="pdf-header">
    <div class="pdf-title">تقرير هيئة الزكاة والضريبة والجمارك</div>
    <div class="pdf-period">${periodText}</div>
  </div>

  <div class="section">
    <h3>الفواتير (مدفوعة وغير مدفوعة) ضمن الفترة — العدد: ${salesInvoices.length}</h3>
    <table>
      <thead><tr>
        <th style="${thStyle}">رقم الفاتورة</th>
        <th style="${thStyle}">التاريخ</th>
        <th style="${thStyle}">العميل</th>
        <th style="${thStyle}">طريقة الدفع</th>
        <th style="${thStyle}">الحالة</th>
        <th style="${thStyle}">قبل الضريبة</th>
        <th style="${thStyle}">الضريبة</th>
        <th style="${thStyle}">الإجمالي</th>
      </tr></thead>
      <tbody>${invRows || `<tr><td colspan="8" style="${tdStyle}text-align:center">لا توجد فواتير</td></tr>`}</tbody>
      <tfoot><tr>
        <th colspan="5" style="${tfStyle}">الإجمالي</th>
        <th style="${tfStyle}">${fmt(sumInvPre)}</th>
        <th style="${tfStyle}">${fmt(sumInvVat)}</th>
        <th style="${tfStyle}">${fmt(sumInvGrand)}</th>
      </tr></tfoot>
    </table>
  </div>

  <div class="section">
    <h3>الفواتير المرتجعة (إشعارات دائنة) — العدد: ${cnItems.length}</h3>
    <table>
      <thead><tr>
        <th style="${thStyle}">رقم الإشعار</th>
        <th style="${thStyle}">التاريخ</th>
        <th style="${thStyle}">العميل</th>
        <th style="${thStyle}">رقم الفاتورة الأصلية</th>
        <th style="${thStyle}">قبل الضريبة</th>
        <th style="${thStyle}">الضريبة</th>
        <th style="${thStyle}">الإجمالي</th>
      </tr></thead>
      <tbody>${cnRows || `<tr><td colspan="7" style="${tdStyle}text-align:center">لا توجد مرتجعات</td></tr>`}</tbody>
      <tfoot><tr>
        <th colspan="4" style="${tfStyle}">إجمالي المرتجعات</th>
        <th style="${tfStyle}">${fmt(sumCnPre)}</th>
        <th style="${tfStyle}">${fmt(sumCnVat)}</th>
        <th style="${tfStyle}">${fmt(sumCnGrand)}</th>
      </tr></tfoot>
    </table>
  </div>

  <div class="section">
    <h3>المصروفات ضمن الفترة — العدد: ${normalizedPur.length}</h3>
    <table>
      <thead><tr>
        <th style="${thStyle}">البيان</th>
        <th style="${thStyle}">التاريخ</th>
        <th style="${thStyle}">طريقة الدفع</th>
        <th style="${thStyle}">قبل الضريبة</th>
        <th style="${thStyle}">الضريبة</th>
        <th style="${thStyle}">الإجمالي</th>
      </tr></thead>
      <tbody>${expRows || `<tr><td colspan="6" style="${tdStyle}text-align:center">لا توجد مصروفات</td></tr>`}</tbody>
      <tfoot><tr>
        <th colspan="3" style="${tfStyle}">إجمالي المصروفات</th>
        <th style="${tfStyle}">${fmt(sumExpPre)}</th>
        <th style="${tfStyle}">${fmt(sumExpVat)}</th>
        <th style="${tfStyle}">${fmt(sumExpGrand)}</th>
      </tr></tfoot>
    </table>
  </div>

  <div class="totals-section">
    <h3 style="text-align:center;font-size:16px;margin:0 0 12px 0;">ملخص الإجماليات</h3>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr>
        <th style="${thStyle}font-size:13px;">البيان</th>
        <th style="${thStyle}font-size:13px;">قبل الضريبة</th>
        <th style="${thStyle}font-size:13px;">الضريبة</th>
        <th style="${thStyle}font-size:13px;">بعد الضريبة</th>
      </tr></thead>
      <tbody>
        <tr>
          <td style="${tdStyle}">المبيعات</td>
          <td style="${tdStyle}">${fmt(sumInvPre)}</td>
          <td style="${tdStyle}">${fmt(sumInvVat)}</td>
          <td style="${tdStyle}font-weight:700;">${fmt(sumInvGrand)}</td>
        </tr>
        <tr style="background:#fff7ed">
          <td style="${tdStyle}">ناقص: المرتجعات</td>
          <td style="${tdStyle}">${fmt(absCnPre_pdf)}</td>
          <td style="${tdStyle}">${fmt(absCnVat_pdf)}</td>
          <td style="${tdStyle}font-weight:700;">${fmt(absCnGrand_pdf)}</td>
        </tr>
        <tr style="background:#f0fdf4;font-weight:700;">
          <td style="${tdStyle}font-weight:700;">المبيعات بعد خصم المرتجعات</td>
          <td style="${tdStyle}font-weight:700;">${fmt(netSalesPdf_Pre)}</td>
          <td style="${tdStyle}font-weight:700;">${fmt(netSalesPdf_Vat)}</td>
          <td style="${tdStyle}font-weight:700;color:#16a34a;">${fmt(netSalesPdf_Grand)}</td>
        </tr>
        <tr style="background:#fffbeb">
          <td style="${tdStyle}">ناقص: المصروفات</td>
          <td style="${tdStyle}">${fmt(sumExpPre)}</td>
          <td style="${tdStyle}">${fmt(sumExpVat)}</td>
          <td style="${tdStyle}font-weight:700;">${fmt(sumExpGrand)}</td>
        </tr>
      </tbody>
      <tfoot><tr>
        <th style="${tfStyle}font-size:13px;">الإجمالي النهائي</th>
        <th style="${tfStyle}font-size:13px;">${fmt(netPdf_Pre)}</th>
        <th style="${tfStyle}font-size:13px;">${fmt(netPdf_Vat)}</th>
        <th style="${tfStyle}font-size:14px;color:#16a34a;">${fmt(netPdf_Grand)}</th>
      </tr></tfoot>
    </table>
  </div>
  </body></html>`;

  const period = periodText.replace(/[^0-9_\-–: ]+/g, '').replace(/\s+/g, ' ').trim();
  const safe = (period || '').replace(/[: ]/g, '_');
  const filename = `zatca-report-${safe || Date.now()}.pdf`;
  await window.api.pdf_export(html, { saveMode: 'auto', filename, pageSize: 'A4' });
}

// ---------------------- تصدير Excel ----------------------

async function exportZatcaExcel() {
  const lines = [];
  const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';

  if (rangeEl && rangeEl.textContent) {
    lines.push(esc('الفترة'), esc(rangeEl.textContent.trim()));
    lines.push('');
  }

  const addTable = (title, tbodyId) => {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const table = tbody.closest('table');
    if (!table) return;
    lines.push(esc(title));
    const ths = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    if (ths.length) lines.push(ths.map(esc).join(','));
    Array.from(table.querySelectorAll('tbody tr')).forEach(tr => {
      const tds = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
      if (tds.length) lines.push(tds.map(esc).join(','));
    });
    const footCells = Array.from(table.querySelectorAll('tfoot th')).map(th => th.textContent.trim());
    if (footCells.length) lines.push(footCells.map(esc).join(','));
    lines.push('');
  };

  addTable('الفواتير', 'invTbody');
  addTable('المرتجعات', 'cnTbody');
  addTable('المصروفات', 'expTbody');

  const netPre   = _invSumPre   - Math.abs(_cnSumPre)   - _expSumPre;
  const netVat   = _invSumVat   - Math.abs(_cnSumVat)   - _expSumVat;
  const netGrand = _invSumGrand - Math.abs(_cnSumGrand) - _expSumGrand;

  lines.push(esc('ملخص الإجماليات'));
  lines.push([esc('البيان'), esc('قبل الضريبة'), esc('الضريبة'), esc('بعد الضريبة')].join(','));
  const exAbsCnPre   = Math.abs(_cnSumPre);
  const exAbsCnVat   = Math.abs(_cnSumVat);
  const exAbsCnGrand = Math.abs(_cnSumGrand);
  const exNetSalesPre   = _invSumPre   - exAbsCnPre;
  const exNetSalesVat   = _invSumVat   - exAbsCnVat;
  const exNetSalesGrand = _invSumGrand - exAbsCnGrand;
  lines.push([esc('المبيعات'), esc(fmt(_invSumPre)), esc(fmt(_invSumVat)), esc(fmt(_invSumGrand))].join(','));
  lines.push([esc('ناقص: المرتجعات'), esc(fmt(exAbsCnPre)), esc(fmt(exAbsCnVat)), esc(fmt(exAbsCnGrand))].join(','));
  lines.push([esc('المبيعات بعد خصم المرتجعات'), esc(fmt(exNetSalesPre)), esc(fmt(exNetSalesVat)), esc(fmt(exNetSalesGrand))].join(','));
  lines.push([esc('ناقص: المصروفات'), esc(fmt(_expSumPre)), esc(fmt(_expSumVat)), esc(fmt(_expSumGrand))].join(','));
  lines.push([esc('الإجمالي النهائي'), esc(fmt(netPre)), esc(fmt(netVat)), esc(fmt(netGrand))].join(','));

  const period = (rangeEl?.textContent || '').replace(/[^0-9_\-–: ]+/g, '').replace(/\s+/g, ' ').trim();
  const filename = `zatca-report-${(period || '').replace(/[: ]/g, '_') || Date.now()}.csv`;
  await window.api.csv_export(lines.join('\n'), { saveMode: 'auto', filename });
}

// ---------------------- ربط أزرار التصدير ----------------------

(function attachExportHandlers() {
  let exporting = false;

  const btnPdf = document.getElementById('exportPdfBtn');
  if (btnPdf) {
    btnPdf.addEventListener('click', async () => {
      if (exporting) return; exporting = true; btnPdf.disabled = true;
      try { await exportZatcaPDF(); }
      catch (e) { console.error(e); alert('تعذر إنشاء PDF'); }
      finally { exporting = false; btnPdf.disabled = false; }
    });
  }

  const btnExcel = document.getElementById('exportExcelBtn');
  if (btnExcel) {
    btnExcel.addEventListener('click', async () => {
      if (exporting) return; exporting = true; btnExcel.disabled = true;
      try { await exportZatcaExcel(); }
      catch (e) { console.error(e); alert('تعذر إنشاء Excel'); }
      finally { exporting = false; btnExcel.disabled = false; }
    });
  }
})();
