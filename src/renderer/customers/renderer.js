// Customers screen: add/list/edit/toggle/delete
function translateCustomersUI(isAr){
  const t = isAr ? {
    pageTitle: '👥 إدارة العملاء',
    backBtn: '⬅ العودة',
    searchPlaceholder: '🔍 البحث بالاسم أو رقم الجوال...',
    addBtn: '➕ إضافة عميل',
    refreshBtn: '🔄 تحديث',
    exportBtn: '📊 تصدير Excel',
    addCustomerTitle: '➕ إضافة عميل جديد',
    editCustomerTitle: '✏️ تعديل بيانات العميل',
    customerNameLabel: 'اسم العميل الكامل',
    customerNamePlaceholder: 'أدخل اسم العميل...',
    phoneLabel: 'رقم الجوال',
    phonePlaceholder: 'مثال: 0501234567',
    emailLabel: 'البريد الإلكتروني',
    emailPlaceholder: 'مثال: customer@example.com',
    addressLabel: 'العنوان',
    addressPlaceholder: 'أدخل عنوان العميل...',
    vatNumberLabel: 'الرقم الضريبي (اختياري)',
    vatNumberPlaceholder: 'مثال: 300123456700003',
    crNumberLabel: 'رقم السجل التجاري (اختياري)',
    crNumberPlaceholder: 'مثال: 1010123456',
    nationalAddressLabel: 'العنوان الوطني (اختياري)',
    nationalAddressPlaceholder: 'مثال: 1234-حي-مدينة-رمز بريدي',
    postalCodeLabel: 'الرمز البريدي',
    postalCodePlaceholder: 'مثال: 12345',
    streetNumberLabel: 'رقم المبنى',
    streetNumberPlaceholder: 'مثال: 123',
    subNumberLabel: 'الرقم الفرعي',
    subNumberPlaceholder: 'مثال: 456',
    notesLabel: 'ملاحظات إضافية',
    notesPlaceholder: 'أي ملاحظات خاصة بالعميل...',
    cancelBtn: 'إلغاء',
    saveBtn: '✓ حفظ',
    confirmTitle: 'تأكيد',
    confirmCancelBtn: 'إلغاء',
    confirmOkBtn: 'موافق',
    nameTh: 'الاسم',
    phoneTh: 'الجوال',
    emailTh: 'البريد',
    statusTh: 'الحالة',
    actionsTh: 'إجراءات',
    activeStatus: 'نشط',
    inactiveStatus: 'موقوف'
  } : {
    pageTitle: '👥 Customers Management',
    backBtn: '⬅ Back',
    searchPlaceholder: '🔍 Search by name or phone...',
    addBtn: '➕ Add customer',
    refreshBtn: '🔄 Refresh',
    exportBtn: '📊 Export Excel',
    addCustomerTitle: '➕ Add new customer',
    editCustomerTitle: '✏️ Edit customer',
    customerNameLabel: 'Full customer name',
    customerNamePlaceholder: 'Enter customer name...',
    phoneLabel: 'Phone number',
    phonePlaceholder: 'E.g.: 0501234567',
    emailLabel: 'Email',
    emailPlaceholder: 'E.g.: customer@example.com',
    addressLabel: 'Address',
    addressPlaceholder: 'Enter customer address...',
    vatNumberLabel: 'VAT Number (optional)',
    vatNumberPlaceholder: 'E.g.: 300123456700003',
    crNumberLabel: 'CR Number (optional)',
    crNumberPlaceholder: 'E.g.: 1010123456',
    nationalAddressLabel: 'National Address (optional)',
    nationalAddressPlaceholder: 'E.g.: 1234-District-City-PostalCode',
    postalCodeLabel: 'Postal Code',
    postalCodePlaceholder: 'E.g.: 12345',
    streetNumberLabel: 'Building Number',
    streetNumberPlaceholder: 'E.g.: 123',
    subNumberLabel: 'Sub Number',
    subNumberPlaceholder: 'E.g.: 456',
    notesLabel: 'Additional notes',
    notesPlaceholder: 'Any notes about customer...',
    cancelBtn: 'Cancel',
    saveBtn: '✓ Save',
    confirmTitle: 'Confirm',
    confirmCancelBtn: 'Cancel',
    confirmOkBtn: 'OK',
    nameTh: 'Name',
    phoneTh: 'Phone',
    emailTh: 'Email',
    statusTh: 'Status',
    actionsTh: 'Actions',
    activeStatus: 'Active',
    inactiveStatus: 'Inactive'
  };

  try{
    const pageTitle = document.querySelector('header .text-xl');
    if(pageTitle) pageTitle.textContent = t.pageTitle;
    
    const backBtn = document.querySelector('header button');
    if(backBtn) backBtn.textContent = t.backBtn;
    
    const searchInput = document.getElementById('q');
    if(searchInput) searchInput.placeholder = t.searchPlaceholder;
    
    const addBtnEl = document.getElementById('addBtn');
    if(addBtnEl) addBtnEl.textContent = t.addBtn;
    
    const refreshBtnEl = document.getElementById('refreshBtn');
    if(refreshBtnEl) refreshBtnEl.textContent = t.refreshBtn;
    
    const exportBtnEl = document.getElementById('exportExcelBtn');
    if(exportBtnEl) exportBtnEl.textContent = t.exportBtn;
    
    const labels = document.querySelectorAll('#dlg label');
    labels.forEach(label => {
      const text = label.textContent.trim();
      if(text.includes('اسم العميل') || text.includes('Full customer')) {
        label.textContent = t.customerNameLabel;
      } else if(text.includes('رقم الجوال') || text.includes('Phone')) {
        label.textContent = t.phoneLabel;
      } else if(text.includes('الرمز البريدي') || text.includes('Postal Code')) {
        label.textContent = t.postalCodeLabel;
      } else if(text.includes('البريد الإلكتروني') || text.includes('Email')) {
        label.textContent = t.emailLabel;
      } else if(text.includes('العنوان الوطني') || text.includes('National Address')) {
        label.textContent = t.nationalAddressLabel;
      } else if(text.includes('العنوان') && !text.includes('الوطني') && !text.includes('National')) {
        label.textContent = t.addressLabel;
      } else if(text.includes('الرقم الضريبي') || text.includes('VAT Number')) {
        label.textContent = t.vatNumberLabel;
      } else if(text.includes('السجل التجاري') || text.includes('CR Number')) {
        label.textContent = t.crNumberLabel;
      } else if(text.includes('رقم المبنى') || text.includes('رقم الشارع') || text.includes('Building Number') || text.includes('Street Number')) {
        label.textContent = t.streetNumberLabel;
      } else if(text.includes('الرقم الفرعي') || text.includes('Sub Number')) {
        label.textContent = t.subNumberLabel;
      } else if(text.includes('ملاحظات') || text.includes('notes')) {
        label.textContent = t.notesLabel;
      }
    });
    
    const f_nameEl = document.getElementById('f_name');
    if(f_nameEl) f_nameEl.placeholder = t.customerNamePlaceholder;
    
    const f_phoneEl = document.getElementById('f_phone');
    if(f_phoneEl) f_phoneEl.placeholder = t.phonePlaceholder;
    
    const f_emailEl = document.getElementById('f_email');
    if(f_emailEl) f_emailEl.placeholder = t.emailPlaceholder;
    
    const f_addressEl = document.getElementById('f_address');
    if(f_addressEl) f_addressEl.placeholder = t.addressPlaceholder;
    
    const f_vatEl = document.getElementById('f_vat');
    if(f_vatEl) f_vatEl.placeholder = t.vatNumberPlaceholder;
    
    const f_crEl = document.getElementById('f_cr');
    if(f_crEl) f_crEl.placeholder = t.crNumberPlaceholder;
    
    const f_nataddrEl = document.getElementById('f_nataddr');
    if(f_nataddrEl) f_nataddrEl.placeholder = t.nationalAddressPlaceholder;
    
    const f_postalEl = document.getElementById('f_postal');
    if(f_postalEl) f_postalEl.placeholder = t.postalCodePlaceholder;
    
    const f_streetEl = document.getElementById('f_street');
    if(f_streetEl) f_streetEl.placeholder = t.streetNumberPlaceholder;
    
    const f_subnumberEl = document.getElementById('f_subnumber');
    if(f_subnumberEl) f_subnumberEl.placeholder = t.subNumberPlaceholder;
    
    const f_notesEl = document.getElementById('f_notes');
    if(f_notesEl) f_notesEl.placeholder = t.notesPlaceholder;
    
    const dlgCancelEl = document.getElementById('dlgCancel');
    if(dlgCancelEl) dlgCancelEl.textContent = t.cancelBtn;
    
    const dlgSaveEl = document.getElementById('dlgSave');
    if(dlgSaveEl) dlgSaveEl.textContent = t.saveBtn;
    
    const confirmTitleEl = document.getElementById('confirmTitle');
    if(confirmTitleEl) confirmTitleEl.textContent = t.confirmTitle;
    
    const confirmCancelEl = document.getElementById('confirmCancel');
    if(confirmCancelEl) confirmCancelEl.textContent = t.confirmCancelBtn;
    
    const confirmOkEl = document.getElementById('confirmOk');
    if(confirmOkEl) confirmOkEl.textContent = t.confirmOkBtn;
    
    const ths = document.querySelectorAll('thead th');
    if(ths.length >= 5){
      ths[0].textContent = t.nameTh;
      ths[1].textContent = t.phoneTh;
      ths[2].textContent = t.emailTh;
      ths[3].textContent = t.statusTh;
      ths[4].textContent = t.actionsTh;
    }
    
    window.__customersTranslations = t;
  }catch(_){}
}

