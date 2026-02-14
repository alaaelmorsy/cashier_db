// Customer pricing renderer
const rulesTbody = document.getElementById('rulesTbody');
const searchBox = document.getElementById('searchBox');
const searchBtn = document.getElementById('searchBtn');
const addBtn = document.getElementById('addBtn');
const backBtn = document.getElementById('backBtn');

// Permissions
let __perms = new Set();
async function loadPerms(){ try{ const u=JSON.parse(localStorage.getItem('pos_user')||'null'); if(u&&u.id){ const r=await window.api.perms_get_for_user(u.id); if(r&&r.ok){ __perms=new Set(r.keys||[]); } } }catch(_){ __perms=new Set(); } }
function canCP(k){ return __perms.has(k); }
(async()=>{ await loadPerms(); try{ if(addBtn && !canCP('customer_pricing.add')) addBtn.style.display='none'; }catch(_){ } })();

const dlg = document.getElementById('dlg');
const dlgCancel = document.getElementById('dlgCancel');
const dlgSave = document.getElementById('dlgSave');

const custSearch = document.getElementById('custSearch');
const prodSearch = document.getElementById('prodSearch');
const custSuggest = document.getElementById('custSuggest');
const prodSuggest = document.getElementById('prodSuggest');
const custSelected = document.getElementById('custSelected');
const addProductBtn = document.getElementById('addProductBtn');
const selectedProductsList = document.getElementById('selectedProductsList');
const modeSelect = document.getElementById('modeSelect');
const previewSection = document.getElementById('previewSection');
const previewContent = document.getElementById('previewContent');

let selectedCustomer = null;
let selectedProducts = [];
let tempSelectedProduct = null;
let editingId = null;

function fmtRule(r){
  if (r.price_cash != null) return `<span class="text-green-600 font-semibold">💵 ${Number(r.price_cash).toFixed(2)} ريال</span>`;
  if (r.discount_percent != null) return `<span class="text-orange-600 font-semibold">📊 خصم ${Number(r.discount_percent)}%</span>`;
  return '<span class="text-gray-400">—</span>';
}

function openModal(){ 
  try{ dlg.showModal(); }catch(_){ }
  custSuggest.classList.add('hidden'); 
  prodSuggest.classList.add('hidden'); 
  previewSection.classList.add('hidden');
  renderSelectedProducts();
}

function closeModal(){ 
  try{ dlg.close(); }catch(_){ }
  editingId = null; 
  selectedCustomer=null; 
  selectedProducts = [];
  tempSelectedProduct = null;
  custSelected.innerHTML=''; 
  custSelected.classList.add('hidden');
  selectedProductsList.innerHTML = '';
  custSearch.value=''; 
  prodSearch.value=''; 
  modeSelect.value='cash'; 
  custSuggest.classList.add('hidden'); 
  prodSuggest.classList.add('hidden'); 
  previewSection.classList.add('hidden');
}

function updateModeDisplay() {
  // إعادة رسم قائمة المنتجات لتحديث placeholders
  renderSelectedProducts();
}

