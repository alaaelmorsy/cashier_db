// Main screen renderer: handle navigation via cards + logout + language toggle

// NOTE:
// Main screen now relies on the global i18n engine in preload.js only.
// We intentionally removed local per-screen translation logic to prevent
// race conditions and mixed-language UI during instant language switching.

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

// ===== Zoom Panel =====
(function () {
  const ZOOM_STEP = 0.1;
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 2.0;

  const toggleBtn = document.getElementById('zoomToggleBtn');
  const panel = document.getElementById('zoomPanel');
  const arrowIcon = document.getElementById('zoomArrowIcon');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomLabel = document.getElementById('zoomLabel');

  if (!toggleBtn || !panel) return;

  let panelOpen = false;
  let currentZoom = 1.0;

  function updateLabel(f) {
    if (zoomLabel) zoomLabel.textContent = Math.round(f * 100) + '%';
  }

  function setArrow(open) {
    if (!arrowIcon) return;
    const poly = arrowIcon.querySelector('polyline');
    if (!poly) return;
    poly.setAttribute('points', open ? '9 18 15 12 9 6' : '15 18 9 12 15 6');
  }

  function togglePanel() {
    panelOpen = !panelOpen;
    panel.style.display = panelOpen ? 'flex' : 'none';
    setArrow(panelOpen);
  }

  async function applyZoom(f) {
    f = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, parseFloat(f.toFixed(1))));
    currentZoom = f;
    updateLabel(f);
    try { await window.api.zoom_set(f); } catch (_) {}
  }

  toggleBtn.addEventListener('click', togglePanel);

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      applyZoom(currentZoom + ZOOM_STEP);
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      applyZoom(currentZoom - ZOOM_STEP);
    });
  }

  (async function init() {
    try {
      const saved = await window.api.zoom_get();
      if (saved && saved >= ZOOM_MIN && saved <= ZOOM_MAX) {
        currentZoom = saved;
        updateLabel(saved);
      }
    } catch (_) {}
  })();
})();