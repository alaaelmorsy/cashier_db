// Purchase Invoices screen logic

// Custom confirm dialog
function customConfirm(title, message, options = {}) {
  return new Promise((resolve) => {
    const confirmDlg = document.getElementById('confirmDlg');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmList = document.getElementById('confirmList');
    const confirmOk = document.getElementById('confirmOk');
    const confirmCancel = document.getElementById('confirmCancel');
    const confirmIcon = document.getElementById('confirmIcon');
    
    if (!confirmDlg || !confirmOk || !confirmCancel) {
      resolve(window.confirm(message));
      return;
    }
    
    // Update dialog content
    if (confirmTitle) confirmTitle.textContent = title || 'تأكيد';
    if (confirmMessage) confirmMessage.textContent = message || '';
    if (confirmIcon) confirmIcon.textContent = options.icon || '🗑️';
    
    // Setup button handlers
    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    
    function cleanup() {
      confirmOk?.removeEventListener('click', onOk);
      confirmCancel?.removeEventListener('click', onCancel);
      try { confirmDlg.close(); } catch(_) {}
      try { window.focus(); } catch(_) {}
    }
    
    confirmOk.addEventListener('click', onOk, { once: true });
    confirmCancel.addEventListener('click', onCancel, { once: true });
    confirmDlg.addEventListener('cancel', onCancel, { once: true });
    
    try { confirmDlg.showModal(); } 
    catch(_) { 
      try { confirmDlg.close(); confirmDlg.showModal(); } 
      catch(__) {} 
    }
    
    setTimeout(() => { try { confirmOk?.focus(); } catch(_) {} }, 0);
  });
}

// Toast Notification System
function showToast(message, type = 'warning', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const icons = {
    warning: '⚠️',
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  };
  
  const titles = {
    warning: 'تنبيه',
    success: 'نجح',
    error: 'خطأ',
    info: 'معلومة'
  };
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || '📋'}</div>
    <div class="toast-content">
      <div class="toast-title">${titles[type] || 'إشعار'}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

// طباعة الفاتورة مباشرة باستخدام iframe مخفي
function printInvoiceDirectly(invoiceId) {
  // إزالة أي iframe طباعة موجود مسبقاً
  const existingFrame = document.getElementById('print-iframe');
  if (existingFrame) {
    existingFrame.remove();
  }
  
  // إنشاء iframe مخفي
  const iframe = document.createElement('iframe');
  iframe.id = 'print-iframe';
  iframe.style.position = 'absolute';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.visibility = 'hidden';
  
  // عند تحميل الـ iframe، نفتح نافذة الطباعة
  iframe.onload = function() {
    try {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }, 500); // انتظار قصير لضمان تحميل كامل للمحتوى
    } catch (error) {
      console.error('Error printing:', error);
      alert('حدث خطأ أثناء الطباعة');
    }
  };
  
  // إضافة الـ iframe إلى الصفحة وتحميل صفحة الطباعة
  document.body.appendChild(iframe);
  iframe.src = `print-a4.html?id=${invoiceId}`;
}

// Success Modal - عرض الفاتورة الكاملة
async function showSuccessModal(invoiceId) {
  const modal = document.getElementById('successModal');
  const modalContent = document.getElementById('invoicePreviewContent');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalCloseBtn2 = document.getElementById('modalCloseBtn2');
  const modalPrintBtn = document.getElementById('modalPrintBtn');
  
  if (!modal || !modalContent) return;
  
  // عرض الـ Modal مع شاشة التحميل
  modal.classList.add('active');
  modalContent.innerHTML = `
    <div class="invoice-loading">
      <div class="spinner"></div>
      <p>جاري تحميل بيانات الفاتورة...</p>
    </div>
  `;
  
  try {
    // جلب بيانات الفاتورة الكاملة
    const result = await window.api.purchase_invoices_get(invoiceId);
    
    if (!result || !result.ok) {
      modalContent.innerHTML = `
        <div class="invoice-loading">
          <p style="color: #ef4444;">❌ فشل تحميل بيانات الفاتورة</p>
        </div>
      `;
      return;
    }
    
    const invoice = result.item;
    const items = result.items || [];
    
    // جلب بيانات المورد
    let supplier = null;
    try {
      const suppResult = await window.api.suppliers_get(invoice.supplier_id);
      if (suppResult && suppResult.ok) supplier = suppResult.item;
    } catch(e) {
      console.error('Failed to load supplier:', e);
    }
    
    // جلب بيانات الإعدادات
    let settings = {};
    try {
      const settResult = await window.api.settings_get?.();
      if (settResult && settResult.ok) settings = settResult.item || {};
    } catch(e) {
      console.error('Failed to load settings:', e);
    }
    
    // بناء HTML للفاتورة
    const invoiceHTML = await buildInvoiceHTML(invoice, items, supplier, settings);
    modalContent.innerHTML = invoiceHTML;
    
    // معالجة أزرار الإغلاق
    const closeModal = () => {
      modal.classList.remove('active');
    };
    
    modalCloseBtn.onclick = closeModal;
    modalCloseBtn2.onclick = closeModal;
    
    // زر الطباعة - فتح صفحة الطباعة
    modalPrintBtn.onclick = () => {
      // طباعة مباشرة باستخدام iframe مخفي
      printInvoiceDirectly(invoiceId);
    };
    
  } catch(error) {
    console.error('Error loading invoice:', error);
    modalContent.innerHTML = `
      <div class="invoice-loading">
        <p style="color: #ef4444;">❌ حدث خطأ أثناء تحميل الفاتورة</p>
      </div>
    `;
  }
}

