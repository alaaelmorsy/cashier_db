// Main screen renderer: handle navigation via cards + logout + language toggle

// Language state
const langSelect = document.getElementById('langSelect') || document.getElementById('appLangSelect');
const __langKey = 'app_lang';
function __applyLang(lang){
  // Normalize locale variants like ar-SA/en-US to base codes
  const base = (typeof lang==='string' ? lang.split('-')[0].toLowerCase() : 'ar');
  const isAr = (base==='ar');
  const t = {
    brand: isAr ? 'الرئيسية' : 'Home',
    logout: isAr ? 'تسجيل الخروج' : 'Logout',
    pos_btn: isAr ? '🛒 نقطة البيع' : '🛒 POS',
    // cards
    users_h: isAr ? 'المستخدمون' : 'Users', users_p: isAr ? 'إدارة مستخدمي النظام والأدوار والحالة' : 'Manage users, roles and status',
    perms_h: isAr ? 'الصلاحيات' : 'Permissions', perms_p: isAr ? 'تحديد صلاحيات المستخدمين' : 'Manage user permissions',
    customers_h: isAr ? 'العملاء' : 'Customers', customers_p: isAr ? 'إضافة/إدارة العملاء' : 'Add/Manage customers',
    appointments_h: isAr ? 'المواعيد' : 'Appointments', appointments_p: isAr ? 'حجز وإدارة المواعيد' : 'Book and manage appointments',
    suppliers_h: isAr ? 'الموردون' : 'Suppliers', suppliers_p: isAr ? 'إضافة/إدارة الموردين' : 'Add/Manage suppliers',
    employees_h: isAr ? 'الموظفون' : 'Employees', employees_p: isAr ? 'إضافة/إدارة الموظفين' : 'Add/Manage employees',
    newinv_h: isAr ? 'فاتورة جديدة' : 'New Invoice', newinv_p: isAr ? 'بدء عملية بيع' : 'Start a sale',
    invoices_h: isAr ? 'الفواتير' : 'Invoices', invoices_p: isAr ? 'عرض وإدارة الفواتير' : 'View and manage invoices',
    credit_h: isAr ? 'الفواتير الدائنة' : 'Credit Notes', credit_p: isAr ? 'عرض الإشعارات الدائنة منفصلة' : 'View credit notes',
    quotations_h: isAr ? 'عروض الأسعار' : 'Quotations', quotations_p: isAr ? 'إدارة وطباعة عروض الأسعار' : 'Manage and print quotations',
    pay_h: isAr ? 'دفع الفاتورة' : 'Payments', pay_p: isAr ? 'سداد فواتير الآجل بالكامل' : 'Settle credit invoices',
    vouchers_h: isAr ? 'السندات' : 'Vouchers', vouchers_p: isAr ? 'سندات القبض والصرف' : 'Receipt and payment vouchers',
    shifts_h: isAr ? 'الشفتات' : 'Shifts', shifts_p: isAr ? 'إدارة شفتات الكاشير' : 'Manage cashier shifts',
    products_h: isAr ? 'المنتجات' : 'Products', products_p: isAr ? 'إضافة منتج جديد' : 'Add products',
    rooms_h: isAr ? 'الغرف' : 'Rooms', rooms_p: isAr ? 'غرف/طاولات المطعم' : 'Restaurant rooms/tables',
    types_h: isAr ? 'الأنواع الرئيسية' : 'Main Types', types_p: isAr ? 'إدارة الأنواع الرئيسية' : 'Manage main types',
    settings_h: isAr ? 'الإعدادات' : 'Settings', settings_p: isAr ? 'معلومات الشركة والضريبة' : 'Company and tax info',
    ops_h: isAr ? 'العمليات' : 'Operations', ops_p: isAr ? 'تعريف العمليات وربطها بالمنتجات' : 'Define operations and link to products',
    kitchen_h: isAr ? 'تعدد الطابعات' : 'Multiple Printers', kitchen_p: isAr ? 'ربط الأقسام بطابعات' : 'Link sections to printers',
    purchases_h: isAr ? 'المصروفات' : 'Purchases', purchases_p: isAr ? 'إضافة ومراجعة مصروفات' : 'Add/Review purchases',
    purchase_invoices_h: isAr ? 'فواتير الشراء' : 'Purchase Invoices', purchase_invoices_p: isAr ? 'إنشاء وإدارة فواتير الشراء' : 'Create and manage purchase invoices',
    inventory_h: isAr ? 'المخزون' : 'Inventory', inventory_p: isAr ? 'تعريف عناصر المخزون وربطها بالمنتجات' : 'Manage inventory items',
    cp_h: isAr ? 'تخصيص أسعار' : 'Customer Pricing', cp_p: isAr ? 'تحديد أسعار/خصومات لعميل' : 'Set special prices/discounts',
    offers_h: isAr ? 'العروض والكوبونات' : 'Offers & Coupons', offers_p: isAr ? 'عروض على الأصناف وكوبونات خصم' : 'Items offers and coupons',
    drivers_h: isAr ? 'السائقون' : 'Drivers', drivers_p: isAr ? 'تسجيل وإدارة السائقين' : 'Register and manage drivers',
    reports_h: isAr ? 'التقارير' : 'Reports', reports_p: isAr ? 'عرض تقارير المبيعات لاحقًا' : 'View sales reports',
    whatsapp_h: isAr ? 'إدارة واتساب' : 'WhatsApp Management', whatsapp_p: isAr ? 'إرسال رسائل واتساب للعملاء' : 'Send WhatsApp messages to customers',
    zatca_h: isAr ? 'الربط - المرحلة الثانية' : 'Integration - Phase 2', zatca_p: isAr ? 'إعداد وإرسال الفواتير إلكترونيًا (ZATCA)' : 'Configure and submit e-invoices (ZATCA)',
    footer: isAr ? 'نظام الرابط' : 'Al-Rabit System',
  };
  // html attrs
  document.documentElement.lang = isAr ? 'ar' : 'en';
  document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  // header
  const brandSpan = document.querySelector('.brand span'); if(brandSpan) brandSpan.textContent = t.brand;
  const logoutBtn = document.getElementById('logoutBtn'); if(logoutBtn) logoutBtn.textContent = (isAr ? 'تسجيل الخروج' : 'Log out');
  const posBtn = document.getElementById('posBtn'); if(posBtn) posBtn.textContent = t.pos_btn;
  // cards text
  const map = [
    ['cardUsers', 'users_h', 'users_p'],
    ['cardPermissions', 'perms_h', 'perms_p'],
    ['cardCustomers', 'customers_h', 'customers_p'],
    ['cardAppointments', 'appointments_h', 'appointments_p'],
    ['cardNewInvoice', 'newinv_h', 'newinv_p'],
    ['cardInvoices', 'invoices_h', 'invoices_p'],
    ['cardCreditNotes', 'credit_h', 'credit_p'],
    ['cardQuotations', 'quotations_h', 'quotations_p'],
    ['cardPayments', 'pay_h', 'pay_p'],
    ['cardVouchers', 'vouchers_h', 'vouchers_p'],
    ['cardShifts', 'shifts_h', 'shifts_p'],
    ['cardProducts', 'products_h', 'products_p'],
    // Removed Rooms card from UI text mapping
    ['cardTypes', 'types_h', 'types_p'],
    ['cardSettings', 'settings_h', 'settings_p'],
    ['cardOperations', 'ops_h', 'ops_p'],
    ['cardKitchen', 'kitchen_h', 'kitchen_p'],
    ['cardPurchases', 'purchases_h', 'purchases_p'],
    ['cardSuppliers', 'suppliers_h', 'suppliers_p'],
    ['cardEmployees', 'employees_h', 'employees_p'],
    // Removed Inventory card from UI text mapping
    ['cardCustomerPricing', 'cp_h', 'cp_p'],
    ['cardOffers', 'offers_h', 'offers_p'],
    ['cardDrivers', 'drivers_h', 'drivers_p'],
    ['cardReports', 'reports_h', 'reports_p'],
    ['cardWhatsApp', 'whatsapp_h', 'whatsapp_p'],
    ['cardPurchaseInvoices', 'purchase_invoices_h', 'purchase_invoices_p'],
    ['cardZatca', 'zatca_h', 'zatca_p'], // requires 'zatca' permission
  ];
  map.forEach(([id, hKey, pKey]) => {
    const el = document.getElementById(id); if(!el) return;
    const h3 = el.querySelector('h3'); if(h3) h3.textContent = t[hKey];
    const p = el.querySelector('p'); if(p) p.textContent = t[pKey];
    try{ el.setAttribute('title', t[pKey]); }catch(_){ }
  });
  const footer = document.querySelector('.footer-note'); if(footer) footer.textContent = t.footer;
  // persist
  try{ localStorage.setItem(__langKey, base); }catch(_){ }
  if(langSelect){ langSelect.value = base; }
  // Update app-wide DB locale and notify other windows
  try{ window.api.app_set_locale(base); }catch(_){ }
  // Trigger DOM translate burst to ensure icons/cards pick up correct language immediately
  try{ window.__i18n_burst && window.__i18n_burst(base); }catch(_){ }
}

