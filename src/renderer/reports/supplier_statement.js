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

const supplierSearchEl = document.getElementById('supplierSearch');
const supplierSuggestEl = document.getElementById('supplierSuggest');
const supplierInfoCard = document.getElementById('supplierInfoCard');
let selectedSupplierId = null;

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

(function initSupplierSearch(){
  if(!supplierSearchEl) return;
  const hideSuggest = ()=>{ if(supplierSuggestEl) supplierSuggestEl.style.display='none'; };
  const showSuggest = (html)=>{ if(supplierSuggestEl){ supplierSuggestEl.innerHTML = html; supplierSuggestEl.style.display = html ? 'block':'none'; } };
  let lastQuery = '';
  let timer = null;
  const doSearch = async (q)=>{
    if(!q || q.trim()===''){ showSuggest(''); return; }
    try{
      const res = await window.api.suppliers_list({ q: q.trim(), sort: 'name_asc' });
      const items = (res && res.ok) ? (res.items||[]) : [];
      if(!items.length){ showSuggest('<div class="muted" style="padding:8px 10px">لا توجد نتائج</div>'); return; }
      const rows = items.slice(0,50).map(s=>{
        const phone = s.phone ? ` — ${s.phone}` : '';
        return `<div class="opt" data-id="${s.id}" data-name="${s.name||''}" data-phone="${s.phone||''}" style="padding:8px 10px; cursor:pointer; border-bottom:1px solid var(--border)">${s.name||('مورد #' + s.id)}${phone}</div>`;
      }).join('');
      showSuggest(rows);
      Array.from(supplierSuggestEl.querySelectorAll('.opt')).forEach(el => {
        el.addEventListener('click', async () => {
          selectedSupplierId = Number(el.getAttribute('data-id'))||null;
          const nm = el.getAttribute('data-name')||'';
          const ph = el.getAttribute('data-phone')||'';
          supplierSearchEl.value = nm || (ph?ph:('مورد #' + selectedSupplierId));
          hideSuggest();
          await loadSupplierInfo(selectedSupplierId);
        });
      });
    }catch(e){ console.error(e); showSuggest('<div class="muted" style="padding:8px 10px">خطأ في البحث</div>'); }
  };
  supplierSearchEl.addEventListener('input', (e)=>{
    const q = e.target.value || '';
    selectedSupplierId = null;
    if(supplierInfoCard) supplierInfoCard.style.display = 'none';
    if(q===lastQuery) return; lastQuery = q;
    clearTimeout(timer); timer = setTimeout(()=> doSearch(q), 250);
  });
  supplierSearchEl.addEventListener('focus', ()=>{ if(supplierSearchEl.value) doSearch(supplierSearchEl.value); });
  document.addEventListener('click', (ev)=>{ if(!supplierSuggestEl.contains(ev.target) && ev.target!==supplierSearchEl){ hideSuggest(); } });
})();