// بناء HTML للفاتورة
async function buildInvoiceHTML(invoice, items, supplier, settings) {
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d)) return String(dateStr);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  
  // استخراج رقم الفاتورة التسلسلي من PI-YYYYMM-#####
  const extractInvoiceNo = (fullNo) => {
    const m = String(fullNo || '').match(/^PI-\d{6}-(\d+)$/);
    return m ? String(Number(m[1])) : (fullNo || '');
  };
  
  // معلومات الشركة بالعربي
  const companyNameAr = settings.seller_legal_name || 'مؤسسة تعلم التقنيات';
  const companyInfoAr = [];
  if (settings.company_location) companyInfoAr.push(settings.company_location);
  else companyInfoAr.push('الرياض - حي العليا العام');
  if (settings.company_site) companyInfoAr.push(settings.company_site);
  if (settings.mobile) companyInfoAr.push('جوال: ' + settings.mobile);
  else companyInfoAr.push('جوال: 01550515065');
  if (settings.email) companyInfoAr.push('إيميل: ' + settings.email);
  else companyInfoAr.push('إيميل: 20alaa25@gmail.com');
  if (settings.seller_vat_number) companyInfoAr.push('الرقم الضريبي: ' + settings.seller_vat_number);
  else companyInfoAr.push('الرقم الضريبي: 534575357357367');
  if (settings.commercial_register) companyInfoAr.push('السجل التجاري: ' + settings.commercial_register);
  else companyInfoAr.push('السجل التجاري: 2120632510');
  if (settings.national_number) companyInfoAr.push('الرقم الوطني: ' + settings.national_number);
  else companyInfoAr.push('الرقم الوطني: 29512956165165');
  
  // معلومات الشركة بالإنجليزي
  const companyNameEn = settings.seller_legal_name_en || 'Technology Learning Foundation';
  const companyInfoEn = [];
  if (settings.company_location_en || settings.company_location) 
    companyInfoEn.push(settings.company_location_en || settings.company_location);
  else companyInfoEn.push('Riyadh - Al-Ulaya General District');
  if (settings.company_site) companyInfoEn.push(settings.company_site);
  if (settings.mobile) companyInfoEn.push('Mobile: ' + settings.mobile);
  else companyInfoEn.push('Mobile: 01550515065');
  if (settings.email) companyInfoEn.push('Email: ' + settings.email);
  else companyInfoEn.push('Email: 20alaa25@gmail.com');
  if (settings.seller_vat_number) companyInfoEn.push('VAT No: ' + settings.seller_vat_number);
  else companyInfoEn.push('VAT No: 534575357357367');
  if (settings.commercial_register) companyInfoEn.push('CR No: ' + settings.commercial_register);
  else companyInfoEn.push('CR No: 2120632510');
  if (settings.national_number) companyInfoEn.push('National No: ' + settings.national_number);
  else companyInfoEn.push('National No: 29512956165165');
  
  // Logo
  let logoSrc = '';
  try {
    const lg = await window.api.settings_image_get?.();
    if (lg && lg.ok && lg.base64) {
      logoSrc = `data:${lg.mime||'image/png'};base64,${lg.base64}`;
    } else if (settings.logo_path) {
      if (String(settings.logo_path).startsWith('assets/')) {
        logoSrc = '../../../' + settings.logo_path;
      } else {
        logoSrc = 'file:///' + String(settings.logo_path||'').replace(/\\/g,'/');
      }
    }
  } catch(e) {}
  
  // بناء صفوف الأصناف
  const vatPct = invoice.vat_percent != null ? Number(invoice.vat_percent) : 0;
  const divisor = 1 + (vatPct / 100);
  let itemsHTML = '';
  
  for (const item of items) {
    const qty = Number(item.qty || 0);
    const uiUnit = (item.ui_unit_cost != null) ? Number(item.ui_unit_cost) : (Number(item.unit_cost || 0) * divisor);
    const unitExclusive = Number(item.unit_cost || 0);
    const lineDiscExclusive = Number(item.discount_line || 0);
    const netExclusiveLine = (item.line_total != null) ? Number(item.line_total) : Number(((unitExclusive * qty) - lineDiscExclusive).toFixed(2));
    const vatAmt = Number((netExclusiveLine * (vatPct / 100)).toFixed(2));
    const total = Number((netExclusiveLine + vatAmt).toFixed(2));
    
    // جلب اسم المنتج
    let productName = `#${item.product_id}`;
    try {
      const pr = await window.api.products_get(item.product_id);
      if (pr && pr.ok && pr.item) {
        productName = pr.item.name || pr.item.name_en || productName;
      }
    } catch(e) {}
    
    const description = item.description ? `<div style="font-size: 0.85em; color: #000; font-weight: 900; margin-top: 2px;">${item.description}</div>` : '';

    itemsHTML += `
      <tr>
        <td>${productName}${description}</td>
        <td>${qty}</td>
        <td>${uiUnit.toFixed(2)}</td>
        <td>${netExclusiveLine.toFixed(2)}</td>
        <td>${vatAmt.toFixed(2)}</td>
        <td>${total.toFixed(2)}</td>
      </tr>
    `;
  }
  
  // حساب المجاميع
  const subExclusive = Number(invoice.sub_total || 0);
  const discExclusive = Number(invoice.discount_general || 0);
  const netExclusive = (subExclusive - discExclusive);
  const vatTotal = Number(invoice.vat_total || 0);
  const grandInclusive = (netExclusive + vatTotal);
  
  return `
    <div class="invoice-content-wrapper">
      <div class="invoice-header-section">
        <div class="invoice-company-row">
          <div class="invoice-company-ar">
            <h1>${companyNameAr}</h1>
            <div class="invoice-company-info">${companyInfoAr.join('\n')}</div>
          </div>
          
          ${logoSrc ? `<img src="${logoSrc}" alt="Logo" class="invoice-logo" />` : '<div></div>'}
          
          <div class="invoice-company-en">
            <h1>${companyNameEn}</h1>
            <div class="invoice-company-info">${companyInfoEn.join('\n')}</div>
          </div>
        </div>
        
        <div class="invoice-type-badge">
          <div class="invoice-type-ar">فاتورة شراء</div>
        </div>
        
        <div class="invoice-meta-grid">
          <div class="invoice-meta-cell"><strong>رقم الفاتورة:</strong> <span>${extractInvoiceNo(invoice.invoice_no)}</span></div>
          <div class="invoice-meta-cell"><strong>التاريخ:</strong> <span>${formatDate(invoice.invoice_at)}</span></div>
          <div class="invoice-meta-cell"><strong>طريقة الدفع:</strong> <span>${invoice.payment_method || ''}</span></div>
          <div class="invoice-meta-cell"><strong>نسبة الضريبة:</strong> <span>${vatPct.toFixed(2)}%</span></div>
          <div class="invoice-meta-cell"><strong>المورد:</strong> <span>${supplier?.name || invoice.supplier_id}</span></div>
          <div class="invoice-meta-cell"><strong>جوال المورد:</strong> <span>${supplier?.phone || '-'}</span></div>
          <div class="invoice-meta-cell"><strong>الرقم الضريبي للمورد:</strong> <span>${supplier?.vat_number || '-'}</span></div>
          <div class="invoice-meta-cell"><strong>رقم فاتورة المورد:</strong> <span>${invoice.reference_no || '-'}</span></div>
        </div>
      </div>
      
      <table class="invoice-items-table">
        <thead>
          <tr>
            <th>الصنف</th>
            <th>الكمية</th>
            <th>سعر الشراء</th>
            <th>الإجمالي قبل الضريبة</th>
            <th>الضريبة</th>
            <th>الإجمالي شامل الضريبة</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
      
      <table class="invoice-totals-table">
        <tbody>
          <tr><td>الإجمالي قبل الضريبة</td><td>${netExclusive.toFixed(2)} \ue900</td></tr>
          <tr><td>الخصم العام (غير شامل)</td><td>${discExclusive.toFixed(2)} \ue900</td></tr>
          <tr><td>قيمة الضريبة</td><td>${vatTotal.toFixed(2)} \ue900</td></tr>
          <tr><td>الإجمالي شامل الضريبة</td><td>${grandInclusive.toFixed(2)} \ue900</td></tr>
        </tbody>
      </table>
      
      ${invoice.notes ? `<div class="invoice-notes"><strong>ملاحظات:</strong> ${invoice.notes}</div>` : ''}
    </div>
  `;
}

