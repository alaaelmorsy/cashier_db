// Municipality report: list invoices within range that have tobacco fee > 0 (or < 0 for CN) and allow export

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

// Load and render company banner from settings
async function loadCompanyBanner(){
  try{
    const r = await window.api.settings_get();
    if(!r || !r.ok) return;
    const s = r.item || {};
    const banner = document.getElementById('companyBanner');
    if(!banner) return;
    const nameEl = document.getElementById('companyName');
    const mobEl = document.getElementById('companyMobile');
    const addrEl = document.getElementById('companyAddress');
    const vatEl = document.getElementById('companyVat');
    const logoEl = document.getElementById('companyLogo');
    if(nameEl) nameEl.textContent = s.seller_legal_name || '';
    if(mobEl) mobEl.textContent = s.mobile || '';
    if(addrEl) addrEl.textContent = s.company_location || '';
    if(vatEl) vatEl.textContent = s.seller_vat_number || '';
    if(s.logo_path && logoEl){
      try{
        const rr = await window.api.resolve_path(s.logo_path);
        if(rr && rr.ok && rr.abs){ logoEl.src = 'file://'+rr.abs; logoEl.style.display=''; }
      }catch(_){ }
    }
    // Do not force show on screen; CSS will show it on print only
  }catch(_){ /* ignore */ }
}

