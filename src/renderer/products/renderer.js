// Products screen: modal add + list/edit/delete/toggle
const tbody = document.getElementById('tbody');
const errorDiv = document.getElementById('error');
const addBtn = document.getElementById('addBtn');
const saveOrderBtn = document.getElementById('saveOrderBtn');
let activeTypes = new Set(); // الأنواع الرئيسية النشطة فقط
const btnExportProductsPdf = document.getElementById('btnExportProductsPdf');
const btnExportProductsCsv = document.getElementById('btnExportProductsCsv');

// Translation helper for exports
const TR_PRODUCTS = {
  ar: {
    '#': '#',
    'الاسم': 'الاسم',
    'الباركود': 'الباركود',
    'سعر الشراء': 'سعر الشراء',
    'سعر البيع': 'سعر البيع',
    'العمليات وأسعارها': 'العمليات وأسعارها',
    'المخزون': 'المخزون',
    'إجمالي الشراء': 'إجمالي الشراء',
    'إجمالي البيع': 'إجمالي البيع',
    'صافي الربح': 'صافي الربح',
    'الفئة': 'الفئة',
    'الحالة': 'الحالة',
    'السعر': 'السعر',
    'التكلفة': 'التكلفة',
    'نشط': 'نشط',
    'موقوف': 'موقوف',
    'غير نشطة': 'غير نشطة',
    'قائمة المنتجات مع الأسعار والعمليات والربحية': 'قائمة المنتجات مع الأسعار والعمليات والربحية',
    'تقرير المنتجات': 'تقرير المنتجات',
    'تقرير المنتج': 'تقرير المنتج',
    'تفاصيل المنتج': 'تفاصيل المنتج',
    'العملية': 'العملية',
    'لا توجد عمليات': 'لا توجد عمليات',
    'تعذر إنشاء PDF': 'تعذر إنشاء PDF',
    'تعذر إنشاء PDF للمنتج': 'تعذر إنشاء PDF للمنتج'
  },
  en: {
    '#': '#',
    'الاسم': 'Name',
    'الباركود': 'Barcode',
    'سعر الشراء': 'Purchase price',
    'سعر البيع': 'Sale price',
    'العمليات وأسعارها': 'Operations & prices',
    'المخزون': 'Stock',
    'إجمالي الشراء': 'Total purchase',
    'إجمالي البيع': 'Total sales',
    'صافي الربح': 'Net profit',
    'الفئة': 'Category',
    'الحالة': 'Status',
    'السعر': 'Price',
    'التكلفة': 'Cost',
    'نشط': 'Active',
    'موقوف': 'Inactive',
    'غير نشطة': 'Inactive',
    'قائمة المنتجات مع الأسعار والعمليات والربحية': 'Products list with prices, operations and profitability',
    'تقرير المنتجات': 'Products report',
    'تقرير المنتج': 'Product report',
    'تفاصيل المنتج': 'Product details',
    'العملية': 'Operation',
    'لا توجد عمليات': 'No operations',
    'تعذر إنشاء PDF': 'Failed to create PDF',
    'تعذر إنشاء PDF للمنتج': 'Failed to create product PDF'
  }
};

async function getAppLang() {
  try {
    const r = await window.api.app_get_locale();
    return (r && r.lang === 'en') ? 'en' : 'ar';
  } catch (_) {
    return 'ar';
  }
}

function t(key) {
  const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
  return (TR_PRODUCTS[lang] && TR_PRODUCTS[lang][key]) || key;
}

// Settings: show/hide selling units section
let showSellingUnits = true; // default
async function loadSellingUnitsVisibility(){
  try{
    const r = await window.api.settings_get();
    if(r && r.ok && r.item){
      showSellingUnits = (r.item.show_selling_units === undefined || r.item.show_selling_units === null) ? true : !!r.item.show_selling_units;
    }
    applySellingUnitsVisibility();
  }catch(_){ showSellingUnits = true; applySellingUnitsVisibility(); }
}
function applySellingUnitsVisibility(){
  const unitsBox = document.getElementById('unitsBox');
  if(unitsBox && unitsBox.parentElement){
    unitsBox.parentElement.style.display = showSellingUnits ? '' : 'none';
  }
}
// Load on page load
(async ()=>{ await loadSellingUnitsVisibility(); })();

// Performance optimization: Advanced debounce & throttle
let searchTimeout;
function debounceSearch(fn, delay = 100) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(fn, delay);
}

// Throttle for expensive operations
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Check if device is primary (main) or secondary
let isMainDevice = true; // default to main device (no cache)
async function checkDeviceType() {
  try {
    const r = await window.api.db_get_config();
    if (r && r.ok && r.config) {
      const host = (r.config.host || '').toLowerCase();
      // Main device uses localhost/127.0.0.1, secondary uses remote IP
      isMainDevice = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    }
  } catch(_) {
    isMainDevice = true; // default to main device on error
  }
}
// Check device type on load
(async ()=>{ await checkDeviceType(); })();
// Request deduplication & caching with memory management
const requestCache = new Map();
const MAX_CACHE_SIZE = 50;

async function cachedRequest(cacheKey, asyncFn, ttl = 2000) {
  // Main device: no cache, direct DB access
  if (isMainDevice) {
    return await asyncFn();
  }
  
  // Secondary device: use cache
  if (requestCache.has(cacheKey)) {
    const cached = requestCache.get(cacheKey);
    if (Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
  }
  
  const result = await asyncFn();
  
  if (requestCache.size >= MAX_CACHE_SIZE) {
    const firstKey = requestCache.keys().next().value;
    requestCache.delete(firstKey);
  }
  
  requestCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

// Cache cleanup only for secondary devices
setInterval(() => {
  if (isMainDevice) return; // Skip cleanup on main device
  
  const now = Date.now();
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > 60000) {
      requestCache.delete(key);
    }
  }
}, 30000);

// Polyfill for requestIdleCallback for older browsers
if (!window.requestIdleCallback) {
  window.requestIdleCallback = function(cb) {
    const start = Date.now();
    return setTimeout(function() {
      cb({
        didTimeout: false,
        timeRemaining: function() {
          return Math.max(0, 50.0 - (Date.now() - start));
        }
      });
    }, 1);
  };
}

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
function hasProd(k){ return __perms.has('products') && __perms.has(k); }
function applyTopPermissions(){
  if(addBtn && !hasProd('products.add')) addBtn.style.display='none';
  if(btnExportProductsPdf && !hasProd('products.export_pdf')) btnExportProductsPdf.style.display='none';
  if(btnExportProductsCsv && !hasProd('products.export_csv')) btnExportProductsCsv.style.display='none';
  if(saveOrderBtn && !hasProd('products.reorder')) saveOrderBtn.style.display='none';
}
// initial load perms and apply
(async ()=>{ await loadPerms(); applyTopPermissions(); })();

// dialog fields
const dlg = document.getElementById('dlg');
const dlgTitle = document.getElementById('dlgTitle');
const f_name = document.getElementById('f_name');
const f_barcode = document.getElementById('f_barcode');
const f_name_en = document.getElementById('f_name_en');
const f_price = document.getElementById('f_price');
const f_cost = document.getElementById('f_cost');
const f_stock = document.getElementById('f_stock');
const f_category = document.getElementById('f_category');
const f_is_tobacco = document.getElementById('f_is_tobacco');
const f_hide_from_sales = document.getElementById('f_hide_from_sales');

// Toggle barcode field visibility (hide in Add, show in Edit)
const barcodeWrap = f_barcode ? f_barcode.closest('div') : null;
function setBarcodeVisible(show){ if(barcodeWrap) barcodeWrap.style.display = show ? '' : 'none'; }

async function populateCategories(){
  try{
    const res = await window.api.types_list();
    f_category.innerHTML = '';
    const def = document.createElement('option');
    def.value = '';
    def.textContent = 'اختر النوع الرئيسي';
    f_category.appendChild(def);
    if(res && res.ok){
      (res.items||[]).forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.name; // نخزن الاسم كقيمة الفئة
        opt.textContent = t.name;
        f_category.appendChild(opt);
      });
    }
  }catch(e){ /* ignore */ }
}

async function populateFilterCategories(){
  try{
    const filterCategoryEl = document.getElementById('filter_category');
    if(!filterCategoryEl) return;
    
    const res = await window.api.types_list();
    filterCategoryEl.innerHTML = '';
    const def = document.createElement('option');
    def.value = '';
    def.textContent = t('كل الفئات');
    filterCategoryEl.appendChild(def);
    
    if(res && res.ok){
      (res.items||[]).forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.name;
        opt.textContent = t.name;
        filterCategoryEl.appendChild(opt);
      });
    }
  }catch(e){ /* ignore */ }
}

// عند فتح نموذج الإضافة نُحدّث القائمة
// Ensure dialog opens reliably and inputs can receive focus (Electron focus quirk workaround)
function safeShowModal(d){ try{ d.showModal(); } catch(_){ try{ d.close(); d.showModal(); }catch(__){} } }
function focusFirstField(){ try{ window.focus(); setTimeout(()=>{ f_name?.focus(); f_name?.select(); }, 0); }catch(_){} }
function openAddDialog(){ editId=null; dlgTitle.textContent='إضافة منتج'; clearDialog(); populateCategories(); loadAllOps(); safeShowModal(dlg); focusFirstField(); }
const f_description = document.getElementById('f_description');
const dlgSave = document.getElementById('dlgSave');
const dlgCancel = document.getElementById('dlgCancel');

let editId = null; // track edit product id

function setError(msg){
  const m = msg || '';
  const dlgErr = document.getElementById('dlgError');
  if(dlgErr && dlg.open){ dlgErr.textContent = m; }
  else { errorDiv.textContent = m; }
}
// Normalize Arabic-Indic digits to ASCII for barcode/search
function normalizeDigits(s){
  if(!s) return '';
  return String(s).replace(/[\u0660-\u0669\u06F0-\u06F9]/g, ch => {
    const code = ch.charCodeAt(0);
    if(code>=0x0660 && code<=0x0669) return String(code - 0x0660);
    if(code>=0x06F0 && code<=0x06F9) return String(code - 0x06F0);
    return ch;
  }).trim();
}
const f_thumb = document.getElementById('f_thumb');
const pickImageBtn = document.getElementById('pickImage');
const removeImageBtn = document.getElementById('removeImage');
let pickedImagePath = null;

const opSelect = document.getElementById('opSelect');
const opPrice = document.getElementById('opPrice');
const opAdd = document.getElementById('opAdd');
const opList = document.getElementById('opList');
let allOps = [];
let prodOps = []; // [{operation_id, name, price}]
let prodUnits = []; // [{ unit_name, multiplier, price_mode, price }]
let prodVariants = []; // [{variant_name, barcode, price, cost, stock_deduct_multiplier, is_active}] - for new products, after edit will have id
let initialVariantIds = new Set(); // track existing variant IDs at dialog open to detect deletions

async function loadAllOps(){
  try{
    // Use cached operations for better performance
    const r = await cachedRequest('ops_list', () => window.api.ops_list(), 10000);
    allOps = r.ok ? (r.items||[]).filter(o=>o.is_active) : [];
    opSelect.innerHTML='';
    const d = document.createElement('option'); d.value=''; d.textContent='اختر عملية'; opSelect.appendChild(d);
    
    // Use DocumentFragment for batch DOM insertion
    const fragment = document.createDocumentFragment();
    allOps.forEach(o=>{ 
      const opt=document.createElement('option'); 
      opt.value=String(o.id); 
      opt.textContent=o.name; 
      fragment.appendChild(opt); 
    });
    opSelect.appendChild(fragment);
  }catch(_){ allOps=[]; }
}

