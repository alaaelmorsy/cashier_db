// Credit invoices report: show unpaid credit invoices within a date range
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

const btnBack = document.getElementById('btnBack');
if(btnBack){ btnBack.onclick = ()=>{ window.location.href = './index.html'; } }

function toStartStr(input){
  const v = (input?.value||'').trim();
  return v ? v.replace('T',' ') + ':00' : '';
}
function toEndStr(input){
  const v = (input?.value||'').trim();
  return v ? v.replace('T',' ') + ':59' : '';
}
function toStr(d){
  const pad2 = (v)=> String(v).padStart(2,'0');
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`;
}

function initDefaultRange(){
  const now = new Date();
  const start = new Date(now); start.setHours(0,0,0,0);
  const s = toStr(start), e = toStr(now);
  if(fromAtEl) fromAtEl.value = s.replace(' ', 'T').slice(0,16);
  if(toAtEl) toAtEl.value = e.replace(' ', 'T').slice(0,16);
}

async function loadRange(startStr, endStr){
  if(rangeEl){ rangeEl.textContent = `الفترة: ${startStr} — ${endStr}`; }
  try{
    const res = await window.api.sales_list_credit_notes({ date_from: startStr, date_to: endStr, pageSize: 50000 });
    let items = (res && res.ok) ? (res.items||[]) : [];
    // Fallback: use generic sales_list(type=credit) if new endpoint not available or returns empty
    if((!res || !res.ok) || items.length === 0){
      try{
        const res2 = await window.api.sales_list({ type: 'credit', date_from: startStr, date_to: endStr, pageSize: 50000 });
        if(res2 && res2.ok){ items = (res2.items||[]).filter(x => String(x.doc_type||'')==='credit_note' || String(x.invoice_no||'').startsWith('CN-')); }
      }catch(_){ /* ignore */ }
    }

    const invTbody = document.getElementById('invTbody');
    let sumGrand = 0;

    const rows = items.map(s=>{
      // Show CN date and link base invoice
      let cnDate = s.created_at ? new Date(s.created_at) : null;
      if(!cnDate || isNaN(cnDate.getTime())){ try{ cnDate = new Date(String(s.created_at||'').replace(' ', 'T')); }catch(_){ cnDate = new Date(); } }
      const cnDatePart = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {year:'numeric', month:'2-digit', day:'2-digit'}).format(cnDate);
      const cnTimePart = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {hour:'2-digit', minute:'2-digit', hour12:true}).format(cnDate);
      const custPhone = s.customer_phone || s.disp_customer_phone || '';
      const cust = custPhone || (s.customer_name || s.disp_customer_name || '');
      const cnAmount = Number(s.grand_total||0);
      sumGrand += cnAmount;
      const baseNo = s.base_invoice_no || s.ref_base_invoice_no || '';
      const baseLink = s.base_id ? `<button class="btn" data-view-base="${s.base_id}">${baseNo||'عرض'}</button>` : (baseNo||'');
      const viewCN = `<button class="btn" data-view-cn="${s.id}">عرض الإشعار</button>`;
      return `<tr>
        <td>${s.invoice_no||''}</td>
        <td dir="ltr" style="text-align:left">${cust}</td>
        <td>${cnDatePart}<br>${cnTimePart}</td>
        <td>${fmt(cnAmount)}</td>
        <td>${baseLink}</td>
        <td>${viewCN}</td>
      </tr>`;
    }).join('');

    if(invTbody){ invTbody.innerHTML = rows || '<tr><td colspan="6" class="muted">لا توجد إشعارات دائن ضمن الفترة</td></tr>'; }
    const set = (id, v)=>{ const el = document.getElementById(id); if(!el) return; el.textContent = (id==='sumCount') ? String(v) : fmt(v); };
    set('sumGrand', sumGrand); set('sumCount', items.length||0);

    // open print view
    try{
      // View CN
      // Honor default_print_format from settings
      let __defPrintFormat = 'thermal';
      try{ const r = await window.api.settings_get(); if(r && r.ok && r.item){ __defPrintFormat = (r.item.default_print_format === 'a4') ? 'a4' : 'thermal'; } }catch(_){ }
      document.querySelectorAll('button[data-view-cn]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = Number(btn.getAttribute('data-view-cn'));
          const page = (__defPrintFormat === 'a4') ? '../sales/print-a4.html' : '../sales/print.html';
          const w = (__defPrintFormat === 'a4') ? 900 : 500;
          const h = (__defPrintFormat === 'a4') ? 1000 : 700;
          // إضافة refresh=1 لضمان تحميل البيانات المحدثة وعرض تاريخ الدفع
          const url = `${page}?id=${encodeURIComponent(String(id))}&pay=refund&refresh=1&hide_pay_remain=1`;
          window.open(url, 'PRINT_VIEW', `width=${w},height=${h}`);
        });
      });
      // View base invoice
      document.querySelectorAll('button[data-view-base]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = Number(btn.getAttribute('data-view-base'));
          const page = (__defPrintFormat === 'a4') ? '../sales/print-a4.html' : '../sales/print.html';
          const w = (__defPrintFormat === 'a4') ? 900 : 500;
          const h = (__defPrintFormat === 'a4') ? 1000 : 700;
          // إضافة refresh=1 لضمان تحميل البيانات المحدثة وعرض تاريخ الدفع
          const url = `${page}?id=${encodeURIComponent(String(id))}&refresh=1&hide_pay_remain=1`;
          window.open(url, 'PRINT_VIEW', `width=${w},height=${h}`);
        });
      });
    }catch(_){ }
  }catch(e){ console.error(e); }
}

(function wireRange(){
  const btn = document.getElementById('applyRangeBtn');
  if(btn){ btn.addEventListener('click', () => {
    const s = toStartStr(fromAtEl);
    const e = toEndStr(toAtEl);
    if(!s || !e){ alert('يرجى تحديد الفترة (من وإلى)'); return; }
    loadRange(s, e);
  }); }
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
        const title = `credit-invoices-${safe||Date.now()}.pdf`;
        
        // إنشاء نسخة نظيفة للتصدير
        const clone = document.documentElement.cloneNode(true);
        
        // إزالة العناصر التفاعلية
        try{
          const header = clone.querySelector('header');
          if(header) header.remove();
          
          const rangeBar = clone.querySelector('.range-bar');
          if(rangeBar) rangeBar.remove();
          
          clone.querySelectorAll('.input, .btn, label, .toolbar').forEach(el => el.remove());
          
          // إزالة أعمدة العرض
          const table = clone.querySelector('table');
          if(table){
            const headRow = table.querySelector('thead tr');
            if(headRow && headRow.lastElementChild){
              headRow.removeChild(headRow.lastElementChild);
              if(headRow.lastElementChild) headRow.removeChild(headRow.lastElementChild);
            }
            clone.querySelectorAll('tbody tr').forEach(tr => {
              if(tr.lastElementChild) tr.removeChild(tr.lastElementChild);
              if(tr.lastElementChild) tr.removeChild(tr.lastElementChild);
            });
          }
          
          // إضافة عنوان التقرير في الأعلى
          const container = clone.querySelector('.container');
          if(container){
            const titleSection = clone.ownerDocument.createElement('div');
            titleSection.className = 'pdf-title-section';
            titleSection.innerHTML = `
              <h1 class="pdf-main-title">تقرير الفواتير الدائنة</h1>
              <div class="pdf-period">${rangeEl?.textContent || ''}</div>
            `;
            container.insertBefore(titleSection, container.firstChild);
          }
        }catch(_){}
        
        // إضافة أنماط خاصة بـ PDF
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
          const sumGrand = document.getElementById('sumGrand')?.textContent || '0.00';
          const sumCount = document.getElementById('sumCount')?.textContent || '0';
          lines.push('');
          lines.push([esc('عدد الفواتير'), esc(sumCount), esc('إجمالي المبالغ'), esc(sumGrand)].join(','));
        }
        const period = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.replace(/[^0-9_\-–: ]+/g,'').replace(/\s+/g,' ').trim() : '';
        const filename = `credit-invoices-${(period||'').replace(/[: ]/g,'_')||Date.now()}.csv`;
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
          const removeLastTwoCols = (tbodyId) => {
            const tb = clone.getElementById(tbodyId);
            if(!tb) return;
            const table = tb.closest('table');
            if(!table) return;
            const headRow = table.querySelector('thead tr');
            if(headRow && headRow.lastElementChild){ 
              headRow.removeChild(headRow.lastElementChild); // Remove view CN column
              if(headRow.lastElementChild){ headRow.removeChild(headRow.lastElementChild); } // Remove base invoice column
            }
            Array.from(tb.querySelectorAll('tr')).forEach(tr => {
              try{ 
                if(tr.lastElementChild) tr.removeChild(tr.lastElementChild);
                if(tr.lastElementChild) tr.removeChild(tr.lastElementChild);
              }catch(_){ }
            });
          };
          removeLastTwoCols('invTbody');
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
          table{ width:100%; max-width:100%; border-collapse:collapse; table-layout: auto; font-size:9.5px; line-height:1.2; }
          th,td{ padding:2px; word-break: normal; overflow-wrap: normal; white-space: normal; }
          th{ background:#eef2ff; color:#0b3daa; border-bottom:2px solid #000; font-size:8.5px; }
          .section{ margin:5px 0; padding:5px; border:1px solid #e5e7eb; }

          /* Full grid borders */
          table{ border:2px solid #000; }
          table th, table td{ border:1px solid #000; }
          table tfoot th{ border-top:2px solid #000; }
          
          /* Fit phone and date to content */
          table th:nth-child(2), table td:nth-child(2){ width:auto; white-space:nowrap; direction:ltr; text-align:left; }
          table th:nth-child(3), table td:nth-child(3){ width:auto; white-space:nowrap; font-size:8.5px; }
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

initDefaultRange();