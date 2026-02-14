// All invoices report (from/to)
// Displays all documents (invoices + credit notes) within the selected period with totals at the bottom

let __currentLang = 'ar';
const fmt = (n)=> Number(n||0).toFixed(2);
const rangeEl = document.getElementById('range');
const fromAtEl = document.getElementById('fromAt');
const toAtEl = document.getElementById('toAt');

function bindDatePicker(input, labelSelector){
  if(!input) return;
  const openPicker = ()=>{
    try{ input.showPicker(); }catch(_){ }
    try{ input.focus(); }catch(_){ }
  };
  input.addEventListener('click', openPicker);
  input.addEventListener('focus', openPicker);
  const label = labelSelector ? document.querySelector(labelSelector) : null;
  if(label){
    label.addEventListener('click', openPicker);
  }
}

bindDatePicker(fromAtEl, 'label[for="fromAt"]');
bindDatePicker(toAtEl, 'label[for="toAt"]');

// خريطة المستخدمين حسب المعرّف لعرض اسم متطابق
let __usersById = new Map();

function labelPaymentMethod(method){
  const isAr = __currentLang === 'ar';
  const m = String(method||'').toLowerCase();
  if(m==='cash') return isAr ? 'نقدًا' : 'Cash';
  if(m==='card' || m==='network') return isAr ? 'شبكة' : 'Card';
  if(m==='credit') return isAr ? 'آجل' : 'Credit';
  if(m==='tamara') return isAr ? 'تمارا' : 'Tamara';
  if(m==='tabby') return isAr ? 'تابي' : 'Tabby';
  if(m==='mixed') return isAr ? 'مختلط' : 'Mixed';
  return method||'';
}

function translateAllInvoicesUI(isAr){
  __currentLang = isAr ? 'ar' : 'en';
  const t = isAr ? {
    pageTitle: 'تقرير جميع الفواتير',
    backBtn: 'الرجوع',
    userLabel: 'المستخدم:',
    fromLabel: 'من:',
    toLabel: 'إلى:',
    applyBtn: 'تطبيق',
    exportPdfBtn: 'تصدير PDF',
    exportExcelBtn: 'تصدير Excel',
    printReportBtn: 'طباعة التقرير',
    sectionTitle: 'جميع الفواتير ضمن الفترة',
    number: 'رقم',
    docType: 'نوع المستند',
    user: 'المستخدم',
    customer: 'العميل',
    date: 'التاريخ',
    paymentMethod: 'طريقة الدفع',
    preVat: 'المبلغ قبل الضريبة',
    vat: 'الضريبة',
    total: 'الإجمالي',
    view: 'عرض',
    totals: 'الإجماليات',
    invoice: 'فاتورة',
    creditNote: 'إشعار دائن',
    noData: 'لا توجد مستندات ضمن الفترة',
    noPayData: 'لا توجد بيانات طرق الدفع ضمن الفترة',
    periodLabel: 'الفترة:',
    userFilterLabel: 'المستخدم:',
    allUsers: 'الكل',
    userPrefix: 'مستخدم #',
    showingText: 'عرض',
    ofText: 'من',
    invoicesText: 'فاتورة',
    noInvoices: 'لا توجد فواتير',
    prevBtn: 'السابق',
    nextBtn: 'التالي',
    pageText: 'صفحة',
    pdfTitle: 'تقرير جميع الفواتير',
    periodExcel: 'الفترة',
    totalsExcel: 'الإجماليات',
    pdfError: 'تعذر إنشاء PDF',
    excelError: 'تعذر إنشاء Excel',
    printError: 'تعذر الطباعة',
    selectPeriodAlert: 'يرجى تحديد الفترة كاملة',
    invoiceCount: 'عدد الفواتير:',
    paymentMethodsTotals: 'إجماليات طرق الدفع'
  } : {
    pageTitle: 'All invoices report',
    backBtn: 'Back',
    userLabel: 'User:',
    fromLabel: 'From:',
    toLabel: 'To:',
    applyBtn: 'Apply',
    exportPdfBtn: 'Export PDF',
    exportExcelBtn: 'Export Excel',
    printReportBtn: 'Print report',
    sectionTitle: 'All invoices within period',
    number: 'No.',
    docType: 'Document type',
    user: 'User',
    customer: 'Customer',
    date: 'Date',
    paymentMethod: 'Payment method',
    preVat: 'Amount before VAT',
    vat: 'VAT',
    total: 'Total',
    view: 'View',
    totals: 'Totals',
    invoice: 'Invoice',
    creditNote: 'Credit note',
    noData: 'No documents in period',
    noPayData: 'No payment method data in period',
    periodLabel: 'Period:',
    userFilterLabel: 'User:',
    allUsers: 'All',
    userPrefix: 'User #',
    showingText: 'Showing',
    ofText: 'of',
    invoicesText: 'invoices',
    noInvoices: 'No invoices',
    prevBtn: 'Previous',
    nextBtn: 'Next',
    pageText: 'Page',
    pdfTitle: 'All invoices report',
    periodExcel: 'Period',
    totalsExcel: 'Totals',
    pdfError: 'Failed to create PDF',
    excelError: 'Failed to create Excel',
    printError: 'Print failed',
    selectPeriodAlert: 'Please select complete period',
    invoiceCount: 'Invoice count:',
    paymentMethodsTotals: 'Payment methods totals'
  };
  
  try{
    const titleEl = document.querySelector('header .title');
    if(titleEl) titleEl.textContent = t.pageTitle;
    
    const btnBack = document.getElementById('btnBack');
    if(btnBack) btnBack.textContent = t.backBtn;
    
    const userLabel = document.querySelector('label[for="userSelect"]');
    if(userLabel) userLabel.textContent = t.userLabel;
    
    const fromLabel = document.querySelector('label[for="fromAt"]');
    if(fromLabel) fromLabel.textContent = t.fromLabel;
    
    const toLabel = document.querySelector('label[for="toAt"]');
    if(toLabel) toLabel.textContent = t.toLabel;
    
    const applyBtn = document.getElementById('applyRangeBtn');
    if(applyBtn) applyBtn.textContent = t.applyBtn;
    
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    if(exportPdfBtn) exportPdfBtn.textContent = t.exportPdfBtn;
    
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if(exportExcelBtn) exportExcelBtn.textContent = t.exportExcelBtn;
    
    const printReportBtn = document.getElementById('printReportBtn');
    if(printReportBtn) printReportBtn.textContent = t.printReportBtn;
    
    const sections = document.querySelectorAll('.section h3');
    sections.forEach((h3) => {
      const text = h3.textContent.trim();
      if(text.includes('جميع الفواتير') || text.includes('All invoices')) {
        h3.textContent = t.sectionTitle;
      } else if(text.includes('إجماليات طرق الدفع') || text.includes('Payment methods totals')) {
        h3.textContent = t.paymentMethodsTotals;
      }
    });
    
    const invTable = document.getElementById('invTbody');
    if(invTable){
      const table = invTable.closest('table');
      if(table){
        const headers = table.querySelectorAll('thead th');
        if(headers.length >= 10){
          headers[0].textContent = t.number;
          headers[1].textContent = t.docType;
          headers[2].textContent = t.user;
          headers[3].textContent = t.customer;
          headers[4].textContent = t.date;
          headers[5].textContent = t.paymentMethod;
          headers[6].textContent = t.preVat;
          headers[7].textContent = t.vat;
          headers[8].textContent = t.total;
          headers[9].textContent = t.view;
        }
        const footers = table.querySelectorAll('tfoot th');
        if(footers.length >= 4){
          footers[0].textContent = t.totals;
          const countSpan = footers[3]?.querySelector('.muted');
          if(countSpan) countSpan.textContent = t.invoiceCount;
        }
      }
    }
    
    window.__allInvoicesTranslations = t;
  }catch(_){}
}