function renderProdOps(){
  opList.innerHTML='';
  prodOps.forEach((it, idx) => {
    const row = document.createElement('div');
    row.style.display='flex'; row.style.gap='8px'; row.style.alignItems='center';
    row.innerHTML = `<div style="flex:1">${it.name}</div>
      <div style="width:150px; text-align:left">${Number(it.price).toFixed(2)}</div>
      <button class="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-medium" data-act="edit" data-idx="${idx}">✏️ تعديل</button>
      <button class="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm font-medium" data-act="remove" data-idx="${idx}">🗑️ حذف</button>`;
    opList.appendChild(row);
  });
}

function renderProdUnits(){
  const unitList = document.getElementById('unitList');
  if(!unitList) return;
  unitList.innerHTML='';
  prodUnits.forEach((u, idx) => {
    const row = document.createElement('div');
    row.style.display='grid';
    row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr auto';
    row.style.gap='8px';
    row.style.alignItems='center';
    const priceTxt = (u.price_mode==='manual' && u.price!=null) ? Number(u.price).toFixed(2) : 'تلقائي';
    row.innerHTML = `<div>${u.unit_name}</div>
      <div>عدد القطع: ${Number(u.multiplier||1)}</div>
      <div>التسعير: ${u.price_mode==='manual'?'يدوي':'تلقائي'}</div>
      <div>السعر: ${priceTxt}</div>
      <div style="display:flex; gap:6px; justify-content:end;">
        <button class="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-medium" data-act="u_edit" data-idx="${idx}">✏️ تعديل</button>
        <button class="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm font-medium" data-act="u_remove" data-idx="${idx}">🗑️ حذف</button>
      </div>`;
    unitList.appendChild(row);
  });
}

function renderProdVariants(){
  const variantsList = document.getElementById('variantsList');
  if(!variantsList) return;
  variantsList.innerHTML='';
  prodVariants.forEach((v, idx) => {
    const row = document.createElement('div');
    row.style.display='grid';
    row.style.gridTemplateColumns = '1.2fr 1.2fr 0.8fr 0.8fr 0.8fr auto';
    row.style.gap='8px';
    row.style.alignItems='center';
    row.style.padding='8px';
    row.style.background='white';
    row.style.borderRadius='6px';
    row.style.border='1px solid #e5e7eb';
    row.innerHTML = `<div style="font-weight:600;">${v.variant_name}</div>
      <div style="font-family:monospace; font-size:12px; color:#666;">${v.barcode}</div>
      <div>${Number(v.price||0).toFixed(2)}</div>
      <div>${v.cost ? Number(v.cost).toFixed(2) : '-'}</div>
      <div title="خصم المخزون">${Number(v.stock_deduct_multiplier!=null ? v.stock_deduct_multiplier : 1).toFixed(3)}</div>
      <div style="display:flex; gap:4px; justify-content:flex-end;">
        <button class="px-2 py-1 bg-orange-600 text-white rounded text-xs font-medium" data-act="v_edit" data-idx="${idx}">✏️</button>
        <button class="px-2 py-1 bg-red-600 text-white rounded text-xs font-medium" data-act="v_remove" data-idx="${idx}">🗑️</button>
      </div>`;
    variantsList.appendChild(row);
  });
}

function clearDialog(){ f_name.value=''; f_name_en.value=''; if(f_barcode) f_barcode.value=''; f_price.value=''; const f_min_price_el=document.getElementById('f_min_price'); if(f_min_price_el) f_min_price_el.value=''; f_cost.value=''; f_stock.value=''; f_category.value=''; f_description.value=''; const f_expiry_date_el=document.getElementById('f_expiry_date'); if(f_expiry_date_el) f_expiry_date_el.value=''; pickedImagePath=null; f_thumb.src=''; prodOps=[]; renderProdOps(); prodUnits=[]; renderProdUnits(); prodVariants=[]; renderProdVariants(); if(typeof f_is_tobacco!== 'undefined' && f_is_tobacco) f_is_tobacco.value='0'; if(f_hide_from_sales) f_hide_from_sales.checked=false; try{ delete window.__pickedImageBase64; delete window.__pickedImageMime; delete window.__removeImage; }catch(_){ } }

function openAddDialog(){ editId=null; dlgTitle.textContent='إضافة منتج'; clearDialog(); setBarcodeVisible(true); populateCategories(); loadAllOps(); applySellingUnitsVisibility(); safeShowModal(dlg); focusFirstField(); }
async function openEditDialog(item){
  editId=item.id; dlgTitle.textContent='تعديل منتج';
  setBarcodeVisible(true);
  try{ delete window.__pickedImageBase64; delete window.__pickedImageMime; }catch(_){ }
  window.__removeImage = false;
  f_name.value=item.name||''; f_name_en.value=item.name_en||''; if(f_barcode) f_barcode.value=item.barcode||''; f_price.value=item.price; const f_min_price_el=document.getElementById('f_min_price'); if(f_min_price_el){ if(item.min_price!=null && item.min_price!==''){ const mp=Number(item.min_price); f_min_price_el.value = isNaN(mp) ? '' : String(mp.toFixed(2)); } else { f_min_price_el.value=''; } } f_cost.value=item.cost; f_stock.value=item.stock; f_description.value=item.description||''; const f_expiry_date_el=document.getElementById('f_expiry_date'); if(f_expiry_date_el){ if(item.expiry_date){ const dt=new Date(item.expiry_date); if(!isNaN(dt.getTime())){ const y=dt.getFullYear(); const m=String(dt.getMonth()+1).padStart(2,'0'); const d=String(dt.getDate()).padStart(2,'0'); f_expiry_date_el.value=`${y}-${m}-${d}`; } else { f_expiry_date_el.value=''; } } else { f_expiry_date_el.value=''; } } if(typeof f_is_tobacco!== 'undefined' && f_is_tobacco) f_is_tobacco.value = (item.is_tobacco ? '1' : '0'); if(f_hide_from_sales) f_hide_from_sales.checked = (item.hide_from_sales === 1);
  await populateCategories();
  const currentCat = item.category || '';
  if(currentCat){
    // إذا لم تكن الفئة الحالية ضمن الخيارات (ربما تم حذف/إيقاف النوع)، أضفها مؤقتًا حتى لا تضيع القيمة
    const exists = Array.from(f_category.options).some(o => o.value === currentCat);
    if(!exists){
      const opt = document.createElement('option');
      opt.value = currentCat;
      opt.textContent = currentCat + ' (غير موجود في الأنواع)';
      f_category.appendChild(opt);
    }
  }
  f_category.value=currentCat;

  // load product operations
  try{
    await loadAllOps();
    const rpo = await window.api.prod_ops_list(item.id);
    prodOps = (rpo && rpo.ok) ? (rpo.items||[]).map(x=>({ operation_id:x.operation_id, name:x.name, price:Number(x.price||0) })) : [];
    renderProdOps();
  }catch(_){ prodOps=[]; renderProdOps(); }

  // load product units
  try{
    const ru = await window.api.product_units_list(item.id);
    prodUnits = (ru && ru.ok) ? (ru.items||[]).map(x=>({ unit_name:String(x.unit_name||'').trim(), multiplier:Number(x.multiplier||1), price_mode:(x.price_mode==='manual'?'manual':'auto'), price:(x.price!=null? Number(x.price): null) })) : [];
    renderProdUnits();
  }catch(_){ prodUnits=[]; renderProdUnits(); }

  // load product variants
  try{
    const rv = await window.api.product_variants_list(item.id);
    prodVariants = (rv && rv.ok) ? (rv.items||[]).map(x=>({ id:x.id, variant_name:String(x.variant_name||'').trim(), barcode:String(x.barcode||'').trim(), price:Number(x.price||0), cost:(x.cost!=null? Number(x.cost): null), stock_deduct_multiplier: (x.stock_deduct_multiplier!=null ? Number(x.stock_deduct_multiplier) : 1), is_active: x.is_active })) : [];
    // track original IDs to detect deletions on save
    initialVariantIds = new Set((rv && rv.ok) ? (rv.items||[]).map(x=>x.id).filter(Boolean) : []);
    renderProdVariants();
  }catch(_){ prodVariants=[]; initialVariantIds = new Set(); renderProdVariants(); }

  pickedImagePath = item.image_path || null;
  // Prefer BLOB on-demand fetch for preview
  try{
    const ir = await window.api.products_image_get(item.id);
    if(ir && ir.ok && ir.base64){
      f_thumb.src = `data:${ir.mime||'image/png'};base64,${ir.base64}`;
    } else if(pickedImagePath){
      if(pickedImagePath.startsWith('assets/')){
        const relToAbs = '../../../' + pickedImagePath;
        f_thumb.src = relToAbs;
      } else {
        f_thumb.src = 'file:///' + pickedImagePath.replace(/\\/g, '/');
      }
    } else {
      f_thumb.src = '';
    }
  }catch(_){
    // fallback to legacy path if available
    if(pickedImagePath){
      if(pickedImagePath.startsWith('assets/')){
        const relToAbs = '../../../' + pickedImagePath;
        f_thumb.src = relToAbs;
      } else {
        f_thumb.src = 'file:///' + pickedImagePath.replace(/\\/g, '/');
      }
    } else {
      f_thumb.src = '';
    }
  }
  applySellingUnitsVisibility();
  safeShowModal(dlg);
  focusFirstField();
}
function closeDialog(){ dlg.close(); }

function imgSrcForList(image_path){
  if(!image_path) return '';
  if(image_path.startsWith('assets/')){
    return '../../../' + image_path; // من src/renderer/products إلى جذر المشروع
  }
  // مسار مطلق على ويندوز
  return 'file:///' + image_path.replace(/\\/g, '/');
}

// pagination state
let __allProducts = [];
let __page = 1;
let __pageSize = 50;
let __totalProducts = 0; // Reduced for better performance on weak devices

function renderPager(total){
  const top = document.getElementById('pagerTop');
  const bottom = document.getElementById('pagerBottom');
  const pages = (__pageSize && __pageSize>0) ? Math.max(1, Math.ceil(total/ __pageSize)) : 1;
  
  const btn = (label, disabled, go)=>`<button class="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium" ${disabled?'disabled':''} data-go="${go}">${label}</button>`;
  const html = [
    btn('⏮️', __page<=1, 'first'),
    btn('◀️', __page<=1, 'prev'),
    `<span class="text-gray-600 font-medium px-2">صفحة ${__page} من ${pages} (${total} منتج)</span>`,
    btn('▶️', __page>=pages, 'next'),
    btn('⏭️', __page>=pages, 'last')
  ].join(' ');
  
  if(top) top.innerHTML = html; 
  if(bottom) bottom.innerHTML = html;
  
  const onClick = (e)=>{
    const b = e.target.closest('button'); 
    if(!b || b.disabled) return;
    const act = b.getAttribute('data-go');
    let newPage = __page;
    if(act==='first') newPage=1;
    else if(act==='prev') newPage=Math.max(1,__page-1);
    else if(act==='next') newPage=Math.min(pages,__page+1);
    else if(act==='last') newPage=pages;
    
    if(newPage !== __page){
      __page = newPage;
      loadProducts(false);
    }
  };
  
  if(top) top.onclick = onClick;
  if(bottom) bottom.onclick = onClick;
}