// Elements
const errorDiv = document.getElementById('error');
const btnBack = document.getElementById('btnBack');
// Tabs
const tabBtnMake = document.getElementById('tabBtnMake');
const tabBtnSaved = document.getElementById('tabBtnSaved');
const tabMake = document.getElementById('tab_make');
const tabSaved = document.getElementById('tab_saved');

const invNo = document.getElementById('inv_no');
const invDt = document.getElementById('inv_dt');
const supplierSel = document.getElementById('supplier_id');
const methodSel = document.getElementById('payment_method');
const refNo = document.getElementById('reference_no');
const notes = document.getElementById('notes');
const prodSearch = document.getElementById('prod_search');
const suggestions = document.getElementById('suggestions');
const tbody = document.getElementById('tbody');
// Totals
const subTotalEl = document.getElementById('sub_total');
const discGenEl = document.getElementById('discount_general');
const priceModeSel = document.getElementById('price_mode');
const vatPctEl = document.getElementById('vat_percent');
const vatTotalEl = document.getElementById('vat_total');
const grandEl = document.getElementById('grand_total');
const paidEl = document.getElementById('amount_paid');
const dueEl = document.getElementById('amount_due');
// Actions
const btnSave = document.getElementById('btnSave');
const btnPrint = document.getElementById('btnPrint');
const btnSearch = document.getElementById('btnSearch');
const btnNew = document.getElementById('btnNew');

// Saved tab elements
const filterFrom = document.getElementById('filter_from');
const filterTo = document.getElementById('filter_to');
const filterSupplier = document.getElementById('filter_supplier_id');
const filterInvNo = document.getElementById('filter_invno');
const btnFilterSearch = document.getElementById('btnFilterSearch');
const btnFilterClear = document.getElementById('btnFilterClear');
const tbodySaved = document.getElementById('tbodySaved');

let lines = []; // { product_id, code, name, qty, unit_cost, discount_line, line_total, line_total_display, unit_cost_exclusive, discount_exclusive }
let editingId = null; // if set, Save will update existing invoice
let originalPaymentMethod = null; // preserve saved payment method during edit
let originalPaymentUi = null; // the UI select value corresponding to saved method

let currentPage = 1;
let itemsPerPage = 10;
let totalInvoices = 0;
let allInvoices = [];

function dbToUiMethod(val){
  const k = String(val||'').toLowerCase();
  if(k==='cash' || val==='كاش') return 'كاش';
  if(k==='network' || k==='card' || val==='شبكة') return 'شبكة';
  if(k==='credit' || val==='آجل' || val==='اجل') return 'آجل';
  return val || '';
}
function uiToDbMethod(val){
  const v = String(val||'').trim();
  if(v==='كاش' || v.toLowerCase()==='cash') return 'cash';
  if(v==='شبكة' || v.toLowerCase()==='network' || v.toLowerCase()==='card') return 'network';
  if(v==='آجل' || v==='اجل' || v.toLowerCase()==='credit') return 'credit';
  return v.toLowerCase()||'cash';
}
let currentTotalsState = { priceMode: String(priceModeSel?.value||'inclusive'), discountGeneralExclusive: 0, vatPercent: (vatPctEl?.value !== '' ? Number(vatPctEl?.value) : 15), subTotal: 0, vatTotal: 0, grandTotal: 0 };

function resetTotalsState(){
  currentTotalsState = {
    priceMode: String(priceModeSel?.value||'inclusive'),
    discountGeneralExclusive: 0,
    vatPercent: Math.max(0, vatPctEl?.value !== '' ? Number(vatPctEl?.value) : 15),
    subTotal: 0,
    vatTotal: 0,
    grandTotal: 0
  };
}

function setError(m){ errorDiv.textContent = m||''; }

function setNow(){
  const now = new Date();
  const iso = new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  invDt.value = iso;
}

async function loadSuppliers(){
  supplierSel.innerHTML = '<option value="">— اختر المورد —</option>';
  const r = await window.api.suppliers_list({ active: '1', sort: 'name_asc' });
  if(r && r.ok){
    r.items.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id; opt.textContent = s.name;
      supplierSel.appendChild(opt);
    });
    // Fill filter supplier as well
    filterSupplier.innerHTML = '<option value="">— كل الموردين —</option>';
    r.items.forEach(s => { const o=document.createElement('option'); o.value=s.id; o.textContent=s.name; filterSupplier.appendChild(o); });
  }
}

function addLineFromProduct(p){
  lines.push({ product_id: p.id, code: p.barcode || String(p.id), name: p.name, description: '', qty: 1, unit_cost: Number(p.cost||0)||0, line_total: 0, line_total_display: 0, line_total_simple: 0, unit_cost_exclusive: 0, _loadedFromDb: false });
  renderLines();
}