(async function initAllInvoicesLocale(){
  try{
    const r = await window.api.app_get_locale();
    const lang = (r && r.lang) || 'ar';
    const isAr = lang === 'ar';
    __currentLang = isAr ? 'ar' : 'en';
    document.documentElement.lang = isAr ? 'ar' : 'en';
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    translateAllInvoicesUI(isAr);
  }catch(_){
    __currentLang = 'ar';
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    translateAllInvoicesUI(true);
  }
  try{
    window.api.app_on_locale_changed((L)=>{
      const isAr = L === 'ar';
      __currentLang = isAr ? 'ar' : 'en';
      document.documentElement.lang = isAr ? 'ar' : 'en';
      document.documentElement.dir = isAr ? 'rtl' : 'ltr';
      translateAllInvoicesUI(isAr);
      const fromStr = fromInputToStr(fromAtEl);
      const toStr = fromInputToStr(toAtEl);
      if(fromStr && toStr) loadRange(fromStr, toStr, currentPage);
    });
  }catch(_){}
})();

const btnBack = document.getElementById('btnBack');
if(btnBack){ btnBack.onclick = ()=>{ window.location.href = './index.html'; } }

async function exportAllInvoicesPDF() {
  const isAr = __currentLang === 'ar';
  const t = window.__allInvoicesTranslations || {};
  
  // Extract period text
  const periodText = rangeEl?.textContent || '';
  
  // Get date range from inputs
  const fromStr = fromInputToStr(fromAtEl);
  const toStrValue = fromInputToStr(toAtEl);
  
  if (!fromStr || !toStrValue) {
    alert(t.selectPeriodAlert || 'يرجى تحديد الفترة كاملة');
    return;
  }
  
  // Get user filter
  const userSel = document.getElementById('userSelect');
  const userId = userSel && userSel.value ? Number(userSel.value) : 0;
  
  // Fetch ALL invoices without pagination
  const payload = { 
    date_from: fromStr, 
    date_to: toStrValue, 
    pageSize: 999999,
    page: 1,
    ...(userId ? { user_id: userId } : {}) 
  };
  const res = await window.api.sales_list(payload);
  const items = (res && res.ok) ? (res.items || []) : [];
  
  if (items.length === 0) {
    alert(t.noInvoices || 'لا توجد فواتير');
    return;
  }
  
  // Build table headers (without "عرض" column)
  const headers = [
    t.number || 'رقم',
    t.docType || 'نوع المستند',
    t.user || 'المستخدم',
    t.customer || 'العميل',
    t.date || 'التاريخ',
    t.paymentMethod || 'طريقة الدفع',
    t.preVat || 'المبلغ قبل الضريبة',
    t.vat || 'الضريبة',
    t.total || 'الإجمالي'
  ];
  
  // Calculate totals
  let sumPre = 0, sumVat = 0, sumGrand = 0;
  const payTotalsMap = new Map();
  
  // Build table rows
  const rows = items.map(s => {
    const isCN = (String(s.doc_type || '') === 'credit_note' || String(s.invoice_no || '').startsWith('CN-'));
    const docType = isCN ? (t.creditNote || 'إشعار دائن') : (t.invoice || 'فاتورة');
    
    let created = s.created_at ? new Date(s.created_at) : null;
    if (!created || isNaN(created.getTime())) {
      try { created = new Date(String(s.created_at).replace(' ', 'T')); } catch (_) { created = new Date(); }
    }
    const dateStr = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).format(created);
    
    const custPhone = s.customer_phone || s.disp_customer_phone || '';
    const cust = custPhone || (s.customer_name || s.disp_customer_name || '');
    
    const pre = Number(s.sub_total || 0);
    const vat = Number(s.vat_total || 0);
    const grand = Number(s.grand_total || 0);
    
    sumPre += pre;
    sumVat += vat;
    sumGrand += grand;
    
    // Payment method totals
    const pm = String(s.payment_method || '').toLowerCase();
    const addAmt = (key, amount) => {
      if (!key) return;
      const k = (key === 'network' ? 'card' : key);
      const prev = Number(payTotalsMap.get(k) || 0);
      payTotalsMap.set(k, prev + Number(amount || 0) * (isCN ? -1 : 1));
    };
    
    if (pm === 'mixed') {
      const cashPart = Number(s.pay_cash_amount || 0);
      const cardPart = Number(s.pay_card_amount || 0);
      addAmt('cash', cashPart > 0 ? cashPart : (grand > 0 ? grand / 2 : 0));
      addAmt('card', cardPart > 0 ? cardPart : (grand > 0 ? grand / 2 : 0));
    } else if (pm === 'cash') {
      const settledCash = Number(s.settled_cash || 0);
      const cashPart = Number(s.pay_cash_amount || 0);
      addAmt('cash', settledCash > 0 ? settledCash : (cashPart > 0 ? cashPart : grand));
    } else if (pm === 'card' || pm === 'network' || pm === 'tamara' || pm === 'tabby') {
      const cardPart = Number(s.pay_card_amount || 0);
      addAmt(pm, cardPart > 0 ? cardPart : grand);
    } else if (pm) {
      addAmt(pm, grand);
    }
    
    const payLabel = labelPaymentMethod(pm);
    const uid = (s.created_by_user_id != null ? Number(s.created_by_user_id) : null);
    const userDisp = (uid != null && __usersById.get(uid)) || s.created_by_username || (uid != null ? ('#' + uid) : '');
    
    // Clean invoice number from any line breaks or extra spaces
    const invoiceNo = String(s.invoice_no || '').replace(/\s+/g, ' ').trim();
    
    return [
      invoiceNo,
      docType,
      userDisp,
      cust,
      dateStr,
      payLabel,
      fmt(pre),
      fmt(vat),
      fmt(grand)
    ];
  });
  
  // Build invoices table HTML (without footer - will be added separately)
  const invoicesTableHTML = `
    <div class="section">
      <h3>${t.sectionTitle || 'جميع الفواتير ضمن الفترة'}</h3>
      <table>
        <thead><tr>${headers.map((h, i) => `<th${i === 0 ? ' class="inv-no"' : ''}>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(row => `<tr>${row.map((cell, i) => `<td${i === 0 ? ' class="inv-no"' : ''}>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>
  `;
  
  // Build totals section (separate from table to appear only at end)
  const totalsHTML = `
    <div class="section totals-section">
      <h3>${t.totals || 'الإجماليات'}</h3>
      <table class="totals-table">
        <tbody>
          <tr>
            <th>${t.invoiceCount || 'عدد الفواتير'}</th>
            <td>${items.length}</td>
          </tr>
          <tr>
            <th>${t.preVat || 'المبلغ قبل الضريبة'}</th>
            <td>${fmt(sumPre)}</td>
          </tr>
          <tr>
            <th>${t.vat || 'الضريبة'}</th>
            <td>${fmt(sumVat)}</td>
          </tr>
          <tr>
            <th>${t.total || 'الإجمالي'}</th>
            <td>${fmt(sumGrand)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
  
  // Build payment totals HTML
  let paymentTotalsHTML = '';
  if (payTotalsMap.size > 0) {
    const entries = Array.from(payTotalsMap.entries()).filter(([k]) => k);
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    
    paymentTotalsHTML = `
      <div class="section">
        <h3>${t.paymentMethodsTotals || 'إجماليات طرق الدفع'}</h3>
        <div class="pay-totals">
          ${entries.map(([k, v]) => `
            <div class="pay-item">
              <div class="pay-label">${labelPaymentMethod(k)}</div>
              <div class="pay-value">${fmt(v)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  // Build minimal HTML document
  const html = `
    <!doctype html>
    <html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="utf-8">
        <style>
          @font-face {
            font-family: 'Cairo';
            src: url('../../../assets/fonts/Cairo-Regular.ttf') format('truetype');
            font-weight: 400;
            font-style: normal;
          }
          @font-face {
            font-family: 'Cairo';
            src: url('../../../assets/fonts/Cairo-SemiBold.ttf') format('truetype');
            font-weight: 600;
            font-style: normal;
          }
          @font-face {
            font-family: 'Cairo';
            src: url('../../../assets/fonts/Cairo-Bold.ttf') format('truetype');
            font-weight: 700;
            font-style: normal;
          }
          @font-face {
            font-family: 'Cairo';
            src: url('../../../assets/fonts/Cairo-ExtraBold.ttf') format('truetype');
            font-weight: 800;
            font-style: normal;
          }
          * {
            font-family: 'Cairo', 'Tajawal', 'Arial', sans-serif;
            font-weight: 700;
          }
          body {
            background: #fff;
            margin: 0;
            padding: 10px 20px;
            color: #0f172a;
          }
          .pdf-title-section {
            text-align: center;
            margin: 0 0 20px 0;
            padding: 10px 0 15px 0;
            border-bottom: 3px solid #3b82f6;
          }
          .pdf-main-title {
            font-size: 28px;
            font-weight: 700;
            color: #0f172a;
            margin: 0 0 12px 0;
          }
          .pdf-period {
            font-size: 15px;
            color: #64748b;
            font-weight: 700;
          }
          .section {
            background: #fff;
            border: 1px solid #e6eaf0;
            border-radius: 12px;
            padding: 16px;
            margin: 12px 0;
            page-break-inside: avoid;
          }
          .section:first-of-type {
            margin-top: 0;
          }
          h3 {
            color: #0f172a;
            font-size: 18px;
            margin: 0 0 12px 0;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0;
            table-layout: auto;
          }
          thead {
            display: table-header-group;
          }
          tr {
            page-break-inside: avoid;
          }
          th, td {
            padding: 10px;
            border: 1px solid #e6eaf0;
            text-align: right;
            font-size: 13px;
            word-wrap: break-word;
          }
          th {
            background: #eef2ff;
            color: #0b3daa;
            font-weight: 700;
          }
          .inv-no {
            white-space: nowrap !important;
            word-wrap: normal !important;
            word-break: keep-all !important;
            overflow-wrap: normal !important;
            text-overflow: clip !important;
            min-width: 100px !important;
            text-align: center !important;
          }
          td.inv-no {
            font-family: 'Courier New', monospace !important;
          }
          tfoot th {
            background: #f1f5f9;
            color: #0f172a;
            font-weight: 700;
            border-top: 2px solid #3b82f6;
          }
          td {
            color: #0f172a;
          }
          .pay-totals {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin: 10px 0;
          }
          .pay-item {
            background: #fff;
            border: 1px solid #e6eaf0;
            border-radius: 8px;
            padding: 12px;
            text-align: center;
          }
          .pay-value {
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 4px;
          }
          .pay-label {
            font-size: 12px;
            color: #64748b;
            font-weight: 700;
          }
          .totals-section {
            page-break-before: auto;
          }
          .totals-table {
            max-width: 500px;
            margin: 0 auto;
          }
          .totals-table th {
            background: #f1f5f9;
            text-align: right;
            width: 60%;
          }
          .totals-table td {
            background: #fff;
            text-align: left;
            width: 40%;
            font-size: 16px;
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <div class="pdf-title-section">
          <h1 class="pdf-main-title">${t.pdfTitle || 'تقرير جميع الفواتير'}</h1>
          <div class="pdf-period">${periodText}</div>
        </div>
        ${invoicesTableHTML}
        ${totalsHTML}
        ${paymentTotalsHTML}
      </body>
    </html>
  `;
  
  const period = periodText ? periodText.replace(/[^0-9_\-–: ]+/g,'').replace(/\s+/g,' ').trim() : '';
  const safe = (period||'').replace(/[: ]/g,'_');
  const filename = `all-invoices-${safe||Date.now()}.pdf`;
  await window.api.pdf_export(html, { saveMode:'auto', filename, pageSize:'A4' });
}

(function attachExportHandlers(){
  let exporting = false;
  const btnPdf = document.getElementById('exportPdfBtn');
  if(btnPdf){
    btnPdf.addEventListener('click', async () => {
      if(exporting) return; exporting = true; btnPdf.disabled = true;
      try{
        await exportAllInvoicesPDF();
      }catch(e){ 
        console.error(e);
        const t = window.__allInvoicesTranslations || {};
        alert(t.pdfError || 'تعذر إنشاء PDF');
      }
      finally{ exporting = false; btnPdf.disabled = false; }
    });
  }
  const btnExcel = document.getElementById('exportExcelBtn');
  if(btnExcel){
    btnExcel.addEventListener('click', async () => {
      if(exporting) return; exporting = true; btnExcel.disabled = true;
      try{
        const lines = [];
        const esc = (v)=> ('"'+String(v??'').replace(/"/g,'""')+'"');
        const t = window.__allInvoicesTranslations || {};
        const tableElem = document.querySelector('tbody#invTbody')?.closest('table');
        if(rangeEl && rangeEl.textContent){ 
          lines.push(esc(t.periodExcel || 'الفترة'), esc(rangeEl.textContent.trim())); 
          lines.push(''); 
        }
        if(tableElem){
          const ths = Array.from(tableElem.querySelectorAll('thead th')).map(th=>th.textContent.trim());
          if(ths.length) lines.push(ths.map(esc).join(','));
          Array.from(tableElem.querySelectorAll('tbody tr')).forEach(tr=>{
            const tds = Array.from(tr.querySelectorAll('td')).map(td=>td.textContent.trim());
            if(tds.length) lines.push(tds.map(esc).join(','));
          });
          // footer
          const sumPre = document.getElementById('sumPre')?.textContent || '0.00';
          const sumVat = document.getElementById('sumVat')?.textContent || '0.00';
          const sumGrand = document.getElementById('sumGrand')?.textContent || '0.00';
          lines.push('');
          lines.push([esc(t.totalsExcel || 'الإجماليات'), '', '', '', '', esc(sumPre), esc(sumVat), esc(sumGrand)].join(','));
        }
        const csv = lines.join('\n');
        const period = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.replace(/[^0-9_\-–: ]+/g,'').replace(/\s+/g,' ').trim() : '';
        const filename = `all-invoices-${(period||'').replace(/[: ]/g,'_')||Date.now()}.csv`;
        await window.api.csv_export(csv, { saveMode:'auto', filename });
      }catch(e){ 
        console.error(e);
        const t = window.__allInvoicesTranslations || {};
        alert(t.excelError || 'تعذر إنشاء Excel');
      }
      finally{ exporting = false; btnExcel.disabled = false; }
    });
  }

  // Print report (thermal 80mm x 297mm)
  const btnPrint = document.getElementById('printReportBtn');
  if(btnPrint){
    btnPrint.addEventListener('click', async ()=>{
      try{
        btnPrint.disabled = true;
        // Ensure settings-based margins are applied before snapshot
        try{ if(window.applyPrintMarginsFromSettings) await window.applyPrintMarginsFromSettings(); }catch(_){ }
        // Prepare a clean HTML snapshot (remove export buttons/toolbars)
        const clone = document.documentElement.cloneNode(true);
        // Remove toolbar actions and range inputs from print version
        try{
          const toolbar = clone.querySelector('.range-actions');
          if(toolbar){ toolbar.parentNode.removeChild(toolbar); }
          // Remove range inputs (من والى وزر تطبيق) from print version
          // لكن نبقي نص الفترة المحددة (#range) ليظهر في التقرير المطبوع
          const rangeInputs = clone.querySelector('.range-inputs');
          if(rangeInputs){ rangeInputs.parentNode.removeChild(rangeInputs); }
          // Remove entire header to avoid any top spacing
          const hdr = clone.querySelector('header');
          if(hdr && hdr.parentNode){ hdr.parentNode.removeChild(hdr); }
        }catch(_){ }
        // Remove collapsed details sections (only show expanded sections)
        try{
          const allDetails = clone.querySelectorAll('details');
          allDetails.forEach(details => {
            if(!details.hasAttribute('open')){
              const section = details.closest('.section');
              if(section && section.parentNode){
                section.parentNode.removeChild(section);
              }
            }
          });
        }catch(_){ }
        // Remove non-print action columns ("عرض") to save width for content
        try{
          const removeLastCol = (tbodyId) => {
            const tb = clone.getElementById(tbodyId);
            if(!tb) return;
            const table = tb.closest('table');
            if(!table) return;
            const headRow = table.querySelector('thead tr');
            if(headRow && headRow.lastElementChild){ headRow.removeChild(headRow.lastElementChild); }
            Array.from(tb.querySelectorAll('tr')).forEach(tr => {
              try{ tr.lastElementChild && tr.removeChild(tr.lastElementChild); }catch(_){ }
            });
            // Also remove from tfoot if exists
            const tfootRow = table.querySelector('tfoot tr');
            if(tfootRow && tfootRow.lastElementChild){ tfootRow.removeChild(tfootRow.lastElementChild); }
          };
          removeLastCol('invTbody');
        }catch(_){ }

        // Physically remove specific columns for print-only (2,6,7) to avoid affecting PDF/Excel
        try{
          const tb = clone.getElementById('invTbody');
          if(tb){
            const table = tb.closest('table');
            if(table){
              const removeCol = (idx)=>{
                // remove header cell at index (1-based nth-child)
                try{ const htr = table.querySelector('thead tr'); const th = htr?.querySelector(`th:nth-child(${idx})`); th && th.remove(); }catch(_){ }
                // remove each row cell
                Array.from(tb.querySelectorAll('tr')).forEach(tr=>{
                  try{ const td = tr.querySelector(`td:nth-child(${idx})`); td && td.remove(); }catch(_){ }
                });
                // remove from footer if exists
                try{ const ftr = table.querySelector('tfoot tr'); const fth = ftr?.querySelector(`th:nth-child(${idx})`); fth && fth.remove(); }catch(_){ }
              };
              // Remove only document type (2) and ensure last action col is gone
              removeCol(9); // already removed elsewhere (عرض) safety
              removeCol(2); // نوع المستند
            }
          }
        }catch(_){ }

        // Normalize footer to reflect visible columns after hiding doc type only
        try{
          const tb2 = clone.getElementById('invTbody');
          const table2 = tb2?.closest('table');
          if(table2){
            table2.classList.add('tbl-inv');
            const ftrRow = table2.querySelector('tfoot tr');
            if(ftrRow){
              const t = window.__allInvoicesTranslations || {};
              const sumPreText = (ftrRow.querySelector('#sumPre')?.textContent || '0.00');
              const sumVatText = (ftrRow.querySelector('#sumVat')?.textContent || '0.00');
              const sumGrandText = (ftrRow.querySelector('#sumGrand')?.textContent || '0.00');
              ftrRow.innerHTML = `<th colspan="4">${t.totals || 'الإجماليات'}</th><th id="sumPre">${sumPreText}</th><th id=\"sumVat\">${sumVatText}</th><th id=\"sumGrand\">${sumGrandText}</th>`;
            }
          }
        }catch(_){ }

        // Add print styles for 80mm width
        const style = document.createElement('style');
        style.textContent = `
          @page { margin: 0; }
          html, body{ width:80mm; max-width:80mm; margin:0; padding:0; }
          *{ box-sizing: border-box; }
          body, .container, .section:first-child{ margin-top:0 !important; padding-top:0 !important; }
          /* Use Settings-based margins for thermal */
          .container{ width:80mm; max-width:80mm; margin:0; padding-left: var(--m-left); padding-right: var(--m-right); padding-top:0; padding-bottom:4px; overflow:hidden; }
          .container > *:first-child{ margin-top:0 !important; }
          .range-bar{ margin-top:0 !important; }
          #range{ display:block !important; margin:8px 0 !important; font-size:11px !important; font-weight:bold !important; }
          div[style*="overflow:auto"]{ overflow: visible !important; }
          table{ width:100%; max-width:100%; border-collapse:collapse; table-layout: fixed; font-size:9px; line-height:1.2; }
          th,td{ padding:2px; word-break: normal; overflow-wrap: normal; white-space: normal; }
          th{ background:#eef2ff; color:#0b3daa; border-bottom:2px solid #000; font-size:8.5px; }
          .section{ margin:5px 0; padding:5px; border:1px solid #e5e7eb; }

          /* شبكة للطباعة (مثل الملخص التفصيلي) */
          table{ border:2px solid #000; }
          table th, table td{ border:1px solid #000; }
          tfoot th{ border-top:2px solid #000; }

          /* عرض أعمدة جدول جميع الفواتير (بعد إخفاء عمود نوع المستند فقط): رقم | العميل | التاريخ | طريقة الدفع | قبل الضريبة | الضريبة | الإجمالي */
          .tbl-inv th:nth-child(1), .tbl-inv td:nth-child(1){ width:12%; }
          .tbl-inv th:nth-child(2), .tbl-inv td:nth-child(2){ width:24%; }
          .tbl-inv th:nth-child(3), .tbl-inv td:nth-child(3){ width:22%; font-size:8px; }
          .tbl-inv th:nth-child(4), .tbl-inv td:nth-child(4){ width:12%; font-size:8px; }
          .tbl-inv th:nth-child(5), .tbl-inv td:nth-child(5){ width:10%; }
          .tbl-inv th:nth-child(6), .tbl-inv td:nth-child(6){ width:10%; }
          .tbl-inv th:nth-child(7), .tbl-inv td:nth-child(7){ width:10%; }
          
          /* ملاحظة: تم توسيع عمود التاريخ لتجنّب خروج التاريخ من الخلية */
          
          #payTotals{ display:block !important; }
          #payTotals > div{ margin:2px 0; padding:3px; border:1px solid #ccc; font-size:9px; }
        `;
        clone.querySelector('head')?.appendChild(style);
        
        // Ensure period info is visible and properly formatted in print
        try{
          const r = clone.getElementById('range');
          if(r && r.textContent && r.textContent.trim()){
            const t = window.__allInvoicesTranslations || {};
            const text = r.textContent.trim();
            const periodPattern = new RegExp(`(${t.periodLabel || 'الفترة:'}|Period:)\\s*(.+?)\\s*[—–-]\\s*(.+?)(?:\\s*[—–-]\\s*(.+))?$`);
            const m = text.match(periodPattern);
            if(m){
              const fromText = m[2]?.trim() || '';
              const toText = m[3]?.trim() || '';
              const userInfo = m[4] ? `<br>${m[4].trim()}` : '';
              r.innerHTML = `${t.periodLabel || 'الفترة:'}<br>${t.fromLabel || 'من:'} ${fromText}<br>${t.toLabel || 'إلى:'} ${toText}${userInfo}`;
            } else {
              r.innerHTML = text;
            }
            r.style.display = 'block';
            r.style.marginBottom = '10px';
            r.style.fontSize = '11px';
            r.style.fontWeight = 'bold';
          }
        }catch(e){ console.error('Range processing error:', e); }

        const html = '<!doctype html>' + clone.outerHTML;
        await window.api.print_html(html, {
          silent: true,
          pageSize: { width: 80000, height: 297000 },
          margins: { marginType: 'none' },
          printBackground: true,
        });
      }catch(e){ 
        console.error(e);
        const t = window.__allInvoicesTranslations || {};
        alert(t.printError || 'تعذر الطباعة');
      }
      finally{ btnPrint.disabled = false; }
    });
  }
})();

function fromInputToStr(input){
  const v = (input?.value||'').trim();
  return v ? v.replace('T',' ') + ':00' : '';
}
function toStr(d){
  const pad2 = (v)=> String(v).padStart(2,'0');
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`;
}

let currentPage = 1;
const PAGE_SIZE = 100;

async function loadRange(startStr, endStr, page = 1){
  currentPage = page;
  const t = window.__allInvoicesTranslations || {};
  const userSel = document.getElementById('userSelect');
  const userId = userSel && userSel.value ? Number(userSel.value) : 0;
  const userText = (userSel && userSel.options && userSel.selectedIndex >= 0) ? userSel.options[userSel.selectedIndex].text : '';
  const periodLabel = userId ? `${t.periodLabel || 'الفترة:'} ${startStr} — ${endStr} — ${t.userFilterLabel || 'المستخدم:'} ${userText}` : `${t.periodLabel || 'الفترة:'} ${startStr} — ${endStr}`;
  if(rangeEl){ rangeEl.textContent = periodLabel; }
  try{
    const payload = { date_from: startStr, date_to: endStr, pageSize: PAGE_SIZE, page: currentPage, ...(userId ? { user_id: userId } : {}) };
    const res = await window.api.sales_list(payload);
    const items = (res && res.ok) ? (res.items||[]) : [];

    const invTbody = document.getElementById('invTbody');
    const invCount = document.getElementById('invCount');

    let sumPre = 0, sumVat = 0, sumGrand = 0;
    const payTotals = new Map(); // key: normalized method, value: total grand

    const rows = items.map(s=>{
      const isCN = (String(s.doc_type||'') === 'credit_note' || String(s.invoice_no||'').startsWith('CN-'));
      const docType = isCN ? (t.creditNote || 'إشعار دائن') : (t.invoice || 'فاتورة');
      let created = s.created_at ? new Date(s.created_at) : null;
      if(!created || isNaN(created.getTime())){ try{ created = new Date(String(s.created_at).replace(' ', 'T')); }catch(_){ created = new Date(); } }
      const dateStr = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:true}).format(created);
      // split date/time for print: wrap into two spans we can stack in print
      const [datePart, timePart] = (function(){
        try{
          const d = new Intl.DateTimeFormat('en-GB', {year:'numeric', month:'2-digit', day:'2-digit'}).format(created);
          const t = new Intl.DateTimeFormat('en-GB', {hour:'2-digit', minute:'2-digit', hour12:true}).format(created);
          return [d, t];
        }catch(_){
          const m = String(dateStr).split(',');
          if(m.length>=2){ return [m[0].trim(), m.slice(1).join(',').trim()]; }
          return [String(dateStr||''), ''];
        }
      })();
      const custPhone = s.customer_phone || s.disp_customer_phone || '';
      const cust = custPhone || (s.customer_name || s.disp_customer_name || '');
      const pre = Number(s.sub_total||0);
      const vat = Number(s.vat_total||0);
      const grand = Number(s.grand_total||0);
      sumPre += pre; sumVat += vat; sumGrand += grand;
      const pm = String(s.payment_method || '').toLowerCase();
      // accumulate totals by payment method with mixed split
      const addAmt = (key, amount)=>{
        if(!key) return;
        const k = (key==='network' ? 'card' : key);
        const prev = Number(payTotals.get(k)||0);
        payTotals.set(k, prev + Number(amount||0) * (isCN ? -1 : 1));
      };
      if(pm==='mixed'){
        const cashPart = Number(s.pay_cash_amount || 0);
        const cardPart = Number(s.pay_card_amount || 0);
        addAmt('cash', cashPart>0 ? cashPart : (grand>0 ? grand/2 : 0));
        addAmt('card', cardPart>0 ? cardPart : (grand>0 ? grand/2 : 0));
      } else if(pm==='cash'){
        const settledCash = Number(s.settled_cash || 0);
        const cashPart = Number(s.pay_cash_amount || 0);
        addAmt('cash', settledCash>0 ? settledCash : (cashPart>0 ? cashPart : grand));
      } else if(pm==='card' || pm==='network' || pm==='tamara' || pm==='tabby'){
        const cardPart = Number(s.pay_card_amount || 0);
        addAmt(pm, cardPart>0 ? cardPart : grand);
      } else if(pm){
        addAmt(pm, grand);
      }
      const payLabel = labelPaymentMethod(pm);
      const pmLower = pm;
      const settledCash = Number(s.settled_cash || 0);
      const payCashPart = Number(s.pay_cash_amount || 0);
      const cashParam = (pmLower==='cash') ? (settledCash>0 ? settledCash : (payCashPart>0 ? payCashPart : Number(s.grand_total||0))) : 0;
      const attrs = [`data-view=\"${s.id}\"`, `data-type=\"${isCN?'credit':'invoice'}\"`, `data-pay=\"${pmLower}\"`];
      if(cashParam){ attrs.push(`data-cash=\"${cashParam}\"`); }
      if(isCN){
        const baseId = (s.ref_base_sale_id != null) ? String(s.ref_base_sale_id) : '';
        const baseNo = (s.ref_base_invoice_no != null) ? String(s.ref_base_invoice_no) : '';
        if(baseId) attrs.push(`data-base=\"${baseId}\"`);
        if(baseNo) attrs.push(`data-base-no=\"${baseNo}\"`);
      }
      const viewBtn = `<button class=\"btn\" ${attrs.join(' ')}>${t.view || 'عرض'}</button>`;
      // اعرض اسم المستخدم من الخريطة حسب المعرف لضمان التطابق مع الفلتر
      const uid = (s.created_by_user_id != null ? Number(s.created_by_user_id) : null);
      const userDisp = (uid!=null && __usersById.get(uid)) || s.created_by_username || (uid!=null ? ('#'+uid) : '');
      return `<tr><td class=\"num\">${s.invoice_no||''}</td><td>${docType}</td><td>${userDisp}</td><td dir=\"ltr\" style=\"text-align:left\">${cust}</td><td class=\"num date-cell\"><span class=\"date-part\">${datePart}</span><span class=\"time-part\">${timePart}</span></td><td>${payLabel}</td><td class=\"num\">${fmt(pre)}</td><td class=\"num\">${fmt(vat)}</td><td class=\"num\">${fmt(grand)}</td><td>${viewBtn}</td></tr>`;
    }).join('');

    if(invTbody){ invTbody.innerHTML = rows || `<tr><td colspan="10" class="muted">${t.noData || 'لا توجد مستندات ضمن الفترة'}</td></tr>`; }
    if(invCount){ invCount.textContent = String(items.length||0); }
    const set = (id, v)=>{ const el = document.getElementById(id); if(!el) return; el.textContent = (id==='sumCount') ? String(v) : fmt(v); };
    set('sumPre', sumPre);
    set('sumVat', sumVat);
    set('sumGrand', sumGrand);
    set('sumCount', items.length||0);

    const total = (res && res.total != null) ? res.total : items.length;
    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
    updatePagination(currentPage, totalPages, total, startStr, endStr);

    // render payment totals
    try{
      const container = document.getElementById('payTotals');
      if(container){
        const entries = Array.from(payTotals.entries()).filter(([k])=>k);
        entries.sort((a,b)=> a[0].localeCompare(b[0]));
        container.innerHTML = entries.map(([k,v])=>{
          const ttl = Number(v||0);
          return `<div style="border:1px solid var(--border); border-radius:10px; padding:14px; background:#fff">
            <div class="muted" style="font-size:15px; margin-bottom:8px">${labelPaymentMethod(k)}</div>
            <div style="font-weight:700; font-size:22px">${fmt(ttl)}</div>
          </div>`;
        }).join('') || `<div class="muted">${t.noPayData || 'لا توجد بيانات طرق الدفع ضمن الفترة'}</div>`;
      }
    }catch(_){ }

    // فتح عرض الطباعة
    try{
      document.querySelectorAll('button[data-view]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = Number(btn.getAttribute('data-view'));
          const type = btn.getAttribute('data-type');
          // Honor default_print_format from settings
          let __defPrintFormat = 'thermal';
          try{ const r = await window.api.settings_get(); if(r && r.ok && r.item){ __defPrintFormat = (r.item.default_print_format === 'a4') ? 'a4' : 'thermal'; } }catch(_){ }
          const page = (__defPrintFormat === 'a4') ? '../sales/print-a4.html' : '../sales/print.html';
          const pay = btn.getAttribute('data-pay') || '';
          const cash = btn.getAttribute('data-cash') || '';
          // إضافة refresh=1 لضمان تحميل البيانات المحدثة وعرض تاريخ الدفع
          const qsObj = { id: String(id), ...(pay?{pay}:{}) , ...(cash?{cash}:{}), refresh: '1' };
          if(type==='credit'){
            const base = btn.getAttribute('data-base') || '';
            const baseNo = btn.getAttribute('data-base-no') || '';
            if(base) qsObj.base = base;
            if(baseNo) qsObj.base_no = baseNo;
          }
          // مرّر اسم مدخل الفاتورة حسب المعرف لضمان التطابق مع الفلتر
          try{
            const r = await window.api.sales_get(id);
            const sale = (r && r.ok) ? (r.sale || {}) : {};
            const uid = (sale.created_by_user_id != null ? Number(sale.created_by_user_id) : null);
            const cashier = (uid!=null && __usersById.get(uid)) || sale.created_by_username || '';
            if(cashier){ qsObj.cashier = cashier; }
          }catch(_){ /* ignore */ }
          const qs = new URLSearchParams(qsObj);
          const w = (__defPrintFormat === 'a4') ? 900 : 500;
          const h = (__defPrintFormat === 'a4') ? 1000 : 700;
          const url = `${page}?${qs.toString()}`;
          window.open(url, 'PRINT_VIEW', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
        });
      });
    }catch(_){ }
  }catch(e){ console.error(e); }
}