function updatePreview() {
  const customer = selectedCustomer;
  const products = selectedProducts;
  const mode = modeSelect.value;
  
  if (!customer || products.length === 0) {
    previewSection.classList.add('hidden');
    return;
  }
  
  // جمع جميع القيم المدخلة من المنتجات
  let hasAnyValue = false;
  let previewItems = [];
  
  for (const product of products) {
    let productItems = [];
    
    // عمليات المنتج
    if (product.operations && product.operations.length > 0) {
      for (const op of product.operations) {
        const val = parseFloat(op.value || 0);
        if (val > 0) {
          hasAnyValue = true;
          if (mode === 'cash') {
            productItems.push(`العملية <strong>${op.name}</strong>: <strong class="text-green-600">${val.toFixed(2)} ريال</strong>`);
          } else {
            productItems.push(`العملية <strong>${op.name}</strong>: خصم <strong class="text-orange-600">${val}%</strong>`);
          }
        }
      }
    }
    
    // السعر العام للمنتج
    const generalVal = parseFloat(product.generalValue || 0);
    if (generalVal > 0) {
      hasAnyValue = true;
      if (mode === 'cash') {
        productItems.push(`سعر عام: <strong class="text-green-600">${generalVal.toFixed(2)} ريال</strong>`);
      } else {
        productItems.push(`خصم عام: <strong class="text-orange-600">${generalVal}%</strong>`);
      }
    }
    
    if (productItems.length > 0) {
      previewItems.push(`
        <div class="mb-2">
          <strong class="text-blue-700">📦 ${product.name}</strong>
          <ul class="mr-4 list-disc mt-1">
            ${productItems.map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>
      `);
    }
  }
  
  if (!hasAnyValue) {
    previewSection.classList.add('hidden');
    return;
  }
  
  const previewText = `
    <div>
      <strong class="text-gray-800">العميل: ${customer.name}</strong>
      <div class="mt-2">${previewItems.join('')}</div>
    </div>
  `;
  
  previewContent.innerHTML = previewText;
  previewSection.classList.remove('hidden');
}

function renderSelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = '<p class="text-sm text-gray-500 text-center py-3">لم يتم اختيار أي منتجات بعد</p>';
    return;
  }
  
  const mode = modeSelect.value;
  const placeholder = mode === 'cash' ? 'السعر (ريال)' : 'الخصم (%)';
  const symbol = mode === 'cash' ? '💵' : '📊';
  
  selectedProductsList.innerHTML = selectedProducts.map((p, idx) => {
    let operationsHTML = '';
    
    if (p.operations && p.operations.length > 0) {
      operationsHTML = `
        <div class="mt-2 space-y-1">
          <div class="text-xs font-semibold text-gray-600 mb-1">⚙️ العمليات:</div>
          ${p.operations.map(op => `
            <div class="flex items-center gap-2 bg-white border border-gray-200 rounded px-2 py-1.5">
              <span class="text-xs flex-1 text-gray-700">${op.name}</span>
              <div class="flex items-center gap-1">
                <span class="text-xs text-gray-500">${symbol}</span>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value="${op.value || ''}"
                  placeholder="${placeholder}"
                  data-product-idx="${idx}"
                  data-op-id="${op.id}"
                  class="product-op-input w-20 px-2 py-1 border border-gray-300 rounded text-xs"
                />
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      operationsHTML = `
        <div class="mt-2">
          <div class="flex items-center gap-2 bg-white border border-gray-200 rounded px-2 py-1.5">
            <span class="text-xs flex-1 text-gray-700">سعر عام للمنتج</span>
            <div class="flex items-center gap-1">
              <span class="text-xs text-gray-500">${symbol}</span>
              <input 
                type="number" 
                step="0.01" 
                min="0"
                value=""
                placeholder="${placeholder}"
                data-product-idx="${idx}"
                data-general="true"
                class="product-op-input w-20 px-2 py-1 border border-gray-300 rounded text-xs"
              />
            </div>
          </div>
        </div>
      `;
    }
    
    return `
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <div class="font-medium text-gray-800 text-sm">${p.name}</div>
            ${p.barcode ? `<div class="text-xs text-gray-500">📋 ${p.barcode}</div>` : '<div class="text-xs text-gray-500">(بدون باركود)</div>'}
          </div>
          <button class="px-2 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600" data-remove-idx="${idx}">🗑️</button>
        </div>
        ${operationsHTML}
      </div>
    `;
  }).join('');
  
  // إضافة event listeners للحقول
  const inputs = selectedProductsList.querySelectorAll('.product-op-input');
  inputs.forEach(input => {
    input.addEventListener('input', (e) => {
      const productIdx = parseInt(e.target.getAttribute('data-product-idx'));
      const opId = e.target.getAttribute('data-op-id');
      const isGeneral = e.target.getAttribute('data-general');
      const val = e.target.value;
      
      if (isGeneral) {
        // حفظ السعر العام
        selectedProducts[productIdx].generalValue = val;
      } else {
        // حفظ قيمة العملية
        const op = selectedProducts[productIdx].operations.find(o => o.id == opId);
        if (op) {
          op.value = val;
        }
      }
      
      updatePreview();
    });
  });
  
  updatePreview();
}

