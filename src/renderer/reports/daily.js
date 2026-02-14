// Daily report screen logic
// - Uses settings.closing_hour to compute the daily window [start, end)
// - Aggregates sales and purchases

let __currentLang = 'ar';
const fmt = (n)=> Number(n||0).toFixed(2);
const rangeEl = document.getElementById('range');

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

function translateDailyUI(isAr){
  __currentLang = isAr ? 'ar' : 'en';
  const t = isAr ? {
    pageTitle: 'التقرير اليومي',
    backBtn: 'الرجوع',
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
    invoicesNote: 'تشمل الفواتير غير الدائنة والفواتير الآجل المدفوعة جزئياً (مع تمييز "مدفوعة جزئياً").',
    number: 'رقم',
    customer: 'العميل',
    paymentMethod: 'طريقة الدفع',
    view: 'عرض',
    returns: 'مرتجع/إشعارات دائنة',
    creditNoteNumber: 'رقم الإشعار',
    value: 'القيمة'
  } : {
    pageTitle: 'Daily report',
    backBtn: 'Back',
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
    invoicesNote: 'Includes non-credit invoices and partially paid credit invoices (marked as "partially paid").',
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
    
    const exportPdfBtn = document.getElementById('exportPdfBtn');
    if(exportPdfBtn) exportPdfBtn.textContent = t.exportPdfBtn;
    
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if(exportExcelBtn) exportExcelBtn.textContent = t.exportExcelBtn;
    
    const printReportBtn = document.getElementById('printReportBtn');
    if(printReportBtn) printReportBtn.textContent = t.printReportBtn;
    
    const sections = document.querySelectorAll('.section h3');
    sections.forEach((h3, idx) => {
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
    
    const invoicesNote = document.querySelector('details summary');
    if(invoicesNote){
      const parent = invoicesNote.closest('.section');
      if(parent && parent.querySelector('#invTbody')){
        const noteEl = parent.querySelector('.muted');
        if(noteEl && (noteEl.textContent.includes('تشمل الفواتير') || noteEl.textContent.includes('Includes'))){
          noteEl.textContent = t.invoicesNote;
        }
      }
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
    
    window.__dailyTranslations = t;
  }catch(_){}
}

(async function initDailyLocale(){
  try{
    const r = await window.api.app_get_locale();
    const lang = (r && r.lang) || 'ar';
    const isAr = lang === 'ar';
    __currentLang = isAr ? 'ar' : 'en';
    document.documentElement.lang = isAr ? 'ar' : 'en';
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    translateDailyUI(isAr);
  }catch(_){
    __currentLang = 'ar';
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    translateDailyUI(true);
  }
  try{
    window.api.app_on_locale_changed((L)=>{
      const isAr = L === 'ar';
      __currentLang = isAr ? 'ar' : 'en';
      document.documentElement.lang = isAr ? 'ar' : 'en';
      document.documentElement.dir = isAr ? 'rtl' : 'ltr';
      translateDailyUI(isAr);
    });
  }catch(_){}
})();

const btnBack = document.getElementById('btnBack');
if(btnBack){ btnBack.onclick = ()=>{ window.location.href = './index.html'; } }

// Attach export handlers early so clicks always work
(function attachExportHandlers(){
  let exporting = false; // prevent multiple exports at once
  const btnPdf = document.getElementById('exportPdfBtn');
  if(btnPdf){
    btnPdf.addEventListener('click', async () => {
      if(exporting) return; exporting = true; btnPdf.disabled = true;
      try{
        const clone = document.documentElement.cloneNode(true);
        // Remove toolbar actions and header
        try{
          const toolbar = clone.querySelector('.range-actions');
          if(toolbar){ toolbar.parentNode.removeChild(toolbar); }
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
        // Remove "عرض" column from tables
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
        }catch(_){ }
        // إضافة عنوان التقرير في الأعلى
        try{
          const container = clone.querySelector('.container');
          if(container){
            const rangeText = rangeEl?.textContent || '';
            const titleText = __currentLang === 'ar' ? 'التقرير اليومي' : 'Daily Report';
            const titleSection = document.createElement('div');
            titleSection.className = 'pdf-title-section';
            titleSection.innerHTML = `
              <h1 class="pdf-main-title">${titleText}</h1>
              <div class="pdf-period">${rangeText}</div>
            `;
            container.insertBefore(titleSection, container.firstChild);
          }
        }catch(_){ }
        
        // Add professional PDF styles with Cairo Bold font
        const style = document.createElement('style');
        style.textContent = `
          * {
            font-family: 'Cairo', sans-serif !important;
            font-weight: 700 !important;
          }
          
          body {
            background: #fff !important;
            margin: 0;
            padding: 10px 20px;
          }
          
          .container {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .pdf-title-section {
            text-align: center !important;
            margin: 0 0 20px 0 !important;
            padding: 10px 0 15px 0 !important;
            border-bottom: 3px solid #3b82f6 !important;
          }
          
          .pdf-main-title {
            font-size: 28px !important;
            font-weight: 700 !important;
            color: #0f172a !important;
            margin: 0 0 12px 0 !important;
          }
          
          .pdf-period {
            font-size: 15px !important;
            color: #64748b !important;
            font-weight: 700 !important;
          }
          
          .section {
            background: #fff !important;
            border: 1px solid #e6eaf0 !important;
            border-radius: 12px !important;
            padding: 16px !important;
            margin: 12px 0 !important;
            page-break-inside: avoid;
          }
          
          .section:first-of-type {
            margin-top: 0 !important;
          }
          
          h3 {
            color: #0f172a !important;
            font-size: 18px !important;
            margin: 0 0 12px 0 !important;
            font-weight: 700 !important;
          }
          
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 8px 0 !important;
            page-break-inside: auto;
          }
          
          thead {
            display: table-header-group;
          }
          
          tr {
            page-break-inside: avoid;
          }
          
          th, td {
            padding: 10px !important;
            border: 1px solid #e6eaf0 !important;
            text-align: right !important;
            font-size: 13px !important;
          }
          
          th {
            background: #eef2ff !important;
            color: #0b3daa !important;
            font-weight: 700 !important;
          }
          
          tfoot th {
            background: #f1f5f9 !important;
            color: #0f172a !important;
            font-weight: 700 !important;
            border-top: 2px solid #3b82f6 !important;
          }
          
          td {
            color: #0f172a !important;
          }
          
          .muted {
            color: #64748b !important;
            font-size: 13px !important;
          }
          
          .kpis {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin: 10px 0;
          }
          
          .kpi {
            background: #fff !important;
            border: 1px solid #e6eaf0 !important;
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
          
          header, #range, .range-bar, .toolbar, .btn, .input, label {
            display: none !important;
            margin: 0 !important;
            padding: 0 !important;
            height: 0 !important;
          }
        `;
        clone.querySelector('head')?.appendChild(style);
        const html = '<!doctype html>' + clone.outerHTML;
        const period = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.replace(/[^0-9_\-–: ]+/g,'').replace(/\s+/g,' ').trim() : '';
        const safe = (period||'').replace(/[: ]/g,'_');
        const title = `daily-report-${safe||Date.now()}.pdf`;
        await window.api.pdf_export(html, { saveMode:'auto', filename: title, pageSize:'A4' });
        // no success alert per requirement
      }catch(e){ console.error(e); alert('تعذر إنشاء PDF'); }
      finally{ exporting = false; btnPdf.disabled = false; }
    });
  }
  const btnExcel = document.getElementById('exportExcelBtn');
  if(btnExcel){
    btnExcel.addEventListener('click', async () => {
      if(exporting) return; exporting = true; btnExcel.disabled = true;
      try{
        // Build CSV from DOM as a fallback so export works even if data variables failed
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
          }catch(_){ /* ignore */ }
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
        const filename = `daily-report-${(period||'').replace(/[: ]/g,'_')||Date.now()}.csv`;
        await window.api.csv_export(csv, { saveMode:'auto', filename });
        // no success alert per requirement
      }catch(e){ console.error(e); alert('تعذر إنشاء Excel'); }
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
        // Remove toolbar actions except title and range
        try{
          const toolbar = clone.querySelector('.range-actions');
          if(toolbar){ toolbar.parentNode.removeChild(toolbar); }
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
          // Extra safety: explicitly remove the 6th column ("عرض") by index
          const removeColIdx = (tbodyId, idx) => {
            const tb = clone.getElementById(tbodyId);
            if(!tb) return;
            const table = tb.closest('table');
            if(!table) return;
            try{ const htr = table.querySelector('thead tr'); const th = htr?.querySelector(`th:nth-child(${idx})`); th && th.remove(); }catch(_){ }
            Array.from(tb.querySelectorAll('tr')).forEach(tr => { try{ const td = tr.querySelector(`td:nth-child(${idx})`); td && td.remove(); }catch(_){ } });
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
          /* Use Settings-based margins for thermal: paddings from CSS vars */
          .container{ width:80mm; max-width:80mm; margin:0; padding-left: var(--m-left); padding-right: var(--m-right); padding-top:0; padding-bottom:4px; overflow:hidden; }
          /* Avoid top margin collapse from first child */
          .container > *:first-child{ margin-top:0 !important; }
          .range-bar{ margin-top:0 !important; }
          /* ألغِ اللفّ المخفي حتى لا تُقص الأعمدة */
          div[style*="overflow:auto"]{ overflow: visible !important; }
          /* الجداول: توزيع تلقائي مع التفاف الأسطر */
          table{ width:100%; max-width:100%; border-collapse:collapse; table-layout: auto; font-size:9.8px; line-height:1.25; }
          th,td{ padding:3px 4px; word-break: normal; overflow-wrap: normal; white-space: normal; }
          /* ضبط تباعد الخلايا رأسًا وأفقًا ليطابق تقرير الفترة */
          .tbl-inv th, .tbl-inv td, .tbl-cn th, .tbl-cn td{ padding:3px 4px; }
          .tbl-inv tr, .tbl-cn tr{ line-height:1.25; }
          /* ضبط خلية العميل لتحتوي الأرقام تمامًا مثل تقرير الفترة */
          .tbl-inv th:nth-child(2), .tbl-inv td:nth-child(2),
          .tbl-cn th:nth-child(2), .tbl-cn td:nth-child(2){
            white-space: normal !important;
            overflow-wrap: anywhere;
            word-wrap: break-word;
            word-break: break-all;
            line-break: anywhere;
            max-width: 100%;
            overflow: hidden;
            direction: ltr;
            unicode-bidi: plaintext;
            text-align: left;
            font-size: 8.8px; /* نفس حجم خط تقرير الفترة */
          }
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

          /* ملاءمة تلقائية للأعمدة حسب المحتوى أثناء الطباعة */
          /* أعمدة قصيرة مضغوطة (لا تلتف) */
          .tbl-inv th:nth-child(1), .tbl-inv td:nth-child(1),
          .tbl-inv th:nth-child(4), .tbl-inv td:nth-child(4),
          .tbl-inv th:nth-child(5), .tbl-inv td:nth-child(5),
          .tbl-cn th:nth-child(1), .tbl-cn td:nth-child(1),
          .tbl-cn th:nth-child(4), .tbl-cn td:nth-child(4),
          .tbl-cn th:nth-child(5), .tbl-cn td:nth-child(5){
            white-space: nowrap;
            width: 1%;
          }
          /* العميل والتاريخ تلتف لتستوعب البيانات */
          .tbl-inv th:nth-child(2), .tbl-inv td:nth-child(2),
          .tbl-inv th:nth-child(3), .tbl-inv td:nth-child(3),
          .tbl-cn th:nth-child(2), .tbl-cn td:nth-child(2),
          .tbl-cn th:nth-child(3), .tbl-cn td:nth-child(3){
            white-space: normal;
            overflow-wrap: anywhere;
            word-break: break-word;
            font-size: 9px;
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
        // Split period label into two lines: من ... ثم إلى ...
        try{
          const r = clone.getElementById('range');
          if(r && r.textContent){
            const m = r.textContent.match(/الفترة:\s*(\d{4}-\d{2}-\d{2}[^–]+)\s*[—–-]\s*(\d{4}-\d{2}-\d{2}.*)$/);
            if(m){ r.innerHTML = `الفترة:<br>من: ${m[1].trim()}<br>إلى: ${m[2].trim()}`; }
          }
        }catch(_){ }
        const html = '<!doctype html>' + clone.outerHTML;
        await window.api.print_html(html, {
          silent: true,
          // طبق نفس إعدادات الفاتورة بالضبط (80mm x 297mm وبدون هوامش)
          pageSize: { width: 80000, height: 297000 },
          margins: { marginType: 'none' },
          printBackground: true,
        });
      }catch(e){ console.error(e); alert('تعذر الطباعة'); }
      finally{ btnPrint.disabled = false; }
    });
  }
})();

function computeDailyRange(closingHour){
  // closingHour: 'HH:MM' (24h), default '00:00'
  const now = new Date();
  let [hh, mm] = String(closingHour||'00:00').split(':').map(x=>parseInt(x||'0',10));
  // sanitize
  if(!Number.isFinite(hh) || hh<0) hh = 0; if(hh>23) hh = 0;
  if(!Number.isFinite(mm) || mm<0) mm = 0; if(mm>59) mm = 0;
  // build today closing time
  const todayClose = new Date(now);
  todayClose.setHours(hh||0, mm||0, 0, 0);
  let start, end;
  if(now < todayClose){
    // before closing -> current day started at yesterday close
    start = new Date(todayClose.getTime() - 24*3600*1000);
    end = todayClose;
  }else{
    // after closing -> current day starts at today close until tomorrow close
    start = todayClose;
    end = new Date(todayClose.getTime() + 24*3600*1000);
  }
  const pad2 = (v)=> String(v).padStart(2,'0');
  const toStr = (d)=> `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`;
  return { now, start, end, startStr: toStr(start), endStr: toStr(end) };
}

async function load(){
  try{
    const st = await window.api.settings_get();
    const s = (st && st.ok) ? st.item : {};
    const closingHour = s.closing_hour || '00:00';
    const { start, end, startStr, endStr } = computeDailyRange(closingHour);
    rangeEl.textContent = `الفترة: ${startStr} — ${endStr}`;

    // Load sold items summary grouped by product
    let soldItems = [];
    try{
      const sumRes = await window.api.sales_items_summary({ date_from: startStr, date_to: endStr });
      soldItems = (sumRes && sumRes.ok) ? (sumRes.items||[]) : [];
    }catch(_){ soldItems = []; }

    // Load sales within range
    let salesRes = await window.api.sales_list({ date_from: startStr, date_to: endStr, pageSize: 50000 });
    let allSales = (salesRes && salesRes.ok) ? (salesRes.items||[]) : [];
    
    // For profitability: load current product catalog to get cost per product
    let __prodById = new Map();
    try{
      const prodsRes = await window.api.products_list({ limit: 0 });
      const products = (prodsRes && prodsRes.ok) ? (prodsRes.items||[]) : [];
      __prodById = new Map(products.map(p => [Number(p.id), p]));
    }catch(_){ __prodById = new Map(); }
    // If empty and we're close to edges, retry with 1-hour padding on both sides to avoid timezone/seconds mismatch
    if(!allSales.length){
      try{
        const padMs = 60*60*1000; // 1h
        const start2 = new Date(start.getTime() - padMs);
        const end2 = new Date(end.getTime() + padMs);
        const pad2 = (v)=> String(v).padStart(2,'0');
        const toStr = (d)=> `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`;
        const s2 = toStr(start2), e2 = toStr(end2);
        salesRes = await window.api.sales_list({ date_from: s2, date_to: e2, pageSize: 50000 });
        allSales = (salesRes && salesRes.ok) ? (salesRes.items||[]) : [];
      }catch(_){ }
    }
    // Enforce strict in-range filtering to avoid showing old invoices when day is empty
    try{
      const inRange = (rec) => {
        const d = new Date(rec.created_at || rec.settled_at || rec.invoice_date);
        return d >= start && d < end;
      };
      allSales = Array.isArray(allSales) ? allSales.filter(inRange) : [];
    }catch(_){ }

    // split into normal invoices and credit notes
    // include PAID invoices and PARTIAL credit invoices (for badge display); exclude credit notes
    const invoices = allSales.filter(s => {
      const isCN = String(s.doc_type||'') === 'credit_note' || String(s.invoice_no||'').startsWith('CN-');
      if(isCN) return false;
      const status = String(s.payment_status||'').toLowerCase();
      const method = String(s.payment_method||'').toLowerCase();
      return (status === 'paid') || (method === 'credit' && status === 'partial');
    });
    const creditNotes = allSales.filter(s => String(s.doc_type||'') === 'credit_note' || String(s.invoice_no||'').startsWith('CN-'));

    // Totals before and after credit notes
    let grossBefore = 0, vatBefore = 0, disc = 0;
    // Dynamic payment buckets by method (after credit notes)
    const payByMethod = new Map(); // method -> total
    let refunds = 0; // sum of credit notes grand_total (absolute)
    let refundsVat = 0; // sum of credit notes VAT (absolute)

    invoices.forEach(sale => {
      const grand = Number(sale.grand_total||0);
      const vatv = Number(sale.vat_total||0);
      const discv = Number(sale.discount_amount||0);
      const pm = String(sale.payment_method||'').toLowerCase();
      // المبيعات قبل الإشعارات يجب أن تعكس المبلغ قبل الخصم وقبل الضريبة
      // نحسبها = (الإجمالي بعد الخصم مع الضريبة) - (الضريبة) + (الخصم)
      grossBefore += ((grand - vatv) + discv);
      vatBefore += vatv;
      disc += discv;
      // Sum payment by actual split amounts if present (exclude credit invoices here; we will use transactions)
      const payCashPart = Number(sale.pay_cash_amount || 0);
      const payCardPart = Number(sale.pay_card_amount || 0);
      const add = (method, amount)=>{
        if(!method) return;
        const k = String(method).toLowerCase();
        const prev = Number(payByMethod.get(k)||0);
        payByMethod.set(k, prev + Number(amount||0));
      };
      if(pm==='credit'){
        // skip; partial and full settlements are captured via payment transactions
        return;
      }
      if(pm==='mixed'){
        add('cash', payCashPart);
        add('card', payCardPart);
      } else if(pm==='cash'){
        const settledCash = Number(sale.settled_cash || 0);
        add('cash', (settledCash>0 ? settledCash : (payCashPart>0?payCashPart:grand)));
      } else if(pm==='card' || pm==='network' || pm==='tamara' || pm==='tabby'){
        add(pm==='network' ? 'card' : pm, (payCardPart>0 ? payCardPart : grand));
      } else {
        // include any other custom method as full grand_total
        add(pm, grand);
      }
    });

    let refundsPreAfterDisc = 0;
    creditNotes.forEach(sale => {
      const pre = Number(sale.sub_total||0);
      const grand = Number(sale.grand_total||0);
      const vatv = Number(sale.vat_total||0);
      const discCN = Number(sale.discount_amount||0);
      // احتساب الإشعارات: قبل الضريبة بعد الخصم يعتمد على (sub_total - discount_amount)، ورسوم التبغ بعمود مستقل
      refunds += Math.abs(pre); // قبل الخصم (لاستخدامات أخرى)
      refundsVat += Math.abs(vatv);
      refundsPreAfterDisc += Math.abs(pre - discCN);
      // خصم مبالغ طرق الدفع من المجاميع بنفس منطق الفواتير لكن بالسالب
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

    const grossAfter = grossBefore - refunds; // pre-VAT after credit notes
    const vatAfter = vatBefore - refundsVat;  // VAT after credit notes
    const netAfterPretax = grossAfter - disc; // pre-VAT net after discount
    const netAfterWithVat = netAfterPretax + vatAfter; // after-VAT net

    // Load purchases (simple + invoices) and collect partial payments within same range
    const [purRes, invRes, payRes] = await Promise.all([
      window.api.purchases_list({ from_at: startStr, to_at: endStr }),
      window.api.purchase_invoices_list({ from: startStr, to: endStr }),
      window.api.sales_list_payments({ date_from: startStr, date_to: endStr })
    ]);
    const simplePurchases = (purRes && purRes.ok) ? (purRes.items||[]) : [];
    const invoicePurchases = (invRes && invRes.ok) ? (invRes.items||[]) : [];

    // Aggregate partial collections by method (cash/card/tamara/tabby) and map per sale within period
    let paidBySale = new Map();
    try{
      const txs = (payRes && payRes.ok) ? (payRes.items||[]) : [];
      txs.forEach(tx => {
        const m = String(tx.payment_method||'').toLowerCase();
        const k = (m === 'network') ? 'card' : m;
        const val = Number(tx.amount||0);
        if(!k || !isFinite(val) || val<=0) return;
        const prev = Number(payByMethod.get(k)||0);
        payByMethod.set(k, prev + val);
        const sid = Number(tx.sale_id||0);
        if(sid>0){ paidBySale.set(sid, Number(paidBySale.get(sid)||0) + val); }
      });
    }catch(_){ }

    // Merge and apply credit rules: exclude unpaid credit invoices, include only paid amount for partial credit
    const purchases = [...simplePurchases, ...invoicePurchases];
    let purchasesTotal = 0;
    purchases.forEach(p => {
      const methodRaw = (p.payment_method==null?'':String(p.payment_method));
      const isCredit = (methodRaw.toLowerCase()==='credit' || methodRaw==='آجل' || methodRaw==='اجل');
      const sub = Number(p.sub_total||0);
      const priceMode = String(p.price_mode||'inclusive');
      const grand = (priceMode === 'zero_vat') ? sub : Number(p.grand_total||0);
      const paid = (priceMode === 'zero_vat') ? (isCredit ? 0 : sub) : Number(p.amount_paid||0);
      const effectiveAfter = isCredit ? Math.min(paid, grand) : grand;
      if(!isCredit || effectiveAfter>0){ purchasesTotal += effectiveAfter; }
    });

    // Build detailed summary rows (scaled: include only collected portion for partial-credit invoices)
    const scaleForPartial = (sale) => {
      const pm = String(sale.payment_method||'').toLowerCase();
      const st = String(sale.payment_status||'').toLowerCase();
      const isPartial = (pm==='credit' && st==='partial');
      if(!isPartial) return 1;
      const grand = Number(sale.grand_total||0);
      const paid = Number(paidBySale.get(Number(sale.id))||0);
      if(!(grand>0) || !(paid>0)) return 0;
      return Math.min(1, paid / grand);
    };

    let salesPre = 0, salesVatBefore = 0, salesVatAfterDisc = 0, salesTob = 0, discTotal = 0, salesAfterDiscAfter = 0;
    const vatPctSetting = Number(s.vat_percent);
    const vatPctLocal = Number.isFinite(vatPctSetting) ? (vatPctSetting / 100) : 0.15;
    invoices.forEach(s => {
      const r = scaleForPartial(s);
      const subOrig = Number(s.sub_total||0);
      const tobOrig = Number(s.tobacco_fee||0);
      const vatBefore = (subOrig + tobOrig) * vatPctLocal * r; // VAT for "المبيعات" row (before discount)
      const vatAfter = Number(s.vat_total||0) * r;             // VAT for "المبيعات بعد الخصم" row
      const discAmt = Number(s.discount_amount||0) * r;
      const sub = subOrig * r;
      const tob = tobOrig * r;
      const grand = Number(s.grand_total||0);
      const paid = Number(paidBySale.get(Number(s.id))||0);
      const isPartial = (String(s.payment_method||'').toLowerCase()==='credit' && String(s.payment_status||'').toLowerCase()==='partial');
      const after = isPartial ? Math.min(paid, grand) : grand;

      salesPre += sub;
      salesTob += tob;
      salesVatBefore += vatBefore;
      salesVatAfterDisc += vatAfter;
      discTotal += discAmt;
      salesAfterDiscAfter += after;
    });

    // Returns
    let retPre = Number(refunds||0);
    let retVat = Number(refundsVat||0);

    // Tobacco fees
    const retTob = Math.max(0, Math.abs(creditNotes.reduce((a,s)=> a + Number(s.tobacco_fee||0), 0)));

    // After-tax for sales row should reflect before-discount amounts
    const salesAfter = salesPre + salesVatBefore + salesTob;
    // After-tax for credit notes should equal sum of absolute grand_total of credit notes
    const retAfter = creditNotes.reduce((acc,s)=> acc + Math.abs(Number(s.grand_total||0)), 0);

    let purPre = 0, purVat = 0;
    purchases.forEach(p => {
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

    try{
      const set = (id, val)=>{ const el=document.getElementById(id); if(el){ el.textContent = Number(val||0).toFixed(2); } };
      set('salesPre', salesPre);
      set('salesVat', salesVatBefore);
      // لم يعد هناك عمود رسوم تبغ في الواجهة
      set('salesAfter', salesAfter);
      set('discTotal', discTotal);
      // صف المرتجعات الآن يُعرض بالنسبة للمبيعات بعد الخصم:
      // قبل الضريبة (بعد الخصم) = (sub_total - discount_amount)
      const retPreAfterDisc = refundsPreAfterDisc;
      set('retPre', retPreAfterDisc);
      set('retVat', retVat);
      // تمت إزالة عمود رسوم التبغ من الجدول، لا حاجة لتعبئته
      // set('retTob', retTob);
      set('retAfter', retAfter);
      set('purPre', purPre);
      set('purVat', purVat);
      set('purAfter', purAfter);

      // إضافة صف "المبيعات بعد الخصم" (VAT after discount from invoices)
      const salesAfterDiscPre = (salesPre - discTotal);
      const salesAfterDiscTob = salesTob; // رسوم التبغ لا تتغير بالخصم عادةً
      const salesAfterDiscVat = salesVatAfterDisc; // الضريبة محسوبة على الصافي بعد الخصم بالفعل (مقاسة)
      // بعد الضريبة بعد الخصم = مجموع المحصل فعليًا للفواتير (للآجل الجزئي: المدفوع فقط)
      set('salesAfterDiscPre', salesAfterDiscPre);
      // تمت إزالة عمود رسوم التبغ من واجهة "المبيعات بعد الخصم"
      // set('salesAfterDiscTob', salesAfterDiscTob);
      set('salesAfterDiscVat', salesAfterDiscVat);
      set('salesAfterDiscAfter', salesAfterDiscAfter);

      // صافي المبيعات بعد الخصم بعد المرتجعات (لا يشمل المصروفات)
      // قبل الضريبة يجب أن يطرح مرتجعات بعد الخصم وليس قبل الخصم
      const salesAfterDiscNetPre = salesAfterDiscPre - retPreAfterDisc;
      const salesAfterDiscNetTob = salesAfterDiscTob - retTob;
      const salesAfterDiscNetVat = salesAfterDiscVat - retVat;
      const salesAfterDiscNetAfter = salesAfterDiscAfter - retAfter;
      set('salesAfterDiscNetPre', salesAfterDiscNetPre);
      // تمت إزالة عمود رسوم التبغ من صف الصافي بعد الخصم
      // set('salesAfterDiscNetTob', salesAfterDiscNetTob);
      set('salesAfterDiscNetVat', salesAfterDiscNetVat);
      set('salesAfterDiscNetAfter', salesAfterDiscNetAfter);

      // تحديث الصافي ليعتمد على "المبيعات بعد الخصم" ومرتجعات بعد الخصم:
      // قبل الضريبة: (مبيعات بعد الخصم قبل الضريبة - مرتجعات بعد الخصم قبل الضريبة) - مشتريات قبل الضريبة
      // الضريبة: (ضريبة المبيعات بعد الخصم - ضريبة المرتجعات) - ضريبة المصروفات
      // بعد الضريبة: مجموع الأعمدة (قبل + تبغ + ضريبة)
      const netPre = (salesAfterDiscPre - retPreAfterDisc) - purPre;
      const netTob = salesAfterDiscTob - retTob;
      const netVat = (salesAfterDiscVat - retVat) - purVat;
      const netAfter = netPre + netTob + netVat;
      set('netPre', netPre);
      set('netTob', netTob);
      set('netVat', netVat);
      set('netAfter', netAfter);

      // Profitability KPIs (with VAT):
      // - costTotalWithVat: sum of (sold qty x product.cost) including VAT based on cost_includes_vat setting
      // - salesTotalWithVat: sum of (sold qty x product.price) including VAT based on prices_include_vat setting
      // - profitNetWithVat: salesTotalWithVat - costTotalWithVat
      try{
        let costTotalWithVat = 0;
        let salesTotalWithVat = 0;
        const vatPct = Number(s.vat_percent || 15) / 100;
        const costIncludesVat = Boolean(Number(s.cost_includes_vat ?? 1));
        const pricesIncludeVat = Boolean(Number(s.prices_include_vat ?? 1));
        
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
        
        const profitNetWithVat = Number(salesTotalWithVat - costTotalWithVat);
        
        set('costTotalPre', costTotalWithVat);
        set('salesTotalPre', salesTotalWithVat);
        set('profitNetPre', profitNetWithVat);
      }catch(_){ set('costTotalPre', 0); set('salesTotalPre', 0); set('profitNetPre', 0); }
    }catch(_){ }

    // Populate tables
    const invTbody = document.getElementById('invTbody');
    const cnTbody = document.getElementById('cnTbody');
    const purTbody = document.getElementById('purTbody');
    const invCount = document.getElementById('invCount');
    const cnCount = document.getElementById('cnCount');
    const purCount = document.getElementById('purCount');

    const invRows = invoices.map(s=>{
      // guard invalid dates
      let created = s.created_at ? new Date(s.created_at) : null;
      if(!created || isNaN(created.getTime())){ try{ created = new Date(String(s.created_at).replace(' ', 'T')); }catch(_){ created = new Date(); } }
      const dStr = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {year:'numeric', month:'2-digit', day:'2-digit'}).format(created);
      const tStr = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {hour:'2-digit', minute:'2-digit', hour12:true}).format(created);
      const custPhone = s.customer_phone || s.disp_customer_phone || '';
      const cust = custPhone || (s.customer_name || s.disp_customer_name || '');
      const pmLower = String(s.payment_method||'').toLowerCase();
      const statusLower = String(s.payment_status||'').toLowerCase();
      const isPartialCredit = (pmLower==='credit' && statusLower==='partial');
      const settledCash = Number(s.settled_cash || 0);
      const payCashPart = Number(s.pay_cash_amount || 0);
      const cashParam = (pmLower==='cash') ? (settledCash>0 ? settledCash : (payCashPart>0 ? payCashPart : Number(s.grand_total||0))) : 0;
      const t = window.__dailyTranslations || {};
      const viewBtnText = t.view || (__currentLang === 'ar' ? 'عرض' : 'View');
      const partialPaidText = __currentLang === 'ar' ? 'مدفوعة جزئياً' : 'Partially paid';
      const viewBtn = `<button class=\"btn\" data-view=\"${s.id}\" data-type=\"invoice\" data-pay=\"${pmLower}\" data-cash=\"${cashParam}\">${viewBtnText}</button>`;
      const payLabel = labelPaymentMethod(s.payment_method||'') + (isPartialCredit ? ` <span class=\"badge badge-partial\">${partialPaidText}</span>` : '');
      const totalCell = isPartialCredit ? fmt(Number(paidBySale.get(Number(s.id))||0)) : fmt(s.grand_total);
      return `<tr><td>${s.invoice_no||''}</td><td dir=\"ltr\" style=\"text-align:left\">${cust}</td><td><div>${dStr}</div><div>${tStr}</div></td><td>${payLabel}</td><td>${totalCell}</td><td>${viewBtn}</td></tr>`;
    }).join('');
    const noInvoicesText = __currentLang === 'ar' ? 'لا توجد فواتير ضمن الفترة' : 'No invoices in period';
    invTbody.innerHTML = invRows || `<tr><td colspan="6" class="muted">${noInvoicesText}</td></tr>`;
    invCount.textContent = String(invoices.length);

    const cnRows = creditNotes.map(s=>{
      let created = s.created_at ? new Date(s.created_at) : null;
      if(!created || isNaN(created.getTime())){ try{ created = new Date(String(s.created_at).replace(' ', 'T')); }catch(_){ created = new Date(); } }
      const dStr = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {year:'numeric', month:'2-digit', day:'2-digit'}).format(created);
      const tStr = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {hour:'2-digit', minute:'2-digit', hour12:true}).format(created);
      const custPhone = s.customer_phone || s.disp_customer_phone || '';
      const cust = custPhone || (s.customer_name || s.disp_customer_name || '');
      const payLabel = labelPaymentMethod(s.payment_method||'');
      // Try to pass base references if present in the row (backend stores ref_base_* on credit notes)
      const baseId = (s.ref_base_sale_id != null) ? String(s.ref_base_sale_id) : '';
      const baseNo = (s.ref_base_invoice_no != null) ? String(s.ref_base_invoice_no) : '';
      const attrs = [`data-view=\"${s.id}\"`, `data-type=\"credit\"`];
      if(baseId) attrs.push(`data-base=\"${baseId}\"`);
      if(baseNo) attrs.push(`data-base-no=\"${baseNo}\"`);
      const t = window.__dailyTranslations || {};
      const viewBtnText = t.view || (__currentLang === 'ar' ? 'عرض' : 'View');
      const viewBtn = `<button class=\"btn\" ${attrs.join(' ')}>${viewBtnText}</button>`;
      return `<tr><td>${s.invoice_no||''}</td><td dir=\"ltr\" style=\"text-align:left\">${cust}</td><td><div>${dStr}</div><div>${tStr}</div></td><td>${payLabel}</td><td>${fmt(s.grand_total)}</td><td>${viewBtn}</td></tr>`;
    }).join('');
    const noCreditNotesText = __currentLang === 'ar' ? 'لا توجد إشعارات دائنة ضمن الفترة' : 'No credit notes in period';
    cnTbody.innerHTML = cnRows || `<tr><td colspan="6" class="muted">${noCreditNotesText}</td></tr>`;
    cnCount.textContent = String(creditNotes.length);

    if(purTbody){
      purTbody.innerHTML = purchases.map(p=>{
        const purchaseInvoicePrefix = __currentLang === 'ar' ? 'فاتورة شراء' : 'Purchase invoice';
        const name = p.invoice_no ? (()=>{ const m = String(p.invoice_no||'').match(/^PI-\d{6}-(\d+)$/); const printed = m ? String(Number(m[1])) : (p.invoice_no||''); return `${purchaseInvoicePrefix} ${printed}`; })() : (p.title || p.name || '');
        let d = null;
        try{ if(p.purchase_at){ d = new Date(p.purchase_at); } }catch(_){ }
        if(!d){ try{ if(p.invoice_at){ d = new Date(p.invoice_at); } }catch(_){ }
        }
        if(!d){ try{ if(p.created_at){ d = new Date(p.created_at); } }catch(_){ }
        }
        const dateStr = d ? new Intl.DateTimeFormat('en-GB-u-ca-gregory', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:true}).format(d) : (p.purchase_date||'');
        // compute effective amounts for credit rules
        const methodRaw = (p.payment_method==null?'':String(p.payment_method));
        const isCredit = (methodRaw.toLowerCase()==='credit' || methodRaw==='آجل' || methodRaw==='اجل');
        const sub = Number(p.sub_total||0);
        // For zero_vat invoices: recalculate with 0% VAT
        const priceMode = String(p.price_mode||'inclusive');
        const vatTot = (priceMode === 'zero_vat') ? 0 : Number(p.vat_total||0);
        const grand = (priceMode === 'zero_vat') ? sub : Number(p.grand_total||0);
        const paid = (priceMode === 'zero_vat') ? (isCredit ? 0 : sub) : Number(p.amount_paid||0);
        const effectiveAfter = isCredit ? Math.min(paid, grand) : grand;
        if(isCredit && effectiveAfter<=0){ return ''; }
        let pre=0, vat=0;
        if((sub+vatTot)>0 && effectiveAfter>0){
          const ratio = effectiveAfter / (sub + vatTot);
          pre = Number((sub * ratio).toFixed(2));
          vat = Number((vatTot * ratio).toFixed(2));
        }else{
          pre = sub; vat = vatTot;
        }
        return `<tr><td>${name}</td><td>${dateStr}</td><td>${fmt(effectiveAfter)}</td><td>${p.notes||''}</td></tr>`;
      }).join('');
    }
    if(purCount){ purCount.textContent = String(purchases.length); }

    // Fill purchases tfoot totals
    try{
      const dPurCount = document.getElementById('dPurCount');
      const dPurAfter = document.getElementById('dPurAfter');
      let tCount = 0;
      let tAfter = 0;
      purchases.forEach(p => {
        // same effective logic used in row creation
        const methodRaw = (p.payment_method==null?'':String(p.payment_method));
        const isCredit = (methodRaw.toLowerCase()==='credit' || methodRaw==='آجل' || methodRaw==='اجل');
        const sub = Number(p.sub_total||0);
        // For zero_vat invoices: recalculate with 0% VAT
        const priceMode = String(p.price_mode||'inclusive');
        const grand = (priceMode === 'zero_vat') ? sub : Number(p.grand_total||0);
        const paid = (priceMode === 'zero_vat') ? (isCredit ? 0 : sub) : Number(p.amount_paid||0);
        const effectiveAfter = isCredit ? Math.min(paid, grand) : grand;
        if(isCredit && effectiveAfter<=0){ return; }
        tCount += 1;
        tAfter += effectiveAfter;
      });
      if(dPurCount){ dPurCount.textContent = String(tCount); }
      if(dPurAfter){ dPurAfter.textContent = fmt(tAfter); }
    }catch(_){ }

    // Fill sold items table (products sold)
    try{
      const tbody = document.getElementById('soldItemsTbody');
      const rows = soldItems.map(it => `<tr><td>${it.name||''}</td><td>${Number(it.qty_total||0)}</td><td>${fmt(it.amount_total)}</td></tr>`).join('');
      const noDataText = __currentLang === 'ar' ? 'لا توجد بيانات' : 'No data';
      tbody.innerHTML = rows || `<tr><td colspan="3" class="muted">${noDataText}</td></tr>`;
    }catch(_){ }

    const stSalesBefore = document.getElementById('stSalesBefore');
    const stVatBefore = document.getElementById('stVatBefore');
    const stSalesAfter = document.getElementById('stSalesAfter');
    const stVatAfter = document.getElementById('stVatAfter');
    const stDisc = document.getElementById('stDisc');
    const stNet = document.getElementById('stNet');

    const stRefunds = document.getElementById('stRefunds');
    const stPurchases = document.getElementById('stPurchases');
    const stProfit = document.getElementById('stProfit');

    // summary boxes
    const boxSalesBefore = document.getElementById('boxSalesBefore');
    const boxVatBefore = document.getElementById('boxVatBefore');
    const boxRefunds = document.getElementById('boxRefunds');
    const boxRefundVat = document.getElementById('boxRefundVat');
    const boxSalesAfter = document.getElementById('boxSalesAfter');
    const boxVatAfter = document.getElementById('boxVatAfter');

    // wire actions: view buttons + exports
    try{
      document.querySelectorAll('button[data-view]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = Number(btn.getAttribute('data-view'));
          const type = btn.getAttribute('data-type');
          // Honor default_print_format from settings
          let __defPrintFormat = 'thermal';
          try{ const r = await window.api.settings_get(); if(r && r.ok && r.item){ __defPrintFormat = (r.item.default_print_format === 'a4') ? 'a4' : 'thermal'; } }catch(_){ }
          const page = (__defPrintFormat === 'a4') ? '../sales/print-a4.html' : '../sales/print.html';
          // pass payment method and cash amount (if cash) to match printed invoice logic
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

    // تمت إزالة ربط أزرار التصدير من هذا الموضع لأن المعالجات تم تعريفها في الأعلى مع منع التكرار وتعطيل الأزرار مؤقتًا.
    // هذا يمنع تسجيل مستمعين مزدوجين يؤديان إلى إنشاء تقريرين وعرض رسائل متكررة.

    // تم إزالة بطاقات المؤشرات وقسم الملخص المختصر حسب طلب المستخدم، لذا لا حاجة لتعبئة تلك العناصر

    // Build dynamic payment methods table
    const payTbody = document.getElementById('payTbody');
    const sumTotal = document.getElementById('sumTotal');
    const rows = [];
    let paymentsSum = 0;
    const notCountedText = __currentLang === 'ar' ? 'لا يُحتسب في الإجمالي' : 'Not counted in total';

    // Compute credit remaining: unpaid = full grand_total, partial = remaining_amount (fallback: grand - paid)
    const creditRemaining = (allSales||[])
      .filter(s => String(s.doc_type||'') !== 'credit_note' && !String(s.invoice_no||'').startsWith('CN-') && String(s.payment_method||'').toLowerCase()==='credit')
      .reduce((acc, s) => {
        const status = String(s.payment_status||'').toLowerCase();
        const grand = Number(s.grand_total||0);
        if(status === 'unpaid'){ return acc + grand; }
        if(status === 'partial'){
          const rem = (s.remaining_amount!=null) ? Number(s.remaining_amount||0) : (grand - Number(s.paid_amount||0));
          return acc + Math.max(0, rem);
        }
        return acc; // paid credit invoices contribute 0
      }, 0);

    // Sort methods for stable display
    const sorted = Array.from(payByMethod.entries()).sort((a,b)=> a[0].localeCompare(b[0]));
    let hasCreditRow = false;
    sorted.forEach(([method, value]) => {
      let amount = Number(value||0);
      if(method === 'credit'){ hasCreditRow = true; amount = Number(creditRemaining||0); }
      if(amount === 0) return; // skip zero rows
      const label = labelPaymentMethod(method);
      const isCredit = (method === 'credit');
      if(!isCredit){ paymentsSum += amount; }
      const note = isCredit ? ` <span class="badge badge-credit">${notCountedText}</span>` : '';
      rows.push(`<tr class="${isCredit?'credit-row':''}"><td>${label}${note}</td><td>${fmt(amount)}</td></tr>`);
    });
    // If no credit method existed in the map but we have outstanding credit, append it
    if(!hasCreditRow && creditRemaining > 0){
      const creditLabel = labelPaymentMethod('credit');
      rows.push(`<tr class="credit-row"><td>${creditLabel} <span class=\"badge badge-credit\">${notCountedText}</span></td><td>${fmt(creditRemaining)}</td></tr>`);
    }
    if(payTbody){ payTbody.innerHTML = rows.join(''); }
    if(sumTotal){ sumTotal.textContent = fmt(paymentsSum); }
    if(stRefunds){ stRefunds.textContent = fmt(refunds); }
    if(stPurchases){ stPurchases.textContent = fmt(purchasesTotal); }

    // Approximate profit: netAfter - purchases
    const profit = netAfter - purchasesTotal;
    if(stProfit){ stProfit.textContent = fmt(profit); }
  }catch(e){
    console.error(e);
  }
}

// Auto-refresh report when invoices change
try{
  window.api.on_sales_changed(() => {
    // Small debounce to group rapid events
    clearTimeout(window.__daily_rep_timer);
    window.__daily_rep_timer = setTimeout(() => { load(); }, 300);
  });
}catch(_){ }

load();