// Unpaid invoices report: list credit invoices (payment_status=unpaid) within a date range
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
    // Fetch unpaid credit invoices in range
    const res = await window.api.sales_list_credit({ date_from: startStr, date_to: endStr, settled_only: false, pageSize: 50000 });
    const items = (res && res.ok) ? (res.items||[]) : [];

    const invTbody = document.getElementById('invTbody');
    let sumGrand = 0;

    const rows = items.map(s=>{
      // Use created_at for unpaid credit invoices
      let created = s.created_at ? new Date(s.created_at) : null;
      if(!created || isNaN(created.getTime())){ try{ created = new Date(String(s.created_at||'').replace(' ', 'T')); }catch(_){ created = new Date(); } }
      const dateStr = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:true}).format(created);
      const cust = s.customer_name || s.disp_customer_name || '';
      const grand = Number(s.grand_total||0);
      sumGrand += grand;
      const payLabels = { cash:'كاش', card:'شبكة', credit:'آجل', mixed:'مختلط', tamara:'تمارا', tabby:'تابي', refund:'إشعار دائن' };
      const payKey = String(s.payment_method||'').toLowerCase();
      const pay = payLabels[payKey] || (s.payment_method || '');
      const viewBtn = `<button class=\"btn\" data-view=\"${s.id}\">عرض</button>`;
      return `<tr><td>${s.invoice_no||''}</td><td>${cust}</td><td>${dateStr}</td><td>${pay}</td><td>${fmt(grand)}</td><td>${viewBtn}</td></tr>`;
    }).join('');

    if(invTbody){ invTbody.innerHTML = rows || '<tr><td colspan="6" class="muted">لا توجد فواتير غير مدفوعة ضمن الفترة</td></tr>'; }
    const set = (id, v)=>{ const el = document.getElementById(id); if(!el) return; el.textContent = (id==='sumCount') ? String(items.length||0) : fmt(v); };
    set('sumGrand', sumGrand); set('sumCount', items.length||0);

    // open print view
    try{
      document.querySelectorAll('button[data-view]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = Number(btn.getAttribute('data-view'));
          try{
            // Honor default_print_format from settings
            let __defPrintFormat = 'thermal';
            try{ const r = await window.api.settings_get(); if(r && r.ok && r.item){ __defPrintFormat = (r.item.default_print_format === 'a4') ? 'a4' : 'thermal'; } }catch(_){ }
            const page = (__defPrintFormat === 'a4') ? '../sales/print-a4.html' : '../sales/print.html';
            const w = (__defPrintFormat === 'a4') ? 900 : 500;
            const h = (__defPrintFormat === 'a4') ? 1000 : 700;
            // إضافة refresh=1 لضمان تحميل البيانات المحدثة وعرض تاريخ الدفع
            const url = `${page}?id=${encodeURIComponent(String(id))}&refresh=1`; // pay سيُستنتج من الفاتورة نفسها
            window.open(url, 'PRINT_VIEW', `width=${w},height=${h}`);
          }catch(_){
            const page = '../sales/print.html';
            const w = 500, h = 700;
            const url = `${page}?id=${encodeURIComponent(String(id))}&refresh=1`;
            window.open(url, 'PRINT_VIEW', `width=${w},height=${h}`);
          }
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
        const title = `unpaid-invoices-${safe||Date.now()}.pdf`;
        await window.api.pdf_export(document.documentElement.outerHTML, { saveMode:'auto', filename: title, pageSize:'A4' });
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
          const sumGrand = document.getElementById('sumGrand')?.textContent || '0.00';
          const sumCount = document.getElementById('sumCount')?.textContent || '0';
          lines.push('');
          lines.push([esc('عدد الفواتير'), esc(sumCount), esc('إجمالي المبالغ'), esc(sumGrand)].join(','));
        }
        const period = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.replace(/[^0-9_\-–: ]+/g,'').replace(/\s+/g,' ').trim() : '';
        const filename = `unpaid-invoices-${(period||'').replace(/[: ]/g,'_')||Date.now()}.csv`;
        await window.api.csv_export(lines.join('\n'), { saveMode:'auto', filename });
      }catch(e){ console.error(e); alert('تعذر إنشاء Excel'); }
      finally{ exporting = false; btnExcel.disabled = false; }
    });
  }
})();

initDefaultRange();