function computeLineTotals(ln, vatPercent, priceMode){
  const qty = Math.max(0, Number(ln.qty||0));
  const unitInput = Math.max(0, Number(ln.unit_cost||0));
  const discInput = 0; // No per-line discount
  // For zero_vat mode, treat as exclusive but vatPercent is 0
  const divisor = priceMode === 'inclusive' ? (1 + (vatPercent/100)) : 1;
  const safeDivisor = divisor > 0 ? divisor : 1;
  const unitExclusive = priceMode === 'inclusive' ? (unitInput / safeDivisor) : unitInput;
  const discountExclusive = 0; // No per-line discount
  const lineExclusive = Math.max(0, qty * unitExclusive);
  const lineDisplay = Math.max(0, qty * unitInput);
  // Simple per-line total shown in UI: qty × unit price as entered (no VAT conversion, no discount)
  const lineSimple = Math.max(0, qty * unitInput);
  ln.unit_cost_exclusive = Number(unitExclusive.toFixed(4));
  ln.discount_exclusive = Number(discountExclusive.toFixed(2));
  ln.line_total = Number(lineExclusive.toFixed(2)); // used for accounting (exclusive, after line discount)
  ln.line_total_display = Number(lineDisplay.toFixed(2)); // inclusive/exclusive visual if needed elsewhere
  ln.line_total_simple = Number(lineSimple.toFixed(2)); // shown in column "الإجمالي"
}
function computeTotals(){
  const vatPct = Math.max(0, vatPctEl.value !== '' ? Number(vatPctEl.value) : 15);
  const priceMode = String(priceModeSel?.value||'inclusive');

  let sub = 0;
  lines.forEach((ln, idx) => {
    computeLineTotals(ln, vatPct, priceMode);
    sub += ln.line_total;
    const row = tbody.children[idx];
    const lineTotalInput = row?.querySelector?.('.linetotal');
    if(lineTotalInput){
      // Always show qty × unit price as entered by user (no VAT conversion, no line discount)
      const displayValue = (ln.line_total_simple ?? (Number(ln.qty||0) * Number(ln.unit_cost||0)));
      lineTotalInput.value = Number(displayValue||0).toFixed(2);
      lineTotalInput.dataset.exclusive = Number(displayValue||0).toFixed(2);
      lineTotalInput.dataset.inclusive = Number(displayValue||0).toFixed(2);
    }
  });
  sub = Number(sub.toFixed(2));

  // Keep discount value exclusive of VAT. If loaded from DB, use the stored exclusive to avoid any change on screen recalc.
  let discountExclusive = Number(currentTotalsState.discountGeneralExclusive||0);
  const currentInputDiscount = Math.max(0, Number(discGenEl.value||0));
  const dbExclusiveHint = Number(discGenEl.dataset?.exclusive || '');
  if(!Number.isNaN(dbExclusiveHint) && dbExclusiveHint>=0){
    discountExclusive = dbExclusiveHint; // trust stored value
  } else if(priceMode === 'zero_vat'){
    discountExclusive = currentInputDiscount;
  } else {
    const divisor = 1 + (vatPct/100);
    const safeDivisor = divisor > 0 ? divisor : 1;
    discountExclusive = Number((currentInputDiscount / safeDivisor).toFixed(2));
  }
  currentTotalsState.discountGeneralExclusive = discountExclusive;

  const base = Math.max(0, sub - discountExclusive);
  const vat = Number((base * (vatPct/100)).toFixed(2));
  const grand = Number((base + vat).toFixed(2));
  subTotalEl.value = sub.toFixed(2) + ' \ue900';
  vatTotalEl.value = vat.toFixed(2) + ' \ue900';
  grandEl.value = grand.toFixed(2) + ' \ue900';
  // Payment method: no partials
  const isCredit = String(methodSel.value||'كاش') === 'آجل';
  const paid = isCredit ? 0 : grand;
  const due = Number((grand - paid).toFixed(2));
  paidEl.value = paid.toFixed(2) + ' \ue900';
  dueEl.value = due.toFixed(2) + ' \ue900';

  currentTotalsState = {
    priceMode,
    discountGeneralExclusive: discountExclusive,
    vatPercent: vatPct,
    subTotal: sub,
    vatTotal: vat,
    grandTotal: grand
  };
}