// Concurrent load limiter for weak devices
let activeLoadCount = 0;
const MAX_CONCURRENT_LOADS = 3;
const loadQueue = [];

function processLoadQueue() {
  while (activeLoadCount < MAX_CONCURRENT_LOADS && loadQueue.length > 0) {
    const { tr, p } = loadQueue.shift();
    activeLoadCount++;
    loadRowData(tr, p).finally(() => {
      activeLoadCount--;
      processLoadQueue();
    });
  }
}

// Intersection Observer for lazy loading (performance boost for weak devices)
let lazyLoadObserver = null;
function initLazyLoadObserver() {
  if (lazyLoadObserver) {
    lazyLoadObserver.disconnect();
  }
  
  lazyLoadObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const tr = entry.target;
        const pid = Number(tr.dataset.pid);
        const p = __allProducts.find(x => x.id === pid);
        if (!p || tr.dataset.loaded === 'true') return;
        
        tr.dataset.loaded = 'true';
        lazyLoadObserver.unobserve(tr);
        
        loadQueue.push({ tr, p });
        processLoadQueue();
      }
    });
  }, {
    root: null,
    rootMargin: '50px',
    threshold: 0.01
  });
}

async function loadRowData(tr, p) {
  requestIdleCallback(async () => {
    try {
      const img = tr.querySelector('img.thumb');
      const oc = tr.querySelector('.ops-cell');
      
      const [imageResult, opsResult] = await Promise.all([
        cachedRequest(`img_${p.id}`, () => window.api.products_image_get(p.id), 30000).catch(() => null),
        cachedRequest(`ops_${p.id}`, () => window.api.prod_ops_list(p.id), 30000).catch(() => null)
      ]);
      
      if (imageResult && imageResult.ok && img) {
        img.src = `data:${imageResult.mime || 'image/png'};base64,${imageResult.base64}`;
        img.style.opacity = '1';
      }
      
      if (opsResult && opsResult.ok) {
        const items = opsResult.items || [];
        
        if (!(Number(p.price) > 0)) {
          const activeOps = items.filter(x => x.is_active);
          if (activeOps.length) {
            const first = activeOps[0];
            const sc = tr.querySelector('.price-cell');
            if (sc) {
              const newPrice = Number(first.price || 0);
              sc.textContent = newPrice.toFixed(2);
              sc.style.color = 'var(--primary)';
              
              const stockVal = Number(p.stock || 0);
              const costVal = Number(p.cost || 0);
              const totalSell = newPrice * stockVal;
              const totalBuy = costVal * stockVal;
              const netProfit = totalSell - totalBuy;
              const tb = tr.querySelector('.total-buy');
              const ts = tr.querySelector('.total-sell');
              const np = tr.querySelector('.net-profit');
              if (tb) tb.textContent = totalBuy.toFixed(2);
              if (ts) ts.textContent = totalSell.toFixed(2);
              if (np) {
                np.textContent = netProfit.toFixed(2);
                np.style.color = netProfit > 0 ? '#047857' : (netProfit < 0 ? '#dc2626' : 'inherit');
                np.style.fontWeight = '700';
              }
            }
          }
        }
        
        if (oc) {
          if (items.length) {
            oc.innerHTML = items.map(o => `<span style='display:inline-flex; gap:6px; align-items:center; padding:3px 8px; border:1px solid var(--border); border-radius:6px; background:var(--light-bg); font-size:12px;'>
              <span style='color:var(--primary); font-weight:600;'>${String(o.name || '')}</span>
              <span style='opacity:0.7;'>${Number(o.price || 0).toFixed(2)}</span>
              ${o.is_active ? '' : `<span style='color:var(--danger); font-weight:700; font-size:10px;'>×</span>`}
            </span>`).join(' ');
          } else {
            oc.textContent = '';
          }
        }
      }
    } catch (_) { }
  }, { timeout: 500 });
}

function renderRows(list){
  tbody.innerHTML='';
  
  const fragment = document.createDocumentFragment();
  
  initLazyLoadObserver();
  
  list.forEach((p, idx) => {
    const tr = document.createElement('tr');
    tr.setAttribute('draggable', 'true');
    tr.dataset.pid = String(p.id);
    tr.dataset.loaded = 'false';
    
    const handleDragStart = (e) => {
      window.__prd_dragId = p.id;
      try{ e.dataTransfer.effectAllowed = 'move'; }catch(_){ }
    };
    
    const handleDragOver = (e) => { 
      e.preventDefault();
    };
    
    const handleDrop = (e) => {
      e.preventDefault();
      const fromId = Number(window.__prd_dragId);
      const toId = Number(tr.dataset.pid);
      if(!fromId || !toId || fromId===toId) return;
      const fromIdx = __allProducts.findIndex(x=>x.id===fromId);
      const toIdx = __allProducts.findIndex(x=>x.id===toId);
      if(fromIdx<0 || toIdx<0) return;
      const item = __allProducts.splice(fromIdx,1)[0];
      __allProducts.splice(toIdx,0,item);
      renderRows(__allProducts);
    };
    
    tr.addEventListener('dragstart', handleDragStart);
    tr.addEventListener('dragover', handleDragOver);
    tr.addEventListener('drop', handleDrop);

    const priceExportBtn = '';
    const rowActions = [
      hasProd('products.edit') ? `<button class="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm font-medium" data-act="edit" data-id="${p.id}">✏️ تعديل</button>` : '',
      `<button class="px-3 py-1.5 bg-green-700 text-white rounded-lg text-sm font-medium" data-act="barcode" data-id="${p.id}">🏷️ باركود</button>`,
      hasProd('products.toggle') ? `<button class="px-3 py-1.5 ${p.is_active? 'bg-red-600':'bg-green-600'} text-white rounded-lg text-sm font-medium" data-act="toggle" data-id="${p.id}">${p.is_active? '❌ إيقاف':'✅ تفعيل'}</button>` : '',
      hasProd('products.delete') ? `<button class="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm font-medium" data-act="delete" data-id="${p.id}">🗑️ حذف</button>` : ''
    ].join(' ');
    
    const priceVal = Number(p.price||0);
    const costVal = Number(p.cost||0);
    const stockVal = Number(p.stock||0);
    const totalBuy = costVal * stockVal;
    const totalSell = priceVal * stockVal;
    const netProfit = totalSell - totalBuy;
    
    // التحقق من انتهاء الصلاحية
    const isExpired = p.expiry_date && new Date(p.expiry_date) < new Date();
    
    // تمييز الصنف المخفي من شاشة الفاتورة
    const isHidden = p.hide_from_sales === 1;
    if(isExpired){
      tr.style.backgroundColor = '#fee2e2'; // لون أحمر فاتح للمنتهي الصلاحية
    } else if(isHidden){
      tr.style.backgroundColor = '#fef3c7'; // لون أصفر فاتح للمخفي
    }
    
    const statusBadge = p.is_active 
      ? (isHidden 
          ? '<div><span class="status-active">✓ نشط</span><br/><span style="font-size:11px; color:#92400e; background:#fbbf24; padding:2px 6px; border-radius:4px; display:inline-block; margin-top:4px;">🔒 مخفي</span></div>' 
          : '<span class="status-active">✓ نشط</span>')
      : (isHidden
          ? '<div><span class="status-inactive">✕ موقوف</span><br/><span style="font-size:11px; color:#92400e; background:#fbbf24; padding:2px 6px; border-radius:4px; display:inline-block; margin-top:4px;">🔒 مخفي</span></div>'
          : '<span class="status-inactive">✕ موقوف</span>');

    const expiryDateText = p.expiry_date ? (function(){
      try {
        const dt = new Date(p.expiry_date);
        const y = dt.getFullYear();
        const m = String(dt.getMonth()+1).padStart(2,'0');
        const d = String(dt.getDate()).padStart(2,'0');
        return `${y}-${m}-${d}`;
      } catch(_){ return ''; }
    })() : '';

    tr.innerHTML = `
      <td>${((__page-1)*(__pageSize||list.length))+idx+1}</td>
      <td><img class="thumb" data-pid="${p.id}" src="" alt="" style="opacity:0.3;"/></td>
      <td>${p.name}${p.name_en ? `<div style='font-size:12px; color:var(--muted);'>${String(p.name_en).replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]))}</div>` : ''}</td>
      <td>${p.barcode || ''}</td>
      <td>${costVal.toFixed(2)}</td>
      <td>
        <span class="price-cell" data-id="${p.id}">${priceVal.toFixed(2)}</span>
        ${priceExportBtn}
      </td>
      <td class="ops-cell" data-id="${p.id}" style="font-size:12px; color:var(--muted);">...</td>
      <td>${stockVal}</td>
      <td class="total-buy" data-id="${p.id}">${totalBuy.toFixed(2)}</td>
      <td class="total-sell" data-id="${p.id}">${totalSell.toFixed(2)}</td>
      <td class="net-profit" data-id="${p.id}" style="font-weight:700; color: ${netProfit>0 ? '#047857' : (netProfit<0 ? '#dc2626' : 'inherit')}">${netProfit.toFixed(2)}</td>
      <td>${p.category || ''}</td>
      <td>${expiryDateText}</td>
      <td>${statusBadge}</td>
      <td>${rowActions}</td>`;
    
    fragment.appendChild(tr);
    
    lazyLoadObserver.observe(tr);
  })
  
  tbody.appendChild(fragment);
}

async function loadProducts(resetPage = true, clearError = true){
  if(clearError) setError('');
  
  // Show loading state with better UX
  const tbody = document.getElementById('tbody');
  const refreshBtn = document.getElementById('refreshBtn');
  
  // Add loading animation to refresh button
  const originalBtnText = refreshBtn?.innerHTML;
  if(refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '⟳ جاري...';
  }
  
  try {
    // Load active types (cached)
    try{
      const t = await cachedRequest('types_list', () => window.api.types_list(), 10000);
      activeTypes = new Set((t && t.ok ? (t.items||[]) : []).map(x => x.name));
    }catch(_){ activeTypes = new Set(); }

    if(resetPage) __page = 1;
    
    const selectedCategory = (document.getElementById('filter_category')?.value || '').trim();
    const activeFilter = (document.getElementById('f_active')?.value || '');
    
    const query = {
      q: normalizeDigits((document.getElementById('q')?.value || '').trim()),
      active: activeFilter === 'hidden' || activeFilter === 'expired' ? '' : activeFilter,
      category: selectedCategory,
      sort: (document.getElementById('sort')?.value || 'id_desc'),
      limit: __pageSize,
      offset: (__page - 1) * __pageSize
    };
    
    const res = await window.api.products_list(query);
    if(!res.ok){ 
      setError(res.error || 'تعذر تحميل المنتجات'); 
      return; 
    }
    
    let products = res.items || [];
    __totalProducts = res.total || 0;
    
    // Client-side filter for special cases (hidden/expired)
    if(activeFilter === 'hidden'){
      products = products.filter(p => p.hide_from_sales === 1);
    } else if(activeFilter === 'expired'){
      products = products.filter(p => p.expiry_date && new Date(p.expiry_date) < new Date());
    }
    
    __allProducts = products;
    renderRows(__allProducts);
    renderPager(__totalProducts);
  } catch(err) {
    setError('حدث خطأ غير متوقع أثناء تحميل المنتجات');
  } finally {
    if(refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = originalBtnText || '🔄 تحديث';
    }
  }
}

