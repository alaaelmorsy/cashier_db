// Customer invoices report: filter by single customer and date-time range
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
let selectedCustomerId = null;

const btnBack = document.getElementById('btnBack');
if(btnBack){ btnBack.onclick = ()=>{ window.location.href = './index.html'; } }

// بحث فوري عن العملاء بالاسم/الجوال مع اقتراحات واختيار معرف العميل
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
      if(!items.length){ showSuggest('<div class="muted" style="padding:10px 12px">لا توجد نتائج</div>'); return; }
      const rows = items.slice(0,50).map(c=>{
        const phone = c.phone ? ` — ${c.phone}` : '';
        return `<div class="opt" data-id="${c.id}" data-name="${c.name||''}" data-phone="${c.phone||''}">${c.name||('عميل #' + c.id)}${phone}</div>`;
      }).join('');
      showSuggest(rows);
      // attach click
      Array.from(customerSuggestEl.querySelectorAll('.opt')).forEach(el => {
        el.addEventListener('click', () => {
          selectedCustomerId = Number(el.getAttribute('data-id'))||null;
          const nm = el.getAttribute('data-name')||'';
          const ph = el.getAttribute('data-phone')||'';
          customerSearchEl.value = nm || (ph?ph:('عميل #' + selectedCustomerId));
          hideSuggest();
        });
      });
    }catch(e){ console.error(e); showSuggest('<div class="muted" style="padding:10px 12px">خطأ في البحث</div>'); }
  };
  customerSearchEl.addEventListener('input', (e)=>{
    const q = e.target.value || '';
    selectedCustomerId = null; // لأن المستخدم يغيّر النص
    if(q===lastQuery) return; lastQuery = q;
    clearTimeout(timer); timer = setTimeout(()=> doSearch(q), 250);
  });
  customerSearchEl.addEventListener('focus', ()=>{ if(customerSearchEl.value) doSearch(customerSearchEl.value); });
  document.addEventListener('click', (ev)=>{ if(!customerSuggestEl.contains(ev.target) && ev.target!==customerSearchEl){ hideSuggest(); } });
})();

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
        const title = `customer-invoices${cust}-${safe||Date.now()}.pdf`;
        
        const clone = document.documentElement.cloneNode(true);
        
        try{
          const header = clone.querySelector('header');
          if(header) header.remove();
          
          const rangeBar = clone.querySelector('.range-bar');
          if(rangeBar) rangeBar.remove();
          
          clone.querySelectorAll('.input, .btn, label, .toolbar').forEach(el => el.remove());
          
          const table = clone.querySelector('table');
          if(table){
            const headRow = table.querySelector('thead tr');
            if(headRow && headRow.lastElementChild){
              headRow.removeChild(headRow.lastElementChild);
            }
            clone.querySelectorAll('tbody tr').forEach(tr => {
              if(tr.lastElementChild) tr.removeChild(tr.lastElementChild);
            });
            const footRow = table.querySelector('tfoot tr');
            if(footRow && footRow.lastElementChild){
              footRow.removeChild(footRow.lastElementChild);
            }
          }
          
          const container = clone.querySelector('.container');
          if(container){
            const custName = customerSearchEl?.value || 'جميع العملاء';
            const titleSection = clone.ownerDocument.createElement('div');
            titleSection.className = 'pdf-title-section';
            titleSection.innerHTML = `
              <h1 class="pdf-main-title">تقرير العملاء</h1>
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
          
          header, #range, .range-bar, .toolbar, .btn, .input, label {
            display: none !important;
            margin: 0 !important;
            padding: 0 !important;
            height: 0 !important;
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
        const tableElem = document.querySelector('tbody#invTbody')?.closest('table');
        if(rangeEl && rangeEl.textContent){ lines.push(esc('الفترة'), esc(rangeEl.textContent.trim())); lines.push(''); }
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
          lines.push([esc('الإجماليات'), '', '', '', esc(sumPre), esc(sumVat), esc(sumGrand)].join(','));
        }
        const period = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.replace(/[^0-9_\-–: ]+/g,'').replace(/\s+/g,' ').trim() : '';
        const filename = `customer-invoices-c${selectedCustomerId||'all'}-${(period||'').replace(/[: ]/g,'_')||Date.now()}.csv`;
        await window.api.csv_export(lines.join('\n'), { saveMode:'auto', filename });
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
        // Remove toolbar actions and range inputs from print version
        try{
          const toolbar = clone.querySelector('.range-actions');
          if(toolbar){ toolbar.parentNode.removeChild(toolbar); }
          const rangeInputs = clone.querySelector('.range-inputs');
          if(rangeInputs){ rangeInputs.parentNode.removeChild(rangeInputs); }
          const hdr = clone.querySelector('header');
          if(hdr && hdr.parentNode){ hdr.parentNode.removeChild(hdr); }
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
          // Mark the invoices table for grid and column width styles
          const tbInv = clone.getElementById('invTbody');
          const tableInv = tbInv?.closest('table');
          if(tableInv){ tableInv.classList.add('tbl-inv','grid-table'); }
        }catch(_){ }

        // Add print styles for 80mm width
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

          /* Hide action column ("عرض") to ensure it never appears */
          table thead th:last-child,
          table tbody td:last-child,
          table tfoot th:last-child { display: none !important; }

          /* Full grid like All Invoices */
          table{ border:2px solid #000; }
          table th, table td{ border:1px solid #000; }
          table tfoot th{ border-top:2px solid #000; }

          /* Grid like All Invoices (class-based as well) */
          .grid-table{ border:2px solid #000; }
          .grid-table th, .grid-table td{ border:1px solid #000; }
          .grid-table tfoot th{ border-top:2px solid #000; }
          
          /* Column widths (thermal): fit phone and date tightly; keep others reasonable */
          .tbl-inv th:nth-child(1), .tbl-inv td:nth-child(1){ width:12%; }
          .tbl-inv th:nth-child(2), .tbl-inv td:nth-child(2){ width:auto; white-space:nowrap; direction:ltr; text-align:left; }
          .tbl-inv th:nth-child(3), .tbl-inv td:nth-child(3){ width:auto; white-space:nowrap; font-size:8.5px; }
          .tbl-inv th:nth-child(4), .tbl-inv td:nth-child(4){ width:12%; font-size:8.5px; }
          .tbl-inv th:nth-child(5), .tbl-inv td:nth-child(5){ width:10%; }
          .tbl-inv th:nth-child(6), .tbl-inv td:nth-child(6){ width:8%; }
          .tbl-inv th:nth-child(7), .tbl-inv td:nth-child(7){ width:8%; }
        `;
        clone.querySelector('head')?.appendChild(style);
        
        // Ensure period info is visible and properly formatted in print
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

let currentPage = 1;
const PAGE_SIZE = 100;

async function loadRange(startStr, endStr, page = 1){
  currentPage = page;
  if(rangeEl){ rangeEl.textContent = `الفترة: ${startStr} — ${endStr}`; }
  const custId = Number(selectedCustomerId||0) || null;
  try{
    const query = { date_from: startStr, date_to: endStr, type: 'invoice', pageSize: PAGE_SIZE, page: currentPage };
    if(custId){ query.customer_id = custId; } else { query.customers_only = true; }
    const res = await window.api.sales_list(query);
    const items = (res && res.ok) ? (res.items||[]) : [];

    const invTbody = document.getElementById('invTbody');
    let sumPre = 0, sumVat = 0, sumGrand = 0;
    const payTotals = new Map();

    const rows = items.map(s=>{
      let created = s.created_at ? new Date(s.created_at) : null;
      if(!created || isNaN(created.getTime())){ try{ created = new Date(String(s.created_at).replace(' ', 'T')); }catch(_){ created = new Date(); } }
      const datePart = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {year:'numeric', month:'2-digit', day:'2-digit'}).format(created);
      const timePart = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {hour:'2-digit', minute:'2-digit', hour12:true}).format(created);
      // Prefer phone; fallback to stored snapshot name if phone missing
      const custPhone = s.customer_phone || s.disp_customer_phone || '';
      const cust = custPhone || (s.customer_name || s.disp_customer_name || '');
      const pre = Number(s.sub_total||0);
      const vat = Number(s.vat_total||0);
      const grand = Number(s.grand_total||0);
      sumPre += pre; sumVat += vat; sumGrand += grand;
      const pm = String(s.payment_method || '').toLowerCase();
      const payLabel = (m)=> m==='cash' ? 'نقدًا' : (m==='card'||m==='network' ? 'شبكة' : (m==='credit' ? 'آجل' : (m==='mixed'?'مختلط': m)));
      // totals by payment
      const addAmt = (key, amount)=>{
        if(!key) return; const k=(key==='network'?'card':key); const prev=Number(payTotals.get(k)||0); payTotals.set(k, prev + Number(amount||0)); };
      if(pm==='mixed'){
        addAmt('cash', Number(s.pay_cash_amount||0) || grand/2);
        addAmt('card', Number(s.pay_card_amount||0) || grand/2);
      } else if(pm==='cash'){
        addAmt('cash', Number(s.settled_cash||0) || Number(s.pay_cash_amount||0) || grand);
      } else if(pm==='card' || pm==='network' || pm==='tamara' || pm==='tabby'){
        addAmt(pm, Number(s.pay_card_amount||0) || grand);
      } else if(pm){ addAmt(pm, grand); }
      const viewBtn = `<button data-view="${s.id}">عرض</button>`;
      return `<tr><td>${s.invoice_no||''}</td><td dir="ltr" style="text-align:left">${cust}</td><td>${datePart}<br>${timePart}</td><td>${payLabel(pm)}</td><td>${fmt(pre)}</td><td>${fmt(vat)}</td><td>${fmt(grand)}</td><td>${viewBtn}</td></tr>`;
    }).join('');

    if(invTbody){ invTbody.innerHTML = rows || '<tr><td colspan="8" class="muted">لا توجد فواتير ضمن الفترة</td></tr>'; }
    const set = (id, v)=>{ const el = document.getElementById(id); if(!el) return; el.textContent = (id==='sumCount') ? String(v) : fmt(v); };
    set('sumPre', sumPre); set('sumVat', sumVat); set('sumGrand', sumGrand); set('sumCount', items.length||0);

    const total = (res && res.total != null) ? res.total : items.length;
    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
    updatePagination(currentPage, totalPages, total, startStr, endStr);

    // render payment totals
    try{
      const container = document.getElementById('payTotals');
      if(container){
        const label = (k)=> k==='cash'?'نقدًا':(k==='card'?'شبكة':(k==='credit'?'آجل':(k==='tamara'?'تمارا':(k==='tabby'?'تابي':k))));
        const entries = Array.from(payTotals.entries()).filter(([k])=>k);
        entries.sort((a,b)=> a[0].localeCompare(b[0]));
        container.innerHTML = entries.map(([k,v])=>{
          const ttl = Number(v||0);
          return `<div style="border:1px solid var(--border); border-radius:10px; padding:14px; background:#fff">
            <div class="muted" style="font-size:15px; margin-bottom:8px">${label(k)}</div>
            <div style="font-weight:700; font-size:22px">${fmt(ttl)}</div>
          </div>`;
        }).join('') || '<div class="muted">لا توجد بيانات طرق الدفع ضمن الفترة</div>';
      }
    }catch(_){ }

    // open print view
    try{
      // Honor default_print_format from settings
      let __defPrintFormat = 'thermal';
      try{ const r = await window.api.settings_get(); if(r && r.ok && r.item){ __defPrintFormat = (r.item.default_print_format === 'a4') ? 'a4' : 'thermal'; } }catch(_){ }
      document.querySelectorAll('button[data-view]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = Number(btn.getAttribute('data-view'));
          const page = (__defPrintFormat === 'a4') ? '../sales/print-a4.html' : '../sales/print.html';
          const w = (__defPrintFormat === 'a4') ? 900 : 500;
          const h = (__defPrintFormat === 'a4') ? 1000 : 700;
          // إضافة refresh=1 لضمان تحميل البيانات المحدثة وعرض تاريخ الدفع
          const url = `${page}?id=${encodeURIComponent(String(id))}&refresh=1`;
          window.open(url, 'PRINT_VIEW', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
        });
      });
    }catch(_){ }
  }catch(e){ console.error(e); }
}