(function initLang(){
  // Apply initial from DB
  (async ()=>{
    try{ const r = await window.api.app_get_locale(); const L=(r&&r.lang)||'ar'; __applyLang(L); if(langSelect) langSelect.value=L; }catch(_){ __applyLang('ar'); }
  })();
  // listen for global changes
  try{ window.api.app_on_locale_changed((L)=>{ __applyLang(L); if(langSelect) langSelect.value=L; try{ window.__i18n_burst && window.__i18n_burst(L); }catch(_){ } }); }catch(_){ }
  if(langSelect){
    langSelect.addEventListener('change', (e) => {
      const v = e.target.value === 'en' ? 'en' : 'ar';
      __applyLang(v);
    });
  }
})();

const cardUsers = document.getElementById('cardUsers');
if (cardUsers) {
  cardUsers.addEventListener('click', () => {
    window.location.href = '../users/index.html';
  });
}

const cardPermissions = document.getElementById('cardPermissions');
if (cardPermissions) {
  cardPermissions.addEventListener('click', () => {
    window.location.href = '../permissions/index.html';
  });
}

const cardProducts = document.getElementById('cardProducts');
if (cardProducts) {
  cardProducts.addEventListener('click', () => {
    window.location.href = '../products/index.html';
  });
}

const cardAppointments = document.getElementById('cardAppointments');
if (cardAppointments) {
  cardAppointments.addEventListener('click', () => {
    window.location.href = '../appointments/index.html';
  });
}