// init page size control
const pageSizeSel = document.getElementById('pageSize');
if(pageSizeSel){
  pageSizeSel.addEventListener('change', ()=>{
    const v = Number(pageSizeSel.value||50);
    __pageSize = v;
    loadProducts(true);
  });
}

addBtn.addEventListener('click', openAddDialog);

// Auto-refresh products when stock changes via purchases
try{
  window.api.on_products_changed(async (_payload)=>{
    try{ await loadProducts(); }catch(_){ /* ignore */ }
  });
}catch(_){ }

if(saveOrderBtn){
  saveOrderBtn.addEventListener('click', async () => {
    try{
      const ids = __allProducts.map(p => p.id);
      const r = await window.api.products_reorder(ids);
      if(!r.ok){ setError(r.error||'فشل حفظ ترتيب المنتجات'); return; }
      setError('تم حفظ الترتيب بنجاح');
    }catch(_){ setError('تعذر حفظ الترتيب'); }
  });
}

// Improved event listeners with optimized debouncing
const searchInput = document.getElementById('q');
searchInput.addEventListener('input', () => { 
  debounceSearch(loadProducts, 100); 
});
searchInput.addEventListener('blur', () => {
  // No color change needed - CSS handles it
});
searchInput.addEventListener('focus', () => {
  // No color change needed - CSS handles it
});

// Throttle filter and sort changes to prevent excessive API calls
const throttledLoadProducts = throttle(loadProducts, 300);
document.getElementById('f_active').addEventListener('change', throttledLoadProducts);
document.getElementById('sort').addEventListener('change', throttledLoadProducts);
document.getElementById('filter_category')?.addEventListener('change', throttledLoadProducts);

// Operations UI events
opAdd.addEventListener('click', () => {
  const opId = Number(opSelect.value||0);
  const op = allOps.find(o=>o.id===opId);
  const price = Number(opPrice.value||0);
  if(!opId || !op || isNaN(price) || price<0) return;
  const exists = prodOps.find(x=>x.operation_id===opId);
  if(exists){ exists.price = price; }
  else { prodOps.push({ operation_id: opId, name: op.name, price }); }
  opPrice.value=''; opSelect.value=''; renderProdOps();
});

opList.addEventListener('click', (e)=>{
  const b = e.target.closest('button'); if(!b) return;
  const idx = Number(b.dataset.idx);
  const act = b.dataset.act;
  if(act==='remove'){ prodOps.splice(idx,1); renderProdOps(); }
  if(act==='edit'){
    const item = prodOps[idx];
    if(!item) return;
    opSelect.value = String(item.operation_id);
    opPrice.value = String(item.price);
  }
});

dlgCancel.addEventListener('click', closeDialog);

dlgSave.addEventListener('click', async () => {
  setError('');
  
  // Add loading state to button
  const originalText = dlgSave.textContent;
  dlgSave.disabled = true;
  dlgSave.textContent = 'جاري الحفظ...';
  
  try {
    const payload = {
      name: f_name.value.trim(),
      name_en: (f_name_en.value||'').trim() || null,
      barcode: f_barcode.value.trim() || null,
      price: parseFloat(f_price.value || '0'),
      min_price: (function(){ const v=(document.getElementById('f_min_price')?.value||'').trim(); if(v==='') return null; const n=Number(v); return isNaN(n)? null : Number(n.toFixed(2)); })(),
      cost: parseFloat(f_cost.value || '0'),
      stock: parseInt(f_stock.value || '0', 10),
      category: f_category.value.trim() || null,
      description: f_description.value.trim() || null,
      expiry_date: (function(){ const el=document.getElementById('f_expiry_date'); return (el && el.value) ? el.value : null; })(),
      is_tobacco: (typeof f_is_tobacco!== 'undefined' && f_is_tobacco) ? (f_is_tobacco.value==='1' ? 1 : 0) : 0,
      hide_from_sales: (f_hide_from_sales && f_hide_from_sales.checked) ? 1 : 0,
    };

    if(!payload.name){ setError('يرجى إدخال اسم المنتج'); return; }
    if(isNaN(payload.price) || payload.price<0){ setError('يرجى إدخال سعر صحيح'); return; }
    if(isNaN(payload.cost) || payload.cost<0){ setError('يرجى إدخال تكلفة صحيحة'); return; }
    if(isNaN(payload.stock)){ setError('يرجى إدخال مخزون صحيح'); return; }

    // تحقق: لا يمكن أن تكون تكلفة الشراء أكبر من سعر البيع
    if(payload.cost > payload.price){
      setError('لا يمكن أن يكون سعر الشراء أكبر من سعر البيع');
      try{ 
        const dlgErr = document.getElementById('dlgError');
        if(dlgErr && dlg.open){ setTimeout(()=>{ if(dlg.open){ dlgErr.textContent=''; } }, 4000); }
        setTimeout(()=>{ setError(''); }, 4000);
      }catch(_){ }
      throw new Error('cost_gt_price');
    }

    // Image handling: preserve existing unless changed or removed
    if(window.__removeImage === true){
      payload.remove_image = 1;
    } else if(window.__pickedImageBase64){
      payload.image_blob_base64 = window.__pickedImageBase64;
      payload.image_mime = window.__pickedImageMime || 'image/png';
      // do not send image_path; we store as BLOB
    } // else: send no image fields to keep current image

    let res;
    if(editId){ res = await window.api.products_update(editId, payload); }
    else { res = await window.api.products_add(payload); }

    if(!res.ok){ setError(res.error || 'فشل الحفظ'); return; }

    // بعد الحفظ، امسح العلامات المؤقتة
    try{ delete window.__pickedImageBase64; delete window.__pickedImageMime; delete window.__removeImage; }catch(_){ }

    // save product operations mapping
    try{
      const items = prodOps.map(x => ({ operation_id: x.operation_id, price: Number(x.price||0) }));
      const pid = editId ? editId : res.id;
      if(pid){ await window.api.prod_ops_set(pid, items); }
    }catch(_){ /* ignore mapping errors to not block product save */ }

    // save product units mapping (only if feature is enabled)
    if(showSellingUnits){
      try{
        const uitems = prodUnits
          .filter(u => String(u.unit_name||'').trim() && Number(u.multiplier||0)>0)
          .map(u => ({ unit_name: String(u.unit_name).trim(), multiplier: Number(u.multiplier||1), price_mode: (u.price_mode==='manual'?'manual':'auto'), price: (u.price_mode==='manual' ? Number(u.price||0) : null) }));
        const pid2 = editId ? editId : res.id;
        if(pid2){ await window.api.product_units_set(pid2, uitems); }
      }catch(_){ /* ignore unit mapping errors */ }
    }

    // save product variants
    try{
      const pid3 = editId ? editId : res.id;
      if(pid3){
        // 1) Add/update current list
        for(const v of prodVariants){
          if(v.id){
            await window.api.product_variants_update({ id: v.id, variant_name: v.variant_name, price: Number(v.price), cost: (v.cost!=null ? Number(v.cost) : null), stock_deduct_multiplier: (v.stock_deduct_multiplier!=null ? Number(v.stock_deduct_multiplier) : 1), is_active: v.is_active ? 1 : 0 });
          } else {
            await window.api.product_variants_add({ product_id: pid3, variant_name: v.variant_name, barcode: v.barcode, price: Number(v.price), cost: (v.cost!=null ? Number(v.cost) : null), stock_deduct_multiplier: (v.stock_deduct_multiplier!=null ? Number(v.stock_deduct_multiplier) : 1) });
          }
        }
        // 2) Delete removed ones (only in edit mode)
        if(editId && initialVariantIds && initialVariantIds.size > 0){
          const keptIds = new Set(prodVariants.map(v=>v.id).filter(Boolean));
          for(const oldId of initialVariantIds){
            if(!keptIds.has(oldId)){
              try{ await window.api.product_variants_delete(oldId); }catch(_){ /* ignore single delete error */ }
            }
          }
        }
      }
    }catch(e){ /* ignore variant errors */ console.error('Variant save error:', e); }

    closeDialog();
    await loadProducts();
  } finally {
    // Restore button state
    dlgSave.disabled = false;
    dlgSave.textContent = originalText;
  }
});

removeImageBtn.addEventListener('click', () => {
  pickedImagePath = null;
  f_thumb.src = '';
  try{ delete window.__pickedImageBase64; delete window.__pickedImageMime; }catch(_){ }
  window.__removeImage = true; // mark for removal on save
});

// Units UI handlers
(function(){
  const unitName = document.getElementById('unitName');
  const unitMultiplier = document.getElementById('unitMultiplier');
  const unitPriceMode = document.getElementById('unitPriceMode');
  const unitPrice = document.getElementById('unitPrice');
  const unitAdd = document.getElementById('unitAdd');
  const unitList = document.getElementById('unitList');
  if(!unitAdd || !unitList) return;

  unitAdd.addEventListener('click', () => {
    const name = String(unitName.value||'').trim();
    const mult = Number(unitMultiplier.value||0);
    const mode = (unitPriceMode.value==='manual'?'manual':'auto');
    const price = unitPrice.value!=='' ? Number(unitPrice.value) : null;
    if(!name || !(mult>0)) return;
    const i = prodUnits.findIndex(u => u.unit_name.toLowerCase() === name.toLowerCase());
    const item = { unit_name: name, multiplier: mult, price_mode: mode, price: (mode==='manual' ? (price!=null? Number(price): 0) : null) };
    if(i>=0){ prodUnits[i] = item; } else { prodUnits.push(item); }
    unitName.value=''; unitMultiplier.value=''; unitPrice.value=''; unitPriceMode.value='auto';
    renderProdUnits();
  });

  unitList.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if(!b) return;
    const act = b.getAttribute('data-act');
    const idx = Number(b.getAttribute('data-idx'));
    if(isNaN(idx)) return;
    if(act==='u_remove'){
      prodUnits.splice(idx,1); renderProdUnits();
    } else if(act==='u_edit'){
      const u = prodUnits[idx]; if(!u) return;
      unitName.value = u.unit_name; unitMultiplier.value = String(u.multiplier);
      unitPriceMode.value = (u.price_mode==='manual'?'manual':'auto');
      unitPrice.value = (u.price_mode==='manual' && u.price!=null) ? String(u.price) : '';
      unitName.focus(); unitName.select();
    }
  });
})();