(async function initCustomersLocale(){
  try{
    const r = await window.api.app_get_locale();
    const lang = (r && r.lang) || 'ar';
    const isAr = lang === 'ar';
    document.documentElement.lang = isAr ? 'ar' : 'en';
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    translateCustomersUI(isAr);
  }catch(_){
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    translateCustomersUI(true);
  }
  try{
    window.api.app_on_locale_changed((L)=>{
      const isAr = L === 'ar';
      document.documentElement.lang = isAr ? 'ar' : 'en';
      document.documentElement.dir = isAr ? 'rtl' : 'ltr';
      translateCustomersUI(isAr);
    });
  }catch(_){}
})();

const tbody = document.getElementById('tbody');
const errorDiv = document.getElementById('error');
const addBtn = document.getElementById('addBtn');
const refreshBtn = document.getElementById('refreshBtn');
const exportExcelBtn = document.getElementById('exportExcelBtn');

// Permissions from DB per page load
let __perms = new Set();
async function loadPerms(){
  try{
    const u = JSON.parse(localStorage.getItem('pos_user')||'null');
    if(!u || !u.id) return;
    const r = await window.api.perms_get_for_user(u.id);
    if(r && r.ok){ __perms = new Set(r.keys||[]); }
  }catch(_){ __perms = new Set(); }
}
function canCust(k){ return __perms.has('customers') && __perms.has(k); }
function applyTop(){ if(addBtn && !canCust('customers.add')) addBtn.style.display = 'none'; }
async function initCustomersPage(){
  await loadPerms();
  applyTop();
  if (!__custInitUsed) {
    try {
      const d = await __custInitPromise;
      __custInitUsed = true;
      if (d && d.ok && Array.isArray(d.customers)) {
        __allCustomers = d.customers;
        __custTotal = d.total || 0;
        renderRows(__allCustomers);
        renderCustPager();
        return;
      }
    } catch (_) {}
  }
  await loadCustomers();
}