// Hide/disable cards by permissions (from DB at runtime)
async function applyPermissions(){
  let keys = [];
  try{
    const u = JSON.parse(localStorage.getItem('pos_user')||'null');
    if(u && u.id){
      const r = await window.api.perms_get_for_user(u.id);
      if(r && r.ok){ keys = r.keys || []; }
    }
  }catch(_){ keys = []; }
  
  const need = {
    cardUsers: 'users',
    cardPermissions: 'permissions',
    cardCustomers: 'customers',
    cardAppointments: 'appointments',
    cardNewInvoice: 'sales',
    cardInvoices: 'invoices',
    cardCreditNotes: 'credit_notes',
    cardQuotations: 'quotations',
    cardPayments: 'payments',
    cardVouchers: 'vouchers',
    cardShifts: 'shifts',
    cardProducts: 'products',
    // Removed Rooms permission mapping
    cardTypes: 'types',
    cardSettings: 'settings',
    cardOperations: 'operations',
    cardKitchen: 'kitchen',
    cardPurchases: 'purchases',
    cardPurchaseInvoices: 'purchase_invoices',
    cardSuppliers: 'suppliers',
    cardEmployees: 'employees',
    // Removed Inventory permission mapping
    cardCustomerPricing: 'customer_pricing',
    cardOffers: 'offers',
    cardDrivers: 'drivers',
    cardReports: 'reports',
    cardWhatsApp: 'whatsapp',
    cardZatca: 'zatca',
  };
  Object.entries(need).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if(!el) return;
    
    if(!keys.includes(key)){
      // Hide completely to avoid partial styles/layout shifts
      el.classList.add('hidden');
      el.removeAttribute('style');
      try{ el.setAttribute('aria-hidden','true'); }catch(_){ }
    } else {
      el.classList.remove('hidden');
      try{ el.removeAttribute('aria-hidden'); }catch(_){ }
    }
  });
  // Re-index visible cards so animations/delays are consistent
  try{ reindexCards && reindexCards(); }catch(_){ }
}