// Variants UI handlers
(function(){
  const variantNameInput = document.getElementById('variantNameInput');
  const variantBarcodeInput = document.getElementById('variantBarcodeInput');
  const variantPriceInput = document.getElementById('variantPriceInput');
  const variantCostInput = document.getElementById('variantCostInput');
  const variantStockDeductInput = document.getElementById('variantStockDeductInput');
  const variantAddBtn = document.getElementById('variantAddBtn');
  const variantsList = document.getElementById('variantsList');
  if(!variantAddBtn || !variantsList) return;

  // Track edit index for variants (-1 means add new)
  let variantEditIndex = -1;
  const defaultAddBtnText = variantAddBtn.textContent || 'إضافة';

  variantAddBtn.addEventListener('click', () => {
    const name = String(variantNameInput.value||'').trim();
    const barcode = String(variantBarcodeInput.value||'').trim();
    const price = Number(variantPriceInput.value||0);
    const cost = variantCostInput.value!=='' ? Number(variantCostInput.value) : null;
    const stockDeduct = variantStockDeductInput && variantStockDeductInput.value!=='' ? Number(variantStockDeductInput.value) : 1;
    
    if(!name) { setError('اسم الصنف مطلوب'); return; }
    if(!barcode) { setError('الباركود مطلوب'); return; }
    if(price <= 0) { setError('السعر يجب أن يكون أكبر من صفر'); return; }
    if(!(stockDeduct>0)) { setError('قيمة خصم المخزون يجب أن تكون أكبر من صفر'); return; }

    // Check for duplicate barcode in current list (exclude current index in edit mode)
    const dup = prodVariants.some((v, i) => v.barcode === barcode && i !== variantEditIndex);
    if(dup){ setError('هذا الباركود موجود بالفعل'); return; }

    const roundedStockDeduct = Number(Number(stockDeduct).toFixed(3));

    if(variantEditIndex >= 0){
      // Update existing variant (preserve id and is_active if exist)
      const prev = prodVariants[variantEditIndex] || {};
      prodVariants[variantEditIndex] = {
        id: prev.id, // keep DB id if exists
        variant_name: name,
        barcode: barcode,
        price: Number(price),
        cost: cost,
        stock_deduct_multiplier: (prev.stock_deduct_multiplier!=null ? Number(roundedStockDeduct) : Number(roundedStockDeduct)),
        is_active: (prev.is_active!=null ? prev.is_active : 1)
      };
      // Reset edit state and button label
      variantEditIndex = -1;
      variantAddBtn.textContent = defaultAddBtnText;
    } else {
      // Add new variant
      const item = { variant_name: name, barcode: barcode, price: Number(price), cost: cost, stock_deduct_multiplier: Number(roundedStockDeduct), is_active: 1 };
      prodVariants.push(item);
    }

    // Clear inputs and re-render
    variantNameInput.value=''; variantBarcodeInput.value=''; variantPriceInput.value=''; variantCostInput.value=''; if(variantStockDeductInput) variantStockDeductInput.value='1';
    renderProdVariants();
    setError('');
  });

  variantsList.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if(!b) return;
    const act = b.getAttribute('data-act');
    const idx = Number(b.getAttribute('data-idx'));
    if(isNaN(idx)) return;
    if(act==='v_remove'){
      prodVariants.splice(idx,1); renderProdVariants();
      // If removing the item being edited, reset edit state
      if(variantEditIndex === idx){ variantEditIndex = -1; variantAddBtn.textContent = defaultAddBtnText; }
    } else if(act==='v_edit'){
      const v = prodVariants[idx]; if(!v) return;
      variantEditIndex = idx;
      variantNameInput.value = v.variant_name || '';
      variantBarcodeInput.value = v.barcode || '';
      variantPriceInput.value = (v.price!=null ? String(v.price) : '');
      variantCostInput.value = (v.cost!=null ? String(v.cost) : '');
      if(variantStockDeductInput) variantStockDeductInput.value = String(v.stock_deduct_multiplier!=null ? v.stock_deduct_multiplier : 1);
      variantAddBtn.textContent = 'حفظ التعديل';
      try{ variantNameInput.focus(); variantNameInput.select && variantNameInput.select(); }catch(_){ }
    }
  });
})();

// Modern custom confirm/alert using <dialog> to avoid native focus issues in Electron
const confirmDlg = document.getElementById('confirmDlg');
const confirmTitle = document.getElementById('confirmTitle');
const confirmText = document.getElementById('confirmText');
const confirmIcon = document.getElementById('confirmIcon');
const confirmOk = document.getElementById('confirmOk');
const confirmCancel = document.getElementById('confirmCancel');
function customConfirm(title, text, options = {}){
  return new Promise((resolve)=>{
    if(!confirmDlg){ resolve(window.confirm(text)); return; }
    
    // Set icon and style based on type
    const isDelete = String(title).includes('حذف') || options.type === 'delete';
    const icon = options.icon || (isDelete ? '🗑️' : '⚠️');
    
    confirmTitle && (confirmTitle.textContent = String(title||'تأكيد'));
    confirmText && (confirmText.textContent = String(text||''));
    confirmIcon && (confirmIcon.textContent = icon);
    
    // Add/remove delete-mode class
    if(isDelete){
      confirmDlg.classList.add('delete-mode');
    } else {
      confirmDlg.classList.remove('delete-mode');
    }
    
    try{ confirmDlg.showModal(); }
    catch(_){ try{ confirmDlg.close(); confirmDlg.showModal(); }catch(__){} }
    
    const onOk = ()=>{ cleanup(); resolve(true); };
    const onCancel = ()=>{ cleanup(); resolve(false); };
    const onBackdropClick = (e)=>{ if(e.target === confirmDlg){ onCancel(); } };
    
    function cleanup(){
      confirmOk && confirmOk.removeEventListener('click', onOk);
      confirmCancel && confirmCancel.removeEventListener('click', onCancel);
      confirmDlg.removeEventListener('click', onBackdropClick);
      confirmDlg.classList.remove('delete-mode');
      try{ confirmDlg.close(); }catch(_){ }
      try{ window.focus(); }catch(_){ }
    }
    
    confirmOk && confirmOk.addEventListener('click', onOk);
    confirmCancel && confirmCancel.addEventListener('click', onCancel);
    confirmDlg.addEventListener('click', onBackdropClick);
    confirmDlg.addEventListener('cancel', onCancel, { once:true });
    setTimeout(()=>{ try{ confirmOk && confirmOk.focus(); }catch(_){ } }, 0);
  });
}
async function customAlert(text, options = {}){
  const icon = options.icon || 'ℹ️';
  await customConfirm('تنبيه', text, { icon, ...options });
}

// Track pending operations to prevent duplicate requests
const pendingOps = new Map();

tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if(!btn) return;
  const id = Number(btn.dataset.id);
  const act = btn.dataset.act;
  setError('');
  
  // Prevent duplicate operations
  const opKey = `${act}:${id}`;
  if(pendingOps.has(opKey)){
    return;
  }

  if(act==='barcode'){
    if(!id) return;
    await openBarcodeDialog(id);
    return;
  }

  if(act==='edit'){
    try {
      const res = await cachedRequest(`product_${id}`, () => window.api.products_get(id), 10000);
      if(!res.ok){ setError(res.error || 'تعذر جلب المنتج'); return; }
      openEditDialog(res.item);
    } catch(err) {
      setError('حدث خطأ غير متوقع');
    }
  }
  
  if(act==='toggle'){
    // Add visual feedback immediately
    btn.disabled = true;
    
    try {
      pendingOps.set(opKey, true);
      const res = await window.api.products_toggle(id);
      if(!res.ok){ 
        setError(res.error || 'فشل تحديث الحالة');
        btn.disabled = false;
        return;
      }
      // Quick reload without full page refresh
      await loadProducts();
    } catch(err) {
      setError('حدث خطأ غير متوقع');
      btn.disabled = false;
    } finally {
      pendingOps.delete(opKey);
    }
  }
  
  if(act==='delete'){
    const ok = await customConfirm(
      'تأكيد حذف المنتج', 
      'هل أنت متأكد من حذف هذا المنتج نهائياً؟\n\nلا يمكن التراجع عن هذا الإجراء وسيتم حذف جميع البيانات المرتبطة به.',
      { type: 'delete' }
    );
    if(!ok) return;
    
    btn.disabled = true;
    
    try {
      pendingOps.set(opKey, true);
      const res = await window.api.products_delete(id);
      if(!res.ok){ 
        setError(res.error || 'فشل الحذف');
        btn.disabled = false;
        return;
      }
      await loadProducts();
    } catch(err) {
      setError('حدث خطأ غير متوقع');
      btn.disabled = false;
    } finally {
      pendingOps.delete(opKey);
    }
  }
  
  if(act==='export_pdf_product'){
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⟳ جاري...';
    
    try{
      const res = await window.api.products_get(id);
      if(!res.ok){ setError(res.error || 'تعذر جلب المنتج'); return; }
      const p = res.item;
      const rpo = await cachedRequest(`prod_ops_${id}`, () => window.api.prod_ops_list(id), 15000);
      const ops = (rpo && rpo.ok ? (rpo.items||[]) : []);
      await exportProductPdf(p, ops);
    } catch(_){ 
      await customAlert('تعذر إنشاء PDF للمنتج'); 
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
});

pickImageBtn.addEventListener('click', async () => {
  const r = await window.api.pick_image();
  if(r && r.ok && r.path){
    try{
      const rf = await window.api.read_file_base64(r.path);
      if(rf && rf.ok){
        if(rf.tooLarge){ await customAlert('حجم الصورة أكبر من 1 ميجابايت. يرجى اختيار صورة أصغر.'); return; }
        f_thumb.src = `data:${rf.mime||'image/png'};base64,${rf.base64}`;
        pickedImagePath = null;
        window.__pickedImageBase64 = rf.base64;
        window.__pickedImageMime = rf.mime || 'image/png';
        window.__removeImage = false; // user chose a new image
      } else if(rf && !rf.ok){
        await customAlert(rf.error || 'فشل قراءة الملف');
      }
    }catch(_){ /* ignore */ }
  }
});

// ====== PDF Export (all products) ======
btnExportProductsPdf?.addEventListener('click', async () => {
  try{
    const btn = btnExportProductsPdf;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ جاري التصدير...';
    
    const withOps = await fetchProductsWithOpsUsingCurrentFilters();
    await exportProductsPdf(withOps);
    
    btn.textContent = '✓ تم!';
    setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 2000);
  }catch(e){ 
    btnExportProductsPdf.disabled = false;
    btnExportProductsPdf.textContent = '🧾 PDF';
    alert('تعذر إنشاء PDF: ' + (e?.message || '')); 
  }
});

// ====== CSV Export (all products, UTF-8 BOM for Arabic) ======
btnExportProductsCsv?.addEventListener('click', async () => {
  try{
    const btn = btnExportProductsCsv;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ جاري التصدير...';
    
    const withOps = await fetchProductsWithOpsUsingCurrentFilters();
    exportProductsCsv(withOps);
    
    btn.textContent = '✓ تم!';
    setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 2000);
  }catch(e){ 
    btnExportProductsCsv.disabled = false;
    btnExportProductsCsv.textContent = '📄 CSV';
    alert('تعذر إنشاء CSV: ' + (e?.message || '')); 
  }
});

/**
 * Helper: Process items with concurrency limit (fallback method)
 * Limits parallel requests to avoid overwhelming the IPC channel
 * Example: 10,000 items with limit=10 = 1,000 iterations instead of 10,000 sequential calls
 */
async function processConcurrently(items, asyncFn, limit = 10) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map(asyncFn));
    results.push(...batchResults);
  }
  return results;
}

