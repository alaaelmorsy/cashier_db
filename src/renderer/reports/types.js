// Types report (by product category) with datetime range

const btnBack = document.getElementById('btnBack');
if(btnBack){ btnBack.onclick = ()=>{ window.location.href = './index.html'; } }

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

const loadBtn = document.getElementById('loadBtn');

function toStr(d){
  const pad2 = (v)=> String(v).padStart(2,'0');
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`;
}
function fromInputToStr(input){
  const v = (input?.value||'').trim();
  if(!v) return '';
  return v.replace('T', ' ') + ':00';
}
const fmt = (n)=> Number(n||0).toFixed(2);

// Format date/time in English (Gregorian) with Latin digits
function fmtDateEn(input){
  if(!input) return '';
  try{
    let d;
    if(typeof input === 'string'){
      // Accepts 'YYYY-MM-DD HH:mm:ss' or ISO
      const s = input.includes('T') ? input : input.replace(' ', 'T');
      d = new Date(s);
    } else {
      d = new Date(input);
    }
    // Example: 27/08/2025, 14:30
    return new Intl.DateTimeFormat('en-GB-u-ca-gregory-nu-latn', {
      year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', hour12:false
    }).format(d);
  }catch(_){ return String(input||'').toString(); }
}

async function loadRange(startStr, endStr){
  try{
    if(rangeEl){ rangeEl.textContent = `الفترة: ${fmtDateEn(startStr)} — ${fmtDateEn(endStr)}`; }
    // استخدم تجميعة عناصر البيع للحصول على الأصناف، ثم نجمع حسب التصنيف
    const sumRes = await window.api.sales_items_summary({ date_from: startStr, date_to: endStr });
    const items = (sumRes && sumRes.ok) ? (sumRes.items||[]) : [];
    // نحتاج جلب بيانات المنتجات لمعرفة التصنيف لكل product_id
    const prodsRes = await window.api.products_list({ limit: 0 });
    const products = (prodsRes && prodsRes.ok) ? (prodsRes.items||[]) : [];
    const byId = new Map(); products.forEach(p=> byId.set(Number(p.id), p));

    // تجميع حسب التصنيف (category). الأصناف بدون تصنيف تُجمع تحت "غير مصنف"
    const byCat = new Map();
    const byCatDetails = new Map();
    items.forEach(it => {
      const pid = Number(it.product_id||0);
      const prod = byId.get(pid);
      const cat = (prod && prod.category) ? String(prod.category) : 'غير مصنف';
      const prev = byCat.get(cat) || { itemsCount:0, qty:0, amount:0 };
      prev.itemsCount += 1;
      prev.qty += Number(it.qty_total||0);
      prev.amount += Number(it.amount_total||0);
      byCat.set(cat, prev);
      const arr = byCatDetails.get(cat) || [];
      arr.push({ name: it.name, qty: Number(it.qty_total||0), amount: Number(it.amount_total||0) });
      byCatDetails.set(cat, arr);
    });

    // عبئ الجدول ملخص التصنيفات
    const catTbody = document.getElementById('catTbody');
    const rows = Array.from(byCat.entries()).map(([cat, v]) => {
      return `<tr><td>${cat}</td><td>${v.itemsCount}</td><td>${fmt(v.qty)}</td><td class="right">${fmt(v.amount)}</td></tr>`;
    }).join('');
    if(catTbody){ catTbody.innerHTML = rows || '<tr><td colspan="4" style="text-align:center;color:#64748b">لا توجد بيانات</td></tr>'; }

    // تفاصيل كل تصنيف: تفصيليًا مثل التبغ
    const detailsBox = document.getElementById('catDetails');
    if(detailsBox){
      detailsBox.innerHTML = '';
      // بيانات تفصيلية لكل الأصناف (ليست التبغ فقط)
      const detAllRes = await window.api.sales_items_detailed({ date_from: startStr, date_to: endStr });
      const detAll = (detAllRes && detAllRes.ok) ? (detAllRes.items||[]) : [];
      const byCatDet = new Map();
      detAll.forEach(it => {
        const cat = it.category || 'غير مصنف';
        const arr = byCatDet.get(cat) || [];
        arr.push(it);
        byCatDet.set(cat, arr);
      });
      Array.from(byCatDet.entries()).forEach(([cat, arr]) => {
        // Group by (product name, category, operation) and sum qty and amount
        const grouped = new Map();
        arr.forEach(it => {
          const key = `${it.name||''}||${it.category||''}||${it.operation_name||''}`;
          const prev = grouped.get(key) || { qty: 0, amount: 0 };
          prev.qty += Number(it.qty||0);
          prev.amount += Number(it.line_total||0);
          grouped.set(key, prev);
        });
        const tbody = Array.from(grouped.entries()).map(([key, v]) => {
          const [name, category, op] = key.split('||');
          const price = v.qty ? (v.amount / v.qty) : 0; // average price
          return `<tr>
            <td>${name}</td>
            <td>${category}</td>
            <td>${op}</td>
            <td>${fmt(v.qty)}</td>
            <td>${fmt(price)}</td>
            <td class=\"right\">${fmt(v.amount)}</td>
          </tr>`;
        }).join('');
        const table = document.createElement('div');
        table.innerHTML = `
          <h4 style=\"margin:6px 0 8px;\">${cat}</h4>
          <div style=\"overflow:auto\">
            <table>
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>التصنيف</th>
                  <th>العملية</th>
                  <th>الكمية</th>
                  <th>السعر</th>
                  <th class=\"right\">الإجمالي</th>
                </tr>
              </thead>
              <tbody>${tbody || '<tr><td colspan=\"6\" style=\"text-align:center;color:#64748b\">لا توجد بيانات</td></tr>'}</tbody>
            </table>
          </div>
        `;
        detailsBox.appendChild(table);
      });
    }

    // أصناف التبغ فقط — تفصيليًا من جدول البنود مع الفاتورة والتاريخ
    try{
      const detRes = await window.api.sales_items_detailed({ date_from: startStr, date_to: endStr, only_tobacco: true });
      const det = (detRes && detRes.ok) ? (detRes.items||[]) : [];
      // بناء تجميع أعلى حسب (التصنيف، العملية)
      const byKey = new Map();
      det.forEach(it => {
        const key = `${it.category||'غير مصنف'}||${it.operation_name||'غير محدد'}`;
        const prev = byKey.get(key) || { count:0, qty:0, amount:0 };
        prev.count += 1;
        prev.qty += Number(it.qty||0);
        prev.amount += Number(it.line_total||0);
        byKey.set(key, prev);
      });
      const sumRows = Array.from(byKey.entries()).map(([key, v]) => {
        const [cat, op] = key.split('||');
        return `<tr>
          <td>${cat}</td>
          <td>${op}</td>
          <td>${v.count}</td>
          <td>${fmt(v.qty)}</td>
          <td class=\"right\">${fmt(v.amount)}</td>
        </tr>`;
      }).join('');
      const tobSumTbody = document.getElementById('tobaccoSummaryTbody');
      if(tobSumTbody){ tobSumTbody.innerHTML = sumRows || '<tr><td colspan=\"5\" style=\"text-align:center;color:#64748b\">لا توجد بيانات تبغ ضمن الفترة</td></tr>'; }

      const tobRows = det.map(it => {
        const dateStr = fmtDateEn(it.created_at);
        return `<tr>
          <td>${dateStr}</td>
          <td>${it.invoice_no||''}</td>
          <td>${it.doc_type==='credit_note'?'إشعار دائن':'فاتورة'}</td>
          <td>${it.name}</td>
          <td>${it.category||''}</td>
          <td>${it.operation_name||''}</td>
          <td>${fmt(it.qty)}</td>
          <td>${fmt(it.price)}</td>
          <td class=\"right\">${fmt(it.line_total)}</td>
        </tr>`;
      });
      const tobTbody = document.getElementById('tobaccoTbody');
      if(tobTbody){ tobTbody.innerHTML = tobRows.join('') || '<tr><td colspan=\"9\" style=\"text-align:center;color:#64748b\">لا توجد أصناف تبغ ضمن الفترة</td></tr>'; }
    }catch(_){
      const tobTbody = document.getElementById('tobaccoTbody');
      if(tobTbody){ tobTbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#64748b">تعذر تحميل تفاصيل التبغ</td></tr>'; }
      const tobSumTbody = document.getElementById('tobaccoSummaryTbody');
      if(tobSumTbody){ tobSumTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#64748b">تعذر تحميل تجميع التبغ</td></tr>'; }
    }
  }catch(e){ console.error(e); alert('تعذر تحميل تقرير الأنواع'); }
}

// تعيين التواريخ الافتراضية فقط دون تحميل البيانات
(function init(){
  const now = new Date();
  const start = new Date(now); start.setHours(0,0,0,0);
  const end = new Date(now); end.setHours(23,59,0,0);
  fromAtEl.value = start.toISOString().slice(0,16);
  toAtEl.value = end.toISOString().slice(0,16);
  
  // إفراغ الجداول عند التحميل الأولي
  const catTbody = document.getElementById('catTbody');
  if(catTbody){ catTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#64748b">قم بالضغط على "تطبيق" لعرض التقرير</td></tr>'; }
  
  const detailsBox = document.getElementById('catDetails');
  if(detailsBox){ detailsBox.innerHTML = '<p style="text-align:center;color:#64748b">قم بالضغط على "تطبيق" لعرض التفاصيل</p>'; }
  
  if(rangeEl){ rangeEl.textContent = ''; }
})();

loadBtn?.addEventListener('click', () => {
  const fromStr = fromInputToStr(fromAtEl);
  const toStrVal = fromInputToStr(toAtEl);
  if(!fromStr || !toStrVal){ alert('يرجى اختيار الفترة'); return; }
  loadRange(fromStr, toStrVal);
});

// تصدير PDF/Excel
(function attachExportHandlers(){
  let exporting = false;
  const btnPdf = document.getElementById('exportPdfBtn');
  const btnExcel = document.getElementById('exportExcelBtn');
  if(btnPdf){
    btnPdf.addEventListener('click', async ()=>{
      if(exporting) return; exporting = true; btnPdf.disabled = true;
      try{
        const period = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.replace(/[^0-9_\-–: ]+/g,'').replace(/\s+/g,' ').trim() : '';
        const title = `types-report-${(period||'').replace(/[: ]/g,'_')||Date.now()}.pdf`;
        
        // إنشاء نسخة نظيفة للتصدير
        const clone = document.documentElement.cloneNode(true);
        
        // إزالة الأزرار وحقول الإدخال
        try{
          const header = clone.querySelector('header');
          if(header) header.remove();
          
          const inputs = clone.querySelectorAll('.input, .btn, label');
          inputs.forEach(el => el.remove());
          
          // فتح جميع details
          clone.querySelectorAll('details').forEach(d => d.setAttribute('open', 'true'));
          
          // إضافة عنوان التقرير في الأعلى
          const container = clone.querySelector('.container');
          if(container){
            const titleSection = clone.ownerDocument.createElement('div');
            titleSection.className = 'pdf-title-section';
            titleSection.innerHTML = `
              <h1 class="pdf-main-title">تقرير الأنواع</h1>
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
          
          #catDetails h4 {
            background: #3b82f6 !important;
            color: #fff !important;
            padding: 14px 20px !important;
            margin: 20px 0 16px 0 !important;
            border-radius: 8px !important;
            font-size: 16px !important;
            font-weight: 700 !important;
            text-align: center !important;
            page-break-after: avoid;
          }
          
          #catDetails h4:first-child {
            margin-top: 0 !important;
          }
          
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 8px 0 !important;
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
          
          td {
            color: #0f172a !important;
          }
          
          .right {
            text-align: left !important;
          }
          
          .muted {
            color: #64748b !important;
            font-size: 13px !important;
          }
          
          details {
            border: none !important;
          }
          
          summary {
            display: none !important;
          }
          
          header, #range, .range-bar, .toolbar {
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
  if(btnExcel){
    btnExcel.addEventListener('click', async ()=>{
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
        addTable('تجميع حسب التصنيفات', document.querySelector('tbody#catTbody')?.closest('table'));
        // كل جداول التفاصيل
        document.querySelectorAll('#catDetails table').forEach((tbl, idx)=> addTable('تفاصيل '+(idx+1), tbl));
        const csv = lines.join('\n');
        const period = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.replace(/[^0-9_\-–: ]+/g,'').replace(/\s+/g,' ').trim() : '';
        const filename = `types-report-${(period||'').replace(/[: ]/g,'_')||Date.now()}.csv`;
        await window.api.csv_export(csv, { saveMode:'auto', filename });
      }catch(e){ console.error(e); alert('تعذر إنشاء Excel'); }
      finally{ exporting = false; btnExcel.disabled = false; }
    });
  }
})();