// Apply settings-based visibility (for cards that can be toggled via DB)
async function applySettingsVisibility(){
  try{
    const r = await window.api.settings_get();
    if(!r || !r.ok || !r.item) return;
    const s = r.item;
    
    // Hide/show appointments card based on show_appointments setting
    const cardAppointments = document.getElementById('cardAppointments');
    if(cardAppointments){
      if(s.show_appointments === 0 || s.show_appointments === false){
        cardAppointments.classList.add('hidden');
        cardAppointments.setAttribute('aria-hidden','true');
      } else {
        cardAppointments.classList.remove('hidden');
        cardAppointments.removeAttribute('aria-hidden');
      }
    }
    // Hide/show shifts card based on show_shifts setting
    const cardShifts = document.getElementById('cardShifts');
    if(cardShifts){
      if(s.show_shifts === 0 || s.show_shifts === false){
        cardShifts.classList.add('hidden');
        cardShifts.setAttribute('aria-hidden','true');
      } else {
        cardShifts.classList.remove('hidden');
        cardShifts.removeAttribute('aria-hidden');
      }
    }
  }catch(e){ console.error('Error applying settings visibility:', e); }
}

// Initial load
applyPermissions();
applySettingsVisibility();

// Re-apply permissions when window gains focus (to pick up DB changes)
window.addEventListener('focus', () => {
  applyPermissions();
  applySettingsVisibility();
});

const cardTypes = document.getElementById('cardTypes');
if (cardTypes) {
  cardTypes.addEventListener('click', () => {
    window.location.href = '../types/index.html';
  });
}

// Rooms card removed

const cardCustomers = document.getElementById('cardCustomers');
if (cardCustomers) {
  cardCustomers.addEventListener('click', () => {
    window.location.href = '../customers/index.html';
  });
}

const cardSettings = document.getElementById('cardSettings');
if (cardSettings) {
  cardSettings.addEventListener('click', () => {
    window.location.href = '../settings/index.html';
  });
}

const cardOperations = document.getElementById('cardOperations');
if (cardOperations) {
  cardOperations.addEventListener('click', () => {
    window.location.href = '../operations/index.html';
  });
}

const cardKitchen = document.getElementById('cardKitchen');
if (cardKitchen) {
  cardKitchen.addEventListener('click', () => {
    window.location.href = '../kitchen/index.html';
  });
}

const cardNewInvoice = document.getElementById('cardNewInvoice');
if (cardNewInvoice) {
  cardNewInvoice.addEventListener('click', () => {
    window.location.href = '../sales/index.html';
  });
}

const cardInvoices = document.getElementById('cardInvoices');
if (cardInvoices) {
  cardInvoices.addEventListener('click', () => {
    window.location.href = '../invoices/index.html';
  });
}

const cardCreditNotes = document.getElementById('cardCreditNotes');
if (cardCreditNotes) {
  cardCreditNotes.addEventListener('click', () => {
    window.location.href = '../credit_notes/index.html';
  });
}

const cardQuotations = document.getElementById('cardQuotations');
if (cardQuotations) {
  cardQuotations.addEventListener('click', () => {
    window.location.href = '../quotations/index.html';
  });
}

const cardPayments = document.getElementById('cardPayments');
if (cardPayments) {
  cardPayments.addEventListener('click', () => {
    window.location.href = '../payments/index.html';
  });
}

const cardVouchers = document.getElementById('cardVouchers');
if (cardVouchers) {
  cardVouchers.addEventListener('click', () => {
    window.location.href = '../vouchers/index.html';
  });
}