async function fetchProductsWithOpsUsingCurrentFilters(){
  const query = {
    q: normalizeDigits((document.getElementById('q')?.value || '').trim()),
    active: (document.getElementById('f_active')?.value || ''),
    sort: (document.getElementById('sort')?.value || 'id_desc'),
  };
  const res = await window.api.products_list(query);
  if(!res.ok){ throw new Error(res.error || 'تعذر تحميل المنتجات'); }
  const list = res.items || [];
  
  // Fetch ALL operations in ONE batch call (1000x faster than sequential!)
  try{
    const productIds = list.map(p => p.id);
    const batchRes = await window.api.prod_ops_list_batch(productIds);
    const opsMap = (batchRes && batchRes.ok && batchRes.items) ? batchRes.items : {};
    
    // Map products with their operations
    return list.map(p => ({
      p,
      ops: opsMap[p.id] || []
    }));
  }catch(e){
    // Fallback: process with concurrency limit if batch fails
    console.warn('Batch ops fetch failed, using fallback concurrent method', e);
    return await processConcurrently(list, async (p) => {
      try{
        const rpo = await window.api.prod_ops_list(p.id);
        return { p, ops: (rpo && rpo.ok ? (rpo.items||[]) : []) };
      }catch(_){ 
        return { p, ops: [] };
      }
    }, 10);
  }
}

function exportProductsCsv(items){
  // Export columns matching current on-screen order (image column is hidden/not exported)
  const header = [t('#'),t('الاسم'),t('الباركود'),t('سعر الشراء'),t('سعر البيع'),t('العمليات وأسعارها'),t('المخزون'),t('إجمالي الشراء'),t('إجمالي البيع'),t('صافي الربح'),t('الفئة'),t('الحالة')];
  const rows = items.map(({p, ops}, idx) => {
    const costVal = Number(p.cost||0);
    const stockVal = Number(p.stock||0);
    const activeOps = (ops||[]).filter(o => o && o.is_active);
    const effPrice = (Number(p.price) > 0) ? Number(p.price||0) : (activeOps.length ? Number(activeOps[0].price||0) : 0);

    const totalBuy = costVal * stockVal;
    const totalSell = effPrice * stockVal;
    const netProfit = totalSell - totalBuy;

    // Put each operation on a new line inside the same cell for Excel
    const opsStr = (ops||[]).map(o => `${(o.name||'')}: ${Number(o.price||0).toFixed(2)}${o.is_active ? '' : ` (${t('غير نشطة')})`}`).join('\n');

    return [
      idx+1,
      p.name||'',
      p.barcode||'',
      costVal.toFixed(2),
      effPrice.toFixed(2),
      opsStr,
      stockVal,
      totalBuy.toFixed(2),
      totalSell.toFixed(2),
      netProfit.toFixed(2),
      p.category||'',
      p.is_active ? t('نشط') : t('موقوف')
    ];
  });
  const csv = [header, ...rows].map(r => r.map(cell => {
    const s = String(cell ?? '');
    // Quote if contains commas, quotes, or newlines
    if(/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  }).join(',')).join('\n');

  // Add BOM to ensure Arabic displays correctly in Excel
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'products.csv'; a.click();
  URL.revokeObjectURL(url);
}

// بناء PDF لقائمة المنتجات + أسعار العمليات
async function exportProductsPdf(items){
  const rows = items.map(({p, ops}, idx) => {
    const costVal = Number(p.cost||0);
    const stockVal = Number(p.stock||0);
    const activeOps = (ops||[]).filter(o => o && o.is_active);
    const effPrice = (Number(p.price) > 0) ? Number(p.price||0) : (activeOps.length ? Number(activeOps[0].price||0) : 0);
    
    // Calculate totals
    const totalBuy = costVal * stockVal;
    const totalSell = effPrice * stockVal;
    const netProfit = totalSell - totalBuy;
    
    const opsRows = (ops||[]).map(o => `<div style="display:flex; gap:8px; justify-content:space-between"><span>${(o.name||'')}</span><span>${Number(o.price||0).toFixed(2)}</span></div>`).join('');
    const safe = (s)=> String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    
    // Color for profit
    const profitColor = netProfit > 0 ? '#047857' : (netProfit < 0 ? '#dc2626' : '#64748b');
    
    return `<tr>
      <td>${idx+1}</td>
      <td><div>${safe(p.name)}</div>${p.name_en? `<div style='color:#64748b; font-size:11px'>${safe(p.name_en)}</div>`:''}</td>
      <td>${safe(p.barcode)}</td>
      <td>${effPrice.toFixed(2)}</td>
      <td>${costVal.toFixed(2)}</td>
      <td>${stockVal}</td>
      <td>${totalBuy.toFixed(2)}</td>
      <td>${totalSell.toFixed(2)}</td>
      <td style="color:${profitColor}; font-weight:700">${netProfit.toFixed(2)}</td>
      <td>${safe(p.category)}</td>
      <td>${p.is_active ? t('نشط') : t('موقوف')}</td>
      <td class="ops">${opsRows || `<span style="color:#64748b">${t('لا توجد عمليات')}</span>`}</td>
    </tr>`;
  }).join('');

  const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
  const dir = lang === 'en' ? 'ltr' : 'rtl';
  const align = lang === 'en' ? 'left' : 'right';
  const html = `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"/>
  <title>${t('تقرير المنتجات')}</title>
  <style>body{font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size:12px;}
  table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:5px;text-align:${align};vertical-align:top; font-size:11px}
  thead th{background:#f3f7ff;color:#0b3daa; font-size:12px}
  .ops div{border-bottom:1px dashed #e5e7eb;padding:2px 0}
  </style></head>
  <body><h3>${t('قائمة المنتجات مع الأسعار والعمليات والربحية')}</h3>
  <table><thead><tr><th>${t('#')}</th><th>${t('الاسم')}</th><th>${t('الباركود')}</th><th>${t('السعر')}</th><th>${t('التكلفة')}</th><th>${t('المخزون')}</th><th>${t('إجمالي الشراء')}</th><th>${t('إجمالي البيع')}</th><th>${t('صافي الربح')}</th><th>${t('الفئة')}</th><th>${t('الحالة')}</th><th>${t('العمليات وأسعارها')}</th></tr></thead>
  <tbody>${rows}</tbody></table></body></html>`;
  const r = await window.api.pdf_export(html, { pageSize: 'A4', printBackground: true, saveMode: 'auto', filename: 'products.pdf' });
  if(!r || !r.ok){ alert(t('تعذر إنشاء PDF')); }
}

// PDF لمنتج واحد + عملياته
async function exportProductPdf(p, ops){
  const rows = (ops||[]).map((o,i)=>`<tr><td>${i+1}</td><td>${(o.name||'')}</td><td>${Number(o.price||0).toFixed(2)}</td></tr>`).join('');
  const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
  const dir = lang === 'en' ? 'ltr' : 'rtl';
  const align = lang === 'en' ? 'left' : 'right';
  const html = `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"/>
  <title>${t('تقرير المنتج')}</title>
  <style>body{font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;}
  table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;text-align:${align}}
  thead th{background:#f3f7ff;color:#0b3daa}
  </style></head>
  <body>
    <h3>${t('تفاصيل المنتج')}</h3>
    <div>${t('الاسم')}: <strong>${(p.name||'')}</strong></div>
    <div>${t('الباركود')}: ${p.barcode||''}</div>
    <div>${t('الفئة')}: ${p.category||''}</div>
    <div>${t('الحالة')}: ${p.is_active ? t('نشط') : t('موقوف')}</div>
    <div>${t('السعر')}: ${Number(p.price||0).toFixed(2)} | ${t('التكلفة')}: ${Number(p.cost||0).toFixed(2)} | ${t('المخزون')}: ${Number(p.stock||0)}</div>
    <h4>${t('العمليات وأسعارها')}</h4>
    <table><thead><tr><th>${t('#')}</th><th>${t('العملية')}</th><th>${t('السعر')}</th></tr></thead><tbody>${rows || `<tr><td colspan="3">${t('لا توجد عمليات')}</td></tr>`}</tbody></table>
  </body></html>`;
  const r = await window.api.pdf_export(html, { pageSize: 'A4', printBackground: true, saveMode: 'auto', filename: `product-${(p.name||'item')}.pdf` });
  if(!r || !r.ok){ alert(t('تعذر إنشاء PDF للمنتج')); }
}

const categoryDlg = document.getElementById('categoryDlg');
const categoryNameInput = document.getElementById('categoryNameInput');
const categorySaveBtn = document.getElementById('categorySaveBtn');
const categoryCancelBtn = document.getElementById('categoryCancelBtn');
const categoryDlgError = document.getElementById('categoryDlgError');
const btnAddCategory = document.getElementById('btnAddCategory');

function showCategoryError(msg){ 
  categoryDlgError.textContent = msg; 
  categoryDlgError.style.display = msg ? 'flex' : 'none'; 
}

function clearCategoryDialog(){
  categoryNameInput.value = '';
  showCategoryError('');
}

btnAddCategory.addEventListener('click', () => {
  clearCategoryDialog();
  categoryDlg.showModal();
  setTimeout(() => categoryNameInput.focus(), 100);
});

categoryCancelBtn.addEventListener('click', () => {
  categoryDlg.close();
  clearCategoryDialog();
});

categorySaveBtn.addEventListener('click', async () => {
  const name = (categoryNameInput.value || '').trim();
  if(!name){ 
    showCategoryError('يرجى إدخال اسم النوع الرئيسي'); 
    categoryNameInput.focus(); 
    return; 
  }
  
  showCategoryError('');
  categorySaveBtn.disabled = true;
  categorySaveBtn.textContent = 'جاري الحفظ...';
  
  try {
    const res = await window.api.types_add({ name });
    if(!res || !res.ok){ 
      showCategoryError(res?.error || 'فشل الحفظ'); 
      categorySaveBtn.disabled = false;
      categorySaveBtn.textContent = 'حفظ';
      return; 
    }
    
    await populateCategories();
    f_category.value = name;
    
    categoryDlg.close();
    clearCategoryDialog();
    setError(`✓ تم إضافة النوع الرئيسي "${name}" بنجاح`);
    setTimeout(() => setError(''), 3000);
  } catch(e) {
    showCategoryError('حدث خطأ غير متوقع');
    console.error(e);
  } finally {
    categorySaveBtn.disabled = false;
    categorySaveBtn.textContent = 'حفظ';
  }
});

categoryNameInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter'){
    e.preventDefault();
    categorySaveBtn.click();
  }
});

categoryDlg.addEventListener('click', (e) => {
  if(e.target === categoryDlg){
    categoryDlg.close();
    clearCategoryDialog();
  }
});

const operationDlg = document.getElementById('operationDlg');
const operationNameInput = document.getElementById('operationNameInput');
const operationSaveBtn = document.getElementById('operationSaveBtn');
const operationCancelBtn = document.getElementById('operationCancelBtn');
const operationDlgError = document.getElementById('operationDlgError');
const opQuickAddBtn = document.getElementById('opQuickAddBtn');

function showOperationError(msg){ 
  operationDlgError.textContent = msg; 
  operationDlgError.style.display = msg ? 'flex' : 'none'; 
}

function clearOperationDialog(){
  operationNameInput.value = '';
  showOperationError('');
}

opQuickAddBtn.addEventListener('click', () => {
  clearOperationDialog();
  operationDlg.showModal();
  setTimeout(() => operationNameInput.focus(), 100);
});

operationCancelBtn.addEventListener('click', () => {
  operationDlg.close();
  clearOperationDialog();
});

