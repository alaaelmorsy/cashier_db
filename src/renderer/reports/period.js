// Period report screen logic (from/to with datetime)
// Reuses the daily report logic but uses selected date-time range

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

function translatePeriodUI(isAr){
  __currentLang = isAr ? 'ar' : 'en';
  const t = isAr ? {
    pageTitle: 'تقرير الفترة',
    backBtn: 'الرجوع',
    fromLabel: 'من:',
    toLabel: 'إلى:',
    applyBtn: 'تطبيق',
    exportPdfBtn: 'تصدير PDF',
    exportExcelBtn: 'تصدير Excel',
    printReportBtn: 'طباعة التقرير',
    detailedSummary: 'الملخص التفصيلي',
    description: 'البيان',
    preVat: 'قبل الضريبة',
    vat: 'الضريبة',
    afterVat: 'بعد الضريبة',
    sales: 'المبيعات',
    discounts: 'الخصومات',
    salesAfterDiscount: 'المبيعات بعد الخصم',
    creditNotes: 'إشعارات الدائن (المرتجعات)',
    totalSalesAfterDiscountReturns: 'إجمالي المبيعات بعد الخصم بعد المرتجعات',
    purchases: 'المصروفات',
    net: 'الصافي',
    profitability: 'الربحية',
    totalCostPrice: 'إجمالي بسعر الشراء (شامل الضريبة)',
    totalSalePrice: 'إجمالي بسعر البيع (شامل الضريبة)',
    netProfit: 'صافي الربح (شامل الضريبة)',
    paymentMethods: 'طرق الدفع',
    method: 'الطريقة',
    total: 'الإجمالي',
    grandTotal: 'الإجمالي الكلي',
    soldProducts: 'المنتجات المباعة',
    product: 'المنتج',
    quantity: 'الكمية',
    purchasesDetail: 'المصروفات',
    statement: 'البيان',
    date: 'التاريخ',
    notes: 'ملاحظات',
    totals: 'الإجماليات',
    invoices: 'الفواتير',
    invoicesNote: 'تشمل الفواتير غير الدائنة فقط ضمن الفترة.',
    number: 'رقم',
    customer: 'العميل',
    paymentMethod: 'طريقة الدفع',
    view: 'عرض',
    returns: 'مرتجع/إشعارات دائنة',
    creditNoteNumber: 'رقم الإشعار',
    value: 'القيمة'
  } : {
    pageTitle: 'Period report',
    backBtn: 'Back',
    fromLabel: 'From:',
    toLabel: 'To:',
    applyBtn: 'Apply',
    exportPdfBtn: 'Export PDF',
    exportExcelBtn: 'Export Excel',
    printReportBtn: 'Print report',
    detailedSummary: 'Detailed summary',
    description: 'Description',
    preVat: 'Pre-VAT',
    vat: 'VAT',
    afterVat: 'After VAT',
    sales: 'Sales',
    discounts: 'Discounts',
    salesAfterDiscount: 'Sales after discount',
    creditNotes: 'Credit notes (returns)',
    totalSalesAfterDiscountReturns: 'Total sales after discount and returns',
    purchases: 'Purchases',
    net: 'Net',
    profitability: 'Profitability',
    totalCostPrice: 'Total cost price (incl. VAT)',
    totalSalePrice: 'Total sale price (incl. VAT)',
    netProfit: 'Net profit (incl. VAT)',
    paymentMethods: 'Payment methods',
    method: 'Method',
    total: 'Total',
    grandTotal: 'Grand total',
    soldProducts: 'Sold products',
    product: 'Product',
    quantity: 'Quantity',
    purchasesDetail: 'Purchases',
    statement: 'Description',
    date: 'Date',
    notes: 'Notes',
    totals: 'Totals',
    invoices: 'Invoices',
    invoicesNote: 'Includes non-credit invoices only within the period.',
    number: 'No.',
    customer: 'Customer',
    paymentMethod: 'Payment method',
    view: 'View',
    returns: 'Returns/Credit notes',
    creditNoteNumber: 'Credit note no.',
    value: 'Value'
  };
  
  try{
    const titleEl = document.querySelector('header .title');
    if(titleEl) titleEl.textContent = t.pageTitle;
    
    const btnBack = document.getElementById('btnBack');
    if(btnBack) btnBack.textContent = t.backBtn;
    
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
      if(text.includes('الملخص التفصيلي') || text.includes('Detailed summary')) {
        h3.textContent = t.detailedSummary;
      } else if(text.includes('الربحية') || text.includes('Profitability')) {
        h3.textContent = t.profitability;
      } else if(text.includes('طرق الدفع') || text.includes('Payment methods')) {
        h3.textContent = t.paymentMethods;
      }
    });
    
    const summaryTable = document.querySelector('.tbl-sum');
    if(summaryTable){
      const headers = summaryTable.querySelectorAll('thead th');
      if(headers.length >= 4){
        headers[0].textContent = t.description;
        headers[1].textContent = t.preVat;
        headers[2].textContent = t.vat;
        headers[3].textContent = t.afterVat;
      }
      
      const rows = summaryTable.querySelectorAll('tbody tr');
      if(rows.length >= 6){
        rows[0].querySelector('td').textContent = t.sales;
        rows[1].querySelector('td').textContent = t.discounts;
        rows[2].querySelector('td').textContent = t.salesAfterDiscount;
        rows[3].querySelector('td').textContent = t.creditNotes;
        rows[4].querySelector('td').textContent = t.totalSalesAfterDiscountReturns;
        rows[5].querySelector('td').textContent = t.purchases;
      }
      
      const footerCells = summaryTable.querySelectorAll('tfoot th');
      if(footerCells.length >= 1){
        footerCells[0].textContent = t.net;
      }
    }
    
    const profitLabels = document.querySelectorAll('.profitability-section .kpi .label');
    if(profitLabels.length >= 3){
      profitLabels[0].textContent = t.totalCostPrice;
      profitLabels[1].textContent = t.totalSalePrice;
      profitLabels[2].textContent = t.netProfit;
    }
    
    const detailsSummaries = document.querySelectorAll('details summary');
    detailsSummaries.forEach(summary => {
      const text = summary.textContent.trim();
      if(text.includes('المنتجات المباعة') || text.includes('Sold products')) {
        summary.textContent = t.soldProducts;
      } else if(text.includes('المصروفات') || text.includes('Purchases')) {
        summary.textContent = t.purchasesDetail;
      } else if(text.includes('الفواتير') || text.includes('Invoices')) {
        summary.textContent = t.invoices;
      } else if(text.includes('مرتجع') || text.includes('Returns')) {
        summary.textContent = t.returns;
      }
    });
    
    const payMethodsTable = document.querySelectorAll('.section h3');
    payMethodsTable.forEach(h3 => {
      const parent = h3.closest('.section');
      if(parent && parent.querySelector('#payTbody')){
        const headers = parent.querySelectorAll('thead th');
        if(headers.length >= 2){
          headers[0].textContent = t.method;
          headers[1].textContent = t.total;
        }
        const footers = parent.querySelectorAll('tfoot th');
        if(footers.length >= 1){
          footers[0].textContent = t.grandTotal;
        }
      }
    });
    
    const soldProductsTable = document.getElementById('soldItemsTbody');
    if(soldProductsTable){
      const table = soldProductsTable.closest('table');
      if(table){
        const headers = table.querySelectorAll('thead th');
        if(headers.length >= 3){
          headers[0].textContent = t.product;
          headers[1].textContent = t.quantity;
          headers[2].textContent = t.total;
        }
      }
    }
    
    const purchasesTable = document.getElementById('purTbody');
    if(purchasesTable){
      const table = purchasesTable.closest('table');
      if(table){
        const headers = table.querySelectorAll('thead th');
        if(headers.length >= 4){
          headers[0].textContent = t.statement;
          headers[1].textContent = t.date;
          headers[2].textContent = t.total;
          headers[3].textContent = t.notes;
        }
        const footers = table.querySelectorAll('tfoot th');
        if(footers.length >= 1){
          footers[0].textContent = t.totals;
        }
      }
    }
    
    const invTable = document.getElementById('invTbody');
    if(invTable){
      const table = invTable.closest('table');
      if(table){
        const headers = table.querySelectorAll('thead th');
        if(headers.length >= 6){
          headers[0].textContent = t.number;
          headers[1].textContent = t.customer;
          headers[2].textContent = t.date;
          headers[3].textContent = t.paymentMethod;
          headers[4].textContent = t.total;
          headers[5].textContent = t.view;
        }
      }
    }
    
    const cnTable = document.getElementById('cnTbody');
    if(cnTable){
      const table = cnTable.closest('table');
      if(table){
        const headers = table.querySelectorAll('thead th');
        if(headers.length >= 6){
          headers[0].textContent = t.creditNoteNumber;
          headers[1].textContent = t.customer;
          headers[2].textContent = t.date;
          headers[3].textContent = t.paymentMethod;
          headers[4].textContent = t.value;
          headers[5].textContent = t.view;
        }
      }
    }
    
    const invoicesNote = document.querySelector('.section .muted');
    if(invoicesNote && (invoicesNote.textContent.includes('تشمل الفواتير') || invoicesNote.textContent.includes('Includes'))){
      invoicesNote.textContent = t.invoicesNote;
    }
    
    document.querySelectorAll('.muted').forEach(el => {
      if(el.querySelector('#invCount')){
        const count = el.querySelector('#invCount').textContent;
        const totalText = isAr ? 'الإجمالي:' : 'Total:';
        el.innerHTML = `${totalText} <b id="invCount">${count}</b>`;
      } else if(el.querySelector('#cnCount')){
        const count = el.querySelector('#cnCount').textContent;
        const totalText = isAr ? 'الإجمالي:' : 'Total:';
        el.innerHTML = `${totalText} <b id="cnCount">${count}</b>`;
      } else if(el.querySelector('#purCount')){
        const count = el.querySelector('#purCount').textContent;
        const totalText = isAr ? 'الإجمالي:' : 'Total:';
        el.innerHTML = `${totalText} <b id="purCount">${count}</b>`;
      }
    });
    
    window.__periodTranslations = t;
  }catch(_){}
}