const cardShifts = document.getElementById('cardShifts');
if (cardShifts) {
  cardShifts.addEventListener('click', () => {
    window.location.href = '../shifts-list/index.html';
  });
}

const cardPurchases = document.getElementById('cardPurchases');
if (cardPurchases) {
  cardPurchases.addEventListener('click', () => {
    window.location.href = '../purchases/index.html';
  });
}

const cardPurchaseInvoices = document.getElementById('cardPurchaseInvoices');
if (cardPurchaseInvoices) {
  cardPurchaseInvoices.addEventListener('click', () => {
    window.location.href = '../purchase_invoices/index.html';
  });
}

const cardSuppliers = document.getElementById('cardSuppliers');
if (cardSuppliers) {
  cardSuppliers.addEventListener('click', () => {
    window.location.href = '../suppliers/index.html';
  });
}

const cardEmployees = document.getElementById('cardEmployees');
if (cardEmployees) {
  cardEmployees.addEventListener('click', () => {
    window.location.href = '../employees/index.html';
  });
}

// Inventory card removed

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    // خروج من الجلسة وإرجاع إلى شاشة الدخول بدون إغلاق التطبيق
    try{ localStorage.removeItem('pos_user'); localStorage.removeItem('pos_perms'); }catch(_){ }
    window.location.replace('../login/index.html');
  });
}

const cardCustomerPricing = document.getElementById('cardCustomerPricing');
if (cardCustomerPricing) {
  cardCustomerPricing.addEventListener('click', () => {
    window.location.href = '../customer_pricing/index.html';
  });
}

const cardOffers = document.getElementById('cardOffers');
if (cardOffers) {
  cardOffers.addEventListener('click', () => {
    window.location.href = '../offers/index.html';
  });
}

const cardDrivers = document.getElementById('cardDrivers');
if (cardDrivers) {
  cardDrivers.addEventListener('click', () => {
    window.location.href = '../drivers/index.html';
  });
}

const cardReports = document.getElementById('cardReports');
if (cardReports) {
  cardReports.addEventListener('click', () => {
    window.location.href = '../reports/index.html';
  });
}

// WhatsApp card navigation
const cardWhatsApp = document.getElementById('cardWhatsApp');
if (cardWhatsApp) {
  cardWhatsApp.addEventListener('click', () => {
    window.location.href = '../whatsapp/index.html';
  });
}

// ZATCA card navigation
const cardZatca = document.getElementById('cardZatca');
if (cardZatca) {
  cardZatca.addEventListener('click', async () => {
    // Prefer Electron navigation if available; fallback to direct href
    try {
      if (window.electronAPI?.navigation?.goTo) {
        const r = await window.electronAPI.navigation.goTo('zatca');
        if (!r || r.ok !== true) throw new Error('nav failed');
      } else {
        window.location.href = '../zatca/index.html';
      }
    } catch (_) {
      window.location.href = '../zatca/index.html';
    }
  });
}

// إعادة فهرسة البطاقات المرئية فقط
function reindexCards(){
  const cards = Array.from(document.querySelectorAll('.card')).filter(c=>!c.classList.contains('hidden'));
  cards.forEach((card, index) => {
    card.style.setProperty('--card-index', index);
    // تأكد من إزالة أي ستايل سابق غير مرغوب
    card.style.opacity = '';
    card.style.transform = '';
  });
  // احترام تفضيل تقليل الحركة
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    cards.forEach(card => {
      card.style.animation = 'none';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    });
  }
}

// إضافة تأثير الظهور التدريجي للبطاقات
document.addEventListener('DOMContentLoaded', function() {
  reindexCards();
});

// POS button in header - navigate to sales
const posBtn = document.getElementById('posBtn');
if (posBtn) {
  posBtn.addEventListener('click', () => {
    window.location.href = '../sales/index.html';
  });
}

// F1 keyboard shortcut for POS
document.addEventListener('keydown', (e) => {
  if (e.key === 'F1') {
    e.preventDefault();
    window.location.href = '../sales/index.html';
  }
});