function toCsvValue(v){ return '"'+String(v??'').replace(/"/g,'""')+'"'; }
function buildCsvFromCustomers(list){
  const t = window.__customersTranslations || {
    activeStatus: 'نشط',
    inactiveStatus: 'موقوف'
  };
  const toAsciiDigits = (s)=> String(s||'').replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06F0));
  const fmtDateTime = (v)=>{
    if(!v) return '';
    try{
      // Try to parse; support "YYYY-MM-DD HH:MM:SS" or ISO
      let d = (v instanceof Date) ? v : new Date(String(v).replace(' ', 'T'));
      if(isNaN(d.getTime())) d = new Date(v);
      if(isNaN(d.getTime())) return toAsciiDigits(String(v));
      const pad2 = (n)=> String(n).padStart(2,'0');
      const out = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
      return toAsciiDigits(out);
    }catch(_){ return toAsciiDigits(String(v)); }
  };
  const headers = ['#','الاسم','الجوال','البريد','العنوان','الحالة','الرقم الضريبي','ملاحظات','تاريخ الإضافة'];
  const lines = [ headers.map(toCsvValue).join(',') ];
  list.forEach((c, idx)=>{
    lines.push([
      idx+1,
      c.name||'',
      c.phone||'',
      c.email||'',
      c.address||'',
      (c.is_active? t.activeStatus : t.inactiveStatus),
      c.vat_number||'',
      c.notes||'',
      fmtDateTime(c.created_at||'')
    ].map(toCsvValue).join(','));
  });
  return lines.join('\n');
}