async function addProductToList(product) {
  // تحقق من عدم تكرار المنتج
  if (selectedProducts.find(p => p.id === product.id)) {
    showToast('⚠️ هذا المنتج مضاف بالفعل', 'error');
    return;
  }
  
  // تحميل عمليات المنتج
  try {
    const r = await window.api.prod_ops_list(product.id);
    const ops = (r && r.ok) ? (r.items || []) : [];
    product.operations = ops.map(o => ({
      id: o.operation_id || o.id,
      name: o.name,
      value: ''
    }));
  } catch(err) {
    product.operations = [];
  }
  
  selectedProducts.push(product);
  renderSelectedProducts();
  prodSearch.value = '';
  prodSuggest.classList.add('hidden');
}

function renderSuggest(listEl, items, onPick){
  listEl.innerHTML = '';
  items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'px-4 py-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 text-sm';
    row.tabIndex = 0;
    row.textContent = it.__label;
    row.onclick = () => onPick(it);
    row.onkeydown = (e) => { if(e.key==='Enter'){ onPick(it); } };
    listEl.appendChild(row);
  });
  if (items.length) {
    listEl.classList.remove('hidden');
  } else {
    listEl.classList.add('hidden');
  }
}

async function suggestCustomers(q){
  try {
    const r = await window.api.customers_list({ q });
    if(r && r.ok){
      const items = (r.items||[]).map(c => ({...c, __label: `${c.name||''}${c.phone?(' - '+c.phone):''}`}));
      renderSuggest(custSuggest, items, (c) => {
        selectedCustomer = c;
        custSelected.innerHTML = `✅ ${c.name} ${c.phone ? `(${c.phone})` : ''}`;
        custSelected.classList.remove('hidden');
        custSuggest.classList.add('hidden');
        custSearch.value = '';
        updatePreview();
      });
    }
  } catch(err) {
    console.error('خطأ في البحث عن العملاء:', err);
  }
}

async function suggestProducts(q){
  try {
    // Try barcode exact first, otherwise use list search
    let items = [];
    try{
      const br = await window.api.products_get_by_barcode(q);
      if(br && br.ok && br.item){ items = [br.item]; }
    }catch(_){ }
    if(!items.length){
      const r = await window.api.products_list({ q });
      if(r && r.ok){ items = r.items || []; }
    }
    const mapped = items.map(p => ({...p, __label: `${p.name||''}${p.barcode?(' - '+p.barcode):''}`}));
    renderSuggest(prodSuggest, mapped, async (p) => {
      tempSelectedProduct = p;
      prodSearch.value = `${p.name||''}${p.barcode?(' - '+p.barcode):''}`;
      prodSuggest.classList.add('hidden');
    });
  } catch(err) {
    console.error('خطأ في البحث عن المنتجات:', err);
  }
}