(async function initPeriodLocale(){
  try{
    const r = await window.api.app_get_locale();
    const lang = (r && r.lang) || 'ar';
    const isAr = lang === 'ar';
    __currentLang = isAr ? 'ar' : 'en';
    document.documentElement.lang = isAr ? 'ar' : 'en';
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    translatePeriodUI(isAr);
  }catch(_){
    __currentLang = 'ar';
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    translatePeriodUI(true);
  }
  try{
    window.api.app_on_locale_changed((L)=>{
      const isAr = L === 'ar';
      __currentLang = isAr ? 'ar' : 'en';
      document.documentElement.lang = isAr ? 'ar' : 'en';
      document.documentElement.dir = isAr ? 'rtl' : 'ltr';
      translatePeriodUI(isAr);
    });
  }catch(_){}
})();

const btnBack = document.getElementById('btnBack');
if(btnBack){ btnBack.onclick = ()=>{ window.location.href = './index.html'; } }

// Export Period Report to PDF (optimized HTML approach)
async function exportPeriodReportPDF() {
  const isAr = __currentLang === 'ar';
  
  // Extract data from DOM
  const periodText = rangeEl?.textContent || '';
  
  // Extract summary table
  let summaryTableHTML = '';
  const summaryTable = document.querySelector('.tbl-sum');
  if (summaryTable) {
    const headers = Array.from(summaryTable.querySelectorAll('thead th')).map(th => th.textContent.trim());
    const rows = Array.from(summaryTable.querySelectorAll('tbody tr')).map(row => 
      Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim())
    );
    const footers = Array.from(summaryTable.querySelectorAll('tfoot th')).map(th => th.textContent.trim());
    
    summaryTableHTML = `
      <div class="section">
        <h3>${isAr ? 'الملخص التفصيلي' : 'Detailed Summary'}</h3>
        <table>
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
          <tfoot><tr>${footers.map(f => `<th>${f}</th>`).join('')}</tr></tfoot>
        </table>
      </div>
    `;
  }
  
  // Extract payment methods table
  let paymentTableHTML = '';
  const payTbody = document.getElementById('payTbody');
  if (payTbody) {
    const table = payTbody.closest('table');
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    const rows = Array.from(payTbody.querySelectorAll('tr')).map(row => 
      Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim())
    );
    const footers = Array.from(table.querySelectorAll('tfoot th')).map(th => th.textContent.trim());
    
    paymentTableHTML = `
      <div class="section">
        <h3>${isAr ? 'طرق الدفع' : 'Payment Methods'}</h3>
        <table>
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
          <tfoot><tr>${footers.map(f => `<th>${f}</th>`).join('')}</tr></tfoot>
        </table>
      </div>
    `;
  }
  
  // Extract profitability section
  let profitabilityHTML = '';
  const profitSection = document.querySelector('.profitability-section');
  if (profitSection) {
    const kpis = Array.from(profitSection.querySelectorAll('.kpi')).map(kpi => {
      const label = kpi.querySelector('.label')?.textContent.trim() || '';
      const value = kpi.querySelector('.value')?.textContent.trim() || '';
      return { label, value };
    });
    
    profitabilityHTML = `
      <div class="section profitability-section">
        <h3>${isAr ? 'الربحية' : 'Profitability'}</h3>
        <div class="kpis">
          ${kpis.map(kpi => `
            <div class="kpi">
              <div class="value">${kpi.value}</div>
              <div class="label">${kpi.label}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  // Extract invoices table (only if open)
  let invoicesTableHTML = '';
  const invTbody = document.getElementById('invTbody');
  const invDetails = invTbody?.closest('details');
  if (invDetails && invDetails.hasAttribute('open')) {
    const table = invTbody.closest('table');
    const headers = Array.from(table.querySelectorAll('thead th')).slice(0, -1).map(th => th.textContent.trim());
    const rows = Array.from(invTbody.querySelectorAll('tr')).map(row => 
      Array.from(row.querySelectorAll('td')).slice(0, -1).map(td => td.textContent.trim())
    );
    
    invoicesTableHTML = `
      <div class="section">
        <h3>${isAr ? 'الفواتير' : 'Invoices'}</h3>
        <table>
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    `;
  }
  
  // Extract credit notes table (only if open)
  let creditNotesTableHTML = '';
  const cnTbody = document.getElementById('cnTbody');
  const cnDetails = cnTbody?.closest('details');
  if (cnDetails && cnDetails.hasAttribute('open')) {
    const table = cnTbody.closest('table');
    const headers = Array.from(table.querySelectorAll('thead th')).slice(0, -1).map(th => th.textContent.trim());
    const rows = Array.from(cnTbody.querySelectorAll('tr')).map(row => 
      Array.from(row.querySelectorAll('td')).slice(0, -1).map(td => td.textContent.trim())
    );
    
    creditNotesTableHTML = `
      <div class="section">
        <h3>${isAr ? 'مرتجع/إشعارات دائنة' : 'Returns/Credit Notes'}</h3>
        <table>
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    `;
  }
  
  // Extract purchases table (only if open)
  let purchasesTableHTML = '';
  const purTbody = document.getElementById('purTbody');
  const purDetails = purTbody?.closest('details');
  if (purDetails && purDetails.hasAttribute('open')) {
    const table = purTbody.closest('table');
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    const rows = Array.from(purTbody.querySelectorAll('tr')).map(row => 
      Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim())
    );
    const footers = Array.from(table.querySelectorAll('tfoot th')).map(th => th.textContent.trim());
    
    purchasesTableHTML = `
      <div class="section">
        <h3>${isAr ? 'المصروفات' : 'Purchases'}</h3>
        <table>
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
          <tfoot><tr>${footers.map(f => `<th>${f}</th>`).join('')}</tr></tfoot>
        </table>
      </div>
    `;
  }
  
  // Extract sold items table (only if open)
  let soldItemsTableHTML = '';
  const soldItemsTbody = document.getElementById('soldItemsTbody');
  const soldDetails = soldItemsTbody?.closest('details');
  if (soldDetails && soldDetails.hasAttribute('open')) {
    const table = soldItemsTbody.closest('table');
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    const rows = Array.from(soldItemsTbody.querySelectorAll('tr')).map(row => 
      Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim())
    );
    
    soldItemsTableHTML = `
      <div class="section">
        <h3>${isAr ? 'المنتجات المباعة' : 'Sold Products'}</h3>
        <table>
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
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
          }
          th {
            background: #eef2ff;
            color: #0b3daa;
            font-weight: 700;
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
          .kpis {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin: 10px 0;
          }
          .kpi {
            background: #fff;
            border: 1px solid #e6eaf0;
            border-radius: 8px;
            padding: 12px;
            text-align: center;
          }
          .kpi .value {
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 4px;
          }
          .kpi .label {
            font-size: 12px;
            color: #64748b;
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <div class="pdf-title-section">
          <h1 class="pdf-main-title">${isAr ? 'تقرير الفترة' : 'Period Report'}</h1>
          <div class="pdf-period">${periodText}</div>
        </div>
        ${summaryTableHTML}
        ${profitabilityHTML}
        ${paymentTableHTML}
        ${invoicesTableHTML}
        ${creditNotesTableHTML}
        ${purchasesTableHTML}
        ${soldItemsTableHTML}
      </body>
    </html>
  `;
  
  // Export using the existing PDF export function
  const period = periodText.replace(/[^0-9_\-–: ]+/g,'').replace(/\s+/g,' ').trim();
  const safe = (period||'').replace(/[: ]/g,'_');
  const filename = `period-report-${safe||Date.now()}.pdf`;
  
  await window.api.pdf_export(html, { saveMode:'auto', filename: filename, pageSize:'A4' });
}

