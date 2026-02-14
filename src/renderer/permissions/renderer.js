// Renderer for permissions management
let __currentLang = 'ar';

const userSelect = document.getElementById('userSelect');
const permsGrid = document.getElementById('permsGrid');
const statusEl = document.getElementById('status');
const selectAllBtn = document.getElementById('selectAllBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const saveBtn = document.getElementById('saveBtn');
const backBtn = document.getElementById('backBtn');
const permsWrap = document.getElementById('permsWrap');
if(permsWrap){ permsWrap.style.display = 'none'; }

let allPerms = [];
let currentUserId = null;
let usersMap = new Map();
let currentUserRole = null;

function getNameMap(isAr){
  return isAr ? {
    // الجذور (مطابقة لعناوين بطاقات الشاشة الرئيسية)
    users:'المستخدمون',
    permissions:'الصلاحيات',
    customers:'العملاء',
    sales:'فاتورة جديدة',
    invoices:'الفواتير',
    credit_notes:'الفواتير الدائنة',
    payments:'دفع الفاتورة',
    products:'المنتجات',
    types:'الأنواع الرئيسية',
    settings:'الإعدادات',
    operations:'العمليات',
    purchases:'المصروفات',
    inventory:'إدارة المخزون',
    customer_pricing:'تخصيص أسعار',
    offers:'العروض والكوبونات',
    drivers:'السائقون',
    reports:'التقارير',
    shifts:'الشفتات',
    zatca:'الربط - المرحلة الثانية',
    
    // عناصر فرعية
    'sales.print':'طباعة الفاتورة',
    'sales.clear':'تفريغ',
    'sales.process_invoice':'معالجة الفاتورة',
    'sales.discount':'الخصم',
    'sales.extra':'الإضافى',
    'sales.coupon':'الكوبون',
    'sales.select_customer':'اختيار العميل',
    'sales.select_driver':'اختيار السائق',
    'sales.remove_item':'حذف',
    'sales.edit_qty':'تعديل الكمية',
    'customers.add':'➕ إضافة عميل',
    'customers.edit':'تعديل',
    'customers.toggle':'تفعيل/إيقاف',
    'customers.delete':'حذف',
    'invoices.view':'عرض الفاتورة',
    'users.add':'إضافة مستخدم',
    'users.edit':'تعديل',
    'users.toggle':'تفعيل/إيقاف',
    'users.delete':'حذف',
    'products.add':'➕ إضافة منتج',
    'products.edit':'تعديل',
    'products.toggle':'تفعيل/إيقاف',
    'products.delete':'حذف',
    'products.export_pdf':'🧾 تصدير PDF',
    'products.export_csv':'📄 تصدير CSV',
    'products.reorder':'💾 حفظ ترتيب السطور',
    'types.add':'إضافة نوع رئيسي',
    'types.edit':'✏️ تعديل',
    'types.toggle':'⏸️ إيقاف/▶️ تفعيل',
    'types.delete':'🗑️ حذف',
    'settings.update':'حفظ الإعدادات',
    'settings.reload':'إعادة تحميل',
    'settings.reset_sales':'حذف كل الفواتير',
    'settings.reset_products':'حذف كل المنتجات',
    'settings.reset_customers':'حذف كل العملاء',
    'operations.add':'إضافة عملية',
    'operations.edit':'تعديل',
    'operations.toggle':'تفعيل/إيقاف',
    'operations.delete':'حذف',
    'operations.reorder':'تغيير الترتيب',
    purchase_invoices:'فواتير الشراء',
    'purchase_invoices.add':'إضافة فاتورة شراء',
    'purchase_invoices.edit':'تعديل فاتورة شراء',
    'purchase_invoices.delete':'حذف فاتورة شراء',
    'purchase_invoices.print':'طباعة فاتورة شراء',
    'purchases.add':'إضافة',
    'purchases.edit':'تعديل',
    'purchases.delete':'حذف',
    'purchases.export_csv':'تصدير CSV',
    'purchases.export_pdf':'تصدير PDF',
    suppliers:'الموردون',
    'suppliers.add':'➕ إضافة مورد',
    'suppliers.edit':'تعديل',
    'suppliers.toggle':'تفعيل/إيقاف',
    'suppliers.delete':'حذف',
    appointments:'المواعيد',
    'appointments.add':'حجز موعد',
    'appointments.edit':'تعديل موعد',
    'appointments.delete':'حذف موعد',
    'customer_pricing.add':'إضافة',
    'customer_pricing.edit':'تعديل',
    'customer_pricing.delete':'حذف',
    'offers.add_offer':'إضافة عرض',
    'offers.add_global_offer':'إضافة عرض عام',
    'offers.edit_offer':'تعديل عرض',
    'offers.toggle_offer':'تفعيل/إيقاف عرض',
    'offers.delete_offer':'حذف عرض',
    'offers.add_coupon':'إضافة كوبون',
    'offers.edit_coupon':'تعديل كوبون',
    'offers.toggle_coupon':'تفعيل/إيقاف كوبون',
    'offers.delete_coupon':'حذف كوبون',
    'drivers.add':'إضافة',
    'drivers.edit':'حفظ',
    'drivers.toggle':'تنشيط/إيقاف',
    'drivers.delete':'حذف',
    'reports.view_daily':'تقرير يومي',
    'reports.view_period':'تقرير فترة',
    'reports.view_all_invoices':'كل الفواتير',
    'reports.view_purchases':'تقرير المصروفات',
    'reports.view_customer_invoices':'فواتير عميل',
    'reports.view_credit_invoices':'الفواتير الدائنة',
    'reports.view_unpaid_invoices':'فواتير غير مدفوعة',
    'reports.view_types':'تقرير الأنواع',
    'reports.view_purchase_invoices':'تقرير فواتير الشراء',
    'reports.view_expiry':'تقرير المنتجات المنتهية الصلاحية',
    'shifts.view':'عرض الشفتات',
    'shifts.open':'فتح شفت',
    'shifts.close':'إغلاق شفت',
    'shifts.print':'طباعة تفاصيل الشفت',
    'payments.settle_full':'سداد كامل',
    'payments.view_invoice':'عرض الفاتورة',
    'credit_notes.view':'عرض الإشعار',
    'credit_notes.view_base':'عرض الفاتورة',
    vouchers:'السندات',
    'vouchers.add':'إضافة سند',
    'vouchers.edit':'تعديل سند',
    'vouchers.delete':'حذف سند',
    'vouchers.print':'طباعة سند',
    quotations:'عروض الأسعار',
    'quotations.add':'إضافة عرض سعر',
    'quotations.edit':'تعديل عرض سعر',
    'quotations.delete':'حذف عرض سعر',
    'quotations.print':'طباعة عرض سعر',
    'quotations.convert':'تحويل لفاتورة',
    whatsapp:'إدارة واتساب',
    'whatsapp.send':'إرسال رسائل',
    'whatsapp.view':'عرض الرسائل',
    'permissions.manage':'إدارة الصلاحيات'
  } : {
    // English translations
    users:'Users',
    permissions:'Permissions',
    customers:'Customers',
    sales:'New invoice',
    invoices:'Invoices',
    credit_notes:'Credit notes',
    payments:'Pay invoice',
    products:'Products',
    types:'Main types',
    settings:'Settings',
    operations:'Operations',
    purchases:'Purchases',
    inventory:'Inventory management',
    customer_pricing:'Custom pricing',
    offers:'Offers & coupons',
    drivers:'Drivers',
    reports:'Reports',
    shifts:'Shifts',
    zatca:'ZATCA - Phase 2',
    
    'sales.print':'Print invoice',
    'sales.clear':'Clear',
    'sales.process_invoice':'Process invoice',
    'sales.discount':'Discount',
    'sales.extra':'Extra',
    'sales.coupon':'Coupon',
    'sales.select_customer':'Select customer',
    'sales.select_driver':'Select driver',
    'sales.remove_item':'Remove',
    'sales.edit_qty':'Edit quantity',
    'customers.add':'➕ Add customer',
    'customers.edit':'Edit',
    'customers.toggle':'Enable/disable',
    'customers.delete':'Delete',
    'invoices.view':'View invoice',
    'users.add':'Add user',
    'users.edit':'Edit',
    'users.toggle':'Enable/disable',
    'users.delete':'Delete',
    'products.add':'➕ Add product',
    'products.edit':'Edit',
    'products.toggle':'Enable/disable',
    'products.delete':'Delete',
    'products.export_pdf':'🧾 Export PDF',
    'products.export_csv':'📄 Export CSV',
    'products.reorder':'💾 Save row order',
    'types.add':'Add main type',
    'types.edit':'✏️ Edit',
    'types.toggle':'⏸️ Disable/▶️ Enable',
    'types.delete':'🗑️ Delete',
    'settings.update':'Save settings',
    'settings.reload':'Reload',
    'settings.reset_sales':'Delete all invoices',
    'settings.reset_products':'Delete all products',
    'settings.reset_customers':'Delete all customers',
    'operations.add':'Add operation',
    'operations.edit':'Edit',
    'operations.toggle':'Enable/disable',
    'operations.delete':'Delete',
    'operations.reorder':'Reorder',
    purchase_invoices:'Purchase invoices',
    'purchase_invoices.add':'Add purchase invoice',
    'purchase_invoices.edit':'Edit purchase invoice',
    'purchase_invoices.delete':'Delete purchase invoice',
    'purchase_invoices.print':'Print purchase invoice',
    'purchases.add':'Add',
    'purchases.edit':'Edit',
    'purchases.delete':'Delete',
    'purchases.export_csv':'Export CSV',
    'purchases.export_pdf':'Export PDF',
    suppliers:'Suppliers',
    'suppliers.add':'➕ Add supplier',
    'suppliers.edit':'Edit',
    'suppliers.toggle':'Enable/disable',
    'suppliers.delete':'Delete',
    appointments:'Appointments',
    'appointments.add':'Add appointment',
    'appointments.edit':'Edit appointment',
    'appointments.delete':'Delete appointment',
    'customer_pricing.add':'Add',
    'customer_pricing.edit':'Edit',
    'customer_pricing.delete':'Delete',
    'offers.add_offer':'Add offer',
    'offers.add_global_offer':'Add global offer',
    'offers.edit_offer':'Edit offer',
    'offers.toggle_offer':'Enable/disable offer',
    'offers.delete_offer':'Delete offer',
    'offers.add_coupon':'Add coupon',
    'offers.edit_coupon':'Edit coupon',
    'offers.toggle_coupon':'Enable/disable coupon',
    'offers.delete_coupon':'Delete coupon',
    'drivers.add':'Add',
    'drivers.edit':'Save',
    'drivers.toggle':'Enable/disable',
    'drivers.delete':'Delete',
    'reports.view_daily':'Daily report',
    'reports.view_period':'Period report',
    'reports.view_all_invoices':'All invoices',
    'reports.view_purchases':'Purchases report',
    'reports.view_customer_invoices':'Customer invoices',
    'reports.view_credit_invoices':'Credit invoices',
    'reports.view_unpaid_invoices':'Unpaid invoices',
    'reports.view_types':'Types report',
    'reports.view_purchase_invoices':'Purchase invoices report',
    'reports.view_expiry':'Expired products report',
    'shifts.view':'View shifts',
    'shifts.open':'Open shift',
    'shifts.close':'Close shift',
    'shifts.print':'Print shift details',
    'payments.settle_full':'Full payment',
    'payments.view_invoice':'View invoice',
    'credit_notes.view':'View note',
    'credit_notes.view_base':'View invoice',
    vouchers:'Vouchers',
    'vouchers.add':'Add voucher',
    'vouchers.edit':'Edit voucher',
    'vouchers.delete':'Delete voucher',
    'vouchers.print':'Print voucher',
    quotations:'Quotations',
    'quotations.add':'Add quotation',
    'quotations.edit':'Edit quotation',
    'quotations.delete':'Delete quotation',
    'quotations.print':'Print quotation',
    'quotations.convert':'Convert to invoice',
    whatsapp:'WhatsApp management',
    'whatsapp.send':'Send messages',
    'whatsapp.view':'View messages',
    'permissions.manage':'Manage permissions'
  };
}

let nameMap = getNameMap(true);

function translatePermissionsUI(isAr){
  __currentLang = isAr ? 'ar' : 'en';
  nameMap = getNameMap(isAr);
  
  const t = isAr ? {
    pageTitle: '🔐 إدارة الصلاحيات',
    backBtn: '⬅ الرئيسية',
    userLabel: 'المستخدم:',
    selectUser: 'اختر مستخدمًا',
    selectAllBtn: '✓ تحديد الكل',
    clearAllBtn: '✕ إلغاء الكل',
    saveBtn: '💾 حفظ الصلاحيات',
    detailsBtn: '▼ التفاصيل',
    hideBtn: '▲ إخفاء',
    noChildren: 'لا توجد عناصر فرعية',
    loadingUsers: 'فشل تحميل المستخدمين',
    loadingPerms: 'فشل تحميل الصلاحيات',
    loadingUserPerms: '...تحميل صلاحيات المستخدم',
    loadingUserPermsFail: 'فشل تحميل صلاحيات المستخدم',
    loading: '...تحميل',
    error: 'حدث خطأ',
    selectUserFirst: 'اختر مستخدمًا أولاً',
    cannotEditAdmin: 'لا يمكن تعديل صلاحيات المدير من الواجهة',
    saving: '⏳ جاري الحفظ...',
    saveFailed: 'فشل الحفظ',
    saveSuccess: '✓ تم الحفظ بنجاح',
    adminTitle: 'لا يمكن تعديل صلاحيات المدير من الواجهة',
    cashierCanEdit: 'يمكنك تعديل صلاحيات المستخدم الكاشير من القائمة أدناه.',
    cashierOnly: 'تظهر الصلاحيات فقط لمستخدمي دور الكاشير.',
    adminStatusMsg: 'لا يمكن عرض أو تعديل صلاحيات المدير من الواجهة. الرجاء اختيار مستخدم كاشير لتعديل صلاحياته.',
    adminRole: ' (مدير)'
  } : {
    pageTitle: '🔐 Manage Permissions',
    backBtn: '⬅ Home',
    userLabel: 'User:',
    selectUser: 'Select user',
    selectAllBtn: '✓ Select all',
    clearAllBtn: '✕ Clear all',
    saveBtn: '💾 Save permissions',
    detailsBtn: '▼ Details',
    hideBtn: '▲ Hide',
    noChildren: 'No child elements',
    loadingUsers: 'Failed to load users',
    loadingPerms: 'Failed to load permissions',
    loadingUserPerms: '...Loading user permissions',
    loadingUserPermsFail: 'Failed to load user permissions',
    loading: '...Loading',
    error: 'An error occurred',
    selectUserFirst: 'Select user first',
    cannotEditAdmin: 'Cannot edit admin permissions from interface',
    saving: '⏳ Saving...',
    saveFailed: 'Save failed',
    saveSuccess: '✓ Saved successfully',
    adminTitle: 'Cannot edit admin permissions from interface',
    cashierCanEdit: 'You can edit cashier user permissions from the list below.',
    cashierOnly: 'Permissions are shown only for cashier role users.',
    adminStatusMsg: 'Cannot view or edit admin permissions from interface. Please select a cashier user to edit their permissions.',
    adminRole: ' (Admin)'
  };
  
  try{
    const titleEl = document.querySelector('header .text-xl');
    if(titleEl) titleEl.textContent = t.pageTitle;
    
    const backBtnEl = document.getElementById('backBtn');
    if(backBtnEl) backBtnEl.textContent = t.backBtn;
    
    const userLabelEl = document.querySelector('label[class*="text-sm"]');
    if(userLabelEl) userLabelEl.textContent = t.userLabel;
    
    if(selectAllBtn) selectAllBtn.textContent = t.selectAllBtn;
    if(clearAllBtn) clearAllBtn.textContent = t.clearAllBtn;
    if(saveBtn) saveBtn.textContent = t.saveBtn;
    
    window.__permissionsTranslations = t;
    
    if(currentUserId && usersMap.size > 0){
      const selectedUserId = currentUserId;
      renderPerms(Array.from(document.querySelectorAll('#permsGrid input[type="checkbox"]:checked')).map(ch => ch.dataset.key));
      updateUserSelectText(isAr);
      if(selectedUserId) userSelect.value = String(selectedUserId);
    }
  }catch(_){}
}

function updateUserSelectText(isAr){
  const t = window.__permissionsTranslations || {};
  const adminRole = t.adminRole || ' (مدير)';
  const selectUserText = t.selectUser || 'اختر مستخدمًا';
  
  try{
    userSelect.innerHTML = `<option value="">${selectUserText}</option>` + 
      Array.from(usersMap.values()).map(u => 
        `<option value="${u.id}">${u.full_name||u.username}${u.role==='admin'?adminRole:''}</option>`
      ).join('');
  }catch(_){}
}

(async function initPermissionsLocale(){
  try{
    const r = await window.api.app_get_locale();
    const lang = (r && r.lang) || 'ar';
    const isAr = lang === 'ar';
    __currentLang = isAr ? 'ar' : 'en';
    document.documentElement.lang = isAr ? 'ar' : 'en';
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    translatePermissionsUI(isAr);
  }catch(_){
    __currentLang = 'ar';
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    translatePermissionsUI(true);
  }
  try{
    window.api.app_on_locale_changed((L)=>{
      const isAr = L === 'ar';
      __currentLang = isAr ? 'ar' : 'en';
      document.documentElement.lang = isAr ? 'ar' : 'en';
      document.documentElement.dir = isAr ? 'rtl' : 'ltr';
      translatePermissionsUI(isAr);
    });
  }catch(_){}
})();

const sessionUser = (()=>{ try{ return JSON.parse(localStorage.getItem('pos_user')||'null'); }catch(_){ return null; }})();

function setStatus(msg){ statusEl.textContent = msg || ''; }

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

async function loadUsers(){
  const t = window.__permissionsTranslations || {};
  const r = await window.api.users_list();
  if(!r.ok){ setStatus(r.error||(t.loadingUsers || 'فشل تحميل المستخدمين')); return; }
  // keep a map for quick role lookup
  usersMap = new Map((r.items||[]).map(u => [String(u.id), u]));
  updateUserSelectText(__currentLang === 'ar');
}

async function loadAllPerms(){
  const t = window.__permissionsTranslations || {};
  const r = await window.api.perms_list_all();
  if(!r.ok){ setStatus(r.error||(t.loadingPerms || 'فشل تحميل الصلاحيات')); return; }
  allPerms = r.items || [];
}

function renderPerms(selectedKeys){
  const set = new Set(selectedKeys||[]);
  permsGrid.innerHTML = '';
  
  cachedCheckboxes = null;
  
  const children = {};
  const rootsByKey = {};
  allPerms.forEach(p => {
    if (p.parent_key) {
      (children[p.parent_key] = children[p.parent_key] || []).push(p);
    } else {
      rootsByKey[p.perm_key] = p;
    }
  });

  const rootOrder = [
    'users','permissions','customers','appointments','sales','invoices','credit_notes','quotations','payments','vouchers','products',
    'types','settings','operations','purchase_invoices','purchases','suppliers','customer_pricing',
    'offers','drivers','reports','shifts','whatsapp','zatca'
  ];

  const fragment = document.createDocumentFragment();

  rootOrder.forEach(key => {
    const root = rootsByKey[key];
    if (!root) return;

    const group = document.createElement('div');
    group.className = 'perm-group bg-white border border-gray-200 rounded-lg overflow-hidden';

    const header = document.createElement('div');
    header.className = 'perm-header flex items-center justify-between gap-3 px-4 py-3 bg-blue-50 cursor-pointer select-none';

    const left = document.createElement('div');
    const rootLabel = nameMap[root.perm_key] || root.name;
    left.innerHTML = `<label class="flex items-center gap-3 cursor-pointer m-0 flex-1">
      <input type="checkbox" data-key="${root.perm_key}" ${set.has(root.perm_key)?'checked':''} class="cursor-pointer w-4 h-4"/>
      <span class="font-semibold text-gray-800">${rootLabel}</span>
    </label>`;

    const t = window.__permissionsTranslations || {};
    const toggle = document.createElement('button');
    toggle.textContent = t.detailsBtn || '▼ التفاصيل';
    toggle.className = 'px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium';

    header.appendChild(left);
    header.appendChild(toggle);

    const body = document.createElement('div');
    body.className = 'perm-body border-t border-gray-200 bg-gray-50 p-4';

    const kids = children[root.perm_key] || [];
    if (kids.length) {
      const grid = document.createElement('div');
      grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3';
      
      const gridFragment = document.createDocumentFragment();
      kids.forEach(ch => {
        const row = document.createElement('label');
        row.className = 'flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg cursor-pointer';
        const chLabel = nameMap[ch.perm_key] || ch.name;
        row.innerHTML = `<input type="checkbox" data-key="${ch.perm_key}" ${set.has(ch.perm_key)?'checked':''} class="cursor-pointer w-4 h-4"/> <span class="text-sm text-gray-700">${chLabel}</span>`;
        gridFragment.appendChild(row);
      });
      grid.appendChild(gridFragment);
      body.appendChild(grid);
    } else {
      const empty = document.createElement('div');
      empty.className = 'text-gray-400 text-sm text-center';
      empty.textContent = t.noChildren || 'لا توجد عناصر فرعية';
      body.appendChild(empty);
    }

    const toggleBody = () => {
      body.classList.toggle('open');
      toggle.textContent = body.classList.contains('open') ? (t.hideBtn || '▲ إخفاء') : (t.detailsBtn || '▼ التفاصيل');
    };
    
    toggle.addEventListener('click', (e) => { e.stopPropagation(); toggleBody(); });
    header.addEventListener('click', toggleBody);

    group.appendChild(header);
    group.appendChild(body);
    fragment.appendChild(group);
  });

  permsGrid.appendChild(fragment);
}

async function loadUserPerms(uid){
  const t = window.__permissionsTranslations || {};
  setStatus(t.loadingUserPerms || '...تحميل صلاحيات المستخدم');
  const r = await window.api.perms_get_for_user(uid);
  if(!r.ok){ setStatus(r.error||(t.loadingUserPermsFail || 'فشل تحميل صلاحيات المستخدم')); return; }
  setStatus('');
  renderPerms(r.keys||[]);
}

userSelect.addEventListener('change', async () => {
  currentUserId = userSelect.value ? parseInt(userSelect.value,10) : null;
  currentUserRole = currentUserId ? (usersMap.get(String(currentUserId))?.role || null) : null;

  const isAdminTarget = (currentUserRole === 'admin');
  const showForCashier = (currentUserRole === 'cashier');

  // Show only for cashier, hide otherwise (including admin)
  if(permsWrap){ permsWrap.style.display = showForCashier ? '' : 'none'; }

  // Update controls state
  const t = window.__permissionsTranslations || {};
  try{
    document.querySelectorAll('#permsGrid input, #selectAllBtn, #clearAllBtn, #saveBtn').forEach(el => {
      el.disabled = !showForCashier;
      if(isAdminTarget){ el.title = t.adminTitle || 'لا يمكن تعديل صلاحيات المدير من الواجهة'; }
      else if(!showForCashier){ el.title = t.cashierOnly || 'تظهر الصلاحيات فقط لمستخدمي دور الكاشير'; }
      else { el.removeAttribute('title'); }
    });
  }catch(_){ }

  // Informative messages
  if(isAdminTarget){
    setStatus(t.adminStatusMsg || 'لا يمكن عرض أو تعديل صلاحيات المدير من الواجهة. الرجاء اختيار مستخدم كاشير لتعديل صلاحياته.');
  } else if(showForCashier){
    setStatus(t.cashierCanEdit || 'يمكنك تعديل صلاحيات المستخدم الكاشير من القائمة أدناه.');
  } else if(currentUserId){
    setStatus(t.cashierOnly || 'تظهر الصلاحيات فقط لمستخدمي دور الكاشير.');
  } else {
    setStatus('');
  }

  if(currentUserId && showForCashier){ await loadUserPerms(currentUserId); }
});

// تحسين الأداء: cache عناصر الـ checkbox
let cachedCheckboxes = null;

function getCachedCheckboxes() {
  if (!cachedCheckboxes) {
    cachedCheckboxes = Array.from(document.querySelectorAll('#permsGrid input[type="checkbox"]'));
  }
  return cachedCheckboxes;
}

selectAllBtn.addEventListener('click', () => {
  getCachedCheckboxes().forEach(ch => { ch.checked = true; });
});

clearAllBtn.addEventListener('click', () => {
  getCachedCheckboxes().forEach(ch => { ch.checked = false; });
});

// عند تحديد/إلغاء تحديد صلاحية رئيسية، طبّق على الفرعية التابعة لها فقط
// وعند تحديد عنصر فرعي لا يتم التأثير على بقية العناصر، ويُحدّث الجذر اختياريًا
permsGrid.addEventListener('change', (e) => {
  const t = e.target;
  if(!(t instanceof HTMLInputElement) || !t.matches('input[type="checkbox"][data-key]')) return;
  
  // إذا كان التغيير داخل ترويسة المجموعة => مفتاح رئيسي
  const header = t.closest('.perm-header');
  if(header){
    const group = header.parentElement;
    const body = group?.querySelector('.perm-body');
    if(body){
      // استخدم أداة تحديث أسرع
      const checkboxes = body.querySelectorAll('input[type="checkbox"][data-key]');
      const checked = t.checked;
      checkboxes.forEach(ch => { ch.checked = checked; });
    }
    return;
  }
  
  // عنصر فرعي: نحدّث حالة الجذر
  const group = t.closest('.perm-group');
  if(group){
    const body = group.querySelector('.perm-body');
    const parentCb = group.querySelector('.perm-header input[type="checkbox"][data-key]');
    if(body && parentCb){
      const anyChecked = !!body.querySelector('input[type="checkbox"][data-key]:checked');
      parentCb.checked = anyChecked;
    }
  }
}, true);

saveBtn.addEventListener('click', async () => {
  const t = window.__permissionsTranslations || {};
  if(!currentUserId){ setStatus(t.selectUserFirst || 'اختر مستخدمًا أولاً'); return; }
  if(currentUserRole === 'admin'){ setStatus(t.cannotEditAdmin || 'لا يمكن تعديل صلاحيات المدير من الواجهة'); return; }
  
  saveBtn.disabled = true;
  setStatus(t.saving || '⏳ جاري الحفظ...');
  
  try {
    // جمع الصلاحيات المحددة
    const keys = Array.from(document.querySelectorAll('#permsGrid input[type="checkbox"]:checked')).map(ch => ch.dataset.key);
    
    // حفظ الصلاحيات
    const r = await window.api.perms_set_for_user(currentUserId, keys);
    
    if(!r.ok){ 
      setStatus(r.error||(t.saveFailed || 'فشل الحفظ')); 
      return; 
    }
    
    // تحديث localStorage للمستخدم الحالي
    try{
      if(sessionUser && Number(sessionUser.id) === Number(currentUserId)){
        const fetched = await window.api.perms_get_for_user(currentUserId);
        if(fetched && fetched.ok){ 
          localStorage.setItem('pos_perms', JSON.stringify(fetched.keys||[])); 
        }
      }
    }catch(_){ }
    
    setStatus('');
    showToast(t.saveSuccess || '✓ تم الحفظ بنجاح', '#16a34a');
  } catch(e) {
    const errorMsg = __currentLang === 'ar' ? 'حدث خطأ: ' : 'An error occurred: ';
    const unknownMsg = __currentLang === 'ar' ? 'خطأ غير معروف' : 'Unknown error';
    setStatus(errorMsg + (e?.message || unknownMsg));
  } finally {
    saveBtn.disabled = false;
  }
});

backBtn.addEventListener('click', () => { window.location.href = '../main/index.html'; });

(async function init(){
  try{
    const t = window.__permissionsTranslations || {};
    setStatus(t.loading || '...تحميل');
    await Promise.all([loadUsers(), loadAllPerms()]);
    setStatus('');
  }catch(e){ 
    console.error(e); 
    const t = window.__permissionsTranslations || {};
    setStatus(t.error || 'حدث خطأ'); 
  }
})();