async function loadRules(){
  const q = searchBox.value.trim();
  
  rulesTbody.innerHTML = `
    <tr>
      <td colspan="6" class="text-center py-10 text-gray-500">
        ⏳ جاري تحميل البيانات...
      </td>
    </tr>
  `;
  
  try {
    const r = await window.api.cust_price_list({ q });
    if (!(r && r.ok)) { 
      rulesTbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-10 text-red-600">
            ❌ فشل في تحميل البيانات<br>
            <small>يرجى المحاولة مرة أخرى</small>
          </td>
        </tr>
      `; 
      return; 
    }
    
    const rows = r.items || [];
    if (!rows.length) { 
      const emptyMessage = q ? 
        `<tr>
          <td colspan="6" class="text-center py-10 text-gray-500">
            <h3 class="text-lg font-semibold mb-2">🔍 لا توجد نتائج</h3>
            <p class="text-sm">لم يتم العثور على تخصيصات تطابق البحث "${q}"</p>
          </td>
        </tr>` :
        `<tr>
          <td colspan="6" class="text-center py-10 text-gray-500">
            <h3 class="text-lg font-semibold mb-2">✨ لا توجد تخصيصات حالياً</h3>
            <p class="text-sm">ابدأ بإضافة تخصيص جديد للأسعار من الأعلى</p>
          </td>
        </tr>`;
      rulesTbody.innerHTML = emptyMessage;
      return; 
    }
    
    rulesTbody.innerHTML = rows.map((it, idx) => `
      <tr class="border-b border-gray-100 hover:bg-gray-50">
        <td class="px-4 py-3 text-center font-semibold text-gray-500">${idx+1}</td>
        <td class="px-4 py-3">
          <div class="font-medium text-gray-800">${it.customer_name || 'غير محدد'}</div>
          ${it.customer_phone ? `<div class="text-xs text-gray-500">📱 ${it.customer_phone}</div>` : ''}
        </td>
        <td class="px-4 py-3">
          <div class="font-medium text-gray-800">${it.product_name || 'غير محدد'}</div>
          ${it.product_barcode ? `<div class="text-xs text-gray-500">📋 ${it.product_barcode}</div>` : ''}
        </td>
        <td class="px-4 py-3 text-center">
          ${it.operation_name ? `<span class="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium border border-green-200">⚙️ ${it.operation_name}</span>` : '<span class="text-gray-400">—</span>'}
        </td>
        <td class="px-4 py-3 text-center">${fmtRule(it)}</td>
        <td class="px-4 py-3 text-center">
          <div class="flex gap-2 justify-center">
            ${canCP('customer_pricing.edit') ? `<button class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium" data-edit="${it.id}" data-json='${JSON.stringify(it).replace(/'/g, "&#39;")}'>✏️ تعديل</button>` : ''}
            ${canCP('customer_pricing.delete') ? `<button class="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium" data-del="${it.id}">🗑️ حذف</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  } catch(err) {
    rulesTbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-10 text-red-600">
          ❌ خطأ في الاتصال بقاعدة البيانات<br>
          <small>${err.message || 'يرجى المحاولة مرة أخرى'}</small>
        </td>
      </tr>
    `;
  }
}

searchBtn.addEventListener('click', loadRules);
addBtn.addEventListener('click', () => { if(!canCP('customer_pricing.add')) return; openModal(); focusFirstField(); });
backBtn.addEventListener('click', () => { window.location.href = '../main/index.html'; });

dlgCancel.addEventListener('click', () => closeModal());

// إضافة منتج للقائمة
addProductBtn.addEventListener('click', () => {
  if (!tempSelectedProduct) {
    showToast('⚠️ يرجى البحث عن منتج واختياره أولاً', 'error');
    return;
  }
  addProductToList(tempSelectedProduct);
  tempSelectedProduct = null;
});

// حذف منتج من القائمة
selectedProductsList.addEventListener('click', (e) => {
  const removeBtn = e.target.closest('button[data-remove-idx]');
  if (removeBtn) {
    const idx = parseInt(removeBtn.getAttribute('data-remove-idx'));
    selectedProducts.splice(idx, 1);
    renderSelectedProducts();
  }
});

// Focus and dialog helpers to avoid native blocking dialogs issues on Windows/Electron
function focusFirstField(){
  try{
    window.focus?.();
    setTimeout(()=>{
      const first = document.querySelector('#custSearch, #prodSearch, input, select, textarea');
      if(first){
        try{ first.focus(); }catch(_){ }
        try{ first.select?.(); }catch(_){ }
      }
    },0);
  }catch(_){ }
}

// In-app confirm/alert using <dialog id="confirmDlg">
const confirmDlg = document.getElementById('confirmDlg');
const confirmText = document.getElementById('confirmText');
const confirmOk = document.getElementById('confirmOk');
const confirmCancel = document.getElementById('confirmCancel');

function safeShowModal(d){
  try{ d.showModal(); }
  catch(_){ try{ d.close(); }catch(__){} try{ d.showModal(); }catch(__){} }
}

async function customConfirm(title, text){
  if(!confirmDlg || !confirmText || !confirmOk || !confirmCancel){
    return window.confirm(text || title || 'تأكيد؟');
  }
  try{ const h = confirmDlg.querySelector('header'); if(h) h.textContent = title || 'تأكيد'; }catch(_){ }
  confirmText.textContent = text || '';
  let res=false;
  const onOk = ()=>{ res=true; try{ confirmDlg.close(); }catch(_){ confirmDlg.removeAttribute('open'); } };
  const onCancel = ()=>{ res=false; try{ confirmDlg.close(); }catch(_){ confirmDlg.removeAttribute('open'); } };
  confirmOk.addEventListener('click', onOk, { once:true });
  confirmCancel.addEventListener('click', onCancel, { once:true });
  try{ safeShowModal(confirmDlg); }catch(_){ }
  return await new Promise(resolve=>{
    confirmDlg.addEventListener('close', ()=>{ setTimeout(()=>{ window.focus?.(); resolve(res); },0); }, { once:true });
  });
}

async function customAlert(text){
  if(!confirmDlg || !confirmText || !confirmOk || !confirmCancel){
    window.alert(text);
    return;
  }
  try{ const h = confirmDlg.querySelector('header'); if(h) h.textContent = 'تنبيه'; }catch(_){ }
  confirmText.textContent = text || '';
  const prev = confirmCancel.style.display;
  confirmCancel.style.display = 'none';
  const onOk = ()=>{ try{ confirmDlg.close(); }catch(_){ confirmDlg.removeAttribute('open'); } };
  confirmOk.addEventListener('click', onOk, { once:true });
  try{ safeShowModal(confirmDlg); }catch(_){ }
  await new Promise(resolve=>{
    confirmDlg.addEventListener('close', ()=>{ confirmCancel.style.display = prev; setTimeout(()=>{ window.focus?.(); resolve(); },0); }, { once:true });
  });
}

// Event listeners for enhanced functionality
modeSelect.addEventListener('change', updateModeDisplay);

// Enhanced search functionality
let searchTimeout;
custSearch.addEventListener('input', () => { 
  const q = custSearch.value.trim(); 
  clearTimeout(searchTimeout);
  if(q.length >= 2){ 
    searchTimeout = setTimeout(() => suggestCustomers(q), 300);
  } else { 
    custSuggest.classList.add('hidden'); 
  } 
});

prodSearch.addEventListener('input', () => { 
  const q = prodSearch.value.trim(); 
  clearTimeout(searchTimeout);
  if(q.length >= 1){ 
    searchTimeout = setTimeout(() => suggestProducts(q), 300);
  } else { 
    prodSuggest.classList.add('hidden'); 
  } 
});

// Enhanced search with Enter key
searchBox.addEventListener('keypress', (e) => {
  if(e.key === 'Enter') {
    e.preventDefault();
    loadRules();
  }
});

// إضافة منتج بضغط Enter
prodSearch.addEventListener('keypress', (e) => {
  if(e.key === 'Enter') {
    e.preventDefault();
    if (tempSelectedProduct) {
      addProductToList(tempSelectedProduct);
      tempSelectedProduct = null;
    }
  }
});

// Hide suggestions when clicking outside
document.addEventListener('click', (e) => {
  if (!custSearch.contains(e.target) && !custSuggest.contains(e.target)) {
    custSuggest.classList.add('hidden');
  }
  if (!prodSearch.contains(e.target) && !prodSuggest.contains(e.target)) {
    prodSuggest.classList.add('hidden');
  }
});

dlgSave.addEventListener('click', async () => {
  // التحقق من صحة البيانات
  if (!selectedCustomer) { 
    showToast('⚠️ يرجى اختيار العميل أولاً', 'error'); 
    custSearch.focus();
    return; 
  }
  
  if (selectedProducts.length === 0) { 
    showToast('⚠️ يرجى إضافة منتج واحد على الأقل', 'error'); 
    prodSearch.focus();
    return; 
  }
  
  const mode = modeSelect.value;
  
  // التحقق من وجود قيم مدخلة
  let hasAnyValue = false;
  for (const product of selectedProducts) {
    if (product.generalValue && Number(product.generalValue) > 0) {
      hasAnyValue = true;
      // التحقق من نسبة الخصم
      if (mode === 'percent' && Number(product.generalValue) >= 100) {
        showToast(`⚠️ نسبة الخصم للمنتج "${product.name}" يجب أن تكون أقل من 100%`, 'error');
        return;
      }
    }
    if (product.operations) {
      for (const op of product.operations) {
        if (op.value && Number(op.value) > 0) {
          hasAnyValue = true;
          // التحقق من نسبة الخصم
          if (mode === 'percent' && Number(op.value) >= 100) {
            showToast(`⚠️ نسبة الخصم للعملية "${op.name}" في المنتج "${product.name}" يجب أن تكون أقل من 100%`, 'error');
            return;
          }
        }
      }
    }
  }
  
  if (!hasAnyValue) {
    showToast('⚠️ يرجى إدخال سعر واحد على الأقل لأحد المنتجات أو العمليات', 'error');
    return;
  }
  
  // تعطيل الزر أثناء المعالجة
  const originalText = dlgSave.innerHTML;
  dlgSave.innerHTML = '⏳ جاري الحفظ...';
  dlgSave.disabled = true;
  
  try {
    let successCount = 0;
    let failCount = 0;
    
    // حفظ تخصيص لكل منتج
    for (const product of selectedProducts) {
      // إذا كانت هناك عمليات مع قيم، احفظ كل عملية
      if (product.operations && product.operations.length > 0) {
        for (const op of product.operations) {
          const val = Number(op.value || 0);
          if (val > 0) {
            const payload = { 
              customer_id: selectedCustomer.id, 
              product_id: product.id, 
              operation_id: op.id, 
              mode, 
              value: val 
            };
            
            let r;
            if (editingId){ 
              r = await window.api.cust_price_update(editingId, payload); 
            } else { 
              r = await window.api.cust_price_upsert(payload); 
            }
            
            if (r && r.ok) {
              successCount++;
            } else {
              failCount++;
            }
          }
        }
      }
      
      // حفظ السعر العام إذا كان موجوداً
      const generalVal = Number(product.generalValue || 0);
      if (generalVal > 0) {
        const payload = { 
          customer_id: selectedCustomer.id, 
          product_id: product.id, 
          operation_id: null, 
          mode, 
          value: generalVal 
        };
        
        let r;
        if (editingId){ 
          r = await window.api.cust_price_update(editingId, payload); 
        } else { 
          r = await window.api.cust_price_upsert(payload); 
        }
        
        if (r && r.ok) {
          successCount++;
        } else {
          failCount++;
        }
      }
    }
    
    if (successCount > 0) {
      showToast(`✅ تم حفظ ${successCount} تخصيص بنجاح!`, 'success');
      closeModal(); 
      await loadRules(); 
    }
    
    if (failCount > 0) {
      showToast(`⚠️ فشل حفظ ${failCount} من التخصيصات`, 'error');
    }
  } catch(err) {
    showToast('❌ خطأ في الاتصال بالخادم', 'error');
  } finally {
    // استعادة الزر
    dlgSave.innerHTML = originalText;
    dlgSave.disabled = false;
  }
});

// Toast notification system
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white';
  toast.innerHTML = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 12px;
    font-weight: 500;
    z-index: 10000;
    min-width: 250px;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    if (toast.parentNode) {
      document.body.removeChild(toast);
    }
  }, 3000);
}

