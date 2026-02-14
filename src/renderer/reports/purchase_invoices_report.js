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

(function attachExportHandlers(){
  let exporting = false;
  const btnPdf = document.getElementById('exportPdfBtn');
  if(btnPdf){
    btnPdf.addEventListener('click', async () => {
      if(exporting) return; exporting = true; btnPdf.disabled = true;
      try{
        const period = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.replace(/[^0-9_\-–: ]+/g,'').replace(/\s+/g,' ').trim() : '';
        const safe = (period||'').replace(/[: ]/g,'_');
        const title = `purchase-invoices-report-${safe||Date.now()}.pdf`;
        
        // إنشاء نسخة نظيفة للتصدير
        const clone = document.documentElement.cloneNode(true);
        
        // إزالة العناصر التفاعلية
        try{
          const header = clone.querySelector('header');
          if(header) header.remove();
          
          const rangeBar = clone.querySelector('.range-bar');
          if(rangeBar) rangeBar.remove();
          
          clone.querySelectorAll('.input, .btn, label, .toolbar').forEach(el => el.remove());
          
          // إزالة عمود العرض
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
          
          // إضافة عنوان التقرير في الأعلى
          const container = clone.querySelector('.container');
          if(container){
            const titleSection = clone.ownerDocument.createElement('div');
            titleSection.className = 'pdf-title-section';
            titleSection.innerHTML = `
              <h1 class="pdf-main-title">تقرير فواتير الشراء</h1>
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
        if(rangeEl && rangeEl.textContent){ lines.push(esc('الفترة'), esc(rangeEl.textContent.trim())); lines.push(''); }
        addTable('فواتير الشراء ضمن الفترة', document.querySelector('table tbody#invTbody')?.closest('table'));
        const csv = lines.join('\n');
        const period = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.replace(/[^0-9_\-–: ]+/g,'').replace(/\s+/g,' ').trim() : '';
        const filename = `purchase-invoices-report-${(period||'').replace(/[: ]/g,'_')||Date.now()}.csv`;
        await window.api.csv_export(csv, { saveMode:'auto', filename });
      }catch(e){ console.error(e); alert('تعذر إنشاء Excel'); }
      finally{ exporting = false; btnExcel.disabled = false; }
    });
  }
})();

function toStr(d){
  const pad2 = (v)=> String(v).padStart(2,'0');
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`;
}

function fromInputToStr(input){
  const v = (input?.value||'').trim();
  if(!v) return '';
  return v.replace('T',' ') + ':00';
}

let currentPage = 1;
const PAGE_SIZE = 100;

async function loadRange(startStr, endStr, page = 1){
  currentPage = page;
  try{
    if(rangeEl){ rangeEl.textContent = `الفترة: ${startStr} — ${endStr}`; }

    const res = await window.api.purchase_invoices_list({ from: startStr, to: endStr, pageSize: PAGE_SIZE, page: currentPage });
    const invoices = (res && res.ok) ? (res.items||[]) : [];

    const invTbody = document.getElementById('invTbody');
    let sumCount = 0, sumPre = 0, sumVat = 0, sumTotal = 0, sumPaid = 0;
    const labelPayment = (m)=>{ const raw = (m==null?'':String(m)); const x=raw.toLowerCase(); if(x==='network' || x==='card') return 'شبكة'; if(x==='credit' || raw==='آجل' || raw==='اجل') return 'آجل'; return 'نقدًا'; };
    
    const rows = invoices.map(inv => {
      const invoiceNo = inv.invoice_no || '';
      const printedNo = (()=>{ const m = String(invoiceNo).match(/^PI-\d{6}-(\d+)$/); return m ? String(Number(m[1])) : invoiceNo; })();
      
      const dateStr = inv.invoice_at || inv.created_at || null;
      const dateOut = dateStr ? new Intl.DateTimeFormat('en-GB-u-ca-gregory', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:true}).format(new Date(dateStr)) : '';
      
      const supplier = inv.supplier_name || '';
      const payment = labelPayment(inv.payment_method||'');
      const sub = Number(inv.sub_total||0);
      // For zero_vat invoices: recalculate with 0% VAT
      const priceMode = String(inv.price_mode||'inclusive');
      const vat = (priceMode === 'zero_vat') ? 0 : Number(inv.vat_total||0);
      const total = (priceMode === 'zero_vat') ? sub : Number(inv.grand_total||0);
      const methodRaw = String(inv.payment_method||'').toLowerCase();
      const isCredit = (methodRaw === 'credit' || methodRaw === 'آجل' || methodRaw === 'اجل');
      const paid = (priceMode === 'zero_vat') ? (isCredit ? 0 : sub) : Number(inv.amount_paid||0);
      const notes = inv.notes || '';
      const invId = inv.id || '';

      sumCount += 1;
      sumPre += sub;
      sumVat += vat;
      sumTotal += total;
      sumPaid += paid;

      return `<tr><td>${printedNo}</td><td>${dateOut}</td><td>${supplier}</td><td>${payment}</td><td>${fmt(sub)}</td><td>${fmt(vat)}</td><td>${fmt(total)}</td><td>${fmt(paid)}</td><td>${notes}</td><td><button class="view-btn" data-inv-id="${invId}">عرض</button></td></tr>`;
    }).join('');
    
    if(invTbody){ 
      invTbody.innerHTML = rows || '<tr><td colspan="10" class="muted">لا توجد فواتير شراء ضمن الفترة</td></tr>';
      
      invTbody.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const invId = btn.getAttribute('data-inv-id');
          if(invId){
            const w = Math.min(960, screen.width - 100);
            const h = Math.min(800, screen.height - 100);
            window.open(`../purchase_invoices/print-a4.html?id=${encodeURIComponent(invId)}`, 'PURCHASE_PRINT_A4', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
          }
        });
      });
    }

    const set = (id,val)=>{ const el=document.getElementById(id); if(el){ el.textContent = (id==='sumCount') ? String(val) : fmt(val); } };
    set('sumCount', sumCount); set('sumPre', sumPre); set('sumVat', sumVat); set('sumTotal', sumTotal); set('sumPaid', sumPaid);

    const total = (res && res.total != null) ? res.total : invoices.length;
    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
    updatePagination(currentPage, totalPages, total, startStr, endStr);
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
  const end = now;
  const s = toStr(start), e = toStr(end);
  if(fromAtEl) fromAtEl.value = s.replace(' ', 'T').slice(0,16);
  if(toAtEl) toAtEl.value = e.replace(' ', 'T').slice(0,16);
}

(function wireRange(){
  const btn = document.getElementById('applyRangeBtn');
  if(btn){
    btn.addEventListener('click', () => {
      const s = fromInputToStr(fromAtEl);
      const e = fromInputToStr(toAtEl);
      if(!s || !e){ alert('يرجى تحديد الفترة (من وإلى)'); return; }
      loadRange(s, e, 1);
    });
  }
})();

initDefaultRange();