function renderLines(){
  const priceMode = String(priceModeSel?.value||'inclusive'); // UI only; per-line display not affected by tax mode
  tbody.innerHTML = '';
  lines.forEach((ln, idx) => {
    const initDisplay = Number(((Number(ln.qty||0)) * (Number(ln.unit_cost||0))).toFixed(2));
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="code" value="${ln.code||''}" readonly /></td>
      <td>
        <input class="pname" value="${ln.name||''}" readonly />
        <input class="description" placeholder="وصف الصنف (يظهر في الطباعة)..." value="${ln.description||''}" style="margin-top: 4px; font-size: 0.8rem; color: #000; width: 100%; border: 1px solid #94a3b8; border-radius: 4px; padding: 4px; background: #fff;" />
      </td>
      <td style="text-align:center"><input class="qty" type="number" step="0.001" min="0" value="${ln.qty}" style="width:110px; text-align:center" /></td>
      <td style="text-align:center"><input class="price" type="number" step="0.01" min="0" value="${ln.unit_cost}" style="width:140px; text-align:center" /></td>
      <td style="text-align:center"><input class="linetotal" type="text" readonly value="${initDisplay.toFixed(2)}" style="width:140px; text-align:center; background:#f3f4f6" data-exclusive="${initDisplay.toFixed(2)}" data-inclusive="${initDisplay.toFixed(2)}" /></td>
      <td style="text-align:center"><button class="btn-del-row">🗑 حذف</button></td>
    `;
    // Bind handlers
    const qty = tr.querySelector('.qty');
    const price = tr.querySelector('.price');
    const desc = tr.querySelector('.description');
    const btnRowDel = tr.querySelector('.btn-del-row');

    const updateAndCompute = () => {
      ln.qty = Number(qty.value||0);
      ln.unit_cost = Number(price.value||0);
      computeTotals();
    };
    qty.addEventListener('input', updateAndCompute);
    price.addEventListener('input', updateAndCompute);
    
    desc.addEventListener('input', () => {
      ln.description = desc.value;
    });

    btnRowDel.addEventListener('click', ()=>{
      lines.splice(idx,1);
      renderLines();
    });

    tbody.appendChild(tr);
  });
  computeTotals();
}

btnBack?.addEventListener('click', async ()=>{ try{ await window.api.app_set_locale(document.documentElement.lang); }catch(_){} try{ await window.api.window_back?.(); }catch(_){} history.back(); });

// Tabs switching
function switchTab(which){
  if(which==='make'){
    tabMake.classList.add('active'); tabSaved.classList.remove('active');
    tabBtnMake.classList.add('active'); tabBtnSaved.classList.remove('active');
  }else{
    tabMake.classList.remove('active'); tabSaved.classList.add('active');
    tabBtnMake.classList.remove('active'); tabBtnSaved.classList.add('active');
  }
}

tabBtnMake?.addEventListener('click', ()=> switchTab('make'));
tabBtnSaved?.addEventListener('click', ()=> switchTab('saved'));

// Live suggestions: type to search by name, Enter searches barcode fallback
let suggestTimer = null;
function hideSuggestions(){ suggestions.style.display='none'; suggestions.innerHTML=''; }
function showSuggestions(items){
  if(!items || !items.length){ hideSuggestions(); return; }
  suggestions.innerHTML = '';
  items.forEach(p => {
    const div = document.createElement('div');
    div.style.padding = '8px 12px';
    div.style.cursor = 'pointer';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '8px';
    div.addEventListener('mouseenter', ()=>{ div.style.background = '#f8fafc'; });
    div.addEventListener('mouseleave', ()=>{ div.style.background = 'transparent'; });
    div.innerHTML = `<span style="color:#64748b">${p.barcode || p.id}</span><span>${p.name}</span><span style="margin-inline-start:auto; color:#0ea5e9">${Number(p.cost||0).toFixed(2)}</span>`;
    div.addEventListener('click', ()=>{ addLineFromProduct(p); prodSearch.value=''; hideSuggestions(); });
    suggestions.appendChild(div);
  });
  suggestions.style.display='block';
}

prodSearch?.addEventListener('input', ()=>{
  const q = String(prodSearch.value||'').trim();
  if(suggestTimer) clearTimeout(suggestTimer);
  if(!q){ hideSuggestions(); return; }
  suggestTimer = setTimeout(async ()=>{
    try{
      const r = await window.api.products_list({ q, limit: 30, sort: 'name_asc' });
      if(r && r.ok){ showSuggestions(r.items); } else { hideSuggestions(); }
    }catch(_){ hideSuggestions(); }
  }, 180);
});

document.addEventListener('click', (e)=>{
  if(!suggestions.contains(e.target) && e.target !== prodSearch){ hideSuggestions(); }
});

prodSearch?.addEventListener('keydown', async (e)=>{
  if(e.key !== 'Enter') return;
  const v = String(prodSearch.value||'').trim(); if(!v) return;
  try{
    const r = await window.api.products_get_by_barcode(v);
    if(r && r.ok){ addLineFromProduct(r.item); prodSearch.value=''; hideSuggestions(); return; }
  }catch(_){ }
  try{ const r2 = await window.api.products_list({ q: v, limit: 1 }); if(r2 && r2.ok && r2.items.length){ addLineFromProduct(r2.items[0]); prodSearch.value=''; hideSuggestions(); } }catch(_){ }
});

function recalcOnChange(){ computeTotals(); }
[discGenEl, vatPctEl, methodSel, priceModeSel].forEach(el => el?.addEventListener('input', recalcOnChange));

// Handle zero_vat mode: set VAT to 0 and make field read-only
priceModeSel?.addEventListener('change', () => {
  const mode = String(priceModeSel.value || 'inclusive');
  if(mode === 'zero_vat'){
    vatPctEl.value = '0';
    vatPctEl.readOnly = true;
    vatPctEl.style.backgroundColor = '#f3f4f6';
  } else {
    vatPctEl.readOnly = false;
    vatPctEl.style.backgroundColor = '';
    if(vatPctEl.value === '0'){
      vatPctEl.value = '15';
    }
  }
  computeTotals();
});

// Recalculate totals when VAT percentage changes
vatPctEl?.addEventListener('input', () => {
  computeTotals();
});

function clearForm(){ editingId=null; originalPaymentMethod=null; btnSave.textContent='💾 حفظ الفاتورة'; invNo.value=''; setNow(); supplierSel.value=''; methodSel.value='cash'; refNo.value=''; notes.value=''; discGenEl.value='0'; currentTotalsState.discountGeneralExclusive = 0; priceModeSel.value='inclusive'; vatPctEl.value='15'; vatPctEl.readOnly=false; vatPctEl.style.backgroundColor=''; lines = []; renderLines(); setError(''); hideSuggestions(); }

btnNew?.addEventListener('click', clearForm);

async function saveOrUpdate(){
  setError('');
  if(!supplierSel.value){ 
    showToast('يرجى اختيار المورد قبل الحفظ', 'warning', 4000);
    return; 
  }
  if(!lines.length){ 
    showToast('لا توجد أصناف في الفاتورة', 'warning', 4000);
    setError('لا توجد أصناف'); 
    return; 
  }
  for(const ln of lines){ 
    if(!ln.product_id || Number(ln.qty)<=0){ 
      showToast('يرجى اختيار منتج صحيح وكميات موجبة', 'warning', 4000);
      setError('يرجى اختيار منتج صحيح وكميات موجبة'); 
      return; 
    } 
  }
  const payload = {
    supplier_id: Number(supplierSel.value),
    items: lines.map(ln => ({ product_id: ln.product_id, description: ln.description || null, qty: Number(ln.qty||0), unit_cost: Number((ln.unit_cost_exclusive ?? ln.unit_cost)||0), discount_line: Number((ln.discount_exclusive ?? ln.discount_line)||0) })),
    discount_general: Number(currentTotalsState.discountGeneralExclusive||0),
    vat_percent: vatPctEl.value !== '' ? Number(vatPctEl.value) : 15,
    // Preserve original payment_method when editing unless user explicitly changes it.
    // Convert between UI (Arabic labels) and DB canonical values.
    payment_method: (function(){
      const uiVal = String(methodSel.value||'').trim();
      if(editingId && originalPaymentMethod!=null){
        // If UI still equals the original UI value, keep DB value unchanged; otherwise convert to DB enum
        if(uiVal === String(originalPaymentUi||'')) return String(originalPaymentMethod);
        return uiToDbMethod(uiVal) || String(originalPaymentMethod);
      }
      return uiToDbMethod(uiVal) || 'cash';
    })(),
    price_mode: String(priceModeSel?.value||'inclusive'),
    reference_no: (refNo.value||'').trim()||null,
    notes: (notes.value||'').trim()||null,
    invoice_dt: invDt.value
  };
  const btnLabel = btnSave.textContent; btnSave.textContent = '⏳ جاري المعالجة...'; btnSave.disabled = true;
  try{
    let r;
    if(editingId){ r = await window.api.purchase_invoices_update(editingId, payload); }
    else { r = await window.api.purchase_invoices_add(payload); }
    if(!r || !r.ok){ 
      showToast(r?.error||'فشل العملية', 'error', 4000);
      setError(r?.error||'فشل العملية'); 
      return; 
    }
    if(!editingId){
      const savedInvoiceNo = r.invoice_no || '';
      const savedInvoiceId = r.id;
      invNo.value = savedInvoiceNo;
      
      // فتح معاينة الطباعة نفسها المستخدمة في تبويب الفواتير المحفوظة
      try {
        const w = 900, h = 1000;
        const view = window.open(`./print-a4.html?id=${encodeURIComponent(savedInvoiceId)}`, 'PURCHASE_PRINT_A4', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
        let tries = 0;
        const t = setInterval(()=>{
          tries++;
          try{
            if(view && view.sessionStorage){ view.sessionStorage.setItem('purchase_invoice_id', String(savedInvoiceId)); clearInterval(t); }
          }catch(_){/* ignore */}
          if(tries>30){ clearInterval(t); }
        }, 100);
      } catch(e) {
        console.error('تعذر فتح المعاينة:', e);
      }

      // بعد الحفظ بنجاح، نفرغ شاشة إنشاء فاتورة مشتريات
      clearForm();
      // ننتقل تلقائياً إلى تبويب الفواتير المحفوظة ونحدّث القائمة
      switchTab('saved');
      await loadSaved();
    } else {
      showToast('تم تحديث الفاتورة بنجاح', 'success', 4000);
      // بعد التحديث، اعرض الفاتورة في تبويب المحفوظة
      switchTab('saved');
      await loadSaved();
    }
  } finally {
    btnSave.textContent = btnLabel; btnSave.disabled = false;
  }
}

btnSave?.addEventListener('click', saveOrUpdate);

btnSearch?.addEventListener('click', ()=>{ switchTab('saved'); });

async function fillFormFromInvoice(it, details){
  editingId = it.id;
  btnSave.textContent = '💾 تحديث الفاتورة';
  // Show short display number like print: extract sequence from PI-YYYYMM-#####
  (function(){
    const raw = String(it.invoice_no||'');
    const m = raw.match(/^PI-\d{6}-(\d+)$/);
    invNo.value = m ? String(Number(m[1])) : (raw || String(it.id||''));
  })();
  try{
    const d = new Date(String(it.invoice_at).replace(' ','T'));
    invDt.value = new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
  }catch(_){ setNow(); }
  supplierSel.value = it.supplier_id;
  // Preserve exact saved payment_method and reflect in UI (supports Arabic values)
  originalPaymentMethod = it.payment_method;
  // Store UI representation and set select accordingly
  originalPaymentUi = dbToUiMethod(it.payment_method);
  methodSel.value = originalPaymentUi;
  refNo.value = it.reference_no || '';
  notes.value = it.notes || '';
  const priceMode = String(it.price_mode||'inclusive');
  priceModeSel.value = priceMode;
  // Handle zero_vat mode when loading invoice
  if(priceMode === 'zero_vat'){
    vatPctEl.value = '0';
    vatPctEl.readOnly = true;
    vatPctEl.style.backgroundColor = '#f3f4f6';
  } else {
    vatPctEl.value = it.vat_percent != null ? Number(it.vat_percent) : 15;
    vatPctEl.readOnly = false;
    vatPctEl.style.backgroundColor = '';
  }
  const vatPct = priceMode === 'zero_vat' ? 0 : (it.vat_percent != null ? Number(it.vat_percent) : 15);
  const divisor = priceMode === 'inclusive' ? (1 + (vatPct/100)) : 1;
  const safeDivisor = divisor > 0 ? divisor : 1;
  // Stored discount_general is exclusive. Display it inclusive in UI if needed, but keep exclusive in state
  const discountExclusiveStored = Number(it.discount_general||0);
  const discountUiStored = (it.discount_general_ui!=null) ? Number(it.discount_general_ui) : null;
  const discountUiInput = (discountUiStored!=null && !Number.isNaN(discountUiStored) && discountUiStored>0)
    ? discountUiStored
    : (priceMode === 'inclusive' ? Number((discountExclusiveStored * safeDivisor).toFixed(2)) : discountExclusiveStored);
  discGenEl.value = Number(discountUiInput||0).toFixed(2);
  // Preserve the exact stored exclusive discount to avoid re-conversion drift on loaded inclusive invoices
  discGenEl.dataset.exclusive = Number(discountExclusiveStored||0).toFixed(2);
  currentTotalsState.discountGeneralExclusive = discountExclusiveStored;
  lines = (details||[]).map(x=>({
    product_id: x.product_id,
    code: String(x.product_id),
    name: '',
    description: x.description || '',
    qty: Number(x.qty||0),
    // Prefer exact UI-entered values when available to guarantee round-trip with no changes
    unit_cost: (function(){
      const uiFromDb = (x.ui_unit_cost!=null) ? Number(x.ui_unit_cost) : null;
      if(uiFromDb!=null && !Number.isNaN(uiFromDb)) return Number(uiFromDb.toFixed(2));
      const base = Number(x.unit_cost||0);
      const ui = priceMode === 'inclusive' ? (base * safeDivisor) : base;
      return Number(ui.toFixed(2));
    })(),
    line_total: Number(x.line_total||0), // stored exclusive
    // UI per-line display should match qty × UI unit_cost, prefer stored ui_line_total when available
    line_total_display: (function(){
      const uiLineFromDb = (x.ui_line_total!=null) ? Number(x.ui_line_total) : null;
      if(uiLineFromDb!=null && !Number.isNaN(uiLineFromDb)) return Number(uiLineFromDb.toFixed(2));
      const qty = Number(x.qty||0);
      const uiUnit = (function(){
        const uiFromDb = (x.ui_unit_cost!=null) ? Number(x.ui_unit_cost) : null;
        if(uiFromDb!=null && !Number.isNaN(uiFromDb)) return uiFromDb;
        return priceMode === 'inclusive' ? (Number(x.unit_cost||0) * safeDivisor) : Number(x.unit_cost||0);
      })();
      return Number((qty * uiUnit).toFixed(2));
    })(),
    unit_cost_exclusive: Number(x.unit_cost||0),
    _loadedFromDb: true
  }));
  for(const ln of lines){ try{ const pr = await window.api.products_get(ln.product_id); if(pr && pr.ok){ ln.name = pr.item.name; ln.code = pr.item.barcode||String(pr.item.id); } }catch(_){ } }
  renderLines();
  computeTotals(); // Recalculate totals after loading invoice (important for zero_vat mode)
  switchTab('make');
}

function dateToDbRange(d, end){
  if(!d) return null;
  const val = String(d).trim();
  if(!val) return null;
  if(val.includes('T')){
    const [date, timeRaw] = val.split('T');
    let hhmm = (timeRaw || '').trim();
    if(!hhmm) hhmm = end ? '23:59' : '00:00';
    if(/^\d{2}:\d{2}$/.test(hhmm)){
      hhmm = hhmm + (end ? ':59' : ':00');
    }
    return `${date} ${hhmm}`;
  }
  return end ? `${val} 23:59:59` : `${val} 00:00:00`;
}

async function loadSaved(){
  const q = {};
  if(filterFrom.value) q.from = dateToDbRange(filterFrom.value, false);
  if(filterTo.value) q.to = dateToDbRange(filterTo.value, true);
  if(filterSupplier.value) q.supplier_id = Number(filterSupplier.value);
  if(filterInvNo.value){
    const rawInv = String(filterInvNo.value).trim();
    if(rawInv){
      if(/^[0-9]+$/.test(rawInv)){
        q.invoice_no = '-' + String(rawInv).padStart(5,'0');
      } else {
        q.invoice_no = rawInv;
      }
    }
  }
  
  tbodySaved.innerHTML = '<tr class="loading-row"><td colspan="7" style="text-align:center; padding:40px;">⏳ جاري تحميل الفواتير...</td></tr>';
  
  const r = await window.api.purchase_invoices_list(q);
  tbodySaved.innerHTML = '';
  
  if(!r || !r.ok || !r.items.length){
    tbodySaved.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <div class="icon">📭</div>
          <div class="message">لا توجد فواتير</div>
          <div class="hint">جرّب تغيير معايير البحث أو قم بإنشاء فاتورة جديدة</div>
        </div>
      </td></tr>
    `;
    document.getElementById('invoice-count').textContent = '0 فاتورة';
    const paginationControls = document.getElementById('paginationControls');
    const paginationControlsTop = document.getElementById('paginationControlsTop');
    if(paginationControls) paginationControls.style.display = 'none';
    if(paginationControlsTop) paginationControlsTop.style.display = 'none';
    return;
  }
  
  allInvoices = r.items;
  totalInvoices = allInvoices.length;
  document.getElementById('invoice-count').textContent = `${totalInvoices} فاتورة`;
  
  const paginationControls = document.getElementById('paginationControls');
  const paginationControlsTop = document.getElementById('paginationControlsTop');
  if(paginationControls) paginationControls.style.display = 'flex';
  if(paginationControlsTop) paginationControlsTop.style.display = 'flex';
  
  const suppliersCache = {};
  try {
    const suppResult = await window.api.suppliers_list?.();
    if(suppResult && suppResult.ok && suppResult.items) {
      for(const s of suppResult.items) {
        suppliersCache[s.id] = s.name;
      }
    }
  } catch(e) {
    console.error('Failed to load suppliers:', e);
  }
  
  renderCurrentPage(suppliersCache);
  renderPagination();
}

function renderCurrentPage(suppliersCache){
  tbodySaved.innerHTML = '';
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalInvoices);
  const currentItems = allInvoices.slice(startIndex, endIndex);
  
  const paginationText = document.getElementById('paginationText');
  const paginationTextTop = document.getElementById('paginationTextTop');
  const textContent = `عرض ${startIndex + 1}-${endIndex} من ${totalInvoices} فاتورة`;
  if(paginationText) paginationText.textContent = textContent;
  if(paginationTextTop) paginationTextTop.textContent = textContent;
  
  for(const it of currentItems){
    const tr = document.createElement('tr');
    
    // Format date
    const fmtDateEn = (s)=>{ 
      const d=new Date(s); 
      if(isNaN(d)) return String(s); 
      const pad=n=>String(n).padStart(2,'0'); 
      const date = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      return `<div><strong>${date}</strong></div><div class="invoice-date">${time}</div>`;
    };
    const dt = fmtDateEn(it.invoice_at);
    
    // Extract sequential number from PI-YYYYMM-##### to display like 1,2,...
    const seqNo = (()=>{ 
      const inv=String(it.invoice_no||''); 
      const m=inv.match(/^PI-\d{6}-(\d+)$/); 
      return m ? String(Number(m[1])) : (inv || String(it.id||'')); 
    })();
    
    // Get supplier name
    const supplierName = suppliersCache[it.supplier_id] || `#${it.supplier_id}`;
    
    // Payment status badge
    const amountPaid = Number(it.amount_paid || 0);
    const grandTotal = Number(it.grand_total || 0);
    const amountDue = Number(it.amount_due || 0);
    
    let paymentStatus = '';
    if(amountDue <= 0 || amountPaid >= grandTotal) {
      paymentStatus = '<span class="payment-badge paid">✓ مدفوع بالكامل</span>';
    } else if(amountPaid > 0) {
      paymentStatus = `<span class="payment-badge partial">⚠ مدفوع جزئياً<br/><small>${amountPaid.toFixed(2)} من ${grandTotal.toFixed(2)}</small></span>`;
    } else {
      paymentStatus = '<span class="payment-badge unpaid">✗ غير مدفوع</span>';
    }
    
    tr.innerHTML = `
      <td>${dt}</td>
      <td><span class="invoice-number">📄 ${seqNo}</span></td>
      <td><span class="supplier-name">${supplierName}</span></td>
      <td><span class="payment-method-badge">${it.payment_method || '-'}</span></td>
      <td>${paymentStatus}</td>
      <td><span class="total-amount">${grandTotal.toFixed(2)} \ue900</span></td>
      <td style="text-align:center">
        <div class="flex flex-wrap gap-2 justify-center">
          <button class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium btn-view">👁 عرض</button>
          <button class="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-medium btn-edit">✏️ تعديل</button>
          <button class="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm font-medium btn-del">🗑️ حذف</button>
        </div>
      </td>
    `;
    
    const btnV=tr.querySelector('.btn-view');
    const btnE=tr.querySelector('.btn-edit');
    const btnD=tr.querySelector('.btn-del');
    
    btnV.addEventListener('click', async ()=>{
      try{
        // Open dedicated A4 view for this purchase invoice
        const w = 900, h = 1000;
        // Prefer passing id via query string for reliability; also set sessionStorage as fallback
        const view = window.open(`./print-a4.html?id=${encodeURIComponent(it.id)}`, 'PURCHASE_PRINT_A4', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
        let tries = 0;
        const t = setInterval(()=>{
          tries++;
          try{
            if(view && view.sessionStorage){ view.sessionStorage.setItem('purchase_invoice_id', String(it.id)); clearInterval(t); }
          }catch(_){ /* ignore cross-origin until ready */ }
          if(tries>30){ clearInterval(t); }
        }, 100);
      }catch(e){ alert('تعذر فتح العرض: ' + (e?.message||String(e))); }
    });
    
    btnE.addEventListener('click', async ()=>{
      const g = await window.api.purchase_invoices_get(it.id); 
      if(!g||!g.ok){ 
        showToast('تعذر جلب بيانات الفاتورة', 'error');
        return; 
      }
      await fillFormFromInvoice(it, g.items||[]);
      switchTab('make');
      showToast('تم تحميل الفاتورة للتعديل', 'success');
    });

    btnD.addEventListener('click', async ()=>{
      // Use modern custom confirm dialog
      const proceed = await customConfirm(
        'تأكيد حذف الفاتورة',
        'هل أنت متأكد من حذف هذه الفاتورة؟',
        { icon: '🗑️' }
      );

      if(!proceed) return;
      
      // Disable button during deletion
      btnD.disabled = true;
      btnD.innerHTML = '⏳ جاري الحذف...';
      
      const r = await window.api.purchase_invoices_delete(it.id);
      
      if(!r||!r.ok){ 
        showToast(r?.error||'فشل الحذف', 'error');
        btnD.disabled = false;
        btnD.innerHTML = '🗑 حذف';
        return; 
      }
      
      showToast('تم حذف الفاتورة بنجاح', 'success');
      await loadSaved();
    });
    
    tbodySaved.appendChild(tr);
  }
}

function renderPagination() {
  const paginationButtons = document.getElementById('paginationButtons');
  const paginationButtonsTop = document.getElementById('paginationButtonsTop');
  
  const totalPages = Math.ceil(totalInvoices / itemsPerPage);
  
  if (totalPages <= 1) {
    if(paginationButtons) paginationButtons.style.display = 'none';
    if(paginationButtonsTop) paginationButtonsTop.style.display = 'none';
    return;
  }
  
  const createButton = (text, page, isActive = false, isDisabled = false, isEllipsis = false) => {
    const btn = document.createElement('button');
    btn.className = 'pagination-btn';
    btn.textContent = text;
    
    if (isActive) btn.classList.add('active');
    if (isDisabled) btn.disabled = true;
    if (isEllipsis) btn.classList.add('ellipsis');
    
    if (!isDisabled && !isEllipsis) {
      btn.addEventListener('click', () => goToPage(page));
    }
    
    return btn;
  };
  
  const renderButtons = (container) => {
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'flex';
    
    container.appendChild(createButton('السابق', currentPage - 1, false, currentPage === 1));
    
    const maxButtons = 7;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }
    
    if (startPage > 1) {
      container.appendChild(createButton('1', 1));
      if (startPage > 2) {
        container.appendChild(createButton('...', null, false, false, true));
      }
    }
    
    for (let i = startPage; i <= endPage; i++) {
      container.appendChild(createButton(String(i), i, i === currentPage));
    }
    
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        container.appendChild(createButton('...', null, false, false, true));
      }
      container.appendChild(createButton(String(totalPages), totalPages));
    }
    
    container.appendChild(createButton('التالي', currentPage + 1, false, currentPage === totalPages));
  };
  
  renderButtons(paginationButtons);
  renderButtons(paginationButtonsTop);
}