rulesTbody.addEventListener('click', async (e) => {
  const del = e.target.closest('button[data-del]');
  if (del){
    if(!canCP('customer_pricing.delete')) return;
    
    const id = Number(del.getAttribute('data-del'));
    const row = del.closest('tr');
    const customerName = row.querySelector('td:nth-child(2) div:first-child')?.textContent || 'العميل';
    const productName = row.querySelector('td:nth-child(3) div:first-child')?.textContent || 'المنتج';
    
    const ok = await customConfirm('تأكيد الحذف', `🗑️ تأكيد حذف تخصيص السعر\n\nالعميل: ${customerName}\nالمنتج: ${productName}\n\nسيتم حذف التخصيص نهائياً ولا يمكن التراجع عن هذا الإجراء.`);
if(!ok) return;
    
    // تعطيل الزر أثناء المعالجة
    const originalText = del.innerHTML;
    del.innerHTML = '⏳ جاري الحذف...';
    del.disabled = true;
    
    try {
      const r = await window.api.cust_price_delete(id);
      if (r && r.ok){ 
        showToast('✅ تم حذف التخصيص بنجاح!', 'success');
        await loadRules(); 
      } else { 
        showToast('❌ فشل في حذف التخصيص', 'error');
        del.innerHTML = originalText;
        del.disabled = false;
      }
    } catch(err) {
      showToast('❌ خطأ في الاتصال', 'error');
      del.innerHTML = originalText;
      del.disabled = false;
    }
    return;
  }
  
  const edit = e.target.closest('button[data-edit]');
  if (edit){
    if(!canCP('customer_pricing.edit')) return;
    
    try{
      const raw = edit.getAttribute('data-json');
      const it = JSON.parse(raw.replace(/&#39;/g, "'"));
      
      // تعيين القيم المبدئية
      selectedCustomer = { id: it.customer_id, name: it.customer_name, phone: it.customer_phone };
      
      // تحميل المنتج مع عملياته
      const product = { id: it.product_id, name: it.product_name, barcode: it.product_barcode };
      
      // تحميل عمليات المنتج
      try {
        const r = await window.api.prod_ops_list(product.id);
        const ops = (r && r.ok) ? (r.items || []) : [];
        product.operations = ops.map(o => ({
          id: o.operation_id || o.id,
          name: o.name,
          value: ''
        }));
        
        // ملء قيمة العملية إذا كان التخصيص لعملية محددة
        if (it.operation_id) {
          const op = product.operations.find(o => o.id == it.operation_id);
          if (op) {
            const val = it.price_cash != null ? it.price_cash : it.discount_percent;
            op.value = String(val || '');
          }
        } else {
          // ملء القيمة العامة إذا لم تكن هناك عملية محددة
          const val = it.price_cash != null ? it.price_cash : it.discount_percent;
          product.generalValue = String(val || '');
        }
      } catch(err) {
        product.operations = [];
      }
      
      selectedProducts = [product];
      
      // عرض العميل المختار
      custSelected.innerHTML = `✅ ${selectedCustomer.name} ${selectedCustomer.phone ? `(${selectedCustomer.phone})` : ''}`;
      custSelected.classList.remove('hidden');
      
      // مسح حقول البحث
      custSearch.value = '';
      prodSearch.value = '';
      
      // تعيين نوع التخصيص
      if(it.price_cash != null){ 
        modeSelect.value = 'cash'; 
      } else if(it.discount_percent != null){ 
        modeSelect.value = 'percent'; 
      } else { 
        modeSelect.value = 'cash'; 
      }
      
      // عرض قائمة المنتجات (سيتم ملء القيم تلقائياً)
      renderSelectedProducts();
      
      editingId = it.id;
      openModal();
    }catch(err){ 
      console.error(err); 
      showToast('❌ تعذر فتح التعديل', 'error');
    }
  }
});

// initial: ensure permissions loaded before first render to show action buttons
(async()=>{ await loadPerms(); await loadRules(); })();