(function attachExportHandlers(){
  let exporting = false;
  const btnPdf = document.getElementById('exportPdfBtn');
  // Show/Hide all toggles
  // Remove toggles (details are always visible)
  async function expandAllDetails(){
    document.querySelectorAll('.item-details').forEach(el=>{ el.dataset._needsLoad = '1'; });
    const boxes = document.querySelectorAll('.item-details');
    for(const box of boxes){
      if(box && !box.dataset.loaded){
        try{
          const sid = Number(box.getAttribute('data-sale'));
          const r = await window.api.sales_get(sid);
          if(r && r.ok){
            const items = r.items || [];
            const html = [`<div style=\"font-weight:700; margin-bottom:6px\">تفاصيل الأصناف - الفاتورة رقم: ${r.sale?.invoice_no||sid}</div>`];
            html.push('<table style=\"width:100%; border-collapse:collapse\"><thead><tr>');
            html.push('<th style=\"text-align:right; padding:6px; border-bottom:1px solid #e2e8f0\">اسم الصنف</th>');
            html.push('<th style=\"text-align:right; padding:6px; border-bottom:1px solid #e2e8f0\">العملية</th>');
            html.push('<th style=\"text-align:right; padding:6px; border-bottom:1px solid #e2e8f0\">النوع الرئيسي</th>');
            html.push('<th style=\"text-align:center; padding:6px; border-bottom:1px solid #e2e8f0\">الكمية</th>');
            html.push('<th style=\"text-align:center; padding:6px; border-bottom:1px solid #e2e8f0\">سعر الوحدة</th>');
            html.push('<th style=\"text-align:left; padding:6px; border-bottom:1px solid #e2e8f0\">الإجمالي</th>');
            html.push('</tr></thead><tbody>');
            for(const it of items){
              const cat = it.category || '-';
              html.push(`<tr><td style=\"padding:6px; border-bottom:1px solid #f1f5f9\">${it.name||''}</td><td style=\"padding:6px; border-bottom:1px solid #f1f5f9\">${it.operation_name||''}</td><td style=\"padding:6px; border-bottom:1px solid #f1f5f9\">${cat}</td><td style=\"padding:6px; text-align:center; border-bottom:1px solid #f1f5f9\">${fmt(it.qty)}</td><td style=\"padding:6px; text-align:center; border-bottom:1px solid #f1f5f9\">${fmt(it.price)}</td><td style=\"padding:6px; text-align:left; border-bottom:1px solid #f1f5f9\">${fmt(it.line_total)}</td></tr>`);
            }
            html.push('</tbody></table>');
            box.innerHTML = html.join('');
            box.dataset.loaded = '1';
          } else { box.textContent = 'تعذر تحميل تفاصيل الأصناف'; }
        }catch(_){ box.textContent = 'تعذر تحميل تفاصيل الأصناف'; }
      }
    }
  }
  // No show/hide listeners anymore
  if(btnPdf){
    btnPdf.addEventListener('click', async () => {
      if(exporting) return; exporting = true; btnPdf.disabled = true;
      try{
        await expandAllDetails();
        // Give layout a moment to settle before snapshot
        await new Promise(r => setTimeout(r, 50));

        const period = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.replace(/[^0-9_\-–: ]+/g,'').replace(/\s+/g,' ').trim() : '';
        const safe = (period||'').replace(/[: ]/g,'_');
        const title = `municipality-${safe||Date.now()}.pdf`;
        await window.api.pdf_export(document.documentElement.outerHTML, { saveMode:'auto', filename: title, pageSize:'A4', printBackground: true, marginsType: 1, landscape: false });
      }catch(e){ console.error(e); alert('تعذر إنشاء PDF'); }
      finally{ exporting = false; btnPdf.disabled = false; }
    });
  }
  const btnExcel = document.getElementById('exportExcelBtn');
  if(btnExcel){
    btnExcel.addEventListener('click', async () => {
      if(exporting) return; exporting = true; btnExcel.disabled = true;
      try{
        // Ensure details are loaded for all invoices to include them in export
        await expandAllDetails();

        const lines = [];
        const esc = (v)=> ('"'+String(v??'').replace(/"/g,'""')+'"');
        
        // Header: company info (similar to PDF banner)
        try{
          const st = await window.api.settings_get();
          if(st && st.ok){
            const s = st.item || {};
            const companyLine = [
              esc(s.seller_legal_name||''),
              esc(s.company_location||''),
              esc(s.mobile||''),
              esc(s.seller_vat_number||'')
            ].join(',');
            if(companyLine.replace(/,/g,'').trim()){ lines.push(companyLine); lines.push(''); }
          }
        }catch(_){ }

        // Period line
        if(rangeEl && rangeEl.textContent){ lines.push(esc('الفترة')+','+esc(rangeEl.textContent.trim())); lines.push(''); }

        // Table header
        lines.push([
          esc('رقم الفاتورة'), esc('طريقة الدفع'), esc('المجموع'), esc('الخصم'), esc('الضريبة'), esc('رسوم التبغ'), esc('الإجمالي'), esc('تاريخ الدفع')
        ].join(','));

        // For each invoice, add a summary row + a block of details rows
        const detailHeaders = [esc('اسم الصنف'), esc('العملية'), esc('النوع الرئيسي'), esc('الكمية'), esc('سعر الوحدة'), esc('الإجمالي')].join(',');
        const blocks = document.querySelectorAll('.detail-card');
        blocks.forEach(block => {
          const invSummary = block.querySelector('.inv-summary');
          const cells = invSummary ? Array.from(invSummary.querySelectorAll('div > div:last-child')).map(el=>esc(el.textContent.trim())) : [];
          // Expecting columns order to match the visual layout
          if(cells.length >= 8){ lines.push(cells.slice(0,8).join(',')); }
          // Details header
          lines.push(detailHeaders);
          // Details rows
          const rows = block.querySelectorAll('.item-details tbody tr');
          rows.forEach(tr => {
            const tds = Array.from(tr.querySelectorAll('td')).map(td=>esc(td.textContent.trim()));
            if(tds.length) lines.push(tds.join(','));
          });
          lines.push('');
        });

        // Footer totals similar to PDF
        const sumTobInv = document.getElementById('sumTobInv')?.textContent || '0.00';
        const sumVatInv = document.getElementById('sumVatInv')?.textContent || '0.00';
        const sumGrandInv = document.getElementById('sumGrandInv')?.textContent || '0.00';
        const sumCountInv = document.getElementById('sumCountInv')?.textContent || '0';
        const sumTobCN = document.getElementById('sumTobCN')?.textContent || '0.00';
        const sumVatCN = document.getElementById('sumVatCN')?.textContent || '0.00';
        const sumGrandCN = document.getElementById('sumGrandCN')?.textContent || '0.00';
        const sumCountCN = document.getElementById('sumCountCN')?.textContent || '0';
        const sumTob = document.getElementById('sumTob')?.textContent || '0.00';
        const sumVat = document.getElementById('sumVat')?.textContent || '0.00';
        const sumGrand = document.getElementById('sumGrand')?.textContent || '0.00';
        const sumCount = document.getElementById('sumCount')?.textContent || '0';

        lines.push(esc('إجمالي الفواتير'));
        lines.push([esc(''), esc(''), esc(''), esc(''), esc(sumVatInv), esc(sumTobInv), esc(sumGrandInv), esc(sumCountInv)].join(','));
        lines.push(esc('إجمالي إشعارات الدائن'));
        lines.push([esc(''), esc(''), esc(''), esc(''), esc(sumVatCN), esc(sumTobCN), esc(sumGrandCN), esc(sumCountCN)].join(','));
        lines.push(esc('الصافي'));
        lines.push([esc(''), esc(''), esc(''), esc(''), esc(sumVat), esc(sumTob), esc(sumGrand), esc(sumCount)].join(','));

        const csv = lines.join('\n');
        const period = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.replace(/[^0-9_\-–: ]+/g,'').replace(/\s+/g,' ').trim() : '';
        const filename = `municipality-${(period||'').replace(/[: ]/g,'_')||Date.now()}.csv`;
        await window.api.csv_export(csv, { saveMode:'auto', filename });
      }catch(e){ console.error(e); alert('تعذر إنشاء Excel'); }
      finally{ exporting = false; btnExcel.disabled = false; }
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
  try{
    const res = await window.api.sales_list({ date_from: startStr, date_to: endStr, pageSize: 50000 });
    const items = (res && res.ok) ? (res.items||[]) : [];
    // Filter: include invoices and CN that have non-zero tobacco_fee
    const filteredAll = items.filter(s => Number(s.tobacco_fee||0) !== 0);
    const excludeCn = document.getElementById('excludeCn');
    const filtered = filteredAll.filter(s => {
      const isCN = (String(s.doc_type||'') === 'credit_note' || String(s.invoice_no||'').startsWith('CN-'));
      return excludeCn && excludeCn.checked ? !isCN : true;
    });

    const invTbody = document.getElementById('invTbody');

    let sumSub = 0, sumDisc = 0, sumVat = 0, sumTob = 0, sumGrand = 0;
    let sumSubInv = 0, sumDiscInv = 0, sumVatInv = 0, sumTobInv = 0, sumGrandInv = 0, cntInv = 0;
    let sumSubCN = 0, sumDiscCN = 0, sumVatCN = 0, sumTobCN = 0, sumGrandCN = 0, cntCN = 0;

    const rows = filtered.map(s => {
      const isCN = (String(s.doc_type||'') === 'credit_note' || String(s.invoice_no||'').startsWith('CN-'));
      let created = s.settled_at || s.created_at; // تاريخ الدفع إن وجد وإلا تاريخ الإنشاء
      created = created ? new Date(created) : null;
      if(!created || isNaN(created.getTime())){ try{ created = new Date(String(created||s.created_at).replace(' ', 'T')); }catch(_){ created = new Date(); } }
      const dateStr = new Intl.DateTimeFormat('en-GB-u-ca-gregory', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:true}).format(created);
      const sub = Math.abs(Number(s.sub_total||0));
      const disc = Math.abs(Number(s.discount_amount||0));
      const vat = Math.abs(Number(s.vat_total||0));
      const tob = Math.abs(Number(s.tobacco_fee||0));
      const grand = Math.abs(Number(s.grand_total||0));
      if(isCN){ sumSubCN += sub; sumDiscCN += disc; sumVatCN += vat; sumTobCN += tob; sumGrandCN += grand; cntCN++; }
      else { sumSubInv += sub; sumDiscInv += disc; sumVatInv += vat; sumTobInv += tob; sumGrandInv += grand; cntInv++; }
      sumSub += sub * (isCN ? -1 : 1);
      sumDisc += disc * (isCN ? -1 : 1);
      sumVat += vat * (isCN ? -1 : 1);
      sumTob += tob * (isCN ? -1 : 1);
      sumGrand += grand * (isCN ? -1 : 1);

      const pm = String(s.payment_method || '').toLowerCase();
      const payLabel = (function(method){
        const m = String(method||'').toLowerCase();
        if(m==='cash') return 'نقدًا';
        if(m==='card' || m==='network') return 'بطاقة';
        if(m==='credit') return 'آجل';
        if(m==='tamara') return 'تمارا';
        if(m==='tabby') return 'تابي';
        if(m==='mixed') return 'مختلط';
        return method||'';
      })(pm);
      const attrs = [`data-view="${s.id}"`, `data-type="${isCN?'credit':'invoice'}"`];
      const viewBtn = `<button class=\"btn\" ${attrs.join(' ')}>عرض</button>`;
      // Header box with invoice details
      const headerBox = `<div class=\"inv-summary\" style=\"margin-bottom:8px; padding:8px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px\">
        <div style=\"display:grid; grid-template-columns: repeat(8, minmax(0,1fr)); gap:8px; font-size:12px\">
          <div><div class=\"muted\">رقم الفاتورة</div><div>${s.invoice_no||''}</div></div>
          <div><div class=\"muted\">طريقة الدفع</div><div>${payLabel}</div></div>
          <div><div class=\"muted\">المجموع</div><div>${fmt(sub)}</div></div>
          <div><div class=\"muted\">الخصم</div><div>${fmt(disc)}</div></div>
          <div><div class=\"muted\">الضريبة</div><div>${fmt(vat)}</div></div>
          <div><div class=\"muted\">رسوم التبغ</div><div>${fmt(tob)}</div></div>
          <div><div class=\"muted\">الإجمالي</div><div>${fmt(grand)}</div></div>
          <div><div class=\"muted\">تاريخ الدفع</div><div>${dateStr}</div></div>
        </div>
        <div style=\"display:flex; gap:8px; margin-top:8px\">${viewBtn}</div>
      </div>`;
      // Always show details row (no toggle button)
      return `<tr><td colspan=\"10\"><div class=\"detail-card ${isCN?'credit':''}\">${headerBox}<div class=\"item-details\" data-sale=\"${s.id}\">يتم التحميل...</div></div></td></tr>`;
    }).join('');

    if(invTbody){ invTbody.innerHTML = rows || '<tr><td colspan=\"10\" class=\"muted\">لا توجد فواتير ضمن الفترة تحتوي رسوم تبغ</td></tr>'; }

    // Auto-load item details to replace the placeholder "يتم التحميل..."
    try{
      const boxes = document.querySelectorAll('.item-details');
      for(const box of boxes){
        if(box && !box.dataset.loaded){
          try{
            const sid = Number(box.getAttribute('data-sale'));
            const r = await window.api.sales_get(sid);
            if(r && r.ok){
              const items = r.items || [];
              const html = [`<div style=\"font-weight:700; margin-bottom:6px\">تفاصيل الأصناف - الفاتورة رقم: ${r.sale?.invoice_no||sid}</div>`];
              html.push('<table style=\"width:100%; border-collapse:collapse\"><thead><tr>');
              html.push('<th style=\"text-align:right; padding:6px; border-bottom:1px solid #e2e8f0\">اسم الصنف</th>');
              html.push('<th style=\"text-align:right; padding:6px; border-bottom:1px solid #e2e8f0\">العملية</th>');
              html.push('<th style=\"text-align:right; padding:6px; border-bottom:1px solid #e2e8f0\">النوع الرئيسي</th>');
              html.push('<th style=\"text-align:center; padding:6px; border-bottom:1px solid #e2e8f0\">الكمية</th>');
              html.push('<th style=\"text-align:center; padding:6px; border-bottom:1px solid #e2e8f0\">سعر الوحدة</th>');
              html.push('<th style=\"text-align:left; padding:6px; border-bottom:1px solid #e2e8f0\">الإجمالي</th>');
              html.push('</tr></thead><tbody>');
              for(const it of items){
                const cat = it.category || '-';
                html.push(`<tr><td style=\"padding:6px; border-bottom:1px solid #f1f5f9\">${it.name||''}</td><td style=\"padding:6px; border-bottom:1px solid #f1f5f9\">${it.operation_name||''}</td><td style=\"padding:6px; border-bottom:1px solid #f1f5f9\">${cat}</td><td style=\"padding:6px; text-align:center; border-bottom:1px solid #f1f5f9\">${fmt(it.qty)}</td><td style=\"padding:6px; text-align:center; border-bottom:1px solid #f1f5f9\">${fmt(it.price)}</td><td style=\"padding:6px; text-align:left; border-bottom:1px solid #f1f5f9\">${fmt(it.line_total)}</td></tr>`);
              }
              html.push('</tbody></table>');
              box.innerHTML = html.join('');
              box.dataset.loaded = '1';
            } else { box.textContent = 'تعذر تحميل تفاصيل الأصناف'; }
          }catch(_){ box.textContent = 'تعذر تحميل تفاصيل الأصناف'; }
        }
      }
    }catch(_){ }

    const set = (id, v)=>{ const el = document.getElementById(id); if(!el) return; el.textContent = (String(id).includes('Count') ? String(v) : fmt(v)); };
    set('sumSubInv', sumSubInv); set('sumDiscInv', sumDiscInv); set('sumVatInv', sumVatInv); set('sumTobInv', sumTobInv); set('sumGrandInv', sumGrandInv); set('sumCountInv', cntInv);
    set('sumSubCN', sumSubCN); set('sumDiscCN', sumDiscCN); set('sumVatCN', sumVatCN); set('sumTobCN', sumTobCN); set('sumGrandCN', sumGrandCN); set('sumCountCN', cntCN);
    set('sumSub', sumSub); set('sumDisc', sumDisc); set('sumVat', sumVat); set('sumTob', sumTob); set('sumGrand', sumGrand); set('sumCount', cntInv + cntCN);

    // Build tobacco items summary for the whole period
    try{
      const detRes = await window.api.sales_items_detailed({ date_from: startStr, date_to: endStr, only_tobacco: true });
      const det = (detRes && detRes.ok) ? (detRes.items||[]) : [];
      const byKey = new Map();
      det.forEach(it => {
        const key = `${it.name||''}||${it.operation_name||''}`;
        const prev = byKey.get(key) || { qty: 0, amount: 0, price: 0, priceCount: 0 };
        const price = Number(it.price||0);
        if(price){ prev.price += price; prev.priceCount += 1; }
        prev.qty += Number(it.qty||0);
        prev.amount += Number(it.line_total||0);
        byKey.set(key, prev);
      });
      const rows = Array.from(byKey.entries()).map(([key, v]) => {
        const [name, op] = key.split('||');
        const avgPrice = v.priceCount ? (v.price / v.priceCount) : (v.qty ? (v.amount / v.qty) : 0);
        return `<tr><td>${name}</td><td>${op}</td><td>${fmt(avgPrice)}</td><td>${fmt(v.qty)}</td><td class="right">${fmt(v.amount)}</td></tr>`;
      }).join('');
      const tbody = document.getElementById('tobaccoSummaryRows');
      if(tbody){ tbody.innerHTML = rows || '<tr><td colspan="5" class="muted" style="text-align:center">لا توجد أصناف تبغ ضمن الفترة</td></tr>'; }
    }catch(_){ const tbody = document.getElementById('tobaccoSummaryRows'); if(tbody){ tbody.innerHTML = '<tr><td colspan="5" class="muted" style="text-align:center">تعذر تحميل ملخص أصناف التبغ</td></tr>'; } }

    // wire view buttons to print window
    try{
      document.querySelectorAll('button[data-view]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = Number(btn.getAttribute('data-view'));
          const type = btn.getAttribute('data-type');
          // Honor default_print_format from settings
          let __defPrintFormat = 'thermal';
          try{ const r = await window.api.settings_get(); if(r && r.ok && r.item){ __defPrintFormat = (r.item.default_print_format === 'a4') ? 'a4' : 'thermal'; } }catch(_){ }
          const page = (__defPrintFormat === 'a4') ? '../sales/print-a4.html' : '../sales/print.html';
          const w = (__defPrintFormat === 'a4') ? 900 : 500;
          const h = (__defPrintFormat === 'a4') ? 1000 : 700;
          // إضافة refresh=1 لضمان تحميل البيانات المحدثة وعرض تاريخ الدفع
          const url = `${page}?id=${encodeURIComponent(String(id))}&refresh=1`;
          window.open(url, 'PRINT_VIEW', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
        });
      });
      // toggle item details rows
      document.querySelectorAll('button[data-detail]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const rowId = btn.getAttribute('data-detail');
          const row = document.getElementById(rowId);
          if(!row) return;
          const box = row.querySelector('.item-details');
          const isHidden = (row.style.display === 'none');
          if(isHidden){ row.style.display = ''; }
          else { row.style.display = 'none'; return; }
          // load items if needed on first open
          if(box && !box.dataset.loaded){
            try{
              const sid = Number(box.getAttribute('data-sale'));
              const r = await window.api.sales_get(sid);
              if(r && r.ok){
                const items = r.items || [];
                const html = [`<div style=\"font-weight:700; margin-bottom:6px\">تفاصيل الأصناف - الفاتورة رقم: ${r.sale?.invoice_no||sid}</div>`]
                html.push('<table style=\"width:100%; border-collapse:collapse\"><thead><tr>');
                html.push('<th style=\"text-align:right; padding:6px; border-bottom:1px solid #e2e8f0\">اسم الصنف</th>');
                html.push('<th style=\"text-align:right; padding:6px; border-bottom:1px solid #e2e8f0\">العملية</th>');
                html.push('<th style=\"text-align:right; padding:6px; border-bottom:1px solid #e2e8f0\">النوع الرئيسي</th>');
                html.push('<th style=\"text-align:center; padding:6px; border-bottom:1px solid #e2e8f0\">الكمية</th>');
                html.push('<th style=\"text-align:center; padding:6px; border-bottom:1px solid #e2e8f0\">سعر الوحدة</th>');
                html.push('<th style=\"text-align:left; padding:6px; border-bottom:1px solid #e2e8f0\">الإجمالي</th>');
                html.push('</tr></thead><tbody>');
                for(const it of items){
                  const cat = it.category || '-';
                  html.push(`<tr><td style=\"padding:6px; border-bottom:1px solid #f1f5f9\">${it.name||''}</td><td style=\"padding:6px; border-bottom:1px solid #f1f5f9\">${it.operation_name||''}</td><td style=\"padding:6px; border-bottom:1px solid #f1f5f9\">${cat}</td><td style=\"padding:6px; text-align:center; border-bottom:1px solid #f1f5f9\">${fmt(it.qty)}</td><td style=\"padding:6px; text-align:center; border-bottom:1px solid #f1f5f9\">${fmt(it.price)}</td><td style=\"padding:6px; text-align:left; border-bottom:1px solid #f1f5f9\">${fmt(it.line_total)}</td></tr>`);
                }
                html.push('</tbody></table>');
                box.innerHTML = html.join('');
                box.dataset.loaded = '1';
              } else {
                box.textContent = 'تعذر تحميل تفاصيل الأصناف';
              }
            }catch(_){ box.textContent = 'تعذر تحميل تفاصيل الأصناف'; }
          }
        });
      });
    }catch(_){ }
  }catch(e){ console.error(e); }
}

function initDefaultRange(){
  const now = new Date();
  const start = new Date(now); start.setHours(0,0,0,0);
  const pad2 = (v)=> String(v).padStart(2,'0');
  const toLocal = (d)=> `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if(fromAtEl) fromAtEl.value = toLocal(start);
  if(toAtEl) toAtEl.value = toLocal(now);
}

async function applyRange(){
  const s = fromInputToStr(fromAtEl);
  const e = fromInputToStr(toAtEl);
  if(!s || !e){ alert('يرجى تحديد الفترة كاملة'); return; }
  await loadRange(s, e);
  // Load all details by default after loading
  try{ await (async ()=>{ await (expandAllDetails && expandAllDetails()); })(); }catch(_){ }
}

const applyBtn = document.getElementById('applyRangeBtn');
if(applyBtn){ applyBtn.addEventListener('click', applyRange); }

// init
initDefaultRange();
// load banner and auto-apply range immediately (show all by default)
loadCompanyBanner();
(async ()=>{ try{ await applyRange(); }catch(_){ } })();