operationSaveBtn.addEventListener('click', async () => {
  const name = (operationNameInput.value || '').trim();
  if(!name){ 
    showOperationError('يرجى إدخال اسم العملية'); 
    operationNameInput.focus(); 
    return; 
  }
  
  showOperationError('');
  operationSaveBtn.disabled = true;
  operationSaveBtn.textContent = 'جاري الحفظ...';
  
  try {
    const res = await window.api.ops_add({ name });
    if(!res || !res.ok){ 
      showOperationError(res?.error || 'فشل الحفظ'); 
      operationSaveBtn.disabled = false;
      operationSaveBtn.textContent = 'حفظ';
      return; 
    }
    
    requestCache.delete('ops_list');
    await loadAllOps();
    opSelect.value = String(res.id);
    
    operationDlg.close();
    clearOperationDialog();
    setError(`✓ تم إضافة العملية "${name}" بنجاح`);
    setTimeout(() => setError(''), 3000);
  } catch(e) {
    showOperationError('حدث خطأ غير متوقع');
    console.error(e);
  } finally {
    operationSaveBtn.disabled = false;
    operationSaveBtn.textContent = 'حفظ';
  }
});

operationNameInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter'){
    e.preventDefault();
    operationSaveBtn.click();
  }
});

operationDlg.addEventListener('click', (e) => {
  if(e.target === operationDlg){
    operationDlg.close();
    clearOperationDialog();
  }
});

const importProgressDiv = document.getElementById('importProgress');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const progressDetails = document.getElementById('progressDetails');

window.api.on_products_import_progress((data) => {
  const { current, total, phase } = data;
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  
  if(progressBar) progressBar.style.width = percent + '%';
  if(progressText) progressText.textContent = percent + '%';
  
  let phaseText = '';
  if(phase === 'validation') phaseText = 'التحقق من البيانات';
  else if(phase === 'inserting') phaseText = 'إضافة المنتجات';
  else if(phase === 'complete') phaseText = 'اكتمل';
  
  if(progressDetails) progressDetails.textContent = `${phaseText}: ${current} / ${total}`;
});

const btnImportExcel = document.getElementById('btnImportExcel');
if(btnImportExcel){
  btnImportExcel.addEventListener('click', async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if(!file) return;
      
      try {
        errorDiv.textContent = 'جاري قراءة الملف...';
        btnImportExcel.disabled = true;
        btnImportExcel.textContent = 'جاري الاستيراد...';
        
        if(importProgressDiv) {
          importProgressDiv.classList.remove('hidden');
          if(progressBar) progressBar.style.width = '0%';
          if(progressText) progressText.textContent = '0%';
          if(progressDetails) progressDetails.textContent = '0 / 0 منتج';
        }
        
        const readResult = await window.api.products_read_excel_file(file.path);
        
        if(!readResult || !readResult.ok){
          errorDiv.textContent = readResult?.error || 'فشل قراءة ملف Excel';
          if(importProgressDiv) importProgressDiv.classList.add('hidden');
          btnImportExcel.disabled = false;
          btnImportExcel.textContent = '📥 استيراد من Excel';
          return;
        }
        
        const excelData = readResult.data;
        
        const result = await window.api.products_import_excel(excelData);
        
        if(importProgressDiv) {
          setTimeout(() => importProgressDiv.classList.add('hidden'), 2000);
        }
        
        if(result && result.ok){
          let msg = `✓ تم استيراد ${result.successCount} منتج بنجاح`;
          if(result.errorCount > 0){
            msg += ` - فشل ${result.errorCount} منتج`;
            if(result.errors && result.errors.length > 0){
              msg += '\n\nالمنتجات الفاشلة:\n' + result.errors.join('\n');
            }
          }
          
          errorDiv.style.visibility = 'visible';
          errorDiv.style.position = 'relative';
          errorDiv.style.zIndex = '9999';
          errorDiv.style.display = 'block';
          errorDiv.style.whiteSpace = 'pre-wrap';
          errorDiv.style.textAlign = 'right';
          errorDiv.style.maxHeight = '400px';
          errorDiv.style.overflowY = 'auto';
          
          if(result.errorCount === 0){
            errorDiv.className = 'text-green-700 bg-green-50 border border-green-200 px-4 py-2.5 rounded-lg min-h-[22px] my-2 text-center font-medium';
          } else {
            errorDiv.className = 'text-orange-700 bg-orange-50 border border-orange-200 px-4 py-2.5 rounded-lg min-h-[22px] my-2 font-medium';
          }
          
          errorDiv.textContent = msg;
          await loadProducts(true, false);
          setTimeout(() => { 
            errorDiv.textContent = ''; 
            errorDiv.className = 'error text-red-700 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg min-h-[22px] my-2 text-center font-medium';
            errorDiv.style.whiteSpace = '';
            errorDiv.style.maxHeight = '';
            errorDiv.style.overflowY = '';
            errorDiv.style.display = '';
          }, 15000);
        } else {
          errorDiv.style.display = 'block';
          errorDiv.textContent = result?.error || 'فشل الاستيراد';
        }
      } catch(err) {
        console.error('Error importing:', err);
        errorDiv.textContent = 'فشل الاستيراد: ' + (err.message || 'خطأ غير معروف');
        if(importProgressDiv) importProgressDiv.classList.add('hidden');
      } finally {
        btnImportExcel.disabled = false;
        btnImportExcel.textContent = '📥 استيراد من Excel';
      }
    };
    input.click();
  });
}

// ====== Barcode label printing ======
const barcodeDlg = document.getElementById('barcodeDlg');
const barcodePreview = document.getElementById('barcodePreview');
const barcodeQtyInput = document.getElementById('barcodeQty');
const barcodeCancelBtn = document.getElementById('barcodeCancel');
const barcodePrintBtn = document.getElementById('barcodePrint');
const barcodeDlgError = document.getElementById('barcodeDlgError');
let currentBarcodeProduct = null;
let barcodeSettings = null;

function setBarcodeError(msg){
  if(!barcodeDlgError) return;
  barcodeDlgError.textContent = msg || '';
}

function ensureBarcodeSettingsDefaults(s){
  const copy = Object.assign({}, s || {});
  if(copy.barcode_paper_width_mm == null || isNaN(Number(copy.barcode_paper_width_mm))){
    copy.barcode_paper_width_mm = 40;
  }
  if(copy.barcode_paper_height_mm == null || isNaN(Number(copy.barcode_paper_height_mm))){
    copy.barcode_paper_height_mm = 25;
  }
  copy.barcode_show_shop_name = (copy.barcode_show_shop_name === undefined || copy.barcode_show_shop_name === null) ? 1 : (copy.barcode_show_shop_name ? 1 : 0);
  copy.barcode_show_product_name = (copy.barcode_show_product_name === undefined || copy.barcode_show_product_name === null) ? 1 : (copy.barcode_show_product_name ? 1 : 0);
  copy.barcode_show_price = (copy.barcode_show_price === undefined || copy.barcode_show_price === null) ? 1 : (copy.barcode_show_price ? 1 : 0);
  copy.barcode_show_barcode_text = (copy.barcode_show_barcode_text === undefined || copy.barcode_show_barcode_text === null) ? 1 : (copy.barcode_show_barcode_text ? 1 : 0);
  copy.barcode_font_size_shop = Number(copy.barcode_font_size_shop || 12);
  copy.barcode_font_size_product = Number(copy.barcode_font_size_product || 12);
  copy.barcode_font_size_price = Number(copy.barcode_font_size_price || 12);
  copy.barcode_font_size_barcode_text = Number(copy.barcode_font_size_barcode_text || 10);
  copy.barcode_height_px = Number(copy.barcode_height_px || 40);
  copy.barcode_label_offset_right_mm = Number(copy.barcode_label_offset_right_mm || 0);
  copy.barcode_label_offset_left_mm = Number(copy.barcode_label_offset_left_mm || 0);
  copy.barcode_label_offset_top_mm = Number(copy.barcode_label_offset_top_mm || 0);
  copy.barcode_label_offset_bottom_mm = Number(copy.barcode_label_offset_bottom_mm || 0);
  return copy;
}

// Minimal Code128-B encoder to SVG (supports standard ASCII 32-126)
function generateCode128Svg(code, opts){
  const text = String(code || '').trim();
  if(!text){
    return '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"></svg>';
  }
  // Code 128 patterns for codes 0-106
  const C128_PATTERNS = [
    '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
    '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
    '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
    '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
    '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
    '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
    '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
    '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
    '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
    '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
    '114131','311141','411131','211412','211214','211232','2331112'
  ];
  const START_B = 104;
  const STOP = 106;
  const codes = [START_B];
  for(let i=0;i<text.length;i++){
    const ch = text.charCodeAt(i);
    if(ch < 32 || ch > 126){
      // unsupported char, replace with space
      codes.push(0); // code for space
    }else{
      codes.push(ch - 32);
    }
  }
  let checksum = codes[0];
  for(let i=1;i<codes.length;i++){
    checksum += codes[i] * i;
  }
  checksum = checksum % 103;
  codes.push(checksum);
  codes.push(STOP);

  const moduleWidth = (opts && opts.moduleWidth) || 1;
  const height = (opts && opts.height) || 40;
  let x = 0;
  let svgBars = '';

  // Build bar sequence
  codes.forEach(codeVal => {
    const pattern = C128_PATTERNS[codeVal] || '';
    for(let i=0;i<pattern.length;i++){
      const width = Number(pattern[i]) * moduleWidth;
      const isBar = (i % 2) === 0;
      if(isBar){
        svgBars += `<rect x="${x}" y="0" width="${width}" height="${height}" fill="black" />`;
      }
      x += width;
    }
  });

  const totalWidth = x;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}" preserveAspectRatio="xMidYMid meet" style="max-width:100%; height:auto;">${svgBars}</svg>`;
}