function updatePagination(page, totalPages, totalRecords, startStr, endStr){
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
  const infoText = totalRecords > 0 ? `عرض ${start} - ${end} من ${totalRecords} فاتورة` : 'لا توجد فواتير';
  const prevDisabled = page <= 1 ? 'disabled' : '';
  const nextDisabled = page >= totalPages ? 'disabled' : '';
  paginationEl.innerHTML = `
    <div style="font-weight:700; color:var(--text)">${infoText}</div>
    <div style="display:flex; gap:8px; align-items:center">
      <button id="prevPageBtn" class="btn" ${prevDisabled} style="${prevDisabled?'opacity:0.5;cursor:not-allowed':''}">السابق</button>
      <span style="font-weight:700; color:var(--text)">صفحة ${page} من ${totalPages}</span>
      <button id="nextPageBtn" class="btn" ${nextDisabled} style="${nextDisabled?'opacity:0.5;cursor:not-allowed':''}">التالي</button>
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
    loadRange(s, e, 1);
  }); }
  if(customerSearchEl){ customerSearchEl.addEventListener('keydown', (ev)=>{
    if(ev.key==='Enter'){
      const s = fromInputToStr(fromAtEl);
      const e = fromInputToStr(toAtEl);
      if(s && e){ loadRange(s, e, 1); }
    }
  }); }
})();

initDefaultRange();