// Optimized Offers & Coupons renderer
// ========================================

// DOM Elements Cache
const elements = {
  backBtn: document.getElementById('backBtn'),
  addOfferBtn: document.getElementById('addOfferBtn'),
  addGlobalOfferBtn: document.getElementById('addGlobalOfferBtn'),
  addCouponBtn: document.getElementById('addCouponBtn'),
  addQtyOfferBtn: document.getElementById('addQtyOfferBtn'),
  globalOfferTab: document.getElementById('globalOfferTab'),
  searchBox: document.getElementById('searchBox'),
  searchBtn: document.getElementById('searchBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  offersTbody: document.getElementById('offersTbody'),
  globalOffersTbody: document.getElementById('globalOffersTbody'),
  qtyOffersTbody: document.getElementById('qtyOffersTbody'),
  couponsTbody: document.getElementById('couponsTbody'),
  modalBackdrop: document.getElementById('modalBackdrop'),
  modalTitle: document.getElementById('modalTitle'),
  modalContent: document.getElementById('modalContent'),
  cancelModal: document.getElementById('cancelModal'),
  saveModal: document.getElementById('saveModal')
};

// State Management
const state = {
  editingType: null, // 'offer' | 'coupon'
  editingId: null,
  editingIsGlobal: 0,
  offerProducts: [], // {product_id, product_name, operation_id, operation_name}
  offerExcludedProducts: [], // {product_id, product_name, operation_id, operation_name}
  isLoading: false
};

// Permissions Cache
let permissions = new Set();
const permissionAlias = {
  'offers.add': 'offers.add_offer',
  'offers.add_global': 'offers.add_global_offer',
  'offers.edit': 'offers.edit_offer',
  'offers.toggle': 'offers.toggle_offer',
  'offers.delete': 'offers.delete_offer',
  'coupons.add': 'offers.add_coupon',
  'coupons.edit': 'offers.edit_coupon',
  'coupons.toggle': 'offers.toggle_coupon',
  'coupons.delete': 'offers.delete_coupon'
};

// Utility Functions
// ================

function hasPermission(key) {
  const actualKey = permissionAlias[key] || key;
  return permissions.has('offers') && permissions.has(actualKey);
}

function showLoading(tbody) {
  const colCount = tbody === elements.offersTbody || tbody === elements.globalOffersTbody ? 8 : (tbody === elements.qtyOffersTbody ? 10 : 7);
  tbody.innerHTML = `
    <tr>
      <td colspan="${colCount}" class="px-4 py-8 text-center text-gray-600">
        جاري التحميل...
      </td>
    </tr>
  `;
}

function showEmpty(tbody, message = 'لا توجد بيانات') {
  let colCount = 7;
  if(tbody === elements.offersTbody || tbody === elements.globalOffersTbody) colCount = 8;
  else if (tbody === elements.qtyOffersTbody) colCount = 10;
  tbody.innerHTML = `
    <tr>
      <td colspan="${colCount}" class="px-4 py-8 text-center text-gray-500">
        ${message}
      </td>
    </tr>
  `;
}

function formatDateRange(startDate, endDate) {
  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    const showTime = hours !== '00' || minutes !== '00';
    const dateStr = `${day}/${month}/${year}`;
    
    return showTime ? `${dateStr} ${hours}:${minutes}` : dateStr;
  };
  
  if (startDate && endDate) {
    return `<div class="text-xs">
              <div class="text-green-700">من: ${formatDate(startDate)}</div>
              <div class="text-red-700">إلى: ${formatDate(endDate)}</div>
            </div>`;
  }
  if (startDate) {
    return `<div class="text-xs text-green-700">من: ${formatDate(startDate)}</div>`;
  }
  if (endDate) {
    return `<div class="text-xs text-blue-700">صالح حتى: ${formatDate(endDate)}</div>`;
  }
  return '<div class="text-xs text-gray-500">غير محدد</div>';
}

function formatCouponValidity(startDate, endDate) {
  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    const showTime = hours !== '00' || minutes !== '00';
    const dateStr = `${day}/${month}/${year}`;
    
    return showTime ? `${dateStr} ${hours}:${minutes}` : dateStr;
  };

  const now = new Date();
  
  if (endDate) {
    const endDateObj = new Date(endDate);
    const isExpired = endDateObj < now;
    
    return `<div class="text-xs ${isExpired ? 'text-red-700' : 'text-blue-700'}">
              ${isExpired ? 'انتهت في' : 'صالح حتى'}: ${formatDate(endDate)}
            </div>`;
  }
  
  if (startDate) {
    return `<div class="text-xs text-green-700">بدأ من: ${formatDate(startDate)}</div>`;
  }
  
  return '<div class="text-xs text-gray-500">غير محدد</div>';
}

function formatMode(mode) {
  return mode === 'percent' ? 'نسبة %' : 'نقدي';
}

function formatOfferType(offer) {
  return offer.is_global ? 
    '<span class="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-bold">عام</span>' : 
    'أصناف محددة';
}

function formatStatus(isActive) {
  return isActive ? 
    '<span class="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">نشط</span>' : 
    '<span class="inline-block px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">موقوف</span>';
}

// Modal Functions
// ==============

function openModal(title, content) {
  elements.modalTitle.textContent = title;
  elements.modalContent.innerHTML = content;
  try { elements.modalBackdrop.showModal(); } 
  catch(_) { try { elements.modalBackdrop.close(); elements.modalBackdrop.showModal(); } catch(__) {} }
  focusFirstField();
}

function closeModal() {
  try { elements.modalBackdrop.close(); } 
  catch(_) { elements.modalBackdrop.removeAttribute('open'); }
  
  state.editingType = null;
  state.editingId = null;
  state.editingIsGlobal = 0;
  state.offerProducts = [];
  state.offerExcludedProducts = [];
  elements.modalContent.innerHTML = '';
  
  try { window.focus(); } catch(_) { }
}

// Focus/modal helpers to avoid native blocking dialog issues on Windows/Electron
function focusFirstField(){
  try{
    window.focus?.();
    setTimeout(()=>{
      const first = document.querySelector('#f_name, #c_code, input, select, textarea');
      if(first){
        try{ first.focus(); }catch(_){ }
        try{ first.select?.(); }catch(_){ }
      }
    },0);
  }catch(_){ }
}

const confirmDlg = document.getElementById('confirmDlg');
const confirmText = document.getElementById('confirmText');
const confirmOk = document.getElementById('confirmOk');
const confirmCancel = document.getElementById('confirmCancel');

function safeShowModal(d){
  try{ d.showModal(); }
  catch(_){ try{ d.close?.(); }catch(__){} try{ d.showModal(); }catch(__){} }
}

async function customConfirm(title, text){
  const dlg = document.getElementById('confirmDlg');
  const txt = document.getElementById('confirmText');
  const ok = document.getElementById('confirmOk');
  const cancel = document.getElementById('confirmCancel');
  const header = document.getElementById('confirmHeader');

  if(!dlg || !txt || !ok || !cancel){
    return window.confirm(text || title || 'تأكيد؟');
  }
  
  const isDelete = title && title.includes('حذف');
  
  if(header) {
    if(isDelete){
      header.classList.remove('bg-blue-600');
      header.classList.add('bg-red-600');
    } else {
      header.classList.remove('bg-red-600');
      header.classList.add('bg-blue-600');
    }
    const tEl = document.getElementById('confirmTitle');
    if(tEl) tEl.textContent = title || 'تأكيد';
    const iEl = document.getElementById('confirmHeaderIcon');
    if(iEl) iEl.textContent = isDelete ? '⚠️' : '❓';
  }

  const iconBody = document.getElementById('confirmIcon');
  if(iconBody) iconBody.textContent = isDelete ? '⚠️' : '❓';

  txt.innerHTML = `<div style="display:flex; align-items:start; gap:12px;"><span style="flex:1;">${text || ''}</span></div>`;
  
  let res=false;
  const onOk = ()=>{ res=true; try{ dlg.close(); }catch(_){ dlg.removeAttribute('open'); } };
  const onCancel = ()=>{ res=false; try{ dlg.close(); }catch(_){ dlg.removeAttribute('open'); } };
  
  // Remove old listeners (cloning node is a quick hack, or just use {once:true} carefully)
  // Since we create new promise every time, we need to ensure old listeners don't fire?
  // relying on {once:true} is fine if the dialog was closed properly.
  // Better: clone buttons to clear listeners
  const okClone = ok.cloneNode(true); ok.parentNode.replaceChild(okClone, ok);
  const cancelClone = cancel.cloneNode(true); cancel.parentNode.replaceChild(cancelClone, cancel);
  
  okClone.addEventListener('click', onOk, { once:true });
  cancelClone.addEventListener('click', onCancel, { once:true });
  
  try{ safeShowModal(dlg); }catch(_){ }
  return await new Promise(resolve=>{
    const onClose = ()=>{ setTimeout(()=>{ window.focus?.(); resolve(res); },0); };
    dlg.addEventListener('close', onClose, { once:true });
  });
}

