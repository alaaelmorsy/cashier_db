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

const employeeSelectEl = document.getElementById('employeeSelect');
const employeeInfoCard = document.getElementById('employeeInfoCard');
const loadBtn = document.getElementById('loadBtn');
let selectedEmployeeId = null;

const btnBack = document.getElementById('btnBack');
if(btnBack){ btnBack.onclick = ()=>{ window.location.href = './index.html'; } }

(function initDateRanges(){
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2,'0');
  const dd = String(today.getDate()).padStart(2,'0');
  const hh = String(today.getHours()).padStart(2,'0');
  const min = String(today.getMinutes()).padStart(2,'0');
  const todayStr = `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  const firstDay = `${yyyy}-${mm}-01T00:00`;
  if(fromAtEl) fromAtEl.value = firstDay;
  if(toAtEl) toAtEl.value = todayStr;
})();

(async function loadEmployeesList(){
  if(!employeeSelectEl) return;
  try{
    const res = await window.api.employees_list({ q: '' });
    const items = (res && res.ok) ? (res.items||[]) : [];
    items.forEach(e => {
      const option = document.createElement('option');
      option.value = e.id;
      option.textContent = e.name || ('موظف #' + e.id);
      employeeSelectEl.appendChild(option);
    });
  }catch(e){
    console.error('Failed to load employees:', e);
  }
})();

if(employeeSelectEl){
  employeeSelectEl.addEventListener('change', async (e)=>{
    selectedEmployeeId = Number(e.target.value) || null;
    if(selectedEmployeeId){
      await loadEmployeeInfo(selectedEmployeeId);
    } else {
      if(employeeInfoCard) employeeInfoCard.style.display = 'none';
    }
  });
}

async function loadEmployeeInfo(employeeId){
  if(!employeeId || !employeeInfoCard) return;
  try{
    const res = await window.api.employees_get(employeeId);
    if(!res || !res.ok || !res.item){
      alert('فشل تحميل بيانات الموظف');
      return;
    }
    const e = res.item;
    const empNameEl = document.getElementById('empName');
    if(empNameEl) empNameEl.textContent = e.name || '-';
    employeeInfoCard.style.display = 'block';
  }catch(err){
    console.error(err);
    alert('خطأ في تحميل بيانات الموظف');
  }
}

if(loadBtn){
  loadBtn.addEventListener('click', async ()=>{
    if(!selectedEmployeeId){
      alert('الرجاء اختيار موظف');
      return;
    }
    if(!fromAtEl.value || !toAtEl.value){
      alert('الرجاء تحديد الفترة');
      return;
    }
    await loadReport();
  });
}

async function loadReport(){
  if(!selectedEmployeeId) return;
  try{
    const from = fromAtEl.value ? fromAtEl.value.replace('T', ' ') + ':00' : '';
    const to = toAtEl.value ? toAtEl.value.replace('T', ' ') + ':59' : '';
    
    const res = await window.api.sales_employee_report({
      employee_id: selectedEmployeeId,
      from_date: from,
      to_date: to
    });
    
    if(!res || !res.ok){
      alert(res?.error || 'فشل تحميل التقرير');
      return;
    }
    
    const data = res.data || {};
    const invoices = data.invoices || [];
    const products = data.products || [];
    const creditNotes = data.creditNotes || [];
    const creditProducts = data.creditProducts || [];
    
    if(rangeEl){
      const fromDisplay = fromAtEl.value ? fromAtEl.value.replace('T', ' ') : from;
      const toDisplay = toAtEl.value ? toAtEl.value.replace('T', ' ') : to;
      rangeEl.textContent = `التقرير من ${fromDisplay} إلى ${toDisplay}`;
    }
    
    document.getElementById('reportContent').style.display = 'block';
    
    let totalSales = 0;
    let totalQty = 0;
    invoices.forEach(inv => {
      totalSales += Number(inv.employee_total||0);
    });
    products.forEach(p => {
      totalQty += Number(p.total_qty||0);
    });
    
    let totalCreditDeduction = 0;
    let totalCreditQty = 0;
    creditNotes.forEach(cn => {
      totalCreditDeduction += Math.abs(Number(cn.employee_total||0));
    });
    creditProducts.forEach(cp => {
      totalCreditQty += Math.abs(Number(cp.total_qty||0));
    });
    
    const netTotal = totalSales - totalCreditDeduction;
    const netQty = totalQty - totalCreditQty;
    
    document.getElementById('totalInvoices').textContent = invoices.length;
    document.getElementById('totalSales').textContent = fmt(totalSales);
    document.getElementById('totalProducts').textContent = products.length;
    document.getElementById('totalQuantity').textContent = totalQty;
    document.getElementById('totalCreditDeduction').textContent = fmt(totalCreditDeduction);
    document.getElementById('netTotal').textContent = fmt(netTotal);
    document.getElementById('netQuantity').textContent = netQty.toFixed(2);
    
    const invTbody = document.getElementById('invoicesTbody');
    if(invTbody){
      if(invoices.length === 0){
        invTbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--muted)">لا توجد فواتير</td></tr>';
      } else {
        invTbody.innerHTML = invoices.map((inv)=>{
          const dateObj = inv.created_at ? new Date(inv.created_at) : null;
          const date = dateObj ? dateObj.toISOString().replace('T', ' ').substring(0, 16) : '-';
          const payMethod = labelPaymentMethod(inv.payment_method);
          const customer = inv.customer_name || '-';
          const products = inv.products_list || '-';
          const employeeTotal = Number(inv.employee_total || 0);
          const pmLower = String(inv.payment_method||'').toLowerCase();
          const settledCash = Number(inv.settled_cash || 0);
          const payCashPart = Number(inv.pay_cash_amount || 0);
          const cashParam = (pmLower==='cash') ? (settledCash>0 ? settledCash : (payCashPart>0 ? payCashPart : Number(inv.grand_total||0))) : 0;
          return `<tr>
            <td>${inv.invoice_no||inv.id}</td>
            <td>${date}</td>
            <td>${customer}</td>
            <td style="max-width:200px; white-space:normal; word-break:break-word">${products}</td>
            <td>${fmt(employeeTotal)}</td>
            <td>${payMethod}</td>
            <td><button class="btn" style="padding:4px 8px; font-size:12px" onclick="viewInvoice(${inv.id}, '${inv.payment_method||''}', ${cashParam})">عرض</button></td>
          </tr>`;
        }).join('');
      }
    }
    
    const prodTbody = document.getElementById('productsTbody');
    if(prodTbody){
      if(products.length === 0){
        prodTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--muted)">لا توجد منتجات</td></tr>';
      } else {
        prodTbody.innerHTML = products.map((p)=>{
          return `<tr>
            <td>${p.product_name||'-'}</td>
            <td>${Number(p.total_qty||0).toFixed(2)}</td>
            <td>${fmt(p.avg_price||0)}</td>
            <td>${fmt(p.total_amount||0)}</td>
          </tr>`;
        }).join('');
      }
    }
    
    const cnTbody = document.getElementById('creditNotesTbody');
    if(cnTbody){
      if(creditNotes.length === 0){
        cnTbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--muted)">لا توجد فواتير دائنة</td></tr>';
      } else {
        cnTbody.innerHTML = creditNotes.map((cn)=>{
          const dateObj = cn.created_at ? new Date(cn.created_at) : null;
          const date = dateObj ? dateObj.toISOString().replace('T', ' ').substring(0, 16) : '-';
          const payMethod = labelPaymentMethod(cn.payment_method);
          const customer = cn.customer_name || '-';
          const products = cn.products_list || '-';
          const employeeTotal = Number(cn.employee_total || 0);
          const pmLower = String(cn.payment_method||'').toLowerCase();
          const settledCash = Number(cn.settled_cash || 0);
          const payCashPart = Number(cn.pay_cash_amount || 0);
          const cashParam = (pmLower==='cash') ? (settledCash>0 ? settledCash : (payCashPart>0 ? payCashPart : Number(cn.grand_total||0))) : 0;
          return `<tr>
            <td>${cn.invoice_no||cn.id}</td>
            <td>${date}</td>
            <td>${cn.ref_base_invoice_no||'-'}</td>
            <td>${customer}</td>
            <td style="max-width:200px; white-space:normal; word-break:break-word">${products}</td>
            <td>${fmt(employeeTotal)}</td>
            <td>${payMethod}</td>
            <td><button class="btn" style="padding:4px 8px; font-size:12px" onclick="viewInvoice(${cn.id}, '${cn.payment_method||''}', ${cashParam})">عرض</button></td>
          </tr>`;
        }).join('');
      }
    }
    
  }catch(err){
    console.error(err);
    alert('خطأ في تحميل التقرير');
  }
}

function labelPaymentMethod(method){
  const m = String(method||'').toLowerCase();
  if(m==='cash') return 'نقدًا';
  if(m==='card' || m==='network') return 'شبكة';
  if(m==='credit') return 'آجل';
  if(m==='tamara') return 'تمارا';
  if(m==='tabby') return 'تابي';
  if(m==='mixed') return 'مختلط';
  return method||'';
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
        const title = `employee-report-${safe||Date.now()}.pdf`;
        
        // إنشاء نسخة نظيفة للتصدير
        const clone = document.documentElement.cloneNode(true);
        
        // إزالة العناصر التفاعلية
        try{
          const header = clone.querySelector('header');
          if(header) header.remove();
          
          const rangeBar = clone.querySelector('.range-bar');
          if(rangeBar) rangeBar.remove();
          
          clone.querySelectorAll('.input, .btn, label, .toolbar, .no-print, .collapse-toggle').forEach(el => el.remove());
          
          // إزالة أعمدة الإجراءات
          clone.querySelectorAll('th.no-print, td:last-child').forEach(el => {
            if(el.textContent.includes('الإجراءات') || el.querySelector('button[onclick*="viewInvoice"]')){
              el.remove();
            }
          });
          
          // فتح جميع الأقسام المطوية
          clone.querySelectorAll('table').forEach(t => t.style.display = 'table');
          
          // إضافة عنوان التقرير في الأعلى
          const container = clone.querySelector('.container');
          if(container){
            const empName = document.getElementById('empName')?.textContent || '';
            const titleSection = clone.ownerDocument.createElement('div');
            titleSection.className = 'pdf-title-section';
            titleSection.innerHTML = `
              <h1 class="pdf-main-title">تقرير الموظفين</h1>
              <div class="pdf-employee">${empName ? 'الموظف: ' + empName : ''}</div>
              <div class="pdf-period">${rangeEl?.textContent || ''}</div>
            `;
            container.insertBefore(titleSection, container.firstChild);
          }
          
          // إخفاء بطاقة معلومات الموظف الأصلية
          const empCard = clone.getElementById('employeeInfoCard');
          if(empCard) empCard.remove();
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
            margin: 0 0 8px 0 !important;
          }
          
          .pdf-employee {
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
            box-shadow: none !important;
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
          
          h3::before {
            display: none !important;
          }
          
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 8px 0 !important;
            page-break-inside: auto;
            display: table !important;
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
          
          .grid-table {
            border: 1px solid #e6eaf0 !important;
          }
          
          .grid-table th, .grid-table td {
            border: 1px solid #e6eaf0 !important;
          }
          
          header, #range, .range-bar, .toolbar, .btn, .input, label, .no-print, .collapse-toggle, #employeeInfoCard {
            display: none !important;
            margin: 0 !important;
            padding: 0 !important;
            height: 0 !important;
          }
          
          #reportContent {
            display: block !important;
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
        if(rangeEl && rangeEl.textContent){ lines.push(esc('الفترة'), esc(rangeEl.textContent.trim())); lines.push(''); }
        
        const empName = document.getElementById('empName')?.textContent || '';
        if(empName){ lines.push(esc('الموظف'), esc(empName)); lines.push(''); }
        
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
        
        lines.push(esc('الإجماليات'));
        lines.push(esc('عدد الفواتير') + ',' + esc(document.getElementById('totalInvoices')?.textContent||'0'));
        lines.push(esc('إجمالي المبيعات') + ',' + esc(document.getElementById('totalSales')?.textContent||'0'));
        lines.push(esc('عدد المنتجات') + ',' + esc(document.getElementById('totalProducts')?.textContent||'0'));
        lines.push(esc('إجمالي الكمية') + ',' + esc(document.getElementById('totalQuantity')?.textContent||'0'));
        lines.push(esc('خصم الفواتير الدائنة') + ',' + esc(document.getElementById('totalCreditDeduction')?.textContent||'0'));
        lines.push(esc('إجمالي الكمية بعد الخصم') + ',' + esc(document.getElementById('netQuantity')?.textContent||'0'));
        lines.push(esc('الإجمالي الصافي') + ',' + esc(document.getElementById('netTotal')?.textContent||'0'));
        lines.push('');
        
        addTable('المنتجات المباعة', document.querySelector('table tbody#productsTbody')?.closest('table'));
        addTable('الفواتير', document.querySelector('table tbody#invoicesTbody')?.closest('table'));
        addTable('الفواتير الدائنة', document.querySelector('table tbody#creditNotesTbody')?.closest('table'));
        
        const csv = lines.join('\n');
        const period = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.replace(/[^0-9_\-–: ]+/g,'').replace(/\s+/g,' ').trim() : '';
        const filename = `employee-report-${(period||'').replace(/[: ]/g,'_')||Date.now()}.csv`;
        await window.api.csv_export(csv, { saveMode:'auto', filename });
      }catch(e){ console.error(e); alert('تعذر إنشاء Excel'); }
      finally{ exporting = false; btnExcel.disabled = false; }
    });
  }
  
  const btnPrint = document.getElementById('printReportBtn');
  if(btnPrint){
    btnPrint.addEventListener('click', async ()=>{
      try{
        btnPrint.disabled = true;
        window.print();
      }catch(e){ console.error(e); alert('تعذرت الطباعة'); }
      finally{ btnPrint.disabled = false; }
    });
  }
})();

(function attachCollapseToggle(){
  const invoicesToggle = document.getElementById('invoicesToggle');
  const invoicesTable = document.getElementById('invoicesTable');
  if(invoicesToggle && invoicesTable){
    invoicesToggle.addEventListener('click', ()=>{
      const isCollapsed = invoicesTable.style.display === 'none';
      if(isCollapsed){
        invoicesTable.style.display = 'table';
        invoicesToggle.textContent = '▼';
        invoicesToggle.classList.remove('collapsed');
      } else {
        invoicesTable.style.display = 'none';
        invoicesToggle.textContent = '◄';
        invoicesToggle.classList.add('collapsed');
      }
    });
  }
  
  const productsToggle = document.getElementById('productsToggle');
  const productsTable = document.getElementById('productsTable');
  if(productsToggle && productsTable){
    productsToggle.addEventListener('click', ()=>{
      const isCollapsed = productsTable.style.display === 'none';
      if(isCollapsed){
        productsTable.style.display = 'table';
        productsToggle.textContent = '▼';
        productsToggle.classList.remove('collapsed');
      } else {
        productsTable.style.display = 'none';
        productsToggle.textContent = '◄';
        productsToggle.classList.add('collapsed');
      }
    });
  }
  
  const creditNotesToggle = document.getElementById('creditNotesToggle');
  const creditNotesTable = document.getElementById('creditNotesTable');
  if(creditNotesToggle && creditNotesTable){
    creditNotesToggle.addEventListener('click', ()=>{
      const isCollapsed = creditNotesTable.style.display === 'none';
      if(isCollapsed){
        creditNotesTable.style.display = 'table';
        creditNotesToggle.textContent = '▼';
        creditNotesToggle.classList.remove('collapsed');
      } else {
        creditNotesTable.style.display = 'none';
        creditNotesToggle.textContent = '◄';
        creditNotesToggle.classList.add('collapsed');
      }
    });
  }
})();

async function viewInvoice(saleId, paymentMethod, cashAmount){
  if(!saleId) return;
  try{
    let __defPrintFormat = 'thermal';
    try{ 
      const r = await window.api.settings_get(); 
      if(r && r.ok && r.item){ 
        __defPrintFormat = (r.item.default_print_format === 'a4') ? 'a4' : 'thermal'; 
      } 
    }catch(_){ }
    const page = (__defPrintFormat === 'a4') ? '../sales/print-a4.html' : '../sales/print.html';
    const w = (__defPrintFormat === 'a4') ? 900 : 500;
    const h = (__defPrintFormat === 'a4') ? 1000 : 700;
    const qsObj = { id: String(saleId), refresh: '1' };
    if(paymentMethod) qsObj.pay = paymentMethod;
    if(cashAmount && cashAmount > 0) qsObj.cash = String(cashAmount);
    const qs = new URLSearchParams(qsObj);
    const url = `${page}?${qs.toString()}`;
    window.open(url, 'PRINT_VIEW', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
  }catch(e){
    console.error(e);
  }
}
