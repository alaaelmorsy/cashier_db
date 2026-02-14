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

const statusSelect = document.getElementById('statusSelect');

let currentProducts = [];
let sortDirection = 'asc';

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
        const title = `expiry-report-${safe||Date.now()}.pdf`;
        
        const clone = document.documentElement.cloneNode(true);
        
        try{
          const header = clone.querySelector('header');
          if(header) header.remove();
          
          const rangeBar = clone.querySelector('.range-bar');
          if(rangeBar) rangeBar.remove();
          
          clone.querySelectorAll('.input, .btn, label, .toolbar').forEach(el => el.remove());
          
          const container = clone.querySelector('.container');
          if(container){
            const currentTitle = document.getElementById('reportTitle')?.textContent || 'تقرير المنتجات المنتهية الصلاحية';
            const titleSection = clone.ownerDocument.createElement('div');
            titleSection.className = 'pdf-title-section';
            titleSection.innerHTML = `
              <h1 class="pdf-main-title">${currentTitle}</h1>
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
          
          .expired-row {
            background: #fee2e2 !important;
          }
          
          .valid-row {
            background: #dcfce7 !important;
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
        addTable('المنتجات ضمن الفترة', document.querySelector('table tbody#productsTbody')?.closest('table'));
        const csv = lines.join('\n');
        const period = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.replace(/[^0-9_\-–: ]+/g,'').replace(/\s+/g,' ').trim() : '';
        const filename = `expiry-report-${(period||'').replace(/[: ]/g,'_')||Date.now()}.csv`;
        await window.api.csv_export(csv, { saveMode:'auto', filename });
      }catch(e){ console.error(e); alert('تعذر إنشاء Excel'); }
      finally{ exporting = false; btnExcel.disabled = false; }
    });
  }
})();

function calculateDaysDifference(expiryDate){
  const today = new Date();
  today.setHours(0,0,0,0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0,0,0,0);
  
  const diffTime = expiry - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

function renderProducts(products){
  const productsTbody = document.getElementById('productsTbody');
  
  const rows = products.map(p => {
    const expiryDateDisplay = p.expiry_date ? (function(){
      try {
        const dt = new Date(p.expiry_date);
        const y = dt.getFullYear();
        const m = String(dt.getMonth()+1).padStart(2,'0');
        const d = String(dt.getDate()).padStart(2,'0');
        return `${y}-${m}-${d}`;
      } catch(_){ return ''; }
    })() : '';
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const expiry = new Date(p.expiry_date);
    expiry.setHours(0,0,0,0);
    const isExpired = expiry < today;
    const rowClass = isExpired ? 'expired-row' : 'valid-row';
    const statusLabel = isExpired ? 'منتهي' : 'ساري';
    
    const daysDiff = p.daysDiff || 0;
    const daysDisplay = daysDiff < 0 ? `منتهي من ${Math.abs(daysDiff)} يوم` : `متبقي ${daysDiff} يوم`;
    
    return `<tr class="${rowClass}"><td>${p.name||''}</td><td>${p.barcode||'-'}</td><td>${fmt(p.cost)}</td><td>${fmt(p.price)}</td><td>${fmt(p.stock)}</td><td>${expiryDateDisplay}</td><td>${daysDisplay}</td><td>${statusLabel}</td></tr>`;
  }).join('');
  
  if(productsTbody){ 
    const status = statusSelect?.value || 'expired';
    const statusText = status === 'all' ? 'الكل' : (status === 'expired' ? 'منتهية الصلاحية' : 'سارية الصلاحية');
    const emptyMsg = status === 'all' ? 'لا توجد منتجات ضمن الفترة المحددة' : `لا توجد منتجات ${statusText} ضمن الفترة المحددة`;
    productsTbody.innerHTML = rows || `<tr><td colspan="8" class="muted">${emptyMsg}</td></tr>`; 
  }
}

async function loadRange(fromDate, toDate, status){
  try{
    const statusText = status === 'all' ? 'الكل' : (status === 'expired' ? 'منتهية الصلاحية' : 'سارية الصلاحية');
    const reportTitle = status === 'all' ? 'تقرير المنتجات السارية والمنتهية' : (status === 'expired' ? 'تقرير المنتجات المنتهية الصلاحية' : 'تقرير المنتجات السارية الصلاحية');
    
    const titleEl = document.getElementById('reportTitle');
    if(titleEl){ titleEl.textContent = reportTitle; }
    
    if(rangeEl){ rangeEl.textContent = `الحالة: ${statusText} — الفترة: ${fromDate} إلى ${toDate}`; }

    console.log('Fetching products with params:', { from_date: fromDate, to_date: toDate, status: status });
    const res = await window.api.products_get_by_expiry({ from_date: fromDate, to_date: toDate, status: status });
    console.log('API response:', res);
    
    if(!res || !res.ok){
      console.error('API error:', res?.error);
      alert(res?.error || 'حدث خطأ أثناء تحميل البيانات');
      return;
    }
    
    const products = res.products || [];
    console.log('Products found:', products.length);
    
    products.forEach(p => {
      p.daysDiff = calculateDaysDifference(p.expiry_date);
    });
    
    currentProducts = products;
    renderProducts(currentProducts);
  }catch(e){ 
    console.error('Error in loadRange:', e); 
    alert('حدث خطأ: ' + e.message);
  }
}

(function wireRange(){
  const btn = document.getElementById('applyRangeBtn');
  if(btn){
    btn.addEventListener('click', () => {
      const from = fromAtEl?.value || '';
      const to = toAtEl?.value || '';
      const status = statusSelect?.value || 'expired';
      if(!from || !to){ alert('يرجى تحديد الفترة (من وإلى)'); return; }
      loadRange(from, to, status);
    });
  }
})();

(function wireSortByDays(){
  const sortHeader = document.getElementById('daysSortHeader');
  if(sortHeader){
    sortHeader.addEventListener('click', () => {
      if(currentProducts.length === 0) return;
      
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      
      const sorted = [...currentProducts].sort((a, b) => {
        const diffA = a.daysDiff || 0;
        const diffB = b.daysDiff || 0;
        
        if(sortDirection === 'asc'){
          return diffA - diffB;
        } else {
          return diffB - diffA;
        }
      });
      
      const arrow = sortDirection === 'asc' ? '↑' : '↓';
      sortHeader.textContent = `عدد الأيام ${arrow}`;
      
      renderProducts(sorted);
    });
  }
})();
