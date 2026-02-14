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

const customerSearchEl = document.getElementById('customerSearch');
const customerSuggestEl = document.getElementById('customerSuggest');
const customerInfoCard = document.getElementById('customerInfoCard');
let selectedCustomerId = null;

const btnBack = document.getElementById('btnBack');
if(btnBack){ btnBack.onclick = ()=>{ window.location.href = './index.html'; } }

async function loadCompanyInfo(){
  try{
    const res = await window.api.settings_get();
    if(!res || !res.ok || !res.item) return;
    const s = res.item;
    const set = (id, val)=>{ const el = document.getElementById(id); if(el) el.textContent = val || '-'; };
    set('companyName', s.seller_legal_name || '-');
    set('companyMobile', s.mobile || '-');
    set('companyEmail', s.email || '-');
    set('companyLocation', s.company_location || '-');
    set('companyVat', s.seller_vat_number || '-');
    set('companyCr', s.commercial_register || '-');
  }catch(e){
    console.error('Failed to load company info:', e);
  }
}

loadCompanyInfo();

(function initCustomerSearch(){
  if(!customerSearchEl) return;
  const hideSuggest = ()=>{ if(customerSuggestEl) customerSuggestEl.style.display='none'; };
  const showSuggest = (html)=>{ if(customerSuggestEl){ customerSuggestEl.innerHTML = html; customerSuggestEl.style.display = html ? 'block':'none'; } };
  let lastQuery = '';
  let timer = null;
  const doSearch = async (q)=>{
    if(!q || q.trim()===''){ showSuggest(''); return; }
    try{
      const res = await window.api.customers_list({ q: q.trim(), sort: 'name_asc' });
      const items = (res && res.ok) ? (res.items||[]) : [];
      if(!items.length){ showSuggest('<div class="muted" style="padding:8px 10px">لا توجد نتائج</div>'); return; }
      const rows = items.slice(0,50).map(c=>{
        const phone = c.phone ? ` — ${c.phone}` : '';
        return `<div class="opt" data-id="${c.id}" data-name="${c.name||''}" data-phone="${c.phone||''}" style="padding:8px 10px; cursor:pointer; border-bottom:1px solid var(--border)">${c.name||('عميل #' + c.id)}${phone}</div>`;
      }).join('');
      showSuggest(rows);
      Array.from(customerSuggestEl.querySelectorAll('.opt')).forEach(el => {
        el.addEventListener('click', async () => {
          selectedCustomerId = Number(el.getAttribute('data-id'))||null;
          const nm = el.getAttribute('data-name')||'';
          const ph = el.getAttribute('data-phone')||'';
          customerSearchEl.value = nm || (ph?ph:('عميل #' + selectedCustomerId));
          hideSuggest();
          await loadCustomerInfo(selectedCustomerId);
        });
      });
    }catch(e){ console.error(e); showSuggest('<div class="muted" style="padding:8px 10px">خطأ في البحث</div>'); }
  };
  customerSearchEl.addEventListener('input', (e)=>{
    const q = e.target.value || '';
    selectedCustomerId = null;
    if(customerInfoCard) customerInfoCard.style.display = 'none';
    if(q===lastQuery) return; lastQuery = q;
    clearTimeout(timer); timer = setTimeout(()=> doSearch(q), 250);
  });
  customerSearchEl.addEventListener('focus', ()=>{ if(customerSearchEl.value) doSearch(customerSearchEl.value); });
  document.addEventListener('click', (ev)=>{ if(!customerSuggestEl.contains(ev.target) && ev.target!==customerSearchEl){ hideSuggest(); } });
})();

async function loadCustomerInfo(customerId){
  if(!customerId || !customerInfoCard) return;
  try{
    const res = await window.api.customers_get(customerId);
    if(!res || !res.ok || !res.item){
      alert('فشل تحميل بيانات العميل');
      return;
    }
    const c = res.item;
    const set = (id, val)=>{ const el = document.getElementById(id); if(el) el.textContent = val || '-'; };
    set('custName', c.name || '-');
    set('custPhone', c.phone || '-');
    set('custEmail', c.email || '-');
    set('custAddress', c.address || '-');
    set('custVat', c.vat_number || '-');
    set('custCr', c.cr_number || '-');
    set('custNationalAddress', c.national_address || '-');
    customerInfoCard.style.display = 'block';
  }catch(e){
    console.error(e);
    alert('خطأ في تحميل بيانات العميل');
  }
}

