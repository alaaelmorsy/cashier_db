// Purchases report: select range and list purchases with totals
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
        const title = `purchases-report-${safe||Date.now()}.pdf`;
        
        // إنشاء نسخة نظيفة للتصدير
        const clone = document.documentElement.cloneNode(true);
        
        // إزالة العناصر التفاعلية
        try{
          const header = clone.querySelector('header');
          if(header) header.remove();
          
          const rangeBar = clone.querySelector('.range-bar');
          if(rangeBar) rangeBar.remove();
          
          clone.querySelectorAll('.input, .btn, label, .toolbar').forEach(el => el.remove());
          
          // إضافة عنوان التقرير في الأعلى
          const container = clone.querySelector('.container');
          if(container){
            const titleSection = clone.ownerDocument.createElement('div');
            titleSection.className = 'pdf-title-section';
            titleSection.innerHTML = `
              <h1 class="pdf-main-title">تقرير المصروفات</h1>
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
        addTable('المصروفات ضمن الفترة', document.querySelector('table tbody#purTbody')?.closest('table'));
        const csv = lines.join('\n');
        const period = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.replace(/[^0-9_\-–: ]+/g,'').replace(/\s+/g,' ').trim() : '';
        const filename = `purchases-report-${(period||'').replace(/[: ]/g,'_')||Date.now()}.csv`;
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

async function loadRange(startStr, endStr){
  try{
    if(rangeEl){ rangeEl.textContent = `الفترة: ${startStr} — ${endStr}`; }

    // اجلب كلًا من عمليات المصروفات البسيطة وفواتير الشراء وادمجهما
    const [resSimple, resInv] = await Promise.all([
      window.api.purchases_list({ from_at: startStr, to_at: endStr }),
      window.api.purchase_invoices_list({ from: startStr, to: endStr })
    ]);
    const simple = (resSimple && resSimple.ok) ? (resSimple.items||[]) : [];
    const invoices = (resInv && resInv.ok) ? (resInv.items||[]) : [];

    // طبيع الشكل إلى عناصر موحّدة
    const normalized = [
      ...simple.map(p => ({
        kind: 'simple',
        name: p.title || p.name || '',
        payment_method: p.payment_method || 'cash',
        sub_total: Number(p.sub_total||0),
        vat_total: Number(p.vat_total||0),
        grand_total: Number(p.grand_total||0),
        notes: p.notes || '',
        at: p.purchase_at || p.created_at || (p.purchase_date ? (p.purchase_date + ' 00:00:00') : null)
      })),
      ...invoices.map(pi => {
        const sub = Number(pi.sub_total||0);
        // For zero_vat invoices: recalculate with 0% VAT
        const priceMode = String(pi.price_mode||'inclusive');
        const vat = (priceMode === 'zero_vat') ? 0 : Number(pi.vat_total||0);
        const grand = (priceMode === 'zero_vat') ? sub : Number(pi.grand_total||0);
        const methodRaw = String(pi.payment_method||'').toLowerCase();
        const isCredit = (methodRaw === 'credit' || methodRaw === 'آجل' || methodRaw === 'اجل');
        const paid = (priceMode === 'zero_vat') ? (isCredit ? 0 : sub) : Number(pi.amount_paid||0);
        return {
          kind: 'invoice',
          name: (()=>{ const m = String(pi.invoice_no||'').match(/^PI-\d{6}-(\d+)$/); const printed = m ? String(Number(m[1])) : (pi.invoice_no||''); return printed ? `فاتورة شراء ${printed}` : 'فاتورة شراء'; })(),
          payment_method: pi.payment_method || 'cash',
          sub_total: sub,
          vat_total: vat,
          grand_total: grand,
          amount_paid: paid,
          notes: pi.notes || '',
          at: pi.invoice_at || pi.created_at || null
        };
      })
    ].sort((a,b)=> new Date(b.at||0) - new Date(a.at||0));

    const purTbody = document.getElementById('purTbody');
    let sumCount = 0, sumPre = 0, sumVat = 0, sumAfter = 0;
    const labelPayment = (m)=>{ const raw = (m==null?'':String(m)); const x=raw.toLowerCase(); if(x==='network' || x==='card') return 'شبكة'; if(x==='credit' || raw==='آجل' || raw==='اجل') return 'آجل'; return 'نقدًا'; };
    const rows = normalized.map(p => {
      // Exclude fully unpaid credit invoices; include partial by paid amount only
      const methodRaw = (p.payment_method==null?'':String(p.payment_method));
      const isCredit = (methodRaw.toLowerCase()==='credit' || methodRaw==='آجل' || methodRaw==='اجل');
      const grand = Number(p.grand_total||0);
      const paid = Number(p.amount_paid||0); // available for purchase invoices
      const effectiveAfter = isCredit ? Math.min(paid, grand) : grand;
      if(isCredit && effectiveAfter<=0){ return ''; }

      // Split paid amount proportionally to sub_total and vat_total
      const sub = Number(p.sub_total||0);
      const vatTot = Number(p.vat_total||0);
      let pre=0, vat=0;
      if(effectiveAfter>0 && (sub+vatTot)>0){
        const ratio = effectiveAfter / (sub + vatTot);
        pre = Number((sub * ratio).toFixed(2));
        vat = Number((vatTot * ratio).toFixed(2));
      } else {
        pre = sub; vat = vatTot;
      }

      sumCount += 1;
      sumPre += pre; sumVat += vat; sumAfter += effectiveAfter;

      const dateStr = p.at ? new Date(p.at) : null;
      const dateOut = dateStr ? new Intl.DateTimeFormat('en-GB-u-ca-gregory', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:true}).format(dateStr) : '';
      const pay = labelPayment(p.payment_method||'');
      return `<tr><td>${p.name||''}</td><td>${dateOut}</td><td>${pay}</td><td>${fmt(pre)}</td><td>${fmt(vat)}</td><td>${fmt(effectiveAfter)}</td><td>${p.notes||''}</td></tr>`;
    }).join('');
    if(purTbody){ purTbody.innerHTML = rows || '<tr><td colspan="7" class="muted">لا توجد مشتريات ضمن الفترة</td></tr>'; }

    const set = (id,val)=>{ const el=document.getElementById(id); if(el){ el.textContent = (id==='sumCount') ? String(val) : fmt(val); } };
    set('sumCount', sumCount); set('sumPre', sumPre); set('sumVat', sumVat); set('sumAfter', sumAfter);
  }catch(e){ console.error(e); }
}

function initDefaultRange(){
  const now = new Date();
  const start = new Date(now); start.setHours(0,0,0,0);
  const end = now;
  const s = toStr(start), e = toStr(end);
  if(fromAtEl) fromAtEl.value = s.replace(' ', 'T').slice(0,16);
  if(toAtEl) toAtEl.value = e.replace(' ', 'T').slice(0,16);
  loadRange(s, e);
}

(function wireRange(){
  const btn = document.getElementById('applyRangeBtn');
  if(btn){
    btn.addEventListener('click', () => {
      const s = fromInputToStr(fromAtEl);
      const e = fromInputToStr(toAtEl);
      if(!s || !e){ alert('يرجى تحديد الفترة (من وإلى)'); return; }
      loadRange(s, e);
    });
  }
})();

// تم تعطيل التحميل التلقائي: لن تظهر بيانات حتى يتم تحديد الفترة والضغط على "تطبيق"