// Attach export handlers and prevent duplicate clicks
(function attachExportHandlers(){
  let exporting = false;
  const btnPdf = document.getElementById('exportPdfBtn');
  if(btnPdf){
    btnPdf.addEventListener('click', async () => {
      if(exporting) return; exporting = true; btnPdf.disabled = true;
      try{
        await exportPeriodReportPDF();
      }catch(e){ 
        console.error(e); 
        const errorMsg = __currentLang === 'ar' ? 'تعذر إنشاء PDF' : 'Failed to create PDF';
        alert(errorMsg); 
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
        const addTable = (title, tableElem)=>{
          try{
            if(!tableElem) return;
            lines.push(esc(title));
            const ths = Array.from(tableElem.querySelectorAll('thead th')).map(th=>th.textContent.trim());
            if(ths.length) lines.push(ths.map(esc).join(','));
            Array.from(tableElem.querySelectorAll('tbody tr')).forEach(tr=>{
              const tds = Array.from(tr.querySelectorAll('td')).map(td=>td.textContent.trim());
              if(tds.length) lines.push(tds.map(esc).join(','));
            });
            lines.push('');
          }catch(_){ }
        };
        const periodText = __currentLang === 'ar' ? 'الفترة' : 'Period';
        const paymentTotalsText = __currentLang === 'ar' ? 'إجماليات طرق الدفع' : 'Payment method totals';
        const invoicesText = __currentLang === 'ar' ? 'الفواتير' : 'Invoices';
        const creditNotesText = __currentLang === 'ar' ? 'الإشعارات الدائنة' : 'Credit notes';
        const purchasesText = __currentLang === 'ar' ? 'المصروفات' : 'Purchases';
        const soldProductsText = __currentLang === 'ar' ? 'المنتجات المباعة' : 'Sold products';
        
        if(rangeEl && rangeEl.textContent){ lines.push(esc(periodText), esc(rangeEl.textContent.trim())); lines.push(''); }
        addTable(paymentTotalsText, document.querySelector('table tbody#payTbody')?.closest('table'));
        addTable(invoicesText, document.querySelector('table tbody#invTbody')?.closest('table'));
        addTable(creditNotesText, document.querySelector('table tbody#cnTbody')?.closest('table'));
        addTable(purchasesText, document.querySelector('table tbody#purTbody')?.closest('table'));
        addTable(soldProductsText, document.querySelector('table tbody#soldItemsTbody')?.closest('table'));
        const csv = lines.join('\n');
        const period = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.replace(/[^0-9_\-–: ]+/g,'').replace(/\s+/g,' ').trim() : '';
        const filename = `period-report-${(period||'').replace(/[: ]/g,'_')||Date.now()}.csv`;
        await window.api.csv_export(csv, { saveMode:'auto', filename });
      }catch(e){ 
        console.error(e); 
        const errorMsg = __currentLang === 'ar' ? 'تعذر إنشاء Excel' : 'Failed to create Excel';
        alert(errorMsg); 
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
          };
          removeLastCol('invTbody');
          removeLastCol('cnTbody');
          // Extra safety: explicitly remove the 6th column ("عرض") by index from head/body/foot
          const removeColIdx = (tbodyId, idx) => {
            const tb = clone.getElementById(tbodyId);
            if(!tb) return;
            const table = tb.closest('table');
            if(!table) return;
            try{ const htr = table.querySelector('thead tr'); const th = htr?.querySelector(`th:nth-child(${idx})`); th && th.remove(); }catch(_){ }
            Array.from(tb.querySelectorAll('tr')).forEach(tr => { try{ const td = tr.querySelector(`td:nth-child(${idx})`); td && td.remove(); }catch(_){ }
            });
            try{ const ftr = table.querySelector('tfoot tr'); const fth = ftr?.querySelector(`th:nth-child(${idx})`); fth && fth.remove(); }catch(_){ }
          };
          removeColIdx('invTbody', 6);
          removeColIdx('cnTbody', 6);
          // Mark tables for targeted column widths
          const markTable = (tbodyId, cls) => {
            const tb = clone.getElementById(tbodyId);
            if(!tb) return;
            const table = tb.closest('table');
            if(table) table.classList.add(cls);
          };
          markTable('invTbody','tbl-inv');
          markTable('cnTbody','tbl-cn');
          markTable('soldItemsTbody','tbl-sold');
          markTable('purTbody','tbl-pur');
          // Add grid borders to invoices and credit-notes tables in print/PDF
          try{
            const inv = clone.getElementById('invTbody')?.closest('table');
            if(inv) inv.classList.add('grid-table');
            const cn = clone.getElementById('cnTbody')?.closest('table');
            if(cn) cn.classList.add('grid-table');
          }catch(_){ }
          // Mark summary table (الملخص التفصيلي) to control first column wrapping
          try{
            const h = Array.from(clone.querySelectorAll('h3')).find(x => /الملخص\s*التفصيلي/.test(x.textContent||''));
            const t = h && h.parentElement ? h.parentElement.querySelector('table') : null;
            if(t){
              t.classList.add('tbl-sum');
              const sec = t.closest('.section');
              if(sec){ sec.classList.add('summary-section'); }
            }
          }catch(_){ }
        }catch(_){ }

        // Add print styles for 80mm width with stronger wrapping and column widths
        const style = document.createElement('style');
        style.textContent = `
          /* لا تحدد ارتفاع الصفحة لتجنب القص، دعه يحسب ديناميكيًا */
          @page { margin: 0; }
          html, body{ width:80mm; max-width:80mm; margin:0; padding:0; }
          *{ box-sizing: border-box; }
          /* Ensure first content touches the top */
          body, .container, .section:first-child{ margin-top:0 !important; padding-top:0 !important; }
          /* Use Settings-based margins for thermal */
          .container{ width:80mm; max-width:80mm; margin:0; padding-left: var(--m-left); padding-right: var(--m-right); padding-top:0; padding-bottom:4px; overflow:hidden; }
          /* Avoid top margin collapse from first child */
          .container > *:first-child{ margin-top:0 !important; }
          .range-bar{ margin-top:0 !important; }
          /* Ensure range element is visible in print */
          #range{ display:block !important; margin:8px 0 !important; font-size:11px !important; font-weight:bold !important; }
          /* ألغِ اللفّ المخفي حتى لا تُقص الأعمدة */
          div[style*="overflow:auto"]{ overflow: visible !important; }
          /* الجداول: توزيع ثابت مع التفاف الأسطر */
          table{ width:100%; max-width:100%; border-collapse:collapse; table-layout: fixed; font-size:9.8px; line-height:1.25; }
          th,td{ padding:3px; word-break: normal; overflow-wrap: normal; white-space: normal; }
          /* لا تكسر الحروف العربية داخل كلمة البيان: لف عند المسافات فقط */
          .tbl-sum th:nth-child(1), .tbl-sum td:nth-child(1){ word-break: normal; overflow-wrap: normal; white-space: normal; }
          th{ background:#eef2ff; color:#0b3daa; border-bottom:2px solid #000; }
          .section{ margin:5px 0; padding:5px; border:1px solid #e5e7eb; }
          /* حدود ثقيلة للملخص التفصيلي */
          .summary-section{ border:2px solid #000; }
          .summary-section table{ border:2px solid #000; border-collapse:collapse; }
          .summary-section th, .summary-section td{ border:1px solid #000; }
          .summary-section tfoot th{ border-top:2px solid #000; }

          /* شبكة للطباعة للفواتير والإشعارات الدائنة */
          .tbl-inv, .tbl-cn{ border:2px solid #000; border-collapse:collapse; }
          .tbl-inv th, .tbl-inv td, .tbl-cn th, .tbl-cn td{ border:1px solid #000; }
          .tbl-inv tfoot th, .tbl-cn tfoot th{ border-top:2px solid #000; }

          /* إخفاء عمود "عرض" أثناء الطباعة للفواتير والإشعارات الدائنة كضمان إضافي */
          @media print {
            .tbl-inv thead th:last-child, .tbl-inv tbody td:last-child, .tbl-inv tfoot th:last-child { display: none !important; }
            .tbl-cn thead th:last-child, .tbl-cn tbody td:last-child, .tbl-cn tfoot th:last-child { display: none !important; }
          }

          /* عرض أعمدة الجداول حسب المحتوى المتوقع */
          /* فواتير: رقم | العميل | التاريخ | طريقة الدفع | الإجمالي */
          .tbl-inv th:nth-child(1), .tbl-inv td:nth-child(1){ width:12%; }
          .tbl-inv th:nth-child(2), .tbl-inv td:nth-child(2){ width:51%; }
          .tbl-inv th:nth-child(3), .tbl-inv td:nth-child(3){ width:18%; font-size:9px; }
          .tbl-inv th:nth-child(4), .tbl-inv td:nth-child(4){ width:4%; font-size:9px; }
          .tbl-inv th:nth-child(5), .tbl-inv td:nth-child(5){ width:15%; }

          /* إشعارات دائن: رقم | العميل | التاريخ | طريقة الدفع | القيمة */
          .tbl-cn th:nth-child(1), .tbl-cn td:nth-child(1){ width:14%; }
          .tbl-cn th:nth-child(2), .tbl-cn td:nth-child(2){ width:48%; }
          .tbl-cn th:nth-child(3), .tbl-cn td:nth-child(3){ width:18%; font-size:9px; }
          .tbl-cn th:nth-child(4), .tbl-cn td:nth-child(4){ width:5%; font-size:9px; }
          .tbl-cn th:nth-child(5), .tbl-cn td:nth-child(5){ width:15%; }

          /* تصغير خط خانة العميل قليلاً لتتسع الأرقام الطويلة */
          .tbl-inv th:nth-child(2), .tbl-inv td:nth-child(2),
          .tbl-cn th:nth-child(2), .tbl-cn td:nth-child(2){ font-size:8.8px; }

          /* تمكين التفاف رقم جوال العميل بالكامل داخل خانة العميل ومنع دخوله خانة أخرى */
          .tbl-inv th:nth-child(2), .tbl-inv td:nth-child(2),
          .tbl-cn th:nth-child(2), .tbl-cn td:nth-child(2) {
            /* لفّ الأرقام داخل الخانة دائمًا وعدم السماح بخروجها */
            white-space: normal !important;
            overflow-wrap: anywhere;   /* كسر السلسلة الطويلة داخل الخلية */
            word-wrap: break-word;     /* دعم قديم مكافئ ل overflow-wrap */
            word-break: break-all;     /* ضمان الالتفاف حتى بدون مسافات */
            line-break: anywhere;      /* مساعدة إضافية لمحركات معينة */
            max-width: 100%;           /* لا تتجاوز حدود الخلية */
            overflow: hidden;          /* قص أي بقايا قد تحاول الخروج */
            direction: ltr;            /* عرض أرقام الجوال من اليسار لليمين */
            unicode-bidi: plaintext;   /* معالجة المزج بين العربية والأرقام */
            text-align: left;          /* محاذاة يسار لقراءة الرقم بوضوح */
          }

          /* المنتجات المباعة: المنتج | الكمية | الإجمالي */
          .tbl-sold th:nth-child(1), .tbl-sold td:nth-child(1){ width:60%; }
          .tbl-sold th:nth-child(2), .tbl-sold td:nth-child(2){ width:20%; font-size:9.3px; }
          .tbl-sold th:nth-child(3), .tbl-sold td:nth-child(3){ width:20%; }

          /* المصروفات: البيان | التاريخ | الإجمالي | ملاحظات */
          .tbl-pur th:nth-child(1), .tbl-pur td:nth-child(1){ width:30%; }
          .tbl-pur th:nth-child(2), .tbl-pur td:nth-child(2){ width:25%; font-size:9.3px; }
          .tbl-pur th:nth-child(3), .tbl-pur td:nth-child(3){ width:15%; }
          .tbl-pur th:nth-child(4), .tbl-pur td:nth-child(4){ width:30%; }

          /* تصغير قسم الربحية للطباعة الحرارية */
          .profitability-section{ margin:2px 0 !important; padding:3px 5px !important; }
          .profitability-section h3{ font-size:9px !important; margin:0 0 2px 0 !important; }
          .profitability-section .kpis{ display:flex !important; flex-wrap:wrap !important; gap:2px !important; margin:0 !important; }
          .profitability-section .kpi{ padding:2px 4px !important; min-width:auto !important; flex:1 !important; border:1px solid #ccc !important; }
          .profitability-section .kpi .value{ font-size:9px !important; }
          .profitability-section .kpi .label{ font-size:7px !important; margin-top:1px !important; line-height:1.1 !important; }
        `;
        clone.querySelector('head')?.appendChild(style);
        // Ensure period info is visible and properly formatted in print
        try{
          const r = clone.getElementById('range');
          if(r && r.textContent && r.textContent.trim()){
            console.log('Found range text:', r.textContent); // Debug
            // Try to split period into two lines if it contains date range
            const text = r.textContent.trim();
            const m = text.match(/الفترة:\s*(.+?)\s*[—–-]\s*(.+)$/);
            if(m){
              r.innerHTML = `الفترة:<br>من: ${m[1].trim()}<br>إلى: ${m[2].trim()}`;
            } else {
              // If pattern doesn't match, just ensure it's visible
              r.innerHTML = text;
            }
            // Make sure it's visible with inline styles
            r.style.display = 'block';
            r.style.marginBottom = '10px';
            r.style.fontSize = '12px';
            r.style.fontWeight = 'bold';
          } else {
            console.log('Range element not found or empty'); // Debug
          }
        }catch(e){ console.error('Range processing error:', e); }
        const html = '<!doctype html>' + clone.outerHTML;
        await window.api.print_html(html, {
          silent: true,
          // طبق نفس إعدادات الفاتورة بالضبط (80mm x 297mm وبدون هوامش)
          pageSize: { width: 80000, height: 297000 },
          margins: { marginType: 'none' },
          printBackground: true,
        });
      }catch(e){ 
        console.error(e); 
        const errorMsg = __currentLang === 'ar' ? 'تعذر الطباعة' : 'Failed to print';
        alert(errorMsg); 
      }
      finally{ btnPrint.disabled = false; }
    });
  }
})();