function goToPage(page) {
  if (page < 1 || page > Math.ceil(totalInvoices / itemsPerPage)) return;
  
  currentPage = page;
  
  loadSaved().then(() => {
    const tableWrapper = document.querySelector('.table-wrapper');
    if (tableWrapper) {
      tableWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

(function(){
  if(!filterInvNo) return;
  let t; const DEBOUNCE_MS = 300;
  filterInvNo.addEventListener('input', ()=>{
    clearTimeout(t);
    t = setTimeout(()=>{ 
      currentPage = 1;
      const hasText = String(filterInvNo.value||'').trim().length>0;
      if(hasText){ loadSaved(); }
      else { 
        tbodySaved.innerHTML = `
          <tr><td colspan="7">
            <div class="empty-state">
              <div class="icon">🔍</div>
              <div class="message">ابحث عن الفواتير</div>
              <div class="hint">أدخل تاريخ من وإلى ثم اضغط بحث، أو أدخل رقم الفاتورة للبحث المباشر</div>
            </div>
          </td></tr>
        `; 
      }
    }, DEBOUNCE_MS);
  });
})();

// Prevent auto-load until valid criteria provided
function canSearch(){
  const hasInv = String(filterInvNo?.value||'').trim().length>0;
  const hasDates = Boolean(filterFrom?.value && filterTo?.value);
  return hasInv || hasDates;
}

// Initial: show empty until user searches
(async function initialEmpty(){
  if(!canSearch()){
    tbodySaved.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <div class="icon">📋</div>
          <div class="message">مرحباً بك في إدارة فواتير الشراء</div>
          <div class="hint">أدخل تاريخ من وإلى ثم اضغط بحث، أو أدخل رقم الفاتورة للبحث المباشر</div>
        </div>
      </td></tr>
    `;
  }
})();

btnFilterSearch?.addEventListener('click', ()=>{
  currentPage = 1;
  if(!canSearch()){
    tbodySaved.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <div class="icon">⚠️</div>
          <div class="message" style="color:#dc2626">معايير البحث مطلوبة</div>
          <div class="hint">يجب إدخال تاريخ من وإلى أو رقم فاتورة للبحث</div>
        </div>
      </td></tr>
    `;
    return;
  }
  loadSaved();
});

btnFilterClear?.addEventListener('click', ()=>{
  currentPage = 1;
  filterFrom.value=''; filterTo.value=''; filterSupplier.value=''; filterInvNo.value='';
  tbodySaved.innerHTML = `
    <tr><td colspan="7">
      <div class="empty-state">
        <div class="icon">🔄</div>
        <div class="message">تم مسح معايير البحث</div>
        <div class="hint">أدخل تاريخ من وإلى ثم اضغط بحث، أو أدخل رقم فاتورة للبحث</div>
      </div>
    </td></tr>
  `;
  document.getElementById('invoice-count').textContent = '0 فاتورة';
  const paginationControls = document.getElementById('paginationControls');
  const paginationControlsTop = document.getElementById('paginationControlsTop');
  if (paginationControls) paginationControls.style.display = 'none';
  if (paginationControlsTop) paginationControlsTop.style.display = 'none';
});

btnSearch?.addEventListener('click', ()=>{ 
  currentPage = 1;
  switchTab('saved'); 
  if(canSearch()) loadSaved();
});

const itemsPerPageSelect = document.getElementById('itemsPerPageSelect');
const itemsPerPageSelectTop = document.getElementById('itemsPerPageSelectTop');

const handleItemsPerPageChange = (value) => {
  itemsPerPage = Number(value) || 10;
  currentPage = 1;
  if (itemsPerPageSelect) itemsPerPageSelect.value = String(itemsPerPage);
  if (itemsPerPageSelectTop) itemsPerPageSelectTop.value = String(itemsPerPage);
  if (allInvoices.length > 0) {
    loadSaved();
  }
};

itemsPerPageSelect?.addEventListener('change', (e) => {
  handleItemsPerPageChange(e.target.value);
});

itemsPerPageSelectTop?.addEventListener('change', (e) => {
  handleItemsPerPageChange(e.target.value);
});

(async function init(){
  setNow();
  await loadSuppliers();
  lines = [];
  renderLines();
  computeTotals();
  
  const paginationControls = document.getElementById('paginationControls');
  const paginationControlsTop = document.getElementById('paginationControlsTop');
  if (paginationControls) paginationControls.style.display = 'none';
  if (paginationControlsTop) paginationControlsTop.style.display = 'none';
})();