let __custSettings = { require_phone_min_10: false };

const dlg = document.getElementById('dlg');
const dlgTitle = document.getElementById('dlgTitle');
const f_name = document.getElementById('f_name');
const f_phone = document.getElementById('f_phone');
const f_email = document.getElementById('f_email');
const f_address = document.getElementById('f_address');
const f_vat = document.getElementById('f_vat');
const f_cr = document.getElementById('f_cr');
const f_nataddr = document.getElementById('f_nataddr');
const f_postal = document.getElementById('f_postal');
const f_street = document.getElementById('f_street');
const f_subnumber = document.getElementById('f_subnumber');
const f_notes = document.getElementById('f_notes');
const dlgSave = document.getElementById('dlgSave');
const dlgCancel = document.getElementById('dlgCancel');

// Custom confirm dialog elements (avoid native confirm focus bug)
const confirmDlg = document.getElementById('confirmDlg');
const confirmTitle = document.getElementById('confirmTitle');
const confirmText = document.getElementById('confirmText');
const confirmOk = document.getElementById('confirmOk');
const confirmCancel = document.getElementById('confirmCancel');

let editId = null;

function setError(msg){ errorDiv.textContent = msg || ''; }
function clearDialog(){ f_name.value=''; f_phone.value=''; f_email.value=''; f_address.value=''; f_vat.value=''; f_cr.value=''; f_nataddr.value=''; f_postal.value=''; f_street.value=''; f_subnumber.value=''; f_notes.value=''; }

// Toast notification at top of screen
let toastTimer = null;
function showToast(message, bgColor = '#16a34a', duration = 3000){
  const toast = document.getElementById('toast');
  if(!toast) return;
  toast.style.background = bgColor;
  toast.textContent = message;
  toast.classList.add('show');
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove('show'); }, duration);
}