function updatePagination(page, totalPages, totalRecords, startStr, endStr){
  const t = window.__allInvoicesTranslations || {};
  let paginationEl = document.getElementById('paginationControls');
  if(!paginationEl){
    paginationEl = document.createElement('div');
    paginationEl.id = 'paginationControls';
    paginationEl.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin:16px 0; padding:12px; background:var(--card); border:1px solid var(--border); border-radius:8px; flex-wrap:wrap; gap:12px';
    const section = document.querySelector('.section');
    if(section){ section.parentNode.insertBefore(paginationEl, section.nextSibling); }
  }
  const start = ((page - 1) * PAGE_SIZE) + 1;
  const end = Math.min(page * PAGE_SIZE, totalRecords);
  const infoText = totalRecords > 0 ? `${t.showingText || 'عرض'} ${start} - ${end} ${t.ofText || 'من'} ${totalRecords} ${t.invoicesText || 'فاتورة'}` : (t.noInvoices || 'لا توجد فواتير');
  const prevDisabled = page <= 1 ? 'disabled' : '';
  const nextDisabled = page >= totalPages ? 'disabled' : '';
  paginationEl.innerHTML = `
    <div style="font-weight:700; color:var(--text)">${infoText}</div>
    <div style="display:flex; gap:8px; align-items:center">
      <button id="prevPageBtn" class="btn" ${prevDisabled} style="${prevDisabled?'opacity:0.5;cursor:not-allowed':''}">${t.prevBtn || 'السابق'}</button>
      <span style="font-weight:700; color:var(--text)">${t.pageText || 'صفحة'} ${page} ${t.ofText || 'من'} ${totalPages}</span>
      <button id="nextPageBtn" class="btn" ${nextDisabled} style="${nextDisabled?'opacity:0.5;cursor:not-allowed':''}">${t.nextBtn || 'التالي'}</button>
    </div>
  `;
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  if(prevBtn && !prevDisabled){ prevBtn.onclick = ()=> loadRange(startStr, endStr, page - 1); }
  if(nextBtn && !nextDisabled){ nextBtn.onclick = ()=> loadRange(startStr, endStr, page + 1); }
}