(function attachExportHandlers(){
  let exporting = false;
  const btnPdf = document.getElementById('exportPdfBtn');
  if(btnPdf){
    btnPdf.addEventListener('click', async () => {
      if(exporting) return; exporting = true; btnPdf.disabled = true;
      try{
        const period = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.replace(/[^0-9_\-–: ]+/g,'').replace(/\s+/g,' ').trim() : '';
        const safe = (period||'').replace(/[: ]/g,'_');
        const cust = selectedCustomerId ? `-c${selectedCustomerId}` : '';
        const title = `customer-statement${cust}-${safe||Date.now()}.pdf`;
        
        const clone = document.documentElement.cloneNode(true);
        
        try{
          const header = clone.querySelector('header');
          if(header) header.remove();
          
          const rangeBar = clone.querySelector('.range-bar');
          if(rangeBar) rangeBar.remove();
          
          clone.querySelectorAll('.input, .btn, label, .toolbar').forEach(el => el.remove());
          
          const invoicesContent = clone.querySelector('#invoicesContent');
          if(invoicesContent) invoicesContent.style.display = 'block';
          const receiptsContent = clone.querySelector('#receiptsContent');
          if(receiptsContent) receiptsContent.style.display = 'block';
          
          const invTable = clone.querySelector('.tbl-inv');
          if(invTable){
            const headRow = invTable.querySelector('thead tr');
            if(headRow && headRow.lastElementChild){
              headRow.removeChild(headRow.lastElementChild);
            }
            clone.querySelectorAll('.tbl-inv tbody tr').forEach(tr => {
              if(tr.lastElementChild) tr.removeChild(tr.lastElementChild);
            });
            const footRow = invTable.querySelector('tfoot tr');
            if(footRow && footRow.lastElementChild){
              footRow.removeChild(footRow.lastElementChild);
            }
          }
          
          const receiptsTable = clone.querySelector('#receiptsTable');
          if(receiptsTable){
            const headRow = receiptsTable.querySelector('thead tr');
            if(headRow && headRow.lastElementChild){
              headRow.removeChild(headRow.lastElementChild);
            }
            clone.querySelectorAll('#receiptsTable tbody tr').forEach(tr => {
              if(tr.lastElementChild) tr.removeChild(tr.lastElementChild);
            });
          }
          
          clone.querySelectorAll('#toggleInvoices, #toggleReceipts').forEach(el => el.remove());
          
          const container = clone.querySelector('.container');
          if(container){
            const custName = customerSearchEl?.value || 'جميع العملاء';
            const titleSection = clone.ownerDocument.createElement('div');
            titleSection.className = 'pdf-title-section';
            titleSection.innerHTML = `
              <h1 class="pdf-main-title">كشف حساب عميل</h1>
              <div class="pdf-customer">العميل: ${custName}</div>
              <div class="pdf-period">${rangeEl?.textContent || ''}</div>
            `;
            container.insertBefore(titleSection, container.firstChild);
          }
        }catch(_){}
        
        const style = clone.ownerDocument.createElement('style');
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
            margin: 0 0 8px 0 !important;
          }
          
          .pdf-customer {
            font-size: 18px !important;
            color: #3b82f6 !important;
            font-weight: 700 !important;
            margin: 0 0 8px 0 !important;
          }
          
          .pdf-period {
            font-size: 15px !important;
            color: #64748b !important;
            font-weight: 700 !important;
          }
          
          .info-cards-container {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 12px !important;
            margin: 16px 0 !important;
            page-break-inside: avoid !important;
          }
          
          .info-card {
            background: #fff !important;
            border: 1px solid #e6eaf0 !important;
            border-radius: 10px !important;
            padding: 12px !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
          }
          
          .info-card-header {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            margin-bottom: 10px !important;
            padding-bottom: 8px !important;
            border-bottom: 2px solid #e6eaf0 !important;
          }
          
          .info-card-icon {
            width: 28px !important;
            height: 28px !important;
            border-radius: 6px !important;
            font-size: 14px !important;
            flex-shrink: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          
          .company-icon {
            background: linear-gradient(135deg, #3b82f6, #2563eb) !important;
            color: #fff !important;
          }
          
          .customer-icon {
            background: linear-gradient(135deg, #8b5cf6, #7c3aed) !important;
            color: #fff !important;
          }
          
          .info-card-title {
            font-size: 14px !important;
            font-weight: 700 !important;
            color: #0f172a !important;
          }
          
          .info-grid {
            display: grid !important;
            gap: 6px !important;
          }
          
          .info-row {
            display: flex !important;
            justify-content: space-between !important;
            padding: 6px 8px !important;
            background: #f8fafc !important;
            border: 1px solid #e6eaf0 !important;
            border-radius: 6px !important;
            font-size: 11px !important;
          }
          
          .info-row-label {
            font-size: 11px !important;
            color: #64748b !important;
            font-weight: 600 !important;
          }
          
          .info-row-value {
            font-size: 11px !important;
            font-weight: 700 !important;
            color: #0f172a !important;
            text-align: left !important;
          }
          
          .section {
            background: #fff !important;
            border: 1px solid #e6eaf0 !important;
            border-radius: 12px !important;
            padding: 16px !important;
            margin: 12px 0 !important;
            page-break-inside: auto;
          }
          
          .section:first-of-type {
            margin-top: 0 !important;
          }
          
          h3 {
            color: #0f172a !important;
            font-size: 16px !important;
            margin: 0 0 12px 0 !important;
            font-weight: 700 !important;
            display: block !important;
          }
          
          .section h3::before {
            content: none !important;
          }
          
          #invoicesContent, #receiptsContent {
            display: block !important;
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
            font-size: 12px !important;
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
            font-size: 12px !important;
          }
          
          .grid-table { 
            border: 2px solid #cbd5e1 !important; 
          }
          
          .grid-table th, .grid-table td { 
            border: 1px solid #e6eaf0 !important; 
          }
          
          .grid-table tfoot th { 
            border-top: 2px solid #3b82f6 !important; 
          }
          
          header, #range, .range-bar, .toolbar, .btn, .input, label {
            display: none !important;
            margin: 0 !important;
            padding: 0 !important;
            height: 0 !important;
          }
          
          .view-btn {
            display: none !important;
          }

          .tbl-inv th:last-child,
          .tbl-inv td:last-child,
          .tbl-inv tfoot th:last-child,
          #receiptsTable th:last-child,
          #receiptsTable td:last-child,
          #receiptsTable tfoot th:last-child {
            display: table-cell !important;
          }
        `;
        clone.querySelector('head')?.appendChild(style);
        
        const html = '<!doctype html>' + clone.outerHTML;
        await window.api.pdf_export(html, { saveMode:'auto', filename: title, pageSize:'A4' });
      }catch(e){ console.error(e); alert('تعذر إنشاء PDF'); }
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
        const getName = (id)=>{ const el = document.getElementById(id); return el ? el.textContent : '-'; };
        
        lines.push(esc('بيانات الشركة'));
        lines.push('');
        lines.push(esc('اسم الشركة'), esc(getName('companyName')));
        lines.push(esc('رقم الجوال'), esc(getName('companyMobile')));
        lines.push(esc('البريد الإلكتروني'), esc(getName('companyEmail')));
        lines.push(esc('العنوان'), esc(getName('companyLocation')));
        lines.push(esc('الرقم الضريبي'), esc(getName('companyVat')));
        lines.push(esc('السجل التجاري'), esc(getName('companyCr')));
        lines.push('');
        lines.push('');
        
        if(selectedCustomerId && customerInfoCard && customerInfoCard.style.display !== 'none'){
          lines.push(esc('بيانات العميل'));
          lines.push('');
          lines.push(esc('اسم العميل'), esc(getName('custName')));
          lines.push(esc('رقم الجوال'), esc(getName('custPhone')));
          lines.push(esc('البريد الإلكتروني'), esc(getName('custEmail')));
          lines.push(esc('العنوان'), esc(getName('custAddress')));
          lines.push(esc('الرقم الضريبي'), esc(getName('custVat')));
          lines.push(esc('السجل التجاري'), esc(getName('custCr')));
          lines.push(esc('العنوان الوطني'), esc(getName('custNationalAddress')));
          lines.push('');
          lines.push('');
        }
        const tableElem = document.querySelector('tbody#invTbody')?.closest('table');
        if(rangeEl && rangeEl.textContent){ lines.push(esc('الفترة'), esc(rangeEl.textContent.trim())); lines.push(''); }
        if(tableElem){
          const ths = Array.from(tableElem.querySelectorAll('thead th')).map(th=>th.textContent.trim());
          if(ths.length) lines.push(ths.map(esc).join(','));
          Array.from(tableElem.querySelectorAll('tbody tr')).forEach(tr=>{
            const tds = Array.from(tr.querySelectorAll('td')).map(td=>td.textContent.trim());
            if(tds.length) lines.push(tds.map(esc).join(','));
          });
          const sumPre = document.getElementById('sumPre')?.textContent || '0.00';
          const sumVat = document.getElementById('sumVat')?.textContent || '0.00';
          const sumGrand = document.getElementById('sumGrand')?.textContent || '0.00';
          const sumCount = document.getElementById('sumCount')?.textContent || '0';
          lines.push('');
          lines.push([esc('الصافي'), '', '', '', esc(sumPre), esc(sumVat), esc(sumGrand), esc(sumCount)].join(','));
          lines.push('');
          lines.push('');
          lines.push(esc('ملخص الإجماليات'));
          lines.push([esc('البيان'), esc('العدد'), esc('قبل الضريبة'), esc('الضريبة'), esc('الإجمالي')].join(','));
          
          const invCount = document.getElementById('invoiceCount')?.textContent || '0';
          const invPre = document.getElementById('invoicesPre')?.textContent || '0.00';
          const invVat = document.getElementById('invoicesVat')?.textContent || '0.00';
          const invGrand = document.getElementById('invoicesGrand')?.textContent || '0.00';
          lines.push([esc('إجمالي فواتير البيع'), esc(invCount), esc(invPre), esc(invVat), esc(invGrand)].join(','));
          
          const credCount = document.getElementById('creditCount')?.textContent || '0';
          const credPre = document.getElementById('creditsPre')?.textContent || '0.00';
          const credVat = document.getElementById('creditsVat')?.textContent || '0.00';
          const credGrand = document.getElementById('creditsGrand')?.textContent || '0.00';
          lines.push([esc('إشعار دائن (مرتجعات)'), esc(credCount), esc(credPre), esc(credVat), esc(credGrand)].join(','));
          
          const netCount = document.getElementById('summaryCount')?.textContent || '0';
          const netPre = document.getElementById('summaryPre')?.textContent || '0.00';
          const netVat = document.getElementById('summaryVat')?.textContent || '0.00';
          const netGrand = document.getElementById('summaryGrand')?.textContent || '0.00';
          lines.push([esc('الصافي (الفواتير - المرتجعات)'), esc(netCount), esc(netPre), esc(netVat), esc(netGrand)].join(','));
          
          const collCount = document.getElementById('collectedCount')?.textContent || '0';
          const collPre = document.getElementById('collectedPre')?.textContent || '0.00';
          const collVat = document.getElementById('collectedVat')?.textContent || '0.00';
          const collGrand = document.getElementById('collectedGrand')?.textContent || '0.00';
          lines.push([esc('إجمالي الفواتير المدفوعة'), esc(collCount), esc(collPre), esc(collVat), esc(collGrand)].join(','));
          
          const creditDueCount = document.getElementById('creditDueCount')?.textContent || '0';
          const creditDuePre = document.getElementById('creditDuePre')?.textContent || '0.00';
          const creditDueVat = document.getElementById('creditDueVat')?.textContent || '0.00';
          const creditDueGrand = document.getElementById('creditDueGrand')?.textContent || '0.00';
          lines.push([esc('إجمالي الفواتير الآجلة'), esc(creditDueCount), esc(creditDuePre), esc(creditDueVat), esc(creditDueGrand)].join(','));
          
          const receiptCount = document.getElementById('receiptVoucherCount')?.textContent || '0';
          const receiptPre = document.getElementById('receiptVouchersPre')?.textContent || '0.00';
          const receiptVat = document.getElementById('receiptVouchersVat')?.textContent || '0.00';
          const receiptGrand = document.getElementById('receiptVouchersGrand')?.textContent || '0.00';
          lines.push([esc('سندات القبض (خصم)'), esc(receiptCount), esc(receiptPre), esc(receiptVat), esc(receiptGrand)].join(','));
          
          const balancePre = document.getElementById('netBalancePre')?.textContent || '0.00';
          const balanceVat = document.getElementById('netBalanceVat')?.textContent || '0.00';
          const balanceGrand = document.getElementById('netBalance')?.textContent || '0.00';
          lines.push([esc('الرصيد النهائي المستحق من العميل (الفواتير الآجلة - سندات القبض)'), '', esc(balancePre), esc(balanceVat), esc(balanceGrand)].join(','));
        }
        const period = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.replace(/[^0-9_\-–: ]+/g,'').replace(/\s+/g,' ').trim() : '';
        const filename = `customer-statement-c${selectedCustomerId||'all'}-${(period||'').replace(/[: ]/g,'_')||Date.now()}.csv`;
        await window.api.csv_export(lines.join('\n'), { saveMode:'auto', filename });
      }catch(e){ console.error(e); alert('تعذر إنشاء Excel'); }
      finally{ exporting = false; btnExcel.disabled = false; }
    });
  }

  const btnPrint = document.getElementById('printReportBtn');
  if(btnPrint){
    btnPrint.addEventListener('click', async ()=>{
      try{
        btnPrint.disabled = true;
        try{ if(window.applyPrintMarginsFromSettings) await window.applyPrintMarginsFromSettings(); }catch(_){ }
        const clone = document.documentElement.cloneNode(true);
        try{
          const toolbar = clone.querySelector('.range-actions');
          if(toolbar){ toolbar.parentNode.removeChild(toolbar); }
          const rangeInputs = clone.querySelector('.range-inputs');
          if(rangeInputs){ rangeInputs.parentNode.removeChild(rangeInputs); }
          const hdr = clone.querySelector('header');
          if(hdr && hdr.parentNode){ hdr.parentNode.removeChild(hdr); }
        }catch(_){ }
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
            const tfootRow = table.querySelector('tfoot tr');
            if(tfootRow && tfootRow.lastElementChild){ tfootRow.removeChild(tfootRow.lastElementChild); }
          };
          removeLastCol('invTbody');
          const tbInv = clone.getElementById('invTbody');
          const tableInv = tbInv?.closest('table');
          if(tableInv){ tableInv.classList.add('tbl-inv','grid-table'); }
        }catch(_){ }

        const style = document.createElement('style');
        style.textContent = `
          @page { margin: 0; }
          html, body{ width:80mm; max-width:80mm; margin:0; padding:0; }
          *{ box-sizing: border-box; }
          body, .container, .section:first-child{ margin-top:0 !important; padding-top:0 !important; }
          .container{ width:80mm; max-width:80mm; margin:0; padding-left: var(--m-left); padding-right: var(--m-right); padding-top:0; padding-bottom:4px; overflow:hidden; }
          .container > *:first-child{ margin-top:0 !important; }
          .range-bar{ margin-top:0 !important; }
          #range{ display:block !important; margin:8px 0 !important; font-size:11px !important; font-weight:bold !important; }
          div[style*="overflow:auto"]{ overflow: visible !important; }
          table{ width:100%; max-width:100%; border-collapse:collapse; table-layout: auto; font-size:9px; line-height:1.2; }
          th,td{ padding:2px; word-break: normal; overflow-wrap: normal; white-space: normal; }
          th{ background:#eef2ff; color:#0b3daa; border-bottom:2px solid #000; font-size:8.5px; }
          .section{ margin:5px 0; padding:5px; border:1px solid #e5e7eb; }
          .customer-info{ display:block !important; }
          .customer-info-item{ margin-bottom:6px; padding:4px; border-bottom:1px solid #e5e7eb; }
          .customer-info-label{ font-size:9px; font-weight:600; }
          .customer-info-value{ font-size:10px; }

          table thead th:last-child,
          table tbody td:last-child,
          table tfoot th:last-child { display: none !important; }

          table{ border:2px solid #000; }
          table th, table td{ border:1px solid #000; }
          table tfoot th{ border-top:2px solid #000; }

          .grid-table{ border:2px solid #000; }
          .grid-table th, .grid-table td{ border:1px solid #000; }
          .grid-table tfoot th{ border-top:2px solid #000; }
          
          .tbl-inv th:nth-child(1), .tbl-inv td:nth-child(1){ width:12%; }
          .tbl-inv th:nth-child(2), .tbl-inv td:nth-child(2){ width:auto; white-space:nowrap; direction:ltr; text-align:left; }
          .tbl-inv th:nth-child(3), .tbl-inv td:nth-child(3){ width:auto; white-space:nowrap; font-size:8.5px; }
          .tbl-inv th:nth-child(4), .tbl-inv td:nth-child(4){ width:12%; font-size:8.5px; }
          .tbl-inv th:nth-child(5), .tbl-inv td:nth-child(5){ width:10%; }
          .tbl-inv th:nth-child(6), .tbl-inv td:nth-child(6){ width:8%; }
          .tbl-inv th:nth-child(7), .tbl-inv td:nth-child(7){ width:8%; }
          
          tbody tr[style*="background:#fef2f2"] {
            background: #fef2f2 !important;
            border-right: 2px solid #000 !important;
          }
          
          .info-cards-container { display: none !important; }
          
          .summary-section { 
            margin: 5px 0 !important; 
            padding: 5px !important; 
          }
          
          .summary-section table {
            border: 2px solid #000 !important;
            border-collapse: collapse !important;
            font-size: 8px !important;
          }
          
          .summary-section th, .summary-section td {
            border: 1px solid #000 !important;
            padding: 2px !important;
            font-size: 8px !important;
          }
          
          .summary-section tfoot th {
            border-top: 2px solid #000 !important;
            background: #eee !important;
            font-weight: bold !important;
          }
        `;
        clone.querySelector('head')?.appendChild(style);
        
        try{
          const r = clone.getElementById('range');
          if(r && r.textContent && r.textContent.trim()){
            const text = r.textContent.trim();
            const m = text.match(/الفترة:\s*(.+?)\s*[—–-]\s*(.+)$/);
            if(m){
              r.innerHTML = `الفترة:<br>من: ${m[1].trim()}<br>إلى: ${m[2].trim()}`;
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
      }catch(e){ console.error(e); alert('تعذر الطباعة'); }
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

async function loadRange(startStr, endStr){
  if(rangeEl){ rangeEl.textContent = `الفترة: ${startStr} — ${endStr}`; }
  const custId = Number(selectedCustomerId||0) || null;
  if(!custId){
    alert('يرجى اختيار عميل أولاً');
    return;
  }
  const invoicesSection = document.getElementById('invoicesSection');
  if(invoicesSection) invoicesSection.classList.add('loading');
  try{
    const query = { date_from: startStr, date_to: endStr, customer_id: custId, pageSize: 50000 };
    const res = await window.api.sales_list(query);
    const items = (res && res.ok) ? (res.items||[]) : [];

    // Fetch customer receipt vouchers within same period
    let vouchers = [];
    try{
      const vRes = await window.api.vouchers_list({
        voucher_type: 'receipt',
        entity_type: 'customer',
        entity_id: custId,
        from_date: startStr.slice(0,10),
        to_date: endStr.slice(0,10)
      });
      vouchers = (vRes && vRes.ok) ? (vRes.items||[]) : [];
    }catch(_){ vouchers = []; }

    const invTbody = document.getElementById('invTbody');
    let sumPre = 0, sumVat = 0, sumGrand = 0;
    let invoiceCount = 0, creditCount = 0;
    let invoicesPre = 0, invoicesVat = 0, invoicesGrand = 0;
    let creditsPre = 0, creditsVat = 0, creditsGrand = 0;
    const payTotals = new Map();
    
    let collectedCount = 0, collectedPre = 0, collectedVat = 0, collectedGrand = 0;
    let creditDueCount = 0, creditDuePre = 0, creditDueVat = 0, creditDueGrand = 0;

    // Vouchers totals (treated as deductions)
    const receiptsTbody = document.getElementById('receiptsTbody');
    const receiptsSection = document.getElementById('receiptsSection');
    let receiptsTotal = 0; let receiptsCount = 0;

    // جمع أرقام الفواتير المرتجعة لاستبعاد سنداتها من الحساب
    const returnedInvoiceNumbers = new Set();

    const rows = items.map(s=>{
      const isCreditNote = String(s.doc_type||'').toLowerCase() === 'credit_note';
      
      // إذا كانت فاتورة مرتجعة، أضف رقم الفاتورة الأصلية للقائمة
      if(isCreditNote && s.ref_base_invoice_no){
        returnedInvoiceNumbers.add(String(s.ref_base_invoice_no).trim());
      }
      const multiplier = isCreditNote ? -1 : 1;
      
      if(isCreditNote) creditCount++; else invoiceCount++;
      
      let created = s.created_at ? new Date(s.created_at) : null;
      if(!created || isNaN(created.getTime())){ try{ created = new Date(String(s.created_at).replace(' ', 'T')); }catch(_){ created = new Date(); } }
      const datePart = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {year:'numeric', month:'2-digit', day:'2-digit'}).format(created);
      const timePart = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {hour:'2-digit', minute:'2-digit', hour12:true}).format(created);
      const custPhone = s.customer_phone || s.disp_customer_phone || '';
      const pre = Number(s.sub_total||0);
      const vat = Number(s.vat_total||0);
      const grand = Number(s.grand_total||0);
      
      const pm = String(s.payment_method || '').toLowerCase();
      const payLabel = (m)=> m==='cash' ? 'نقدًا' : (m==='card'||m==='network' ? 'شبكة' : (m==='credit' ? 'آجل' : (m==='mixed'?'مختلط': m)));
      const status = String(s.payment_status || 'paid').toLowerCase();
      
      if(isCreditNote){
        creditsPre += pre; creditsVat += vat; creditsGrand += grand;
      } else {
        // إجمالي فواتير البيع: فقط المدفوعة (نقداً، شبكة، إلخ) - بدون الآجلة
        if(pm==='cash' || pm==='card' || pm==='network' || pm==='tamara' || pm==='tabby' || pm==='mixed'){
          invoicesPre += pre; invoicesVat += vat; invoicesGrand += grand;
        }
      }
      
      if(!isCreditNote){
        if(pm==='cash' || pm==='card' || pm==='network' || pm==='tamara' || pm==='tabby' || pm==='mixed'){
          collectedCount++; collectedPre += pre; collectedVat += vat; collectedGrand += grand;
        }
        // إجمالي الفواتير الآجلة: الفواتير بطريقة دفع "آجل" - المبلغ الكامل بدون خصم سندات القبض
        if(pm === 'credit'){
          creditDueCount++;
          creditDuePre += pre;
          creditDueVat += vat;
          creditDueGrand += grand;
        }
      } else {
        // إشعار دائن (مرتجع) - يُخصم من الفواتير المدفوعة (القيم سالبة في قاعدة البيانات)
        if(pm==='cash' || pm==='card' || pm==='network' || pm==='tamara' || pm==='tabby' || pm==='mixed'){
          collectedCount--; collectedPre += pre; collectedVat += vat; collectedGrand += grand;
        }
      }
      const addAmt = (key, amount)=>{
        if(!key) return; const k=(key==='network'?'card':key); const prev=Number(payTotals.get(k)||0); payTotals.set(k, prev + (Number(amount||0) * multiplier)); };
      if(pm==='mixed'){
        addAmt('cash', Number(s.pay_cash_amount||0) || grand/2);
        addAmt('card', Number(s.pay_card_amount||0) || grand/2);
      } else if(pm==='cash'){
        addAmt('cash', Number(s.settled_cash||0) || Number(s.pay_cash_amount||0) || grand);
      } else if(pm==='card' || pm==='network' || pm==='tamara' || pm==='tabby'){
        addAmt(pm, Number(s.pay_card_amount||0) || grand);
      } else if(pm){ addAmt(pm, grand); }
      const viewBtn = `<button class="view-btn" data-view="${s.id}">عرض</button>`;
      const docTypeLabel = isCreditNote ? '<span style="color:#dc2626; font-weight:700">إشعار دائن</span>' : '';
      const rowStyle = isCreditNote ? 'background:#fef2f2; border-right:3px solid #dc2626' : '';
      const invNo = isCreditNote ? `<span style="color:#dc2626">${s.invoice_no||''}</span>` : (s.invoice_no||'');
      return `<tr style="${rowStyle}"><td>${invNo}</td><td dir="ltr" style="text-align:left">${custPhone}</td><td>${datePart}<br>${timePart}</td><td>${docTypeLabel || payLabel(pm)}</td><td style="${isCreditNote?'color:#dc2626':''}">${fmt(pre)}</td><td style="${isCreditNote?'color:#dc2626':''}">${fmt(vat)}</td><td style="${isCreditNote?'color:#dc2626':''}"><b>${fmt(grand)}</b></td><td>${viewBtn}</td></tr>`;
    }).join('');

    // Net = invoices + credits (credit notes already negative in totals)
    sumPre = invoicesPre + creditsPre;
    sumVat = invoicesVat + creditsVat;
    sumGrand = invoicesGrand + creditsGrand;

    if(invTbody){ 
      invTbody.innerHTML = rows || '<tr><td colspan="8" class="muted">لا توجد فواتير ضمن الفترة</td></tr>'; 
      requestAnimationFrame(()=>{
        if(invTbody.parentElement) invTbody.parentElement.classList.add('fade-in');
      });
    }
    const set = (id, v)=>{ const el = document.getElementById(id); if(!el) return; const asCount = ['sumCount','summaryCount','invoiceCount','creditCount','receiptVoucherCount','collectedCount','creditDueCount']; el.textContent = asCount.includes(id) ? String(v) : fmt(v); };
    set('sumPre', sumPre); set('sumVat', sumVat); set('sumGrand', sumGrand); 
    set('sumCount', `${invoiceCount} فاتورة${creditCount>0 ? ` - ${creditCount} مرتجع` : ''}`);
    
    set('invoiceCount', invoiceCount); 
    set('invoicesPre', invoicesPre); 
    set('invoicesVat', invoicesVat); 
    set('invoicesGrand', invoicesGrand);
    
    set('creditCount', creditCount); 
    set('creditsPre', creditsPre); 
    set('creditsVat', creditsVat); 
    set('creditsGrand', creditsGrand);
    
    // Summary for invoices + credit notes only
    set('summaryCount', items.length||0); 
    set('summaryPre', sumPre); 
    set('summaryVat', sumVat); 
    set('summaryGrand', sumGrand);
    
    set('collectedCount', collectedCount);
    set('collectedPre', collectedPre);
    set('collectedVat', collectedVat);
    set('collectedGrand', collectedGrand);
    
    set('creditDueCount', creditDueCount);
    set('creditDuePre', creditDuePre);
    set('creditDueVat', creditDueVat);
    set('creditDueGrand', creditDueGrand);

    // Render and apply receipt vouchers (deduction)
    try{
      if(receiptsTbody && receiptsSection){
        if(Array.isArray(vouchers) && vouchers.length){
          // استبعاد سندات القبض المرتبطة بفواتير مرتجعة
          const validVouchers = vouchers.filter(v => {
            const invNo = String(v.invoice_no||'').trim();
            return !invNo || !returnedInvoiceNumbers.has(invNo);
          });
          receiptsCount = validVouchers.length;
          receiptsTotal = validVouchers.reduce((acc, v)=> acc + Number(v.amount||0), 0);
          const rows = validVouchers.map(v=>{
            let created = v.created_at ? new Date(v.created_at) : null;
            if(!created || isNaN(created.getTime())){ try{ created = new Date(String(v.created_at).replace(' ', 'T')); }catch(_){ created = new Date(); } }
            const datePart = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {year:'numeric', month:'2-digit', day:'2-digit'}).format(created);
            const timePart = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {hour:'2-digit', minute:'2-digit', hour12:true}).format(created);
            const pm = String(v.payment_method||'').toLowerCase();
            const payLabel = (m)=> m==='cash' ? 'نقدًا' : (m==='card'||m==='network' ? 'شبكة' : (m==='credit' ? 'آجل' : (m==='tamara'?'تمارا':(m==='tabby'?'تابي': (m||'-')))));
            const viewBtn = `<button class="view-btn" data-view="${v.id}">عرض</button>`;
            return `<tr><td>${v.voucher_no||''}</td><td>${datePart}<br>${timePart}</td><td>${v.invoice_no||''}</td><td>${payLabel(pm)}</td><td>${fmt(v.amount||0)}</td><td>${v.user_name||''}</td><td>${viewBtn}</td></tr>`;
          }).join('');
          receiptsTbody.innerHTML = rows;
          // Attach click handlers for view buttons to open the voucher print view
          try{
            receiptsTbody.querySelectorAll('button.view-btn[data-view]').forEach(btn=>{
              btn.addEventListener('click', async (ev)=>{
                // Prevent any parent row/table handlers from triggering (e.g., invoice view)
                if(ev){ ev.preventDefault(); ev.stopPropagation(); }
                const id = Number(btn.getAttribute('data-view'))||0;
                if(!id) return;
                try{
                  const res = await window.api.vouchers_get(id);
                  if(res && res.ok && res.item){
                    const v = res.item;
                    // Open the receipt print with invoice_no to show "سند فاتورة رقم X"
                    const printUrl = `../payments/receipt-print.html?voucher_no=${encodeURIComponent(v.voucher_no)}&invoice_no=${encodeURIComponent(v.invoice_no || '')}&customer_id=${encodeURIComponent(v.entity_id || '')}&customer_name=${encodeURIComponent(v.entity_name || '')}&customer_phone=${encodeURIComponent(v.entity_phone || '')}&customer_tax=${encodeURIComponent(v.entity_tax_number || '')}&amount=${encodeURIComponent(v.amount)}&method=${encodeURIComponent(v.payment_method || 'cash')}&notes=${encodeURIComponent(v.notes || '')}&user_name=${encodeURIComponent(v.user_name || '')}&date=${encodeURIComponent(v.created_at || '')}`;
                    // Use a named window so only one receipt window is reused, avoiding multiple popups
                    window.open(printUrl, 'RECEIPT_PRINT', 'width=800,height=900,menubar=no,toolbar=no,location=no,status=no');
                  }else{
                    alert('فشل في تحميل بيانات السند');
                  }
                }catch(err){
                  console.error('Open voucher error:', err);
                  alert('حدث خطأ أثناء فتح السند');
                }
              });
            });
          }catch(_){ }
          
          if(validVouchers.length > 0){
            receiptsSection.style.display = 'block';
          } else {
            receiptsTbody.innerHTML = '<tr><td colspan="7" class="muted">لا توجد سندات</td></tr>';
            receiptsSection.style.display = 'none';
          }
        } else {
          receiptsCount = 0; receiptsTotal = 0;
          receiptsTbody.innerHTML = '<tr><td colspan="7" class="muted">لا توجد سندات</td></tr>';
          receiptsSection.style.display = 'none';
        }
        const rTot = document.getElementById('receiptsTotal'); if(rTot) rTot.textContent = fmt(receiptsTotal);
        const rCnt = document.getElementById('receiptsCount'); if(rCnt) rCnt.textContent = String(receiptsCount);
        // Calculate vouchers pre-tax and VAT (assuming 15% VAT is included)
        const receiptsPre = receiptsTotal / 1.15;
        const receiptsVat = receiptsTotal - receiptsPre;
        // Update summary row for vouchers (treated as deduction)
        set('receiptVoucherCount', receiptsCount);
        set('receiptVouchersPre', receiptsPre);
        set('receiptVouchersVat', receiptsVat);
        set('receiptVouchersGrand', receiptsTotal);
        // Final net balance = credit due invoices - receipts (for all components)
        const netPre = Number(creditDuePre||0) - Number(receiptsPre||0);
        const netVat = Number(creditDueVat||0) - Number(receiptsVat||0);
        const net = Number(creditDueGrand||0) - Number(receiptsTotal||0);
        const netBalancePreEl = document.getElementById('netBalancePre'); if(netBalancePreEl) netBalancePreEl.textContent = fmt(netPre);
        const netBalanceVatEl = document.getElementById('netBalanceVat'); if(netBalanceVatEl) netBalanceVatEl.textContent = fmt(netVat);
        const netEl = document.getElementById('netBalance'); if(netEl) netEl.textContent = fmt(net);
      }
    }catch(_){ }

    try{
      const container = document.getElementById('payTotals');
      if(container){
        const label = (k)=> k==='cash'?'نقدًا':(k==='card'?'شبكة':(k==='credit'?'آجل':(k==='tamara'?'تمارا':(k==='tabby'?'تابي':k))));
        const icon = (k)=> k==='cash'?'💵':(k==='card'?'💳':(k==='credit'?'📝':(k==='tamara'?'🛒':(k==='tabby'?'🛍️':'💰'))));
        const color = (k)=> k==='cash'?'linear-gradient(135deg, #10b981, #059669)':(k==='card'?'linear-gradient(135deg, #0891b2, #0e7490)':(k==='credit'?'linear-gradient(135deg, #f59e0b, #d97706)':'linear-gradient(135deg, #6366f1, #4f46e5)'));
        const entries = Array.from(payTotals.entries()).filter(([k])=>k);
        entries.sort((a,b)=> a[0].localeCompare(b[0]));
        container.innerHTML = entries.map(([k,v])=>`<div style="background:${color(k)}; border-radius:12px; padding:14px; color:#fff; box-shadow:0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s ease" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='translateY(0)'"><div style="font-size:13px; opacity:0.9; margin-bottom:6px">${icon(k)} ${label(k)}</div><div style="font-weight:800; font-size:22px">${fmt(Number(v||0))}</div></div>`).join('') || '<div class="muted">لا توجد بيانات طرق الدفع ضمن الفترة</div>';
      }
    }catch(_){ }

    try{
      let __defPrintFormat = 'thermal';
      try{ const r = await window.api.settings_get(); if(r && r.ok && r.item){ __defPrintFormat = (r.item.default_print_format === 'a4') ? 'a4' : 'thermal'; } }catch(_){ }
      // استهداف أزرار عرض الفواتير فقط (من جدول الفواتير) وليس أزرار سندات القبض
      const invTbody = document.getElementById('invTbody');
      if(invTbody){
        invTbody.querySelectorAll('button[data-view]').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = Number(btn.getAttribute('data-view'));
            const page = (__defPrintFormat === 'a4') ? '../sales/print-a4.html' : '../sales/print.html';
            const w = (__defPrintFormat === 'a4') ? 900 : 500;
            const h = (__defPrintFormat === 'a4') ? 1000 : 700;
            const url = `${page}?id=${encodeURIComponent(String(id))}&refresh=1`;
            window.open(url, 'PRINT_VIEW', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
          });
        });
      }
    }catch(_){ }
  }catch(e){ 
    console.error(e); 
    alert('حدث خطأ أثناء تحميل البيانات');
  }finally{
    if(invoicesSection) invoicesSection.classList.remove('loading');
  }
}

function initDefaultRange(){
  const now = new Date();
  const start = new Date(now); start.setHours(0,0,0,0);
  const s = toStr(start), e = toStr(now);
  if(fromAtEl) fromAtEl.value = s.replace(' ', 'T').slice(0,16);
  if(toAtEl) toAtEl.value = e.replace(' ', 'T').slice(0,16);
}

(async function wireRange(){
  const btn = document.getElementById('applyRangeBtn');
  if(btn){ btn.addEventListener('click', () => {
    const s = fromInputToStr(fromAtEl);
    const e = fromInputToStr(toAtEl);
    if(!s || !e){ alert('يرجى تحديد الفترة (من وإلى)'); return; }
    if(!selectedCustomerId){ alert('يرجى اختيار عميل أولاً'); return; }
    loadRange(s, e);
  }); }
  if(customerSearchEl){ customerSearchEl.addEventListener('keydown', (ev)=>{
    if(ev.key==='Enter'){
      const s = fromInputToStr(fromAtEl);
      const e = fromInputToStr(toAtEl);
      if(s && e && selectedCustomerId){ loadRange(s, e); }
    }
  }); }
})();

initDefaultRange();