// Robustly open dialog and ensure keyboard focus (Electron fix after native dialogs like confirm)
function safeShowModal(d){
  try { d.showModal(); }
  catch(_){
    try { d.close(); d.showModal(); } catch(__){}
  }
}
function focusFirstField(){
  try{
    // Ensure window regains focus and then focus the first input
    window.focus();
    setTimeout(()=>{ if(f_name){ f_name.focus(); f_name.select(); } else if(dlg && dlg.focus){ dlg.focus(); } }, 0);
  }catch(_){ }
}
function openAddDialog(){
  editId=null; 
  const t = window.__customersTranslations || {addCustomerTitle: '➕ إضافة عميل جديد'};
  dlgTitle.textContent=t.addCustomerTitle; 
  clearDialog(); 
  safeShowModal(dlg);
  focusFirstField();
}
function openEditDialog(item){
  editId=item.id;
  const t = window.__customersTranslations || {editCustomerTitle: '✏️ تعديل بيانات العميل'};
  dlgTitle.textContent=t.editCustomerTitle;
  f_name.value=item.name||''; f_phone.value=item.phone||''; f_email.value=item.email||'';
  f_address.value=item.address||''; f_vat.value=item.vat_number||''; f_cr.value=item.cr_number||''; f_nataddr.value=item.national_address||''; f_postal.value=item.postal_code||''; f_street.value=item.street_number||''; f_subnumber.value=item.sub_number||''; f_notes.value=item.notes||'';
  safeShowModal(dlg);
  focusFirstField();
}
function closeDialog(){ dlg.close(); }

// Lightweight custom confirm using <dialog> to avoid native confirm focus issues in Electron
function customConfirm(title, text, options={}){
  return new Promise((resolve)=>{
    if(!confirmDlg){
      // Fallback to native confirm if custom dialog not found
      resolve(window.confirm(text));
      return;
    }
    
    // تحديد النوع (delete, warning, info)
    const type = options.type || 'info';
    const isDanger = type === 'delete';
    const isWarning = type === 'warning';
    
    // تحديث العنوان والأيقونات
    confirmTitle.textContent = String(title||'تأكيد');
    confirmText.textContent = String(text||'');
    
    // إضافة أيقونة حسب نوع الرسالة
    const confirmIcon = document.getElementById('confirmIcon');
    const confirmHeaderIcon = document.getElementById('confirmHeaderIcon');
    const confirmHeader = document.getElementById('confirmHeader');
    
    // تحديث لون الـ header حسب النوع
    if(confirmHeader){
      if(isDanger){
        confirmHeader.className = 'px-5 py-4 bg-red-600 text-white text-lg font-bold rounded-t-lg flex items-center gap-2';
      } else if(isWarning){
        confirmHeader.className = 'px-5 py-4 bg-orange-600 text-white text-lg font-bold rounded-t-lg flex items-center gap-2';
      } else {
        confirmHeader.className = 'px-5 py-4 bg-blue-600 text-white text-lg font-bold rounded-t-lg flex items-center gap-2';
      }
    }
    
    if(confirmIcon){
      if(isDanger) confirmIcon.textContent = '🗑️';
      else if(isWarning) confirmIcon.textContent = '⚠️';
      else if(type === 'success') confirmIcon.textContent = '✓';
      else confirmIcon.textContent = '❓';
    }
    
    if(confirmHeaderIcon){
      if(isDanger) confirmHeaderIcon.textContent = '🗑️';
      else if(isWarning) confirmHeaderIcon.textContent = '⚠️';
      else confirmHeaderIcon.textContent = '⚠️';
    }
    
    // تحديث لون الزر OK حسب النوع
    if(isDanger){
      confirmOk.className = 'px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium';
      confirmOk.textContent = '🗑️ حذف نهائياً';
    } else {
      confirmOk.className = 'px-5 py-2.5 bg-slate-600 text-white rounded-lg font-medium';
      confirmOk.textContent = '✓ موافق';
    }
    
    // إخفاء زر الإلغاء في حالة التحذير (فقط زر موافق)
    if(confirmCancel){
      if(isWarning){
        confirmCancel.style.display = 'none';
      } else {
        confirmCancel.style.display = '';
      }
    }
    
    try{ confirmDlg.showModal(); }
    catch(_){ try{ confirmDlg.close(); confirmDlg.showModal(); }catch(__){} }
    const onOk = ()=>{ cleanup(); resolve(true); };
    const onCancel = ()=>{ cleanup(); resolve(false); };
    function cleanup(){
      confirmOk.removeEventListener('click', onOk);
      confirmCancel.removeEventListener('click', onCancel);
      confirmDlg.close();
      // Return focus to main window to keep inputs working
      try{ window.focus(); }catch(_){ }
    }
    confirmOk.addEventListener('click', onOk);
    confirmCancel.addEventListener('click', onCancel);
    // Keyboard support
    confirmDlg.addEventListener('cancel', onCancel, { once:true });
    // Focus default button
    setTimeout(()=>{ try{ confirmOk.focus(); }catch(_){ } }, 0);
  });
}