function initDefaultRange(){
  const now = new Date();
  const start = new Date(now); start.setHours(0,0,0,0);
  const pad2 = (v)=> String(v).padStart(2,'0');
  const toLocal = (d)=> `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if(fromAtEl) fromAtEl.value = toLocal(start);
  if(toAtEl) toAtEl.value = toLocal(now);
}

async function applyRange(){
  const s = fromInputToStr(fromAtEl);
  const e = fromInputToStr(toAtEl);
  if(!s || !e){ 
    const t = window.__allInvoicesTranslations || {};
    alert(t.selectPeriodAlert || 'يرجى تحديد الفترة كاملة'); 
    return; 
  }
  await loadRange(s, e, 1);
}

// Populate users in selector and users map; re-run when changed
async function initUsers(){
  const sel = document.getElementById('userSelect');
  if(!sel) return;
  try{
    const t = window.__allInvoicesTranslations || {};
    // fetch users
    const res = await window.api.users_list();
    const list = (res && res.ok) ? (res.items||[]) : [];
    // build users map for display by id
    __usersById = new Map(list.map(u => [Number(u.id), (u.username || u.name || ((t.userPrefix || 'مستخدم #') + u.id))]));
    // reset and add "الكل"
    sel.innerHTML = '';
    const optAll = document.createElement('option');
    optAll.value = '';
    optAll.textContent = t.allUsers || 'الكل';
    sel.appendChild(optAll);
    // add users by id to selector
    list.forEach(u => {
      const opt = document.createElement('option');
      opt.value = String(u.id);
      opt.textContent = __usersById.get(Number(u.id)) || ((t.userPrefix || 'مستخدم #') + u.id);
      sel.appendChild(opt);
    });
    // لا تقم بتحميل النتائج عند تغيير المستخدم؛ انتظر زر "تطبيق"
    sel.addEventListener('change', ()=>{/* intentional no-op until Apply is pressed */});
  }catch(e){ console.error('Failed to load users', e); }
}

const applyBtn = document.getElementById('applyRangeBtn');
if(applyBtn){ applyBtn.addEventListener('click', applyRange); }

// init
initDefaultRange();
initUsers();
// انتظر المستخدم يضغط تطبيق