async function customAlert(text){
  const dlg = document.getElementById('confirmDlg');
  const txt = document.getElementById('confirmText');
  const ok = document.getElementById('confirmOk');
  const cancel = document.getElementById('confirmCancel');
  const header = document.getElementById('confirmHeader');

  if(!dlg || !txt || !ok || !cancel){
    window.alert(text);
    return;
  }
  
  if(header) {
    header.classList.remove('bg-red-600');
    header.classList.add('bg-blue-600');
    const tEl = document.getElementById('confirmTitle');
    if(tEl) tEl.textContent = 'تنبيه';
    const iEl = document.getElementById('confirmHeaderIcon');
    if(iEl) iEl.textContent = 'ℹ️';
  }
  
  const iconBody = document.getElementById('confirmIcon');
  if(iconBody) iconBody.textContent = 'ℹ️';
  
  txt.textContent = text || '';
  const prev = cancel.style.display;
  cancel.style.display = 'none';
  
  const onOk = ()=>{ try{ dlg.close(); }catch(_){ dlg.removeAttribute('open'); } };
  const okClone = ok.cloneNode(true); ok.parentNode.replaceChild(okClone, ok);
  okClone.addEventListener('click', onOk, { once:true });
  
  try{ safeShowModal(dlg); }catch(_){ }
  await new Promise(resolve=>{
    const onClose = ()=>{ 
      cancel.style.display = prev; 
      setTimeout(()=>{ window.focus?.(); resolve(); },0); 
    };
    dlg.addEventListener('close', onClose, { once:true });
  });
}

// Data Loading
// ============

async function loadPermissions() {
  try {
    const user = JSON.parse(localStorage.getItem('pos_user') || 'null');
    if (user && user.id) {
      const result = await window.api.perms_get_for_user(user.id);
      if (result && result.ok) {
        permissions = new Set(result.keys || []);
      }
    }
  } catch (error) {
    console.warn('Error loading permissions:', error);
    permissions = new Set();
  }
}

async function loadData() {
  if (state.isLoading) return;
  
  state.isLoading = true;
  const searchQuery = elements.searchBox.value.trim();
  const query = searchQuery ? { q: searchQuery } : {};
  
  try {
    // Show loading states
    showLoading(elements.offersTbody);
    if(elements.qtyOffersTbody) showLoading(elements.qtyOffersTbody);
    showLoading(elements.couponsTbody);
    
    // Load data in parallel
    const [offersResult, qtyOffersResult, couponsResult] = await Promise.all([
      window.api.offers_list(query),
      window.api.offers_qty_list(query),
      window.api.coupons_list(query)
    ]);
    
    // Render offers
    renderOffers(offersResult);
    // Render qty offers
    renderQtyOffers(qtyOffersResult);
    // Render coupons
    renderCoupons(couponsResult);
    
  } catch (error) {
    console.error('Error loading data:', error);
    showEmpty(elements.offersTbody, 'حدث خطأ في تحميل البيانات');
    if(elements.qtyOffersTbody) showEmpty(elements.qtyOffersTbody, 'حدث خطأ في تحميل البيانات');
    showEmpty(elements.couponsTbody, 'حدث خطأ في تحميل البيانات');
  } finally {
    state.isLoading = false;
  }
}