// pagination state
let __allCustomers = [];
let __custPage = 1;
let __custPageSize = 20;
let __custTotal = 0;
const __custInitPromise = window.api && window.api.screen_init_customers ? window.api.screen_init_customers() : Promise.resolve(null);
let __custInitUsed = false;

function getPageBtnTitle(action) {
  switch(action) {
    case 'first': return 'الانتقال إلى الصفحة الأولى';
    case 'prev': return 'الانتقال إلى الصفحة السابقة';
    case 'next': return 'الانتقال إلى الصفحة التالية';
    case 'last': return 'الانتقال إلى الصفحة الأخيرة';
    default: return '';
  }
}

function renderCustPager(){
  const top = document.getElementById('pagerTop');
  const bottom = document.getElementById('pagerBottom');
  const pages = (__custPageSize && __custPageSize>0) ? Math.max(1, Math.ceil(__custTotal / __custPageSize)) : 1;
  const btn = (label, disabled, go)=>`<button class="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium" ${disabled?'disabled':''} data-go="${go}" title="${getPageBtnTitle(go)}">${label}</button>`;
  const html = [
    btn('⏮️', __custPage<=1, 'first'),
    btn('◀️', __custPage<=1, 'prev'),
    `<span class="text-gray-600 font-medium px-2">صفحة ${__custPage} من ${pages} (إجمالي: ${__custTotal})</span>`,
    btn('▶️', __custPage>=pages, 'next'),
    btn('⏭️', __custPage>=pages, 'last')
  ].join(' ');
  if(top) top.innerHTML = html; if(bottom) bottom.innerHTML = html;
  const onClick = (e)=>{
    const b = e.target.closest('button'); if(!b) return;
    const act = b.getAttribute('data-go');
    const pages = (__custPageSize && __custPageSize>0) ? Math.max(1, Math.ceil(__custTotal / __custPageSize)) : 1;
    if(act==='first') __custPage=1;
    if(act==='prev') __custPage=Math.max(1,__custPage-1);
    if(act==='next') __custPage=Math.min(pages,__custPage+1);
    if(act==='last') __custPage=pages;
    loadCustomers();
  };
  if(top) top.onclick = onClick;
  if(bottom) bottom.onclick = onClick;
}

function renderRows(list){
  const t = window.__customersTranslations || {
    activeStatus: 'نشط',
    inactiveStatus: 'موقوف'
  };
  tbody.innerHTML='';
  list.forEach((c, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-100 last:border-b-0';
    const actions = [
      canCust('customers.edit') ? `<button class="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-medium" data-act="edit" data-id="${c.id}" title="تعديل بيانات العميل">✏️ تعديل</button>` : '',
      canCust('customers.toggle') ? `<button class="px-3 py-1.5 ${c.is_active?'bg-red-600':'bg-green-600'} text-white rounded-lg text-sm font-medium" data-act="toggle" data-id="${c.id}" title="${c.is_active? 'إيقاف العميل':'تفعيل العميل'}">${c.is_active? '❌ إيقاف':'✅ تفعيل'}</button>` : '',
      canCust('customers.delete') ? `<button class="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm font-medium" data-act="delete" data-id="${c.id}" title="حذف العميل نهائياً">🗑️ حذف</button>` : ''
    ].join(' ');
    tr.innerHTML = `
      <td class="px-4 py-3 text-gray-700 font-medium">${((__custPage-1)*__custPageSize)+idx+1}</td>
      <td class="px-4 py-3 text-gray-900 font-semibold">${c.name}</td>
      <td class="px-4 py-3 text-gray-700">${c.phone||''}</td>
      <td class="px-4 py-3 text-gray-700">${c.email||''}</td>
      <td class="px-4 py-3 text-gray-700">${c.address||''}</td>
      <td class="px-4 py-3">${c.is_active ? `<span class="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">${t.activeStatus}</span>` : `<span class="inline-block px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">${t.inactiveStatus}</span>`}</td>
      <td class="px-4 py-3"><div class="flex flex-wrap gap-2">${actions}</div></td>`;
    tbody.appendChild(tr);
  })
  renderCustPager();
}