async function loadSupplierInfo(supplierId){
  if(!supplierId || !supplierInfoCard) return;
  try{
    const res = await window.api.suppliers_get(supplierId);
    if(!res || !res.ok || !res.item){
      alert('فشل تحميل بيانات المورد');
      return;
    }
    const s = res.item;
    const set = (id, val)=>{ const el = document.getElementById(id); if(el) el.textContent = val || '-'; };
    set('supplierName', s.name || '-');
    set('supplierPhone', s.phone || '-');
    set('supplierVat', s.vat_number || '-');
    supplierInfoCard.style.display = 'block';
  }catch(e){
    console.error(e);
    alert('خطأ في تحميل بيانات المورد');
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
        const sup = selectedSupplierId ? `-s${selectedSupplierId}` : '';
        const title = `supplier-statement${sup}-${safe||Date.now()}.pdf`;
        const clone = document.documentElement.cloneNode(true);
        
        try{
          const header = clone.querySelector('header');
          if(header) header.style.display = 'none';
          const rangeInputs = clone.querySelector('.range-inputs');
          if(rangeInputs) rangeInputs.style.display = 'none';
          const rangeActions = clone.querySelector('.range-actions');
          if(rangeActions) rangeActions.style.display = 'none';
        }catch(_){}
        
        const style = clone.ownerDocument.createElement('style');
        style.textContent = `
          @page { size: A4; margin: 10mm; }
          * { box-sizing: border-box; }
          body { 
            margin: 0; 
            padding: 10px; 
            font-family: 'Noto Kufi Arabic', Arial, sans-serif !important;
            font-size: 10px !important;
            line-height: 1.3 !important;
          }
          header, .range-inputs, .range-actions { display: none !important; }
          .container { 
            max-width: 100%; 
            margin: 0; 
            padding: 0; 
          }
          #range { 
            font-size: 11px !important; 
            font-weight: bold !important; 
            margin: 8px 0 !important;
            color: #000 !important;
          }
          
          .info-cards-container {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
            margin: 8px 0 !important;
            page-break-inside: avoid !important;
          }
          
          .info-card {
            background: #fff !important;
            border: 1.5px solid #666 !important;
            border-radius: 6px !important;
            padding: 8px !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
          }
          
          .info-card-header {
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            margin-bottom: 8px !important;
            padding-bottom: 6px !important;
            border-bottom: 1px solid #999 !important;
          }
          
          .info-card-icon {
            width: 24px !important;
            height: 24px !important;
            border-radius: 4px !important;
            font-size: 12px !important;
            flex-shrink: 0 !important;
          }
          
          .company-icon {
            background: #3b82f6 !important;
            color: #fff !important;
          }
          
          .supplier-icon {
            background: #f59e0b !important;
            color: #fff !important;
          }
          
          .info-card-title {
            font-size: 12px !important;
            font-weight: bold !important;
            color: #000 !important;
          }
          
          .info-grid {
            display: grid !important;
            gap: 4px !important;
          }
          
          .info-row {
            display: flex !important;
            justify-content: space-between !important;
            padding: 4px 6px !important;
            background: #f9f9f9 !important;
            border: 1px solid #ddd !important;
            border-radius: 3px !important;
            font-size: 9px !important;
            line-height: 1.2 !important;
          }
          
          .info-row-label {
            font-size: 9px !important;
            color: #555 !important;
            font-weight: 500 !important;
            white-space: nowrap !important;
          }
          
          .info-row-value {
            font-size: 9px !important;
            font-weight: 600 !important;
            color: #000 !important;
            text-align: left !important;
            word-break: break-word !important;
            max-width: 60% !important;
          }
          
          .section {
            background: #fff !important;
            border: 1px solid #999 !important;
            border-radius: 6px !important;
            padding: 8px !important;
            margin: 8px 0 !important;
            page-break-inside: avoid !important;
          }
          
          .section h3 {
            margin: 0 0 8px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            color: #000 !important;
          }
          
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 8px !important;
            margin: 0 !important;
          }
          
          .tbl-inv thead th:last-child,
          .tbl-inv tbody td:last-child,
          .tbl-inv tfoot th:last-child { 
            display: none !important; 
          }
          
          th, td {
            padding: 4px 3px !important;
            border: 1px solid #000 !important;
            text-align: center !important;
            font-size: 8px !important;
            line-height: 1.2 !important;
          }
          
          th {
            background: #e0e7ff !important;
            color: #000 !important;
            font-weight: bold !important;
            font-size: 8.5px !important;
          }
          
          tfoot th {
            background: #fef3c7 !important;
            color: #000 !important;
            font-weight: bold !important;
            border-top: 2px solid #000 !important;
            font-size: 9px !important;
          }
          
          .grid-table { 
            border: 2px solid #000 !important; 
          }
          
          .summary-section table {
            border: 2px solid #000 !important;
            border-collapse: collapse !important;
            width: 100% !important;
            font-size: 8px !important;
          }
          
          .summary-section th, .summary-section td {
            border: 1px solid #000 !important;
            padding: 5px 3px !important;
            text-align: center !important;
            font-size: 8px !important;
          }
          
          .summary-section tfoot th {
            border-top: 2px solid #000 !important;
            background: #fef3c7 !important;
            font-weight: bold !important;
            font-size: 9px !important;
          }
          
          .summary-section tbody tr:nth-child(3) {
            background: #eff6ff !important;
            font-weight: bold !important;
          }
        `;
        clone.querySelector('head')?.appendChild(style);
        
        try{
          const container = clone.querySelector('.container');
          if(container){
            const titleEl = clone.ownerDocument.createElement('div');
            titleEl.textContent = 'كشف حساب مورد';
            titleEl.setAttribute('style', 'text-align:center; font-weight:800; font-size:18px; margin:6px 0 10px;');
            container.insertBefore(titleEl, container.firstChild);
          }
        }catch(_){ }
        
        const html = '<!doctype html>' + clone.outerHTML;
        await window.api.pdf_export(html, { saveMode:'auto', filename: title, pageSize:'A4', printBackground: true });
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
        
        if(selectedSupplierId && supplierInfoCard && supplierInfoCard.style.display !== 'none'){
          lines.push(esc('بيانات المورد'));
          lines.push('');
          lines.push(esc('اسم المورد'), esc(getName('supplierName')));
          lines.push(esc('رقم الجوال'), esc(getName('supplierPhone')));
          lines.push(esc('الرقم الضريبي'), esc(getName('supplierVat')));
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
          lines.push([esc('الإجمالي'), '', '', esc(sumPre), esc(sumVat), esc(sumGrand), esc(sumCount)].join(','));
          lines.push('');
          lines.push('');
          lines.push(esc('ملخص الإجماليات'));
          lines.push([esc('البيان'), esc('العدد'), esc('قبل الضريبة'), esc('الضريبة'), esc('الإجمالي')].join(','));
          
          const invCount = document.getElementById('invoiceCount')?.textContent || '0';
          const invPre = document.getElementById('invoicesPre')?.textContent || '0.00';
          const invVat = document.getElementById('invoicesVat')?.textContent || '0.00';
          const invGrand = document.getElementById('invoicesGrand')?.textContent || '0.00';
          lines.push([esc('إجمالي فواتير الشراء'), esc(invCount), esc(invPre), esc(invVat), esc(invGrand)].join(','));
          
          const retCount = document.getElementById('returnCount')?.textContent || '0';
          const retPre = document.getElementById('returnsPre')?.textContent || '0.00';
          const retVat = document.getElementById('returnsVat')?.textContent || '0.00';
          const retGrand = document.getElementById('returnsGrand')?.textContent || '0.00';
          lines.push([esc('إجمالي الفواتير المرتجعة'), esc(retCount), esc(retPre), esc(retVat), esc(retGrand)].join(','));
          
          const netInvCount = document.getElementById('netInvoiceCount')?.textContent || '0';
          const netInvPre = document.getElementById('netInvoicesPre')?.textContent || '0.00';
          const netInvVat = document.getElementById('netInvoicesVat')?.textContent || '0.00';
          const netInvGrand = document.getElementById('netInvoicesGrand')?.textContent || '0.00';
          lines.push([esc('صافي فواتير الشراء (بعد خصم المرتجعات)'), esc(netInvCount), esc(netInvPre), esc(netInvVat), esc(netInvGrand)].join(','));
          
          const paidCount = document.getElementById('paidCount')?.textContent || '0';
          const paidPre = document.getElementById('paidPre')?.textContent || '0.00';
          const paidVat = document.getElementById('paidVat')?.textContent || '0.00';
          const paidGrand = document.getElementById('paidGrand')?.textContent || '0.00';
          lines.push([esc('إجمالي الفواتير المدفوعة'), esc(paidCount), esc(paidPre), esc(paidVat), esc(paidGrand)].join(','));
          
          const creditCount = document.getElementById('creditCount')?.textContent || '0';
          const creditPre = document.getElementById('creditPre')?.textContent || '0.00';
          const creditVat = document.getElementById('creditVat')?.textContent || '0.00';
          const creditGrand = document.getElementById('creditGrand')?.textContent || '0.00';
          lines.push([esc('إجمالي الفواتير الآجلة'), esc(creditCount), esc(creditPre), esc(creditVat), esc(creditGrand)].join(','));
          
          const voucherCount = document.getElementById('voucherCount')?.textContent || '0';
          const voucherPre = document.getElementById('vouchersPre')?.textContent || '0.00';
          const voucherVat = document.getElementById('vouchersVat')?.textContent || '0.00';
          const voucherGrand = document.getElementById('vouchersGrand')?.textContent || '0.00';
          lines.push([esc('سندات الصرف (خصم)'), esc(voucherCount), esc(voucherPre), esc(voucherVat), esc(voucherGrand)].join(','));
          
          const balancePre = document.getElementById('netBalancePre')?.textContent || '0.00';
          const balanceVat = document.getElementById('netBalanceVat')?.textContent || '0.00';
          const balanceGrand = document.getElementById('netBalance')?.textContent || '0.00';
          lines.push([esc('الرصيد النهائي المستحق للمورد (الفواتير الآجلة - سندات الصرف)'), '', esc(balancePre), esc(balanceVat), esc(balanceGrand)].join(','));
        }
        const period = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.replace(/[^0-9_\-–: ]+/g,'').replace(/\s+/g,' ').trim() : '';
        const filename = `supplier-statement-s${selectedSupplierId||'all'}-${(period||'').replace(/[: ]/g,'_')||Date.now()}.csv`;
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
          .supplier-info{ display:block !important; }
          .supplier-info-item{ margin-bottom:6px; padding:4px; border-bottom:1px solid #e5e7eb; }
          .supplier-info-label{ font-size:9px; font-weight:600; }
          .supplier-info-value{ font-size:10px; }

          table thead th:last-child,
          table tbody td:last-child,
          table tfoot th:last-child { display: none !important; }

          table{ border:2px solid #000; }
          table th, table td{ border:1px solid #000; }
          table tfoot th{ border-top:2px solid #000; }

          .grid-table{ border:2px solid #000; }
          .grid-table th, .grid-table td{ border:1px solid #000; }
          .grid-table tfoot th{ border-top:2px solid #000; }
          
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
  const supId = Number(selectedSupplierId||0) || null;
  if(!supId){
    alert('يرجى اختيار مورد أولاً');
    return;
  }
  const invoicesSection = document.getElementById('invoicesSection');
  if(invoicesSection) invoicesSection.classList.add('loading');
  try{
    // Fetch both invoices and returns
    const invoiceQuery = { date_from: startStr, date_to: endStr, supplier_id: supId, doc_type: 'invoice' };
    const invoiceRes = await window.api.purchase_invoices_list(invoiceQuery);
    const invoices = (invoiceRes && invoiceRes.ok) ? (invoiceRes.items||[]) : [];

    // Fetch return invoices
    const returnQuery = { date_from: startStr, date_to: endStr, supplier_id: supId, doc_type: 'return' };
    const returnRes = await window.api.purchase_invoices_list(returnQuery);
    const returns = (returnRes && returnRes.ok) ? (returnRes.items||[]) : [];

    // Combine and sort by date
    const allItems = [
      ...invoices.map(inv => ({...inv, _docType: 'invoice'})),
      ...returns.map(ret => ({...ret, _docType: 'return'}))
    ];
    allItems.sort((a, b) => new Date(b.invoice_at) - new Date(a.invoice_at));

    let vouchers = [];
    try{
      const vRes = await window.api.vouchers_list({
        voucher_type: 'payment',
        entity_type: 'supplier',
        entity_id: supId,
        from_date: startStr.slice(0,10),
        to_date: endStr.slice(0,10)
      });
      vouchers = (vRes && vRes.ok) ? (vRes.items||[]) : [];
    }catch(_){ vouchers = []; }

    const invTbody = document.getElementById('invTbody');
    let sumPre = 0, sumVat = 0, sumGrand = 0;
    let invoiceCount = 0;
    const payTotals = new Map();
    
    // Total purchase invoices (without returns)
    let totalInvoicePre = 0, totalInvoiceVat = 0, totalInvoiceGrand = 0;
    
    let paidCount = 0, paidPre = 0, paidVat = 0, paidGrand = 0;
    let creditCount = 0, creditPre = 0, creditVat = 0, creditGrand = 0;
    
    // Return invoices totals
    let returnCount = 0, returnPre = 0, returnVat = 0, returnGrand = 0;
    
    // Paid returns (to deduct from paid invoices)
    let returnPaidPre = 0, returnPaidVat = 0, returnPaidGrand = 0;
    
    // Net totals (purchase invoices - returns)
    let netInvoiceCount = 0, netInvoicePre = 0, netInvoiceVat = 0, netInvoiceGrand = 0;
    
    // IMPORTANT: creditCount/Pre/Vat/Grand track ONLY credit (deferred) invoices
    // These values are NEVER deducted from anything and always show the full total

    const vouchersTbody = document.getElementById('vouchersTbody');
    const vouchersSection = document.getElementById('vouchersSection');
    let vouchersTotal = 0; let vouchersCount = 0;

    const rows = allItems.map((pi, index)=>{
      const isReturn = pi._docType === 'return';
      
      if(isReturn){
        returnCount++;
      } else {
        invoiceCount++;
      }
      
      let created = pi.invoice_at ? new Date(pi.invoice_at) : null;
      if(!created || isNaN(created.getTime())){ try{ created = new Date(String(pi.invoice_at).replace(' ', 'T')); }catch(_){ created = new Date(); } }
      const datePart = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {year:'numeric', month:'2-digit', day:'2-digit'}).format(created);
      const timePart = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {hour:'2-digit', minute:'2-digit', hour12:true}).format(created);
      
      let pre = Number(pi.sub_total||0);
      const priceMode = String(pi.price_mode||'inclusive');
      let vat = (priceMode === 'zero_vat') ? 0 : Number(pi.vat_total||0);
      let grand = (priceMode === 'zero_vat') ? pre : Number(pi.grand_total||0);
      
      // For returns, use absolute values for calculation but display as negative
      if(isReturn){
        pre = Math.abs(pre);
        vat = Math.abs(vat);
        grand = Math.abs(grand);
      }
      
      sumPre += (isReturn ? -pre : pre);
      sumVat += (isReturn ? -vat : vat);
      sumGrand += (isReturn ? -grand : grand);
      
      // Track purchase invoice totals separately (without returns)
      if(!isReturn){
        totalInvoicePre += pre;
        totalInvoiceVat += vat;
        totalInvoiceGrand += grand;
      }
      
      // Track return invoice totals separately
      if(isReturn){
        returnPre += pre;
        returnVat += vat;
        returnGrand += grand;
            
        // Track paid returns separately to deduct from paid invoices
        const pm = String(pi.original_payment_method || pi.payment_method || '').toLowerCase();
        if(pm === 'cash' || pm === 'card' || pm === 'network'){
          returnPaidPre += pre;
          returnPaidVat += vat;
          returnPaidGrand += grand;
        }
      } else {
        // Track payment methods only for regular invoices
        const pm = String(pi.payment_method || '').toLowerCase();
        const addAmt = (key, amount)=>{
          if(!key) return; const k=(key==='network'?'card':key); const prev=Number(payTotals.get(k)||0); payTotals.set(k, prev + Number(amount||0)); };
        if(pm==='cash'){
          addAmt('cash', grand);
          paidCount++; paidPre += pre; paidVat += vat; paidGrand += grand;
        } else if(pm==='card' || pm==='network'){
          addAmt(pm, grand);
          paidCount++; paidPre += pre; paidVat += vat; paidGrand += grand;
        } else if(pm==='credit'){
          addAmt('credit', grand);
          // Credit (deferred) invoices - these are NEVER deducted from anything
          // They always show the full total in the summary
          creditCount++; creditPre += pre; creditVat += vat; creditGrand += grand;
        } else if(pm){ 
          addAmt(pm, grand); 
        }
      }
      
      const viewBtn = `<button class="view-btn" data-view="${pi.id}">عرض</button>`;
      
      const inv = String(pi.invoice_no||'');
      const m = inv.match(/^PI-\d{6}-(\d+)$/);
      const displayInvNo = m ? String(Number(m[1])) : (inv || String(pi.id||''));
      
      // Document type badge
      const docTypeBadge = isReturn 
        ? '<span style="background:#fee2e2; color:#dc2626; padding:3px 8px; border-radius:4px; font-weight:700; font-size:11px">مرتجع</span>'
        : '<span style="background:#dbeafe; color:#2563eb; padding:3px 8px; border-radius:4px; font-weight:700; font-size:11px">فاتورة شراء</span>';
      
      // Row styling for returns
      const rowStyle = isReturn ? 'style="background:#fef2f2"' : '';
      const displayPre = isReturn ? `-${pre.toFixed(2)}` : pre.toFixed(2);
      const displayVat = isReturn ? `-${vat.toFixed(2)}` : vat.toFixed(2);
      const displayGrand = isReturn ? `-${grand.toFixed(2)}` : grand.toFixed(2);
      const payLabel = (m)=> m==='cash' ? 'نقدًا' : (m==='card'||m==='network' ? 'شبكة' : (m==='credit' ? 'آجل' : m));
      const displayPayment = isReturn ? '-' : payLabel(String(pi.payment_method || '').toLowerCase());
      
      return `<tr ${rowStyle}><td>${docTypeBadge}</td><td>${displayInvNo}</td><td>${datePart}<br>${timePart}</td><td>${displayPayment}</td><td>${displayPre}</td><td>${displayVat}</td><td><b>${displayGrand}</b></td><td>${viewBtn}</td></tr>`;
    }).join('');

    if(invTbody){ 
      invTbody.innerHTML = rows || '<tr><td colspan="7" class="muted">لا توجد فواتير ضمن الفترة</td></tr>'; 
      requestAnimationFrame(()=>{
        if(invTbody.parentElement) invTbody.parentElement.classList.add('fade-in');
      });
    }
    const set = (id, v)=>{ const el = document.getElementById(id); if(!el) return; const asCount = ['sumCount','summaryCount','invoiceCount','returnCount','netInvoiceCount','voucherCount','paidCount','creditCount']; el.textContent = asCount.includes(id) ? String(v) : fmt(v); };
    set('sumPre', sumPre); set('sumVat', sumVat); set('sumGrand', sumGrand); 
    set('sumCount', invoiceCount);
    
    // Set total purchase invoices (without returns)
    set('invoiceCount', invoiceCount); 
    set('invoicesPre', totalInvoicePre); 
    set('invoicesVat', totalInvoiceVat); 
    set('invoicesGrand', totalInvoiceGrand);
    
    set('returnCount', returnCount);
    set('returnsPre', returnPre);
    set('returnsVat', returnVat);
    set('returnsGrand', returnGrand);
    
    // Calculate net values (purchase invoices - returns)
    netInvoiceCount = invoiceCount - returnCount;
    netInvoicePre = totalInvoicePre - returnPre;
    netInvoiceVat = totalInvoiceVat - returnVat;
    netInvoiceGrand = totalInvoiceGrand - returnGrand;
    
    set('netInvoiceCount', netInvoiceCount);
    set('netInvoicesPre', netInvoicePre);
    set('netInvoicesVat', netInvoiceVat);
    set('netInvoicesGrand', netInvoiceGrand);
    
    // Calculate net paid invoices (paid - paid returns)
    const netPaidCount = Math.max(0, paidCount - returnCount);
    const netPaidPre = Math.max(0, paidPre - returnPaidPre);
    const netPaidVat = Math.max(0, paidVat - returnPaidVat);
    const netPaidGrand = Math.max(0, paidGrand - returnPaidGrand);
    
    set('paidCount', netPaidCount);
    set('paidPre', netPaidPre);
    set('paidVat', netPaidVat);
    set('paidGrand', netPaidGrand);
    
    set('creditCount', creditCount);
    set('creditPre', creditPre);
    set('creditVat', creditVat);
    set('creditGrand', creditGrand);
    
    // Total deferred invoices - always shows the full total without any deductions
    // This represents all credit invoices in the report period
    
    set('summaryCount', allItems.length||0); 
    set('summaryPre', sumPre); 
    set('summaryVat', sumVat); 
    set('summaryGrand', sumGrand);

    try{
      if(vouchersTbody && vouchersSection){
        if(Array.isArray(vouchers) && vouchers.length){
          vouchersCount = vouchers.length;
          vouchersTotal = vouchers.reduce((acc, v)=> acc + Number(v.amount||0), 0);
          const rows = vouchers.map(v=>{
            let created = v.created_at ? new Date(v.created_at) : null;
            if(!created || isNaN(created.getTime())){ try{ created = new Date(String(v.created_at).replace(' ', 'T')); }catch(_){ created = new Date(); } }
            const datePart = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {year:'numeric', month:'2-digit', day:'2-digit'}).format(created);
            const timePart = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {hour:'2-digit', minute:'2-digit', hour12:true}).format(created);
            const pm = String(v.payment_method||'').toLowerCase();
            const payLabel = (m)=> m==='cash' ? 'نقدًا' : (m==='card'||m==='network' ? 'شبكة' : (m||'-'));
            const viewBtn = `<button class="view-btn" data-view="${v.id}">عرض</button>`;
            return `<tr><td>${v.voucher_no||''}</td><td>${datePart}<br>${timePart}</td><td>${v.invoice_no||''}</td><td>${payLabel(pm)}</td><td>${fmt(v.amount||0)}</td><td>${v.user_name||''}</td><td>${viewBtn}</td></tr>`;
          }).join('');
          vouchersTbody.innerHTML = rows;
          try{
            vouchersTbody.querySelectorAll('button.view-btn[data-view]').forEach(btn=>{
              btn.addEventListener('click', async (ev)=>{
                if(ev){ ev.preventDefault(); ev.stopPropagation(); }
                const id = Number(btn.getAttribute('data-view'))||0;
                if(!id) return;
                try{
                  const res = await window.api.vouchers_get(id);
                  if(res && res.ok && res.item){
                    const v = res.item;
                    const printUrl = `../suppliers/payment-voucher-print.html?voucher_no=${encodeURIComponent(v.voucher_no)}&invoice_no=${encodeURIComponent(v.invoice_no || '')}&supplier_id=${encodeURIComponent(v.entity_id || '')}&supplier_name=${encodeURIComponent(v.entity_name || '')}&supplier_phone=${encodeURIComponent(v.entity_phone || '')}&supplier_tax=${encodeURIComponent(v.entity_tax_number || '')}&amount=${encodeURIComponent(v.amount)}&method=${encodeURIComponent(v.payment_method || 'cash')}&notes=${encodeURIComponent(v.notes || '')}&user_name=${encodeURIComponent(v.user_name || '')}&date=${encodeURIComponent(v.created_at || '')}`;
                    window.open(printUrl, 'VOUCHER_PRINT', 'width=800,height=900,menubar=no,toolbar=no,location=no,status=no');
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
          vouchersSection.style.display = 'block';
        } else {
          vouchersCount = 0; vouchersTotal = 0;
          vouchersTbody.innerHTML = '<tr><td colspan="7" class="muted">لا توجد سندات</td></tr>';
          vouchersSection.style.display = 'none';
        }
        const vTot = document.getElementById('vouchersTotal'); if(vTot) vTot.textContent = fmt(vouchersTotal);
        const vCnt = document.getElementById('vouchersCount'); if(vCnt) vCnt.textContent = String(vouchersCount);
        const vouchersPre = vouchersTotal / 1.15;
        const vouchersVat = vouchersTotal - vouchersPre;
        set('voucherCount', vouchersCount);
        set('vouchersPre', vouchersPre);
        set('vouchersVat', vouchersVat);
        set('vouchersGrand', vouchersTotal);
        const netPre = Number(creditPre||0) - Number(vouchersPre||0);
        const netVat = Number(creditVat||0) - Number(vouchersVat||0);
        const net = Number(creditGrand||0) - Number(vouchersTotal||0);
        const netBalancePreEl = document.getElementById('netBalancePre'); if(netBalancePreEl) netBalancePreEl.textContent = fmt(netPre);
        const netBalanceVatEl = document.getElementById('netBalanceVat'); if(netBalanceVatEl) netBalanceVatEl.textContent = fmt(netVat);
        const netEl = document.getElementById('netBalance'); if(netEl) netEl.textContent = fmt(net);
      }
    }catch(_){ }

    try{
      const container = document.getElementById('payTotals');
      if(container){
        const label = (k)=> k==='cash'?'نقدًا':(k==='card'?'شبكة':(k==='credit'?'آجل':k));
        const icon = (k)=> k==='cash'?'💵':(k==='card'?'💳':(k==='credit'?'📝':'💰'));
        const color = (k)=> k==='cash'?'linear-gradient(135deg, #10b981, #059669)':(k==='card'?'linear-gradient(135deg, #0891b2, #0e7490)':(k==='credit'?'linear-gradient(135deg, #f59e0b, #d97706)':'linear-gradient(135deg, #6366f1, #4f46e5)'));
        const entries = Array.from(payTotals.entries()).filter(([k])=>k);
        entries.sort((a,b)=> a[0].localeCompare(b[0]));
        container.innerHTML = entries.map(([k,v])=>`<div style="background:${color(k)}; border-radius:12px; padding:14px; color:#fff; box-shadow:0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s ease" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='translateY(0)'"><div style="font-size:13px; opacity:0.9; margin-bottom:6px">${icon(k)} ${label(k)}</div><div style="font-weight:800; font-size:22px">${fmt(Number(v||0))}</div></div>`).join('') || '<div class="muted">لا توجد بيانات طرق الدفع ضمن الفترة</div>';
      }
    }catch(_){ }

    try{
      let __defPrintFormat = 'thermal';
      try{ const r = await window.api.settings_get(); if(r && r.ok && r.item){ __defPrintFormat = (r.item.default_print_format === 'a4') ? 'a4' : 'thermal'; } }catch(_){ }
      const invTbody = document.getElementById('invTbody');
      if(invTbody){
        invTbody.querySelectorAll('button[data-view]').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = Number(btn.getAttribute('data-view'));
            const page = (__defPrintFormat === 'a4') ? '../purchase_invoices/print-a4.html' : '../purchase_invoices/print-a4.html';
            const w = 900;
            const h = 1000;
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
    if(!selectedSupplierId){ alert('يرجى اختيار مورد أولاً'); return; }
    loadRange(s, e);
  }); }
  if(supplierSearchEl){ supplierSearchEl.addEventListener('keydown', (ev)=>{
    if(ev.key==='Enter'){
      const s = fromInputToStr(fromAtEl);
      const e = fromInputToStr(toAtEl);
      if(s && e && selectedSupplierId){ loadRange(s, e); }
    }
  }); }
})();

initDefaultRange();