function toStr(d){
  const pad2 = (v)=> String(v).padStart(2,'0');
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`;
}

function fromInputToStr(input){
  // input type=datetime-local gives 'YYYY-MM-DDTHH:MM'
  const v = (input?.value||'').trim();
  if(!v) return '';
  // Convert to space-separated for backend consistency
  return v.replace('T', ' ') + ':00';
}

async function loadRange(startStr, endStr){
  try{
    // show range text
    if(rangeEl){ rangeEl.textContent = `الفترة: ${startStr} — ${endStr}`; }

    // queries
    // Sold items summary (for sales/qty)
    let soldItems = [];
    try{
      const sumRes = await window.api.sales_items_summary({ date_from: startStr, date_to: endStr });
      soldItems = (sumRes && sumRes.ok) ? (sumRes.items||[]) : [];
    }catch(_){ soldItems = []; }

    // Products map (id -> cost) for cost computations
    let __prodById = new Map();
    try{
      const prodsRes = await window.api.products_list({ limit: 0 });
      const products = (prodsRes && prodsRes.ok) ? (prodsRes.items||[]) : [];
      __prodById = new Map(products.map(p => [Number(p.id), p]));
    }catch(_){ __prodById = new Map(); }

    let salesRes = await window.api.sales_list({ date_from: startStr, date_to: endStr, pageSize: 50000 });
    let allSales = (salesRes && salesRes.ok) ? (salesRes.items||[]) : [];
    // Removed fallback padding and unbounded fetch: show exactly the selected period
    // Keep allSales as returned by the API within [startStr, endStr] only

    const invoices = allSales.filter(s => String(s.doc_type||'') !== 'credit_note' && !String(s.invoice_no||'').startsWith('CN-') && String(s.payment_status||'paid') === 'paid');
    const creditNotes = allSales.filter(s => String(s.doc_type||'') === 'credit_note' || String(s.invoice_no||'').startsWith('CN-'));

    let grossBefore = 0, vatBefore = 0, disc = 0;
    const payByMethod = new Map();
    let refunds = 0, refundsVat = 0;
    let refundsPreAfterDisc = 0;

    invoices.forEach(sale => {
      const grand = Number(sale.grand_total||0);
      const vatv = Number(sale.vat_total||0);
      const discv = Number(sale.discount_amount||0);
      const pm = String(sale.payment_method||'').toLowerCase();
      grossBefore += ((grand - vatv) + discv);
      vatBefore += vatv;
      disc += discv;
      const payCashPart = Number(sale.pay_cash_amount || 0);
      const payCardPart = Number(sale.pay_card_amount || 0);
      const add = (method, amount)=>{
        if(!method) return;
        const k = String(method).toLowerCase();
        const prev = Number(payByMethod.get(k)||0);
        payByMethod.set(k, prev + Number(amount||0));
      };
      if(pm==='mixed'){
        add('cash', payCashPart);
        add('card', payCardPart);
      } else if(pm==='cash'){
        const settledCash = Number(sale.settled_cash || 0);
        add('cash', (settledCash>0 ? settledCash : (payCashPart>0?payCashPart:grand)));
      } else if(pm==='card' || pm==='network' || pm==='tamara' || pm==='tabby'){
        add(pm==='network' ? 'card' : pm, (payCardPart>0 ? payCardPart : grand));
      } else {
        add(pm, grand);
      }
      if(pm==='credit' && String(sale.payment_status||'')!=='paid'){
        add('credit', grand);
      }
    });

    creditNotes.forEach(sale => {
      const pre = Number(sale.sub_total||0);
      const grand = Number(sale.grand_total||0);
      const vatv = Number(sale.vat_total||0);
      const discCN = Number(sale.discount_amount||0);
      refunds += Math.abs(pre);
      refundsVat += Math.abs(vatv);
      refundsPreAfterDisc += Math.abs(pre - discCN);
      const pm = String(sale.payment_method||'').toLowerCase();
      const cCash = Number(Math.abs(sale.pay_cash_amount||0));
      const cCard = Number(Math.abs(sale.pay_card_amount||0));
      const sub = (method, amount)=>{
        if(!method) return;
        const k = String(method).toLowerCase();
        const prev = Number(payByMethod.get(k)||0);
        payByMethod.set(k, prev - Number(amount||0));
      };
      if(pm==='mixed'){
        sub('cash', cCash);
        sub('card', cCard);
      } else if(pm==='cash'){
        sub('cash', (cCash>0 ? cCash : Math.abs(grand)));
      } else if(pm==='card' || pm==='network' || pm==='tamara' || pm==='tabby'){
        sub(pm==='network' ? 'card' : pm, (cCard>0 ? cCard : Math.abs(grand)));
      } else if(pm){
        sub(pm, Math.abs(grand));
      }
    });

    const grossAfter = grossBefore - refunds;
    const vatAfter = vatBefore - refundsVat;
    const netAfterPretax = grossAfter - disc;
    const netAfter = netAfterPretax + vatAfter;

    // Load purchases (simple + invoices) within same range
    const [purRes, invRes] = await Promise.all([
      window.api.purchases_list({ from_at: startStr, to_at: endStr }),
      window.api.purchase_invoices_list({ from: startStr, to: endStr })
    ]);
    const simplePurchases = (purRes && purRes.ok) ? (purRes.items||[]) : [];
    const invoicePurchases = (invRes && invRes.ok) ? (invRes.items||[]) : [];
    const purchases = [...simplePurchases, ...invoicePurchases];
    let purchasesTotal = 0; purchases.forEach(p => {
      const methodRaw = (p.payment_method==null?'':String(p.payment_method));
      const isCredit = (methodRaw.toLowerCase()==='credit' || methodRaw==='آجل' || methodRaw==='اجل');
      const sub = Number(p.sub_total||0);
      const priceMode = String(p.price_mode||'inclusive');
      const grand = (priceMode === 'zero_vat') ? sub : Number(p.grand_total||0);
      const paid = (priceMode === 'zero_vat') ? (isCredit ? 0 : sub) : Number(p.amount_paid||0);
      const effectiveAfter = isCredit ? Math.min(paid, grand) : grand;
      if(!isCredit || effectiveAfter>0){ purchasesTotal += effectiveAfter; }
    });

    const salesPre = invoices.reduce((acc,s)=> acc + Number(s.sub_total||0), 0);
    // VAT before discount for display (apply on sub_total + tobacco)
    let tobInv = 0, tobCN = 0;
    try{ tobInv = invoices.reduce((a,s)=> a + Number(s.tobacco_fee||0), 0); }catch(_){ tobInv = 0; }
    try{ tobCN = creditNotes.reduce((a,s)=> a + Number(s.tobacco_fee||0), 0); }catch(_){ tobCN = 0; }
    const salesTob = Math.max(0, tobInv);
    const retTob = Math.max(0, Math.abs(tobCN));
    const settingsRes = await window.api.settings_get();
    const settings = (settingsRes && settingsRes.ok) ? settingsRes.item : {};
    const vatPct = Number(settings.vat_percent || 15) / 100;
    const salesVatBefore = Number((salesPre + salesTob) * vatPct);

    const discTotal = Number(disc||0);

    // Returns display values aligned with daily report
    const retPreAfterDisc = refundsPreAfterDisc;
    let retPre = Number(refunds||0);
    let retVat = Number(refundsVat||0);
    const retAfter = creditNotes.reduce((acc,s)=> acc + Math.abs(Number(s.grand_total||0)), 0);

    let purPre = 0, purVat = 0; purchases.forEach(p => {
      const methodRaw = (p.payment_method==null?'':String(p.payment_method));
      const isCredit = (methodRaw.toLowerCase()==='credit' || methodRaw==='آجل' || methodRaw==='اجل');
      const sub = Number(p.sub_total||0);
      // For zero_vat invoices: recalculate with 0% VAT
      const priceMode = String(p.price_mode||'inclusive');
      const vatTot = (priceMode === 'zero_vat') ? 0 : Number(p.vat_total||0);
      const grand = (priceMode === 'zero_vat') ? sub : Number(p.grand_total||0);
      const paid = (priceMode === 'zero_vat') ? (isCredit ? 0 : sub) : Number(p.amount_paid||0);
      const effectiveAfter = isCredit ? Math.min(paid, grand) : grand;
      if(isCredit && effectiveAfter<=0) return;
      if((sub+vatTot)>0 && effectiveAfter>0){
        const ratio = effectiveAfter / (sub + vatTot);
        purPre += Number((sub * ratio).toFixed(2));
        purVat += Number((vatTot * ratio).toFixed(2));
      }else{
        purPre += sub; purVat += vatTot;
      }
    });
    const purAfter = purPre + purVat;

    const set = (id, val)=>{ const el=document.getElementById(id); if(el){ el.textContent = Number(val||0).toFixed(2); } };
    set('salesPre', salesPre);
    set('salesVat', salesVatBefore);
    // تمت إزالة عمود رسوم التبغ من واجهة الملخص
    // set('salesTob', salesTob);
    set('salesAfter', salesPre + salesVatBefore + salesTob);
    set('discTotal', discTotal);
    set('retPre', retPreAfterDisc);
    set('retVat', retVat);
    // تمت إزالة عمود رسوم التبغ من صف المرتجعات
    // set('retTob', retTob);
    set('retAfter', retAfter);
    set('purPre', purPre);
    set('purVat', purVat);
    set('purAfter', purAfter);

    // Sales after discount row
    const salesAfterDiscPre = (salesPre - discTotal);
    const salesAfterDiscTob = salesTob;
    const salesAfterDiscVat = invoices.reduce((acc,s)=> acc + Number(s.vat_total||0), 0);
    const salesAfterDiscAfter = invoices.reduce((acc,s)=> acc + Number(s.grand_total||0), 0);
    set('salesAfterDiscPre', salesAfterDiscPre);
    // تمت إزالة عمود رسوم التبغ من صف "المبيعات بعد الخصم"
    // set('salesAfterDiscTob', salesAfterDiscTob);
    set('salesAfterDiscVat', salesAfterDiscVat);
    set('salesAfterDiscAfter', salesAfterDiscAfter);

    // Net sales after discount after returns (no purchases)
    const salesAfterDiscNetPre = salesAfterDiscPre - retPreAfterDisc;
    const salesAfterDiscNetTob = salesAfterDiscTob - retTob;
    const salesAfterDiscNetVat = salesAfterDiscVat - retVat;
    const salesAfterDiscNetAfter = salesAfterDiscAfter - retAfter;
    set('salesAfterDiscNetPre', salesAfterDiscNetPre);
    // تمت إزالة عمود رسوم التبغ من صف الصافي بعد الخصم
    // set('salesAfterDiscNetTob', salesAfterDiscNetTob);
    set('salesAfterDiscNetVat', salesAfterDiscNetVat);
    set('salesAfterDiscNetAfter', salesAfterDiscNetAfter);

    // Net totals (footer) now follow daily.js logic based on after-discount values
    const netPre = (salesAfterDiscPre - retPreAfterDisc) - purPre;
    const netTob = salesAfterDiscTob - retTob;
    const netVat = (salesAfterDiscVat - retVat) - purVat;
    set('netPre', netPre);
    set('netTob', netTob);
    set('netVat', netVat);
    set('netAfter', netPre + netTob + netVat);

    // Profitability KPIs (with VAT):
    // - costTotalWithVat: sum of (sold qty x product.cost) including VAT based on cost_includes_vat setting
    // - salesTotalWithVat: sum of (sold qty x product.price) including VAT based on prices_include_vat setting
    // - profitNetWithVat: salesTotalWithVat - costTotalWithVat
    let costTotalWithVat = 0;
    let salesTotalWithVat = 0;
    try{
      const costIncludesVat = Boolean(Number(settings.cost_includes_vat ?? 1));
      const pricesIncludeVat = Boolean(Number(settings.prices_include_vat ?? 1));
      // For accuracy, derive per-product sold qty using soldItems summary (includes CN as negative)
      (soldItems||[]).forEach(it => {
        const pid = Number(it.product_id||0);
        const qty = Number(it.qty_total||0);
        const product = __prodById.get(pid);
        const cost = Number(product?.cost || 0);
        const price = Number(product?.price || 0);
        
        // حساب التكلفة شاملة الضريبة حسب الإعدادات
        let costWithVat;
        if(costIncludesVat){
          // سعر التكلفة مُدخل شامل الضريبة بالفعل
          costWithVat = cost;
        } else {
          // سعر التكلفة مُدخل قبل الضريبة، نضيف الضريبة
          costWithVat = cost * (1 + vatPct);
        }
        costTotalWithVat += (qty * costWithVat);
        
        // حساب سعر البيع شامل الضريبة حسب الإعدادات
        let priceWithVat;
        if(pricesIncludeVat){
          // سعر البيع مُدخل شامل الضريبة بالفعل
          priceWithVat = price;
        } else {
          // سعر البيع مُدخل قبل الضريبة، نضيف الضريبة
          priceWithVat = price * (1 + vatPct);
        }
        salesTotalWithVat += (qty * priceWithVat);
      });
    }catch(_){ costTotalWithVat = 0; salesTotalWithVat = 0; }
    
    const profitNetWithVat = Number(salesTotalWithVat - costTotalWithVat);
    
    set('costTotalPre', costTotalWithVat);
    set('salesTotalPre', salesTotalWithVat);
    set('profitNetPre', profitNetWithVat);

    // build tables similar to daily.js
    const invTbody = document.getElementById('invTbody');
    const cnTbody = document.getElementById('cnTbody');
    const purTbody = document.getElementById('purTbody');
    const invCount = document.getElementById('invCount');
    const cnCount = document.getElementById('cnCount');
    const purCount = document.getElementById('purCount');

    const invRows = invoices.map(s=>{
      let created = s.created_at ? new Date(s.created_at) : null;
      if(!created || isNaN(created.getTime())){ try{ created = new Date(String(s.created_at).replace(' ', 'T')); }catch(_){ created = new Date(); } }
      const dateStr = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:true}).format(created);
      const custPhone = s.customer_phone || s.disp_customer_phone || '';
      const cust = custPhone || (s.customer_name || s.disp_customer_name || '');
      const pmLower = String(s.payment_method||'').toLowerCase();
      const settledCash = Number(s.settled_cash || 0);
      const payCashPart = Number(s.pay_cash_amount || 0);
      const cashParam = (pmLower==='cash') ? (settledCash>0 ? settledCash : (payCashPart>0 ? payCashPart : Number(s.grand_total||0))) : 0;
      const t = window.__periodTranslations || {};
      const viewBtnText = t.view || (__currentLang === 'ar' ? 'عرض' : 'View');
      const viewBtn = `<button class=\"btn\" data-view=\"${s.id}\" data-type=\"invoice\" data-pay=\"${pmLower}\" data-cash=\"${cashParam}\">${viewBtnText}</button>`;
      const payLabel = labelPaymentMethod(s.payment_method||'');
      return `<tr><td>${s.invoice_no||''}</td><td dir=\"ltr\" style=\"text-align:left\">${cust}</td><td>${dateStr}</td><td>${payLabel}</td><td>${fmt(s.grand_total)}</td><td>${viewBtn}</td></tr>`;
    }).join('');
    if(invTbody){ invTbody.innerHTML = invRows; }
    if(invCount){ invCount.textContent = String(invoices.length||0); }

    const cnRows = creditNotes.map(s=>{
      let created = s.created_at ? new Date(s.created_at) : null;
      if(!created || isNaN(created.getTime())){ try{ created = new Date(String(s.created_at).replace(' ', 'T')); }catch(_){ created = new Date(); } }
      const dateStr = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:true}).format(created);
      const custPhone = s.customer_phone || s.disp_customer_phone || '';
      const cust = custPhone || (s.customer_name || s.disp_customer_name || '');
      const payLabel = labelPaymentMethod(s.payment_method||'');
      const baseId = (s.ref_base_sale_id != null) ? String(s.ref_base_sale_id) : '';
      const baseNo = (s.ref_base_invoice_no != null) ? String(s.ref_base_invoice_no) : '';
      const attrs = [`data-view=\"${s.id}\"`, `data-type=\"credit\"`];
      if(baseId) attrs.push(`data-base=\"${baseId}\"`);
      if(baseNo) attrs.push(`data-base-no=\"${baseNo}\"`);
      const t = window.__periodTranslations || {};
      const viewBtnText = t.view || (__currentLang === 'ar' ? 'عرض' : 'View');
      const viewBtn = `<button class=\"btn\" ${attrs.join(' ')}>${viewBtnText}</button>`;
      return `<tr><td>${s.invoice_no||''}</td><td dir=\"ltr\" style=\"text-align:left\">${cust}</td><td>${dateStr}</td><td>${payLabel}</td><td>${fmt(s.grand_total)}</td><td>${viewBtn}</td></tr>`;
    }).join('');
    if(cnTbody){ cnTbody.innerHTML = cnRows; }
    if(cnCount){ cnCount.textContent = String(creditNotes.length||0); }

    // Add sold items table (sorted by most sold - highest quantity)
    const soldItemsTbody = document.getElementById('soldItemsTbody');
    try{
      const sortedSold = (soldItems||[]).slice().sort((a,b)=> Number(b?.qty_total||0) - Number(a?.qty_total||0));
      const rows = sortedSold.map(it => `<tr><td>${it.name||''}</td><td>${Number(it.qty_total||0)}</td><td>${fmt(it.amount_total)}</td></tr>`).join('');
      const noDataText = __currentLang === 'ar' ? 'لا توجد بيانات' : 'No data';
      if(soldItemsTbody){ soldItemsTbody.innerHTML = rows || `<tr><td colspan="3" class="muted">${noDataText}</td></tr>`; }
    }catch(_){ 
      const noDataText = __currentLang === 'ar' ? 'لا توجد بيانات' : 'No data';
      if(soldItemsTbody){ soldItemsTbody.innerHTML = `<tr><td colspan="3" class="muted">${noDataText}</td></tr>`; } 
    }

    // Add payment methods table
    const payTbody = document.getElementById('payTbody');
    const sumTotalEl = document.getElementById('sumTotal');
    let totalPayments = 0;
    const payRows = [];
    const notCountedText = __currentLang === 'ar' ? 'غير محتسب في الإجمالي' : 'Not counted in total';
    
    [...payByMethod.entries()].sort().forEach(([method, amount]) => {
      const label = labelPaymentMethod(method);
      const amountNum = Number(amount||0);
      if(method === 'credit'){
        payRows.push(`<tr><td>${label} <span class="badge badge-credit">${notCountedText}</span></td><td>${fmt(amountNum)}</td></tr>`);
      } else {
        totalPayments += amountNum;
        payRows.push(`<tr><td>${label}</td><td>${fmt(amountNum)}</td></tr>`);
      }
    });
    
    if(payTbody){ payTbody.innerHTML = payRows.join(''); }
    if(sumTotalEl){ sumTotalEl.textContent = fmt(totalPayments); }

    const purRows = purchases.map(p=>{
      const purchaseInvoicePrefix = __currentLang === 'ar' ? 'فاتورة شراء' : 'Purchase invoice';
      const name = p.invoice_no ? (()=>{ const m = String(p.invoice_no||'').match(/^PI-\d{6}-(\d+)$/); const printed = m ? String(Number(m[1])) : (p.invoice_no||''); return `${purchaseInvoicePrefix} ${printed}`; })() : (p.title || p.name || '');
      let d = null;
      try{ if(p.purchase_at){ d = new Date(p.purchase_at); } }catch(_){ }
      if(!d){ try{ if(p.invoice_at){ d = new Date(p.invoice_at); } }catch(_){ }
      }
      if(!d){ try{ if(p.created_at){ d = new Date(p.created_at); } }catch(_){ }
      }
      const dateStr = d ? new Intl.DateTimeFormat('en-GB-u-ca-gregory', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:true}).format(d) : '';
      // compute effective paid amount (exclude unpaid credit)
      const methodRaw = (p.payment_method==null?'':String(p.payment_method));
      const isCredit = (methodRaw.toLowerCase()==='credit' || methodRaw==='آجل' || methodRaw==='اجل');
      const sub = Number(p.sub_total||0);
      const priceMode = String(p.price_mode||'inclusive');
      const grand = (priceMode === 'zero_vat') ? sub : Number(p.grand_total||0);
      const paid = (priceMode === 'zero_vat') ? (isCredit ? 0 : sub) : Number(p.amount_paid||0);
      const effectiveAfter = isCredit ? Math.min(paid, grand) : grand;
      if(isCredit && effectiveAfter<=0){ return ''; }
      return `<tr><td>${name}</td><td>${dateStr}</td><td>${fmt(effectiveAfter)}</td><td>${p.notes||''}</td></tr>`;
    }).join('');
    if(purTbody){ purTbody.innerHTML = purRows; }
    if(purCount){ purCount.textContent = String(purchases.length||0); }

    // Fill purchases tfoot totals
    try{
      const pPurCount = document.getElementById('pPurCount');
      const pPurAfter = document.getElementById('pPurAfter');
      let tCount = 0;
      let tAfter = 0;
      purchases.forEach(p => {
        const methodRaw = (p.payment_method==null?'':String(p.payment_method));
        const isCredit = (methodRaw.toLowerCase()==='credit' || methodRaw==='آجل' || methodRaw==='اجل');
        const sub = Number(p.sub_total||0);
        const priceMode = String(p.price_mode||'inclusive');
        const grand = (priceMode === 'zero_vat') ? sub : Number(p.grand_total||0);
        const paid = (priceMode === 'zero_vat') ? (isCredit ? 0 : sub) : Number(p.amount_paid||0);
        const effectiveAfter = isCredit ? Math.min(paid, grand) : grand;
        if(isCredit && effectiveAfter<=0){ return; }
        tCount += 1;
        tAfter += effectiveAfter;
      });
      if(pPurCount){ pPurCount.textContent = String(tCount); }
      if(pPurAfter){ pPurAfter.textContent = fmt(tAfter); }
    }catch(_){ }

    // wire view buttons
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
          const w = (__defPrintFormat === 'a4') ? 900 : 500;
          const h = (__defPrintFormat === 'a4') ? 1000 : 700;
          // إضافة refresh=1 لضمان تحميل البيانات المحدثة وعرض تاريخ الدفع
          const qsObj = { id: String(id), ...(pay?{pay}:{}) , ...(cash?{cash}:{}), refresh: '1' };
          if(type==='credit'){
            const base = btn.getAttribute('data-base') || '';
            const baseNo = btn.getAttribute('data-base-no') || '';
            if(base) qsObj.base = base;
            if(baseNo) qsObj.base_no = baseNo;
          }
          const qs = new URLSearchParams(qsObj);
          const url = `${page}?${qs.toString()}`;
          window.open(url, 'PRINT_VIEW', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
        });
      });
    }catch(_){ }
  }catch(e){ console.error(e); }
}

function initDefaultRange(){
  // default: اليوم الحالي من الساعة 00:00 إلى الآن
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
  if(!s || !e){ alert('يرجى تحديد الفترة كاملة'); return; }
  await loadRange(s, e);
}

const applyBtn = document.getElementById('applyRangeBtn');
if(applyBtn){ applyBtn.addEventListener('click', applyRange); }

// init
initDefaultRange();
// Waiting for user to click Apply