async function loadCustomers(){
  setError('');
  const query = {
    q: (document.getElementById('q')?.value || '').trim(),
    page: __custPage,
    pageSize: __custPageSize
  };
  const res = await window.api.customers_list(query);
  if(!res.ok){ setError('❌ ' + (res.error || 'تعذر تحميل قائمة العملاء. يرجى المحاولة مرة أخرى.')); return; }
  __allCustomers = res.items || [];
  __custTotal = res.total || 0;
  renderRows(__allCustomers);
}

// init page size control
const pageSizeSel = document.getElementById('pageSize');
if(pageSizeSel){
  pageSizeSel.addEventListener('change', ()=>{
    const v = Number(pageSizeSel.value||20);
    __custPageSize = v;
    __custPage = 1;
    loadCustomers();
  });
}

if(addBtn) addBtn.addEventListener('click', () => { if(!canCust('customers.add')) return; openAddDialog(); });
refreshBtn.addEventListener('click', loadCustomers);

if(exportExcelBtn){
  exportExcelBtn.addEventListener('click', async ()=>{
    try{
      exportExcelBtn.disabled = true;
      // Fetch all customers for export (no pagination)
      const query = {
        q: (document.getElementById('q')?.value || '').trim(),
        pageSize: 0 // 0 means get all
      };
      const res = await window.api.customers_list(query);
      if(!res.ok){ 
        setError('❌ تعذر جلب بيانات العملاء للتصدير'); 
        return; 
      }
      const allCustomers = res.items || [];
      const csv = buildCsvFromCustomers(allCustomers);
      const now = new Date();
      const pad2 = (v)=> String(v).padStart(2,'0');
      const stamp = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())}_${pad2(now.getHours())}-${pad2(now.getMinutes())}`;
      const filename = `customers_${stamp}.csv`;
      await window.api.csv_export(csv, { saveMode: 'auto', filename });
    }catch(e){ console.error(e); setError('❌ تعذر إنشاء ملف Excel. يرجى المحاولة مرة أخرى.'); }
    finally{ exportExcelBtn.disabled = false; }
  });
}

document.getElementById('q').addEventListener('input', () => { 
  __custPage = 1; // Reset to first page when searching
  loadCustomers(); 
});

// منع إدخال الأحرف في حقول الأرقام فقط
function allowOnlyNumbers(inputElement) {
  inputElement.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^\d]/g, '');
  });
  inputElement.addEventListener('keypress', (e) => {
    if (!/^\d$/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Tab') {
      e.preventDefault();
    }
  });
  inputElement.addEventListener('paste', (e) => {
    e.preventDefault();
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    const numbersOnly = pastedText.replace(/[^\d]/g, '');
    document.execCommand('insertText', false, numbersOnly);
  });
}

// تطبيق التحقق على الحقول الرقمية
if(f_phone) allowOnlyNumbers(f_phone);
if(f_vat) allowOnlyNumbers(f_vat);
if(f_cr) allowOnlyNumbers(f_cr);

dlgCancel.addEventListener('click', closeDialog);

dlgSave.addEventListener('click', async () => {
  setError('');
  const payload = {
    name: f_name.value.trim(),
    phone: f_phone.value.trim() || null,
    email: f_email.value.trim() || null,
    address: f_address.value.trim() || null,
    vat_number: f_vat.value.trim() || null,
    cr_number: f_cr.value.trim() || null,
    national_address: f_nataddr.value.trim() || null,
    postal_code: f_postal.value.trim() || null,
    street_number: f_street.value.trim() || null,
    sub_number: f_subnumber.value.trim() || null,
    notes: f_notes.value.trim() || null,
  };
  if(payload.phone && !/^\d+$/.test(payload.phone)){ showToast('❌ رقم الجوال يجب أن يحتوي على أرقام فقط', '#dc2626', 4000); return; }
  if(payload.phone && __custSettings.require_phone_min_10 && payload.phone.length < 10){ showToast('❌ رقم الجوال يجب أن يكون 10 أرقام على الأقل', '#dc2626', 4000); return; }
  if(payload.vat_number && !/^\d{15}$/.test(payload.vat_number)){ showToast('❌ الرقم الضريبي يجب أن يكون 15 رقماً بالضبط', '#dc2626', 4000); return; }
  if(payload.cr_number && !/^\d+$/.test(payload.cr_number)){ showToast('❌ رقم السجل التجاري يجب أن يحتوي على أرقام فقط', '#dc2626', 4000); return; }
  if(!payload.name){ showToast('❌ يرجى إدخال اسم العميل - هذا الحقل مطلوب', '#dc2626', 4000); return; }
  let res;
  if(editId){ res = await window.api.customers_update(editId, payload); }
  else { res = await window.api.customers_add(payload); }
  if(!res.ok){ showToast('❌ ' + (res.error || 'فشل في حفظ بيانات العميل. يرجى المحاولة مرة أخرى.'), '#dc2626', 4000); return; }
  showToast('✓ تم حفظ بيانات العميل بنجاح', '#16a34a', 3000);
  closeDialog();
  await loadCustomers();
});

tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if(!btn) return;
  const id = Number(btn.dataset.id);
  const act = btn.dataset.act;
  setError('');

  if(act==='edit'){
    if(!canCust('customers.edit')) return;
    const res = await window.api.customers_get(id);
    if(!res.ok){ setError('❌ ' + (res.error || 'تعذر جلب بيانات العميل. يرجى المحاولة مرة أخرى.')); return; }
    openEditDialog(res.item);
  }
  if(act==='toggle'){
    if(!canCust('customers.toggle')) return;
    const res = await window.api.customers_toggle(id);
    if(!res.ok){ setError('❌ ' + (res.error || 'فشل في تحديث حالة العميل. يرجى المحاولة مرة أخرى.')); return; }
    showToast('✓ تم تحديث حالة العميل بنجاح', '#10b981', 2000);
    await loadCustomers();
  }
  if(act==='delete'){
    if(!canCust('customers.delete')) return;
    const ok = await customConfirm('حذف العميل','هل أنت متأكد من حذف هذا العميل نهائياً؟\nلا يمكن التراجع عن هذا الإجراء.', { type: 'delete' });
    if(!ok) return;
    const res = await window.api.customers_delete(id);
    if(!res.ok){ 
      if(res.hasInvoices){
        showToast('⚠️ لا يمكن حذف العميل لأنه مرتبط بفواتير سابقة. يمكنك إيقاف العميل بدلاً من حذفه.', '#d97706', 5000);
      } else {
        setError('❌ ' + (res.error || 'فشل في حذف العميل. يرجى المحاولة مرة أخرى.'));
      }
      return; 
    }
    showToast('✓ تم حذف العميل بنجاح', '#16a34a', 3000);
    await loadCustomers();
  }
});

(async function loadCustomerSettings(){
  try{
    const r = await __custInitPromise;
    const s = r && r.ok ? (r.settings || r.item || {}) : {};
    __custSettings.require_phone_min_10 = !!s.require_phone_min_10;
  }catch(_){}
})();

initCustomersPage();