function renderOffers(result) {
  const offers = (result && result.ok) ? (result.items || []) : [];
  
  const regularOffers = offers.filter(offer => !Number(offer.is_global || 0));
  const globalOffers = offers.filter(offer => Number(offer.is_global || 0) === 1);
  
  if (!regularOffers.length) {
    showEmpty(elements.offersTbody, 'لا توجد عروض');
  } else {
    elements.offersTbody.innerHTML = regularOffers.map((offer, index) => `
      <tr class="border-b border-gray-100 last:border-b-0">
        <td class="px-4 py-3 text-gray-700 font-medium">${index + 1}</td>
        <td class="px-4 py-3 text-gray-900 font-semibold">${offer.name || ''}</td>
        <td class="px-4 py-3 text-gray-700">${formatMode(offer.mode)}</td>
        <td class="px-4 py-3 text-gray-700">${formatOfferType(offer)}</td>
        <td class="px-4 py-3 text-gray-700">${Number(offer.value || 0).toFixed(2)}</td>
        <td class="px-4 py-3">${formatDateRange(offer.start_date, offer.end_date)}</td>
        <td class="px-4 py-3">${formatStatus(offer.is_active)}</td>
        <td class="px-4 py-3">
          <div class="flex flex-wrap gap-2">
            ${hasPermission('offers.edit') ? 
              `<button class="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-medium" onclick="editOffer(${offer.id})">✏️ تعديل</button>` : ''}
            ${hasPermission('offers.toggle') ? 
              `<button class="px-3 py-1.5 ${offer.is_active ? 'bg-red-600' : 'bg-green-600'} text-white rounded-lg text-sm font-medium" onclick="toggleOffer(${offer.id})">
                ${offer.is_active ? '❌ إيقاف' : '✅ تفعيل'}
              </button>` : ''}
            ${hasPermission('offers.delete') ? 
              `<button class="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm font-medium" onclick="deleteOffer(${offer.id})">🗑️ حذف</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  }
  
  if (!globalOffers.length) {
    showEmpty(elements.globalOffersTbody, 'لا يوجد عرض عام');
  } else {
    elements.globalOffersTbody.innerHTML = globalOffers.map((offer, index) => `
      <tr class="border-b border-gray-100 last:border-b-0">
        <td class="px-4 py-3 text-gray-700 font-medium">${index + 1}</td>
        <td class="px-4 py-3 text-gray-900 font-semibold">${offer.name || ''}</td>
        <td class="px-4 py-3 text-gray-700">${formatMode(offer.mode)}</td>
        <td class="px-4 py-3 text-gray-700">${formatOfferType(offer)}</td>
        <td class="px-4 py-3 text-gray-700">${Number(offer.value || 0).toFixed(2)}</td>
        <td class="px-4 py-3">${formatDateRange(offer.start_date, offer.end_date)}</td>
        <td class="px-4 py-3">${formatStatus(offer.is_active)}</td>
        <td class="px-4 py-3">
          <div class="flex flex-wrap gap-2">
            ${hasPermission('offers.edit') ? 
              `<button class="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-medium" onclick="editOffer(${offer.id})">✏️ تعديل</button>` : ''}
            ${hasPermission('offers.toggle') ? 
              `<button class="px-3 py-1.5 ${offer.is_active ? 'bg-red-600' : 'bg-green-600'} text-white rounded-lg text-sm font-medium" onclick="toggleOffer(${offer.id})">
                ${offer.is_active ? '❌ إيقاف' : '✅ تفعيل'}
              </button>` : ''}
            ${hasPermission('offers.delete') ? 
              `<button class="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm font-medium" onclick="deleteOffer(${offer.id})">🗑️ حذف</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  }
  
  updateGlobalOfferButton(offers);
}

function renderQtyOffers(result){
  const rules = (result && result.ok) ? (result.items || []) : [];
  if(!elements.qtyOffersTbody){ return; }
  if(!rules.length){
    showEmpty(elements.qtyOffersTbody, 'لا توجد عروض كمية');
    return;
  }
  elements.qtyOffersTbody.innerHTML = rules.map((r, idx) => `
    <tr class="border-b border-gray-100 last:border-b-0">
      <td class="px-4 py-3 text-gray-700 font-medium">${idx+1}</td>
      <td class="px-4 py-3 text-gray-900 font-semibold">${r.name || ''}</td>
      <td class="px-4 py-3 text-gray-700">شراء ${Number(r.buy_qty||0)}، خصم على القطعة رقم ${Number(r.nth||1)}</td>
      <td class="px-4 py-3 text-gray-700">${formatMode(r.mode)}</td>
      <td class="px-4 py-3 text-gray-700">${Number(r.value||0).toFixed(2)}</td>
      <td class="px-4 py-3 text-gray-700">${Number(r.per_group||0) ? 'نعم' : 'لا'}</td>
      <td class="px-4 py-3">${formatDateRange(r.start_date, r.end_date)}</td>
      <td class="px-4 py-3 text-gray-700">${Number(r.items_count||0)}</td>
      <td class="px-4 py-3">${formatStatus(r.is_active)}</td>
      <td class="px-4 py-3">
        <div class="flex flex-wrap gap-2">
          ${hasPermission('offers.edit_qty_offer') ? `<button class="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-medium" onclick="editQtyOffer(${r.id})">✏️ تعديل</button>` : ''}
          ${hasPermission('offers.toggle_qty_offer') ? `<button class="px-3 py-1.5 ${r.is_active ? 'bg-red-600' : 'bg-green-600'} text-white rounded-lg text-sm font-medium" onclick="toggleQtyOffer(${r.id})">${r.is_active ? '❌ إيقاف' : '✅ تفعيل'}</button>` : ''}
          ${hasPermission('offers.delete_qty_offer') ? `<button class="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm font-medium" onclick="deleteQtyOffer(${r.id})">🗑️ حذف</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function renderCoupons(result) {
  const coupons = (result && result.ok) ? (result.items || []) : [];
  
  if (!coupons.length) {
    showEmpty(elements.couponsTbody, 'لا توجد كوبونات');
    return;
  }
  
  elements.couponsTbody.innerHTML = coupons.map((coupon, index) => `
    <tr class="border-b border-gray-100 last:border-b-0">
      <td class="px-4 py-3 text-gray-700 font-medium">${index + 1}</td>
      <td class="px-4 py-3"><code class="bg-gray-100 px-2 py-1 rounded text-sm">${coupon.code || ''}</code></td>
      <td class="px-4 py-3 text-gray-700">${formatMode(coupon.mode)}</td>
      <td class="px-4 py-3 text-gray-700">${Number(coupon.value || 0).toFixed(2)}</td>
      <td class="px-4 py-3">${formatCouponValidity(coupon.start_date, coupon.end_date)}</td>
      <td class="px-4 py-3">${formatStatus(coupon.is_active)}</td>
      <td class="px-4 py-3">
        <div class="flex flex-wrap gap-2">
          ${hasPermission('coupons.edit') ? 
            `<button class="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-medium" onclick="editCoupon(${coupon.id})">✏️ تعديل</button>` : ''}
          ${hasPermission('coupons.toggle') ? 
            `<button class="px-3 py-1.5 ${coupon.is_active ? 'bg-red-600' : 'bg-green-600'} text-white rounded-lg text-sm font-medium" onclick="toggleCoupon(${coupon.id})">
              ${coupon.is_active ? '❌ إيقاف' : '✅ تفعيل'}
            </button>` : ''}
          ${hasPermission('coupons.delete') ? 
            `<button class="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm font-medium" onclick="deleteCoupon(${coupon.id})">🗑️ حذف</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function updateGlobalOfferButton(offers) {
  if (!elements.addGlobalOfferBtn) return;
  
  const hasGlobal = offers.some(offer => Number(offer.is_global || 0) === 1);
  elements.addGlobalOfferBtn.disabled = hasGlobal;
  elements.addGlobalOfferBtn.title = hasGlobal ? 
    'يوجد عرض عام بالفعل — احذف العرض الحالي أولاً' : '';
}

// Form Generation
// ==============

function generateQtyOfferForm(initialData = {}) {
  const data = {
    name: '',
    description: '',
    buy_qty: 3,
    nth: 1,
    mode: 'percent',
    value: '',
    start_date: '',
    end_date: '',
    per_group: 1,
    is_active: 1,
    ...initialData
  };

  return `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">اسم العرض *</label>
        <input id="q_name" placeholder="اسم العرض" value="${data.name}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">الوصف</label>
        <input id="q_desc" placeholder="وصف اختياري" value="${data.description}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">عند شراء (X) *</label>
        <input id="q_buy" type="number" min="1" value="${data.buy_qty}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">القطعة المخفضة داخل المجموعة (Y)</label>
        <input id="q_nth" type="number" min="1" value="${data.nth}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">نوع الخصم العام</label>
        <select id="q_mode" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="percent" ${data.mode === 'percent' ? 'selected' : ''}>نسبة %</option>
          <option value="cash" ${data.mode === 'cash' ? 'selected' : ''}>نقدي</option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">قيمة الخصم العام</label>
        <input id="q_value" type="number" step="0.01" min="0" value="${data.value}" placeholder="0.00" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <small class="text-xs text-gray-600 mt-1 block">يمكن تحديد خصم عام أو خصم مخصص لكل منتج</small>
      </div>

      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">من تاريخ</label>
        <input id="q_start" type="datetime-local" lang="en" value="${data.start_date ? new Date(data.start_date).toISOString().slice(0, 16) : ''}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">إلى تاريخ</label>
        <input id="q_end" type="datetime-local" lang="en" value="${data.end_date ? new Date(data.end_date).toISOString().slice(0, 16) : ''}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">تكرار داخل كل مجموعة</label>
        <select id="q_group" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="1" ${data.per_group ? 'selected' : ''}>نعم</option>
          <option value="0" ${!data.per_group ? 'selected' : ''}>لا</option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">الحالة</label>
        <select id="q_active" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="1" ${data.is_active ? 'selected' : ''}>نشط</option>
          <option value="0" ${!data.is_active ? 'selected' : ''}>موقوف</option>
        </select>
      </div>

      <div class="col-span-full" id="productPicker">
        <hr class="my-4 border-gray-200" />
        <label class="block text-sm font-semibold text-gray-700 mb-2">الأصناف المشمولة في العرض</label>

        <div class="flex gap-2 items-end mb-2 flex-wrap">
          <div class="flex-1 min-w-[200px]">
            <input id="prodSearch" placeholder="ابحث عن صنف لإضافته للعرض" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div id="opBox" style="display: none;">
            <label class="text-xs text-gray-600 block mb-1">الوحدة</label>
            <select id="opSelect" class="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none min-w-[120px]"></select>
          </div>
          <div id="discountBox" style="display: none;">
            <label class="text-xs text-gray-600 block mb-1">نوع الخصم</label>
            <select id="itemDiscountMode" class="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none min-w-[100px]">
              <option value="percent">نسبة %</option>
              <option value="cash">نقدي</option>
            </select>
          </div>
          <div id="discountValueBox" style="display: none;">
            <label class="text-xs text-gray-600 block mb-1">قيمة الخصم</label>
            <input id="itemDiscountValue" type="number" step="0.01" min="0" placeholder="0.00" class="w-[100px] px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none" />
          </div>
          <button type="button" id="addProdToOffer" class="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium">إضافة</button>
        </div>

        <div id="prodSuggest" class="hidden bg-white border border-gray-200 rounded-lg max-h-[200px] overflow-y-auto"></div>

        <div id="selectedItems" class="bg-gray-50 border border-gray-200 rounded-lg min-h-[60px] p-3">
          <div class="text-center text-gray-500">لم يتم إضافة أصناف بعد</div>
        </div>
      </div>
    </div>
  `;
}

function generateOfferForm(initialData = {}) {
  const data = {
    name: '',
    description: '',
    mode: 'percent',
    value: '',
    start_date: '',
    end_date: '',
    is_active: 1,
    ...initialData
  };
  
  return `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">اسم العرض *</label>
        <input id="f_name" placeholder="اسم العرض" value="${data.name}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">الوصف</label>
        <input id="f_desc" placeholder="وصف اختياري" value="${data.description}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">النوع *</label>
        <select id="f_mode" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="percent" ${data.mode === 'percent' ? 'selected' : ''}>نسبة %</option>
          <option value="cash" ${data.mode === 'cash' ? 'selected' : ''}>نقدي</option>
        </select>
      </div>
      
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">القيمة *</label>
        <input id="f_value" type="number" step="0.01" min="0" value="${data.value}" placeholder="0.00" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">من تاريخ</label>
        <input id="f_start" type="datetime-local" lang="en" value="${data.start_date ? new Date(data.start_date).toISOString().slice(0, 16) : ''}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">إلى تاريخ</label>
        <input id="f_end" type="datetime-local" lang="en" value="${data.end_date ? new Date(data.end_date).toISOString().slice(0, 16) : ''}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">الحالة</label>
        <select id="f_active" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="1" ${data.is_active ? 'selected' : ''}>نشط</option>
          <option value="0" ${!data.is_active ? 'selected' : ''}>موقوف</option>
        </select>
      </div>
      
      <div class="col-span-full" id="productPicker" ${state.editingIsGlobal ? 'style="display:none"' : ''}>
        <hr class="my-4 border-gray-200" />
        <label class="block text-sm font-semibold text-gray-700 mb-2">الأصناف المشمولة في العرض</label>
        
        <div class="flex gap-2 items-end mb-2 flex-wrap">
          <div class="flex-1 min-w-[200px]">
            <input id="prodSearch" placeholder="ابحث عن صنف لإضافته للعرض" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div id="opBox" style="display: none;">
            <select id="opSelect" class="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none"></select>
          </div>
          <button type="button" id="addProdToOffer" class="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium">إضافة</button>
        </div>
        
        <div id="prodSuggest" class="hidden bg-white border border-gray-200 rounded-lg max-h-[200px] overflow-y-auto"></div>
        
        <div id="selectedItems" class="bg-gray-50 border border-gray-200 rounded-lg min-h-[60px] p-3">
          <div class="text-center text-gray-500">لم يتم إضافة أصناف بعد</div>
        </div>
      </div>

      <div class="col-span-full" id="excludedPicker" ${!state.editingIsGlobal ? 'style="display:none"' : ''}>
        <hr class="my-4 border-gray-200" />
        <label class="block text-sm font-semibold text-gray-700 mb-2">الأصناف المستثناة من العرض</label>
        <p class="text-xs text-gray-500 mb-3">العرض العام يطبق على جميع الأصناف ما عدا المستثناة</p>
        
        <div class="flex gap-2 items-end mb-2 flex-wrap">
          <div class="flex-1 min-w-[200px]">
            <input id="excludedSearch" placeholder="ابحث بالباركود أو اسم الصنف" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div id="excludedOpBox" style="display: none;">
            <select id="excludedOpSelect" class="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none"></select>
          </div>
          <button type="button" id="addExcludedToOffer" class="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium">استثناء</button>
        </div>
        
        <div id="excludedSuggest" class="hidden bg-white border border-gray-200 rounded-lg max-h-[200px] overflow-y-auto"></div>
        
        <div id="excludedItems" class="bg-gray-50 border border-gray-200 rounded-lg min-h-[60px] p-3">
          <div class="text-center text-gray-500">لا توجد أصناف مستثناة</div>
        </div>
      </div>
    </div>
  `;
}

function generateCouponForm(initialData = {}) {
  const data = {
    code: '',
    name: '',
    mode: 'percent',
    value: '',
    start_date: '',
    end_date: '',
    min_invoice_total: '',
    usage_limit: '',
    is_active: 1,
    ...initialData
  };
  
  return `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">رمز الكوبون *</label>
        <input id="c_code" placeholder="مثال: SAVE10" value="${data.code}" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">اسم/وصف الكوبون</label>
        <input id="c_name" placeholder="اختياري" value="${data.name}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">النوع *</label>
        <select id="c_mode" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="percent" ${data.mode === 'percent' ? 'selected' : ''}>نسبة %</option>
          <option value="cash" ${data.mode === 'cash' ? 'selected' : ''}>نقدي</option>
        </select>
      </div>
      
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">القيمة *</label>
        <input id="c_value" type="number" step="0.01" min="0" value="${data.value}" placeholder="0.00" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">من تاريخ</label>
        <input id="c_start" type="datetime-local" lang="en" value="${data.start_date ? new Date(data.start_date).toISOString().slice(0, 16) : ''}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">إلى تاريخ</label>
        <input id="c_end" type="datetime-local" lang="en" value="${data.end_date ? new Date(data.end_date).toISOString().slice(0, 16) : ''}" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">حد أدنى للفاتورة</label>
        <input id="c_min" type="number" step="0.01" min="0" value="${data.min_invoice_total}" placeholder="0.00" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">حد الاستخدام</label>
        <input id="c_limit" type="number" min="0" value="${data.usage_limit}" placeholder="غير محدود" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">الحالة</label>
        <select id="c_active" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="1" ${data.is_active ? 'selected' : ''}>نشط</option>
          <option value="0" ${!data.is_active ? 'selected' : ''}>موقوف</option>
        </select>
      </div>
    </div>
  `;
}

// Action Functions (Global for onclick handlers)
// =============================================

window.editOffer = async function(id) {
  if (!hasPermission('offers.edit')) return;
  
  try {
    const result = await window.api.offers_list({});
    const offer = (result.items || []).find(item => Number(item.id) === id);
    if (!offer) {
      await customAlert('العرض غير موجود');
      return;
    }
    
    state.editingType = 'offer';
    state.editingId = id;
    state.editingIsGlobal = Number(offer.is_global || 0);
    
    openModal('تعديل عرض', generateOfferForm(offer));
    initOfferForm();
    initExcludedProductsForm();
    
    // Load current products if not global
    if (!state.editingIsGlobal) {
      try {
        const productsResult = await window.api.offers_get_products(id);
        if (productsResult && productsResult.ok) {
          state.offerProducts = (productsResult.items || []).map(item => ({
            product_id: item.product_id,
            product_name: item.product_name || ('ID ' + item.product_id),
            operation_id: item.operation_id ?? null,
            operation_name: item.operation_name || ''
          }));
          renderSelectedProducts();
        }
      } catch (error) {
        console.warn('Error loading offer products:', error);
      }
    } else {
      try {
        const excludedResult = await window.api.offers_get_excluded_products(id);
        if (excludedResult && excludedResult.ok) {
          const excludedItems = excludedResult.items || [];
          state.offerExcludedProducts = [];
          
          for (const item of excludedItems) {
            try {
              const productResult = await window.api.products_get(item.product_id);
              const product = productResult && productResult.ok ? productResult.item : null;
              
              state.offerExcludedProducts.push({
                product_id: item.product_id,
                product_name: item.product_name || (product ? product.name : ('ID ' + item.product_id)),
                barcode: product ? (product.barcode || '') : '',
                price: product ? (product.price || 0) : 0,
                operation_id: item.operation_id ?? null,
                operation_name: item.operation_name || (item.operation_id == null ? 'كل العمليات' : '')
              });
            } catch (err) {
              console.warn('Error loading product details:', err);
              state.offerExcludedProducts.push({
                product_id: item.product_id,
                product_name: item.product_name || ('ID ' + item.product_id),
                barcode: '',
                price: 0,
                operation_id: item.operation_id ?? null,
                operation_name: item.operation_name || (item.operation_id == null ? 'كل العمليات' : '')
              });
            }
          }
          
          renderExcludedProducts();
        }
      } catch (error) {
        console.warn('Error loading excluded products:', error);
      }
    }
  } catch (error) {
    console.error('Error editing offer:', error);
    await customAlert('حدث خطأ في تحميل بيانات العرض');
  }
};

window.deleteOffer = async function(id) {
  if (!hasPermission('offers.delete')) return;
  const ok = await customConfirm('تأكيد الحذف', 'هل أنت متأكد من حذف هذا العرض؟\nسيتم حذف جميع البيانات المرتبطة به.');
  if (!ok) return;
  
  try {
    const result = await window.api.offers_delete(id);
    if (!result.ok) {
      await customAlert(result.error || 'فشل حذف العرض');
      return;
    }
    
    await loadData();
  } catch (error) {
    console.error('Error deleting offer:', error);
    await customAlert('حدث خطأ في حذف العرض');
  }
};

window.toggleOffer = async function(id) {
  if (!hasPermission('offers.toggle')) return;
  
  try {
    const result = await window.api.offers_toggle(id);
    if (!result.ok) {
      await customAlert(result.error || 'فشل تغيير حالة العرض');
      return;
    }
    
    await loadData();
  } catch (error) {
    console.error('Error toggling offer:', error);
    await customAlert('حدث خطأ في تغيير حالة العرض');
  }
};

window.editCoupon = async function(id) {
  if (!hasPermission('coupons.edit')) return;
  
  try {
    const result = await window.api.coupons_list({});
    const coupon = (result.items || []).find(item => Number(item.id) === id);
    if (!coupon) {
      await customAlert('الكوبون غير موجود');
      return;
    }
    
    state.editingType = 'coupon';
    state.editingId = id;
    
    openModal('تعديل كوبون', generateCouponForm(coupon));
  } catch (error) {
    console.error('Error editing coupon:', error);
    await customAlert('حدث خطأ في تحميل بيانات الكوبون');
  }
};

window.deleteCoupon = async function(id) {
  if (!hasPermission('coupons.delete')) return;
  const ok = await customConfirm('تأكيد الحذف', 'هل أنت متأكد من حذف هذا الكوبون؟');
  if (!ok) return;
  
  try {
    const result = await window.api.coupons_delete(id);
    if (!result.ok) {
      await customAlert(result.error || 'فشل حذف الكوبون');
      return;
    }
    
    await loadData();
  } catch (error) {
    console.error('Error deleting coupon:', error);
    await customAlert('حدث خطأ في حذف الكوبون');
  }
};

window.toggleCoupon = async function(id) {
  if (!hasPermission('coupons.toggle')) return;
  
  try {
    const result = await window.api.coupons_toggle(id);
    if (!result.ok) {
      await customAlert(result.error || 'فشل تغيير حالة الكوبون');
      return;
    }
    
    await loadData();
  } catch (error) {
    console.error('Error toggling coupon:', error);
    await customAlert('حدث خطأ في تغيير حالة الكوبون');
  }
};

// Save Function
// ============

async function saveForm() {
  if (state.editingType === 'offer') {
    await saveOffer();
  } else if (state.editingType === 'coupon') {
    await saveCoupon();
  } else if (state.editingType === 'qty_offer') {
    await saveQtyOffer();
  }
}

// Qty offers actions
window.toggleQtyOffer = async function(id){
  if (!hasPermission('offers.toggle_qty_offer')) return;
  try{
    const r = await window.api.offers_qty_toggle(id);
    if(!r || r.ok !== true){ await customAlert(r?.error || 'فشل تغيير الحالة'); return; }
    await loadData();
  }catch(e){ console.error(e); await customAlert('حدث خطأ'); }
};
window.deleteQtyOffer = async function(id){
  if (!hasPermission('offers.delete_qty_offer')) return;
  if(!await customConfirm('حذف العرض الكمي', 'هل أنت متأكد من حذف هذا العرض الكمي؟')) return;
  try{
    const r = await window.api.offers_qty_delete(id);
    if(!r || r.ok !== true){ await customAlert(r?.error || 'فشل الحذف'); return; }
    await loadData();
  }catch(e){ console.error(e); await customAlert('حدث خطأ'); }
};
window.editQtyOffer = async function(id){
  if (!hasPermission('offers.edit_qty_offer')) return;
  try{
    // Load rule via list and pick it (no dedicated get:id handler yet)
    const lr = await window.api.offers_qty_list({});
    const it = (lr && lr.ok) ? (lr.items||[]).find(x=>Number(x.id)===Number(id)) : null;
    if(!it){ await customAlert('العرض غير موجود'); return; }
    state.editingType = 'qty_offer';
    state.editingId = id;
    // Load linked products
    try{
      const pr = await window.api.offers_qty_get_products(id);
      state.offerProducts = (pr && pr.ok) ? (pr.items||[]).map(item => ({
        product_id: item.product_id,
        product_name: item.product_name || ('ID ' + item.product_id),
        operation_id: item.operation_id ?? null,
        operation_name: item.operation_name || '',
        mode: item.mode || 'percent',
        value: item.value || null
      })) : [];
    }catch(_){ state.offerProducts = []; }
    openModal('تعديل عرض كمي', generateQtyOfferForm(it));
    initOfferForm();
  }catch(e){ console.error(e); await customAlert('تعذر فتح العرض'); }
};

async function saveOffer() {
  const nameEl = document.getElementById('f_name');
  const descEl = document.getElementById('f_desc');
  const modeEl = document.getElementById('f_mode');
  const valueEl = document.getElementById('f_value');
  const startEl = document.getElementById('f_start');
  const endEl = document.getElementById('f_end');
  const activeEl = document.getElementById('f_active');
  
  // Validation
  if (!nameEl?.value?.trim()) {
    await customAlert('اسم العرض مطلوب');
    nameEl?.focus();
    return;
  }
  
  if (!valueEl?.value || Number(valueEl.value) <= 0) {
    await customAlert('قيمة العرض مطلوبة ويجب أن تكون أكبر من صفر');
    valueEl?.focus();
    return;
  }
  
  const payload = {
    name: nameEl.value.trim(),
    description: descEl?.value?.trim() || null,
    mode: modeEl?.value || 'percent',
    value: Number(valueEl?.value || 0),
    start_date: startEl?.value || null,
    end_date: endEl?.value || null,
    is_active: Number(activeEl?.value || 1),
    is_global: state.editingIsGlobal
  };
  
  try {
    let offerId = state.editingId;
    let result;
    
    if (state.editingId) {
      result = await window.api.offers_update(state.editingId, payload);
    } else {
      result = await window.api.offers_add(payload);
      offerId = result.id;
    }
    
    if (!result.ok) {
      await customAlert(result.error || 'فشل حفظ العرض');
      return;
    }
    
    // Save product links for non-global offers
    if (offerId && !state.editingIsGlobal) {
      const products = state.offerProducts.map(item => ({
        product_id: item.product_id,
        operation_id: item.operation_id
      }));
      
      const linkResult = await window.api.offers_set_products(offerId, products);
      if (!linkResult.ok) {
        console.warn('Error saving product links:', linkResult.error);
      }
    }
    
    // Save excluded products for global offers
    if (offerId && state.editingIsGlobal) {
      const excludedProducts = state.offerExcludedProducts.map(item => ({
        product_id: item.product_id,
        operation_id: item.operation_id
      }));
      
      const excludedResult = await window.api.offers_set_excluded_products(offerId, excludedProducts);
      if (!excludedResult.ok) {
        console.warn('Error saving excluded products:', excludedResult.error);
      }
      
      // Clear offers cache in sales screens
      try {
        localStorage.setItem('clear_offers_cache', Date.now().toString());
        localStorage.removeItem('clear_offers_cache');
      } catch (e) {
        console.warn('Error clearing cache signal:', e);
      }
    }
    
    closeModal();
    await loadData();
  } catch (error) {
    console.error('Error saving offer:', error);
    await customAlert('حدث خطأ في حفظ العرض');
  }
}

async function saveQtyOffer() {
  const nameEl = document.getElementById('q_name');
  const descEl = document.getElementById('q_desc');
  const buyEl = document.getElementById('q_buy');
  const nthEl = document.getElementById('q_nth');
  const modeEl = document.getElementById('q_mode');
  const valueEl = document.getElementById('q_value');
  const startEl = document.getElementById('q_start');
  const endEl = document.getElementById('q_end');
  const groupEl = document.getElementById('q_group');
  const activeEl = document.getElementById('q_active');

  if (!nameEl?.value?.trim()) { await customAlert('اسم العرض مطلوب'); nameEl?.focus(); return; }
  const buyQty = Number(buyEl?.value || 0);
  if (!buyQty || buyQty < 1) { await customAlert('قيمة الشراء (X) يجب أن تكون 1 أو أكثر'); buyEl?.focus(); return; }
  
  const hasProductSpecificDiscounts = state.offerProducts.some(p => p.mode && p.value && Number(p.value) > 0);
  const hasGeneralDiscount = valueEl?.value && Number(valueEl.value) > 0;
  
  if (!hasProductSpecificDiscounts && !hasGeneralDiscount) {
    await customAlert('يجب تحديد خصم عام أو تحديد خصم لكل منتج');
    valueEl?.focus();
    return;
  }

  const payload = {
    name: nameEl.value.trim(),
    description: descEl?.value?.trim() || null,
    buy_qty: buyQty,
    nth: Math.max(1, Number(nthEl?.value || 1)),
    mode: modeEl?.value || 'percent',
    value: valueEl?.value ? Number(valueEl.value) : 0,
    start_date: startEl?.value || null,
    end_date: endEl?.value || null,
    per_group: Number(groupEl?.value || 1),
    is_active: Number(activeEl?.value || 1)
  };

  try {
    let ruleId = state.editingId;
    let result;
    if (state.editingId) {
      result = await window.api.offers_qty_update(state.editingId, payload);
    } else {
      result = await window.api.offers_qty_add(payload);
      ruleId = result.id;
    }
    if (!result.ok) { await customAlert(result.error || 'فشل حفظ العرض الكمي'); return; }

    if (ruleId) {
      const products = state.offerProducts.map(item => ({ 
        product_id: item.product_id, 
        operation_id: item.operation_id,
        mode: item.mode || null,
        value: item.value || null
      }));
      const linkResult = await window.api.offers_qty_set_products(ruleId, products);
      if (!linkResult.ok) { console.warn('Error saving qty products:', linkResult.error); }
    }

    closeModal();
    await loadData();
  } catch (error) {
    console.error('Error saving qty offer:', error);
    await customAlert('حدث خطأ في حفظ العرض الكمي');
  }
}

async function saveCoupon() {
  const codeEl = document.getElementById('c_code');
  const nameEl = document.getElementById('c_name');
  const modeEl = document.getElementById('c_mode');
  const valueEl = document.getElementById('c_value');
  const startEl = document.getElementById('c_start');
  const endEl = document.getElementById('c_end');
  const minEl = document.getElementById('c_min');
  const limitEl = document.getElementById('c_limit');
  const activeEl = document.getElementById('c_active');
  
  // Validation
  if (!codeEl?.value?.trim()) {
    await customAlert('رمز الكوبون مطلوب');
    codeEl?.focus();
    return;
  }
  
  if (!valueEl?.value || Number(valueEl.value) <= 0) {
    await customAlert('قيمة الكوبون مطلوبة ويجب أن تكون أكبر من صفر');
    valueEl?.focus();
    return;
  }
  
  const payload = {
    code: codeEl.value.trim(),
    name: nameEl?.value?.trim() || null,
    mode: modeEl?.value || 'percent',
    value: Number(valueEl?.value || 0),
    start_date: startEl?.value || null,
    end_date: endEl?.value || null,
    min_invoice_total: minEl?.value ? Number(minEl.value) : null,
    usage_limit: limitEl?.value ? Number(limitEl.value) : null,
    is_active: Number(activeEl?.value || 1)
  };
  
  try {
    let result;
    
    if (state.editingId) {
      result = await window.api.coupons_update(state.editingId, payload);
    } else {
      result = await window.api.coupons_add(payload);
    }
    
    if (!result.ok) {
      await customAlert(result.error || 'فشل حفظ الكوبون');
      return;
    }
    
    closeModal();
    await loadData();
  } catch (error) {
    console.error('Error saving coupon:', error);
    await customAlert('حدث خطأ في حفظ الكوبون');
  }
}

// Product Selection for Offers
// ============================

function renderSelectedProducts() {
  const container = document.getElementById('selectedItems');
  if (!container) return;
  
  if (!state.offerProducts.length) {
    container.innerHTML = '<div class="text-muted text-center">لم يتم إضافة أصناف بعد</div>';
    return;
  }
  
  const isQtyOffer = state.editingType === 'qty_offer';
  
  container.innerHTML = state.offerProducts.map((product, index) => `
    <div class="selected-product" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-bottom: 1px solid var(--border); background: var(--gray-50); margin-bottom: 0.5rem; border-radius: 0.5rem;">
      <div style="flex: 1;">
        <strong>${product.product_name}</strong>
        ${product.operation_name ? `<span class="badge badge-secondary" style="margin-right: 0.5rem;">${product.operation_name}</span>` : ''}
      </div>
      ${isQtyOffer ? `
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <select class="form-select" style="width: 110px; padding: 0.35rem 0.5rem; font-size: 13px;" onchange="updateProductDiscount(${index}, 'mode', this.value)">
            <option value="percent" ${(product.mode === 'percent' || !product.mode) ? 'selected' : ''}>نسبة %</option>
            <option value="cash" ${product.mode === 'cash' ? 'selected' : ''}>نقدي</option>
          </select>
          <input type="number" class="form-input" style="width: 90px; padding: 0.35rem 0.5rem; font-size: 13px;" step="0.01" min="0" placeholder="قيمة" value="${product.value || ''}" onchange="updateProductDiscount(${index}, 'value', this.value)" />
        </div>
      ` : ''}
      <button type="button" class="btn btn-danger btn-sm" onclick="removeProduct(${index})">حذف</button>
    </div>
  `).join('');
}

window.removeProduct = function(index) {
  state.offerProducts.splice(index, 1);
  renderSelectedProducts();
};

window.updateProductDiscount = function(index, field, value) {
  if (state.offerProducts[index]) {
    if (field === 'mode') {
      state.offerProducts[index].mode = value;
    } else if (field === 'value') {
      state.offerProducts[index].value = value ? Number(value) : null;
    }
  }
};

function initOfferForm() {
  const prodSearch = document.getElementById('prodSearch');
  const prodSuggest = document.getElementById('prodSuggest');
  const opBox = document.getElementById('opBox');
  const opSelect = document.getElementById('opSelect');
  const discountBox = document.getElementById('discountBox');
  const discountValueBox = document.getElementById('discountValueBox');
  const itemDiscountMode = document.getElementById('itemDiscountMode');
  const itemDiscountValue = document.getElementById('itemDiscountValue');
  const addBtn = document.getElementById('addProdToOffer');
  
  if (!prodSearch || !addBtn) return;
  
  let selectedProductId = null;
  let selectedProductName = '';
  let searchTimeout = null;
  
  // Product search functionality
  prodSearch.addEventListener('input', function() {
    const query = this.value.trim();
    
    clearTimeout(searchTimeout);
    
    if (!query) {
      prodSuggest.classList.add('hidden');
      if (opBox) opBox.style.display = 'none';
      if (discountBox) discountBox.style.display = 'none';
      if (discountValueBox) discountValueBox.style.display = 'none';
      selectedProductId = null;
      selectedProductName = '';
      return;
    }
    
    searchTimeout = setTimeout(async () => {
      try {
        let products = [];
        
        // Try barcode search first
        try {
          const barcodeResult = await window.api.products_get_by_barcode(query);
          if (barcodeResult && barcodeResult.ok && barcodeResult.item) {
            products = [barcodeResult.item];
          }
        } catch (e) {
          console.warn('Barcode search failed:', e);
        }
        
        // If no barcode match, try name search
        if (!products.length) {
          const searchResult = await window.api.products_list({ q: query });
          products = (searchResult && searchResult.ok) ? (searchResult.items || []) : [];
        }
        
        showProductSuggestions(products);
      } catch (error) {
        console.error('Product search error:', error);
        prodSuggest.classList.add('hidden');
      }
    }, 300);
  });
  
  function showProductSuggestions(products) {
    if (!products.length) {
      prodSuggest.classList.add('hidden');
      return;
    }
    
    prodSuggest.innerHTML = products.slice(0, 10).map(product => `
      <div class="suggestion-item" style="padding: 0.5rem; cursor: pointer; border-bottom: 1px solid var(--border);" 
           onclick="selectProduct(${product.id}, '${(product.name || '').replace(/'/g, '\\\'')}')"
           onmouseover="this.style.backgroundColor='var(--bg)'" 
           onmouseout="this.style.backgroundColor='transparent'">
        <strong>${product.name || ''}</strong>
        ${product.barcode ? `<br><small class="text-muted">${product.barcode}</small>` : ''}
      </div>
    `).join('');
    
    prodSuggest.classList.remove('hidden');
  }
  
  window.selectProduct = async function(productId, productName) {
    selectedProductId = productId;
    selectedProductName = productName;
    prodSearch.value = productName;
    prodSuggest.classList.add('hidden');
    
    // Load operations for this product
    try {
      const result = await window.api.prod_ops_list(productId);
      const operations = (result && result.ok) ? (result.items || []) : [];
      
      if (operations.length) {
        opSelect.innerHTML = operations.map(op => 
          `<option value="${op.operation_id || op.id}">${op.name}</option>`
        ).join('');
        opBox.style.display = 'block';
      } else {
        opSelect.innerHTML = '';
        opBox.style.display = 'none';
      }
    } catch (error) {
      console.warn('Error loading operations:', error);
      opSelect.innerHTML = '';
      opBox.style.display = 'none';
    }
    
    if (state.editingType === 'qty_offer' && discountBox && discountValueBox) {
      discountBox.style.display = 'block';
      discountValueBox.style.display = 'block';
      if (itemDiscountMode) itemDiscountMode.value = 'percent';
      if (itemDiscountValue) itemDiscountValue.value = '';
    }
  };
  
  addBtn.addEventListener('click', async function() {
    if (!selectedProductId) {
      await customAlert('اختر الصنف من قائمة البحث');
      return;
    }
    
    let operationId = null;
    let operationName = '';
    
    if (opBox.style.display !== 'none' && opSelect.value) {
      operationId = Number(opSelect.value);
      operationName = opSelect.selectedOptions[0]?.textContent || '';
    }
    
    // Check if already added
    const exists = state.offerProducts.some(p => 
      p.product_id === selectedProductId && p.operation_id === operationId
    );
    
    if (exists) {
      await customAlert('هذا الصنف مضاف بالفعل');
      return;
    }
    
    const newProduct = {
      product_id: selectedProductId,
      product_name: selectedProductName,
      operation_id: operationId,
      operation_name: operationName
    };
    
    if (state.editingType === 'qty_offer') {
      const mode = itemDiscountMode?.value || 'percent';
      const value = itemDiscountValue?.value ? Number(itemDiscountValue.value) : null;
      newProduct.mode = mode;
      newProduct.value = value;
    }
    
    state.offerProducts.push(newProduct);
    
    // Reset form
    prodSearch.value = '';
    prodSuggest.classList.add('hidden');
    opBox.style.display = 'none';
    opSelect.innerHTML = '';
    if (discountBox) discountBox.style.display = 'none';
    if (discountValueBox) discountValueBox.style.display = 'none';
    if (itemDiscountMode) itemDiscountMode.value = 'percent';
    if (itemDiscountValue) itemDiscountValue.value = '';
    selectedProductId = null;
    selectedProductName = '';
    
    renderSelectedProducts();
  });
  
  renderSelectedProducts();
}

function initExcludedProductsForm() {
  const excludedSearch = document.getElementById('excludedSearch');
  const excludedSuggest = document.getElementById('excludedSuggest');
  const excludedOpBox = document.getElementById('excludedOpBox');
  const excludedOpSelect = document.getElementById('excludedOpSelect');
  const addExcludedBtn = document.getElementById('addExcludedToOffer');
  
  if (!excludedSearch || !addExcludedBtn) return;
  
  let selectedProductId = null;
  let selectedProductName = '';
  let selectedBarcode = '';
  let selectedPrice = '';
  let searchTimeout = null;
  
  excludedSearch.addEventListener('input', function() {
    const query = this.value.trim();
    
    clearTimeout(searchTimeout);
    
    if (!query) {
      excludedSuggest.classList.add('hidden');
      if (excludedOpBox) excludedOpBox.style.display = 'none';
      selectedProductId = null;
      selectedProductName = '';
      selectedBarcode = '';
      selectedPrice = '';
      return;
    }
    
    searchTimeout = setTimeout(async () => {
      try {
        let products = [];
        
        try {
          const barcodeResult = await window.api.products_get_by_barcode(query);
          if (barcodeResult && barcodeResult.ok && barcodeResult.item) {
            products = [barcodeResult.item];
          }
        } catch (e) {
          console.warn('Barcode search failed:', e);
        }
        
        if (!products.length) {
          const searchResult = await window.api.products_list({ q: query });
          products = (searchResult && searchResult.ok) ? (searchResult.items || []) : [];
        }
        
        showExcludedSuggestions(products);
      } catch (error) {
        console.error('Product search error:', error);
        excludedSuggest.classList.add('hidden');
      }
    }, 300);
  });
  
  function showExcludedSuggestions(products) {
    if (!products.length) {
      excludedSuggest.classList.add('hidden');
      return;
    }
    
    excludedSuggest.innerHTML = products.slice(0, 10).map(product => `
      <div class="suggestion-item p-3 cursor-pointer border-b border-gray-200 hover:bg-gray-50" 
           onclick="selectExcludedProduct(${product.id}, '${(product.name || '').replace(/'/g, '\\\'').replace(/"/g, '&quot;')}', '${(product.barcode || '').replace(/'/g, '\\\'').replace(/"/g, '&quot;')}', ${product.price || 0})">
        <div class="font-semibold text-gray-900">${product.name || ''}</div>
        <div class="text-xs text-gray-600 mt-1">
          <span class="inline-block ml-3">الباركود: ${product.barcode || 'غير محدد'}</span>
          <span class="inline-block">السعر: ${Number(product.price || 0).toFixed(2)} ريال</span>
        </div>
      </div>
    `).join('');
    
    excludedSuggest.classList.remove('hidden');
  }
  
  window.selectExcludedProduct = async function(productId, productName, barcode, price) {
    selectedProductId = productId;
    selectedProductName = productName;
    selectedBarcode = barcode;
    selectedPrice = price;
    excludedSearch.value = productName;
    excludedSuggest.classList.add('hidden');
    
    try {
      const result = await window.api.prod_ops_list(productId);
      const operations = (result && result.ok) ? (result.items || []) : [];
      
      if (operations.length) {
        excludedOpSelect.innerHTML = `<option value="">-- كل العمليات --</option>` + operations.map(op => 
          `<option value="${op.operation_id || op.id}">${op.name}</option>`
        ).join('');
        excludedOpBox.style.display = 'block';
      } else {
        excludedOpSelect.innerHTML = '';
        excludedOpBox.style.display = 'none';
      }
    } catch (error) {
      console.warn('Error loading operations:', error);
      excludedOpSelect.innerHTML = '';
      excludedOpBox.style.display = 'none';
    }
  };
  
  addExcludedBtn.addEventListener('click', async function() {
    if (!selectedProductId) {
      await customAlert('اختر الصنف من قائمة البحث');
      return;
    }
    
    let operationId = null;
    let operationName = '';
    
    if (excludedOpBox.style.display !== 'none') {
      if(excludedOpSelect.value){
        operationId = Number(excludedOpSelect.value);
        operationName = excludedOpSelect.selectedOptions[0]?.textContent || '';
      } else {
        // All operations selected
        operationId = null;
        operationName = 'كل العمليات';
      }
    }
    
    const exists = state.offerExcludedProducts.some(p => 
      p.product_id === selectedProductId && p.operation_id === operationId
    );
    
    if (exists) {
      await customAlert('هذا الصنف مستثنى بالفعل');
      return;
    }
    
    state.offerExcludedProducts.push({
      product_id: selectedProductId,
      product_name: selectedProductName,
      barcode: selectedBarcode,
      price: selectedPrice,
      operation_id: operationId,
      operation_name: operationName
    });
    
    excludedSearch.value = '';
    excludedSuggest.classList.add('hidden');
    excludedOpBox.style.display = 'none';
    excludedOpSelect.innerHTML = '';
    selectedProductId = null;
    selectedProductName = '';
    selectedBarcode = '';
    selectedPrice = '';
    
    renderExcludedProducts();
  });
  
  renderExcludedProducts();
}

function renderExcludedProducts() {
  const container = document.getElementById('excludedItems');
  if (!container) return;
  
  if (!state.offerExcludedProducts.length) {
    container.innerHTML = '<div class="text-center text-gray-500">لا توجد أصناف مستثناة</div>';
    return;
  }
  
  container.innerHTML = state.offerExcludedProducts.map((item, index) => `
    <div class="flex items-center justify-between p-2 mb-2 bg-white border border-gray-200 rounded-lg">
      <div class="flex-1">
        <div class="font-semibold text-gray-900">${item.product_name}</div>
        <div class="text-xs text-gray-600 mt-1">
          <span class="inline-block ml-3">الباركود: ${item.barcode || 'غير محدد'}</span>
          <span class="inline-block">السعر: ${Number(item.price || 0).toFixed(2)} ريال</span>
          ${item.operation_name ? `<span class="inline-block mr-3">الوحدة: ${item.operation_name}</span>` : ''}
        </div>
      </div>
      <button type="button" 
              onclick="removeExcludedProduct(${index})"
              class="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium mr-2">
        حذف
      </button>
    </div>
  `).join('');
}

window.removeExcludedProduct = function(index) {
  state.offerExcludedProducts.splice(index, 1);
  renderExcludedProducts();
};

// Event Handlers Setup
// ===================

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('text-blue-600', 'border-blue-600');
    btn.classList.add('text-gray-600', 'border-transparent');
  });
  
  document.querySelectorAll('.tab-content').forEach(pane => {
    pane.classList.remove('active');
  });
  
  const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  const activePane = document.getElementById(`${tabName}-tab`);
  
  if (activeBtn) {
    activeBtn.classList.remove('text-gray-600', 'border-transparent');
    activeBtn.classList.add('text-blue-600', 'border-blue-600');
  }
  if (activePane) activePane.classList.add('active');
}

function setupEventHandlers() {
  // Navigation
  elements.backBtn?.addEventListener('click', () => {
    window.location.href = '../main/index.html';
  });
  
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
  
  // Modal
  elements.cancelModal?.addEventListener('click', closeModal);
  elements.saveModal?.addEventListener('click', saveForm);
  
  // Click outside modal to close
  elements.modalBackdrop?.addEventListener('click', (e) => {
    if (e.target === elements.modalBackdrop) {
      closeModal();
    }
  });
  
  // Search
  elements.searchBtn?.addEventListener('click', loadData);
  elements.refreshBtn?.addEventListener('click', () => {
    elements.searchBox.value = '';
    loadData();
  });
  
  elements.searchBox?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      loadData();
    }
  });
  
  // Add buttons
  elements.addOfferBtn?.addEventListener('click', () => {
    if (!hasPermission('offers.add')) return;
    
    state.editingType = 'offer';
    state.editingId = null;
    state.editingIsGlobal = 0;
    state.offerProducts = [];
    
    openModal('إضافة عرض جديد', generateOfferForm({ mode: 'percent', is_active: 1 }));
    initOfferForm();
    initExcludedProductsForm();
  });
  
  elements.globalOfferTab?.addEventListener('click', () => {
    switchTab('global-offers');
  });
  
  elements.addGlobalOfferBtn?.addEventListener('click', async () => {
    if (!hasPermission('offers.add_global')) return;
    
    try {
      const result = await window.api.offers_list({});
      const hasGlobal = (result.items || []).some(offer => Number(offer.is_global || 0) === 1);
      
      if (hasGlobal) {
        await customAlert('يوجد عرض عام بالفعل. احذف العرض الحالي قبل إضافة عرض عام جديد.');
        return;
      }
    } catch (error) {
      console.warn('Error checking global offers:', error);
    }
    
    state.editingType = 'offer';
    state.editingId = null;
    state.editingIsGlobal = 1;
    state.offerProducts = [];
    state.offerExcludedProducts = [];
    
    openModal('إضافة عرض عام', generateOfferForm({ mode: 'percent', is_active: 1 }));
    initOfferForm();
    initExcludedProductsForm();
  });
  
  elements.addCouponBtn?.addEventListener('click', () => {
    if (!hasPermission('coupons.add')) return;
    
    state.editingType = 'coupon';
    state.editingId = null;
    
    openModal('إضافة كوبون جديد', generateCouponForm({ mode: 'percent', is_active: 1 }));
  });
  
  // Quantity Offer button -> open full form
  elements.addQtyOfferBtn?.addEventListener('click', () => {
    if (!hasPermission('offers.add_qty_offer')) return;
    
    state.editingType = 'qty_offer';
    state.editingId = null;
    state.offerProducts = [];
    
    openModal('إضافة عرض كمي', generateQtyOfferForm({ mode: 'percent', is_active: 1, per_group: 1, buy_qty: 3, nth: 1 }));
    initOfferForm();
  });
}

// Initialize permissions-based UI
async function initializePermissions() {
  await loadPermissions();
  
  // Hide buttons based on permissions
  if (!hasPermission('offers.add') && elements.addOfferBtn) {
    elements.addOfferBtn.style.display = 'none';
  }
  
  if (!hasPermission('offers.add_global') && elements.addGlobalOfferBtn) {
    elements.addGlobalOfferBtn.style.display = 'none';
  }
  
  if (!hasPermission('coupons.add') && elements.addCouponBtn) {
    elements.addCouponBtn.style.display = 'none';
  }
  
  // Hide quantity-offer button if no offers.add_qty_offer permission
  if (!hasPermission('offers.add_qty_offer') && elements.addQtyOfferBtn) {
    elements.addQtyOfferBtn.style.display = 'none';
  }
}

// Application Initialization
// =========================

async function initialize() {
  try {
    await initializePermissions();
    setupEventHandlers();
    await loadData();
  } catch (error) {
    console.error('Initialization error:', error);
    showEmpty(elements.offersTbody, 'حدث خطأ في تحميل التطبيق');
    showEmpty(elements.couponsTbody, 'حدث خطأ في تحميل التطبيق');
  }
}

// Start the application
initialize();