function buildBarcodeLabelHtml(prod, settings){
  // Preserve seller_legal_name before applying defaults
  const sellerName = (settings && settings.seller_legal_name) 
    ? String(settings.seller_legal_name).trim() 
    : ((window.__barcodeShopName||'') || (window.__settingsSellerName||'') || '');
  
  const s = ensureBarcodeSettingsDefaults(settings || {});
  // Restore seller_legal_name if it was lost
  if(sellerName && !s.seller_legal_name){
    s.seller_legal_name = sellerName;
  }
  
  const name = String(prod.name||'').trim();
  const price = Number(prod.price||0);
  const barcode = String(prod.barcode||'').trim();
  // Get shop name from settings
  const shopName = s.seller_legal_name || sellerName || '';

  const safe = (v)=>String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const barcodeHeight = s.barcode_height_px || 40;
  const svg = generateCode128Svg(barcode || name, { moduleWidth: 1, height: barcodeHeight });

  const labelWidthMm = s.barcode_paper_width_mm || 40;
  const labelHeightMm = s.barcode_paper_height_mm || 25;
  // Apply offsets
  const offsetRightMm = s.barcode_label_offset_right_mm || 0;
  const offsetLeftMm = s.barcode_label_offset_left_mm || 0;
  const offsetTopMm = s.barcode_label_offset_top_mm || 0;
  const offsetBottomMm = s.barcode_label_offset_bottom_mm || 0;
  // Calculate available content area (subtract base padding only)
  // We don't subtract offsets from contentWidthMm to ensure layout doesn't break when shifting
  const basePadding = 2; // base padding in mm
  const contentWidthMm = labelWidthMm - (basePadding * 2);

  const parts = [];
  if(s.barcode_show_shop_name && shopName){
    parts.push(`<div style="flex-shrink:0; font-family:'Cairo', system-ui, -apple-system, sans-serif; font-weight:700; font-size:${s.barcode_font_size_shop}px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:${contentWidthMm}mm; line-height:1.3; text-align:center;">${safe(shopName)}</div>`);
  }
  if(s.barcode_show_product_name && name){
    parts.push(`<div style="flex-shrink:0; font-family:'Cairo', system-ui, -apple-system, sans-serif; font-weight:700; font-size:${s.barcode_font_size_product}px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:${contentWidthMm}mm; line-height:1.3; text-align:center;">${safe(name)}</div>`);
  }
  // Ensure barcode SVG fits within content width
  const svgMaxWidth = contentWidthMm - 2; // 1mm margin on each side
  parts.push(`<div style="flex-shrink:0; line-height:1; display:flex; justify-content:center; align-items:center; max-width:${svgMaxWidth}mm; overflow:hidden; width:100%;"><div style="max-width:100%; height:auto; display:block;"><div style="max-width:100%; overflow:hidden;">${svg}</div></div></div>`);
  if(s.barcode_show_barcode_text && barcode){
    parts.push(`<div style="flex-shrink:0; font-family:'Cairo', system-ui, -apple-system, sans-serif; font-weight:700; font-size:${s.barcode_font_size_barcode_text}px; letter-spacing:1px; line-height:1.3; text-align:center; max-width:${contentWidthMm}mm; overflow:hidden; white-space:nowrap;">${safe(barcode)}</div>`);
  }
  if(s.barcode_show_price && price>0){
    parts.push(`<div style="flex-shrink:0; font-family:'Cairo', system-ui, -apple-system, sans-serif; font-weight:700; font-size:${s.barcode_font_size_price}px; line-height:1.3; text-align:center; max-width:${contentWidthMm}mm; overflow:hidden;">${price.toFixed(2)} SAR</div>`);
  }

  // Calculate translation offsets
  // Left offset moves right (+X), Right offset moves left (-X)
  // Top offset moves down (+Y), Bottom offset moves up (-Y)
  const translateX = offsetLeftMm - offsetRightMm;
  const translateY = offsetTopMm - offsetBottomMm;
  
  return `
  <div style="
    box-sizing:border-box;
    width:${labelWidthMm}mm;
    height:${labelHeightMm}mm;
    padding:${basePadding}mm;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:flex-start;
    border:1px solid #e5e7eb;
    border-radius:2px;
    font-family:'Cairo', system-ui, -apple-system, sans-serif;
    font-weight:700;
    text-align:center;
    overflow:hidden;
    background:white;
    max-width:${labelWidthMm}mm;
    max-height:${labelHeightMm}mm;
  ">
    <div style="width:100%; display:flex; flex-direction:column; align-items:center; gap:2px; transform:translate(${translateX}mm, ${translateY}mm)">
      ${parts.join('')}
    </div>
  </div>`;
}

function renderBarcodePreview(prod, settings){
  if(!barcodePreview) return;
  const s = ensureBarcodeSettingsDefaults(settings || {});
  const labelWidthMm = s.barcode_paper_width_mm || 40;
  const labelHeightMm = s.barcode_paper_height_mm || 25;
  
  // Convert mm to pixels for preview (1mm ≈ 7 pixels for very compact preview)
  const scale = 7;
  const previewWidthPx = labelWidthMm * scale;
  const previewHeightPx = labelHeightMm * scale;
  
  // Build preview with exact size - pass full settings object to include seller_legal_name
  const labelHtml = buildBarcodeLabelHtml(prod, settings);
  
  // Scale factor to make the MM-sized content fill the PX-sized container
  // Container is scaled by 'scale' (7px/mm)
  // Content is naturally approx 3.78px/mm (96 DPI)
  // We need to scale content up by (7 / 3.7795) ≈ 1.85
  const cssPixelsPerMm = 3.7795;
  const scaleFactor = scale / cssPixelsPerMm;

  barcodePreview.innerHTML = `<div style="transform: scale(${scaleFactor}); transform-origin: center center;">${labelHtml}</div>`;
  
  // Apply exact size to preview container with modern styling
  barcodePreview.style.width = previewWidthPx + 'px';
  barcodePreview.style.minWidth = previewWidthPx + 'px';
  barcodePreview.style.height = previewHeightPx + 'px';
  barcodePreview.style.maxWidth = '100%';
  barcodePreview.style.overflow = 'hidden';
  barcodePreview.style.padding = '0';
  barcodePreview.style.border = 'none';
  barcodePreview.style.borderRadius = '6px';
  barcodePreview.style.boxShadow = 'none';
  
  // Also ensure wrapper centers properly with minimal spacing
  const wrapper = document.getElementById('barcodePreviewWrapper');
  if(wrapper){
    wrapper.style.display = 'flex';
    wrapper.style.justifyContent = 'center';
    wrapper.style.alignItems = 'center';
    wrapper.style.minHeight = Math.max(previewHeightPx + 12, 120) + 'px';
    wrapper.style.padding = '6px';
  }
}

async function openBarcodeDialog(productId){
  try{
    setBarcodeError('');
    if(!barcodeQtyInput) return;
    // Load full product details if not already cached
    const r = await window.api.products_get(productId);
    if(!r.ok){ setBarcodeError(r.error || 'تعذر جلب بيانات المنتج'); return; }
    currentBarcodeProduct = r.item;
    
    // Always reload settings to get latest values
    const st = await window.api.settings_get();
    if(st && st.ok){
      // Store full settings object (not just defaults) so seller_legal_name is available
      barcodeSettings = st.item || {};
      // Ensure defaults are applied
      barcodeSettings = ensureBarcodeSettingsDefaults(barcodeSettings);
      // Ensure seller name is available
      if(st.item && st.item.seller_legal_name){
        window.__settingsSellerName = String(st.item.seller_legal_name).trim();
        window.__barcodeShopName = String(st.item.seller_legal_name).trim();
      }
    }else{
      barcodeSettings = ensureBarcodeSettingsDefaults(null);
    }
    
    barcodeQtyInput.value = '1';
    // Pass full settings object (with seller_legal_name) to preview
    renderBarcodePreview(currentBarcodeProduct, st && st.ok ? st.item : barcodeSettings);
    try{ barcodeDlg.showModal(); }catch(_){ try{ barcodeDlg.close(); barcodeDlg.showModal(); }catch(__){} }
  }catch(e){
    setBarcodeError('حدث خطأ أثناء فتح شاشة الباركود: ' + (e && e.message ? e.message : ''));
  }
}

barcodeCancelBtn?.addEventListener('click', () => {
  try{ barcodeDlg.close(); }catch(_){}
});

barcodePrintBtn?.addEventListener('click', async () => {
  if(!currentBarcodeProduct){ setBarcodeError('لا يوجد منتج محدد'); return; }
  const rawQty = Number(barcodeQtyInput?.value || 1);
  const qty = Math.max(1, isFinite(rawQty) ? Math.floor(rawQty) : 1);
  try{
    setBarcodeError('');
    barcodePrintBtn.disabled = true;
    barcodePrintBtn.textContent = 'جاري الطباعة...';
    
    // Reload settings to ensure latest values
    const st = await window.api.settings_get();
    const fullSettings = (st && st.ok) ? (st.item || {}) : (barcodeSettings || {});
    const s = ensureBarcodeSettingsDefaults(fullSettings);
    
    // Pass full settings object (with seller_legal_name) to buildBarcodeLabelHtml
    const labelHtml = buildBarcodeLabelHtml(currentBarcodeProduct, fullSettings);
    const widthMm = s.barcode_paper_width_mm || 40;
    const heightMm = s.barcode_paper_height_mm || 25;
    
    // Build single label HTML page
    const buildLabelPage = () => `
      <!doctype html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8"/>
        <style>
          @page { 
            margin: 0; 
            size: ${widthMm}mm ${heightMm}mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            margin:0;
            padding:0;
            direction: rtl;
            font-family:'Cairo', system-ui, -apple-system, sans-serif;
            font-weight:700;
            width: ${widthMm}mm;
            height: ${heightMm}mm;
            overflow: hidden;
          }
        </style>
      </head>
      <body>
        ${labelHtml}
      </body>
      </html>
    `;
    
    const pageSize = { width: Math.round(widthMm * 1000), height: Math.round(heightMm * 1000) }; // microns
    const printOpts = {
      silent: true,
      deviceName: s.barcode_printer_device_name || undefined,
      printBackground: true,
      copies: 1,
      pageSize: pageSize
    };
    
    // Print each label as a separate page
    let successCount = 0;
    let errorCount = 0;
    for(let i = 0; i < qty; i++){
      try{
        const body = buildLabelPage();
        const res = await window.api.print_html(body, printOpts);
        if(res && res.ok){
          successCount++;
          // Small delay between prints to avoid overwhelming the printer
          if(i < qty - 1){
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } else {
          errorCount++;
        }
      } catch(e){
        errorCount++;
        console.error('Print error for label', i + 1, ':', e);
      }
    }
    
    if(errorCount > 0){
      setBarcodeError(`تم طباعة ${successCount} من ${qty} استيكر. فشل ${errorCount} استيكر.`);
    } else {
      try{ barcodeDlg.close(); }catch(_){}
    }
    
    barcodePrintBtn.disabled = false;
    barcodePrintBtn.textContent = '🖨️ طباعة';
  }catch(e){
    setBarcodeError('فشل طباعة الباركود: ' + (e && e.message ? e.message : ''));
    console.error('Barcode print error:', e);
    barcodePrintBtn.disabled = false;
    barcodePrintBtn.textContent = '🖨️ طباعة';
  }
});

const btnDownloadTemplate = document.getElementById('btnDownloadTemplate');
if(btnDownloadTemplate){
  btnDownloadTemplate.addEventListener('click', async () => {
    try {
      btnDownloadTemplate.disabled = true;
      btnDownloadTemplate.textContent = 'جاري التحميل...';
      
      const result = await window.api.products_download_template();
      
      if(result && result.ok){
        errorDiv.textContent = '✓ تم حفظ الملف النموذجي بنجاح';
        errorDiv.className = 'text-green-700 bg-green-50 border border-green-200 px-4 py-2.5 rounded-lg min-h-[22px] my-2 text-center font-medium';
        setTimeout(() => { 
          errorDiv.textContent = ''; 
          errorDiv.className = 'error text-red-700 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg min-h-[22px] my-2 text-center font-medium';
        }, 3000);
      } else {
        if(result?.error !== 'تم الإلغاء'){
          errorDiv.textContent = result?.error || 'فشل تحميل الملف النموذجي';
        }
      }
    } catch(err) {
      console.error('Error downloading template:', err);
      errorDiv.textContent = 'فشل تحميل الملف النموذجي: ' + (err.message || 'خطأ غير معروف');
    } finally {
      btnDownloadTemplate.disabled = false;
      btnDownloadTemplate.textContent = '📋 نموذج Excel';
    }
  });
}

(async () => {
  await populateFilterCategories();
  await loadProducts();
})();