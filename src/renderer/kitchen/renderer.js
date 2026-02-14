const tbody = document.getElementById('tbody');
const btnAddPrinter = document.getElementById('btnAddPrinter');
const btnSave = document.getElementById('btnSave');
const btnDelete = document.getElementById('btnDelete');
const btnTest = document.getElementById('btnTest');
const errorDiv = document.getElementById('error');

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

function setError(msg){ if(errorDiv) errorDiv.textContent = msg || ''; }

function safeShowModal(d){
  try{ d.showModal(); }
  catch(_){ try{ d.close(); d.showModal(); } catch(__){} }
}

const confirmDlg = document.getElementById('confirmDlg');
const confirmText = document.getElementById('confirmText');
const confirmOk = document.getElementById('confirmOk');
const confirmCancel = document.getElementById('confirmCancel');
const confirmTitle = document.getElementById('confirmTitle');
const confirmIcon = document.getElementById('confirmIcon');

function customConfirm(msg, iconChar='❓'){
  return new Promise((resolve)=>{
    confirmText.textContent = msg;
    confirmIcon.textContent = iconChar;
    const onOk = ()=>{ confirmDlg.close(); cleanup(); resolve(true); };
    const onCancel = ()=>{ confirmDlg.close(); cleanup(); resolve(false); };
    const cleanup = ()=>{ confirmOk.removeEventListener('click',onOk); confirmCancel.removeEventListener('click',onCancel); confirmDlg.removeEventListener('cancel',onCancel); };
    confirmOk.addEventListener('click', onOk, { once:true });
    confirmCancel.addEventListener('click', onCancel, { once:true });
    confirmDlg.addEventListener('cancel', onCancel, { once:true });
    safeShowModal(confirmDlg);
    setTimeout(()=>{ try{ confirmOk.focus(); }catch(_){ } }, 0);
  });
}

let __perms = new Set();
async function loadPerms(){ try{ const u=JSON.parse(localStorage.getItem('pos_user')||'null'); if(u&&u.id){ const r=await window.api.perms_get_for_user(u.id); if(r&&r.ok){ __perms=new Set(r.keys||[]); } } }catch(_){ __perms=new Set(); } }
function canKitchen(k){ return __perms.has(k); }
(async()=>{ await loadPerms(); try{
  if(btnAddPrinter && !canKitchen('kitchen.add')) btnAddPrinter.style.display='none';
  if(btnSave && !canKitchen('kitchen.edit')) btnSave.style.display='none';
  if(btnDelete && !canKitchen('kitchen.delete')) btnDelete.style.display='none';
  if(btnTest && !canKitchen('kitchen.test')) btnTest.style.display='none';
}catch(_){ } })();
const pDevice = document.getElementById('pDevice');
const pActive = document.getElementById('pActive');
const typeSelect = document.getElementById('typeSelect');
const btnAddType = document.getElementById('btnAddType');
const typeChips = document.getElementById('typeChips');

let allTypes = [];
let printers = [];
let currentId = null;
let currentTypes = [];

function chip(label){
  const x = document.createElement('button'); 
  x.textContent='×'; 
  x.className = 'text-red-600 font-bold mr-1';
  x.style.border='0'; 
  x.style.background='transparent'; 
  x.style.cursor='pointer';
  const wrap = document.createElement('span');
  wrap.className = 'px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold inline-flex items-center gap-1';
  wrap.appendChild(x); 
  wrap.appendChild(document.createTextNode(label));
  x.addEventListener('click', () => { currentTypes = currentTypes.filter(t => t!==label); renderEditor(); });
  return wrap;
}

async function loadTypes(){ try{ const r = await window.api.types_list_all(); allTypes = r.ok ? (r.items||[]) : []; }catch(_){ allTypes = []; } }

function renderEditor(){
  const noTypesEl = document.getElementById('no-types');
  
  typeChips.innerHTML = '';
  
  if (currentTypes.length === 0) {
    if (noTypesEl) noTypesEl.style.display = 'block';
  } else {
    if (noTypesEl) noTypesEl.style.display = 'none';
    
    currentTypes.forEach((t) => {
      const chipEl = chip(t);
      typeChips.appendChild(chipEl);
    });
  }
  
  typeSelect.innerHTML = '';
  const active = allTypes.filter(t => t.is_active!==0);
  active.forEach(t => { const opt = document.createElement('option'); opt.value=t.name; opt.textContent=t.name; typeSelect.appendChild(opt); });
}

function renderTable(){
  tbody.innerHTML = '';
  
  if (printers.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `
      <td colspan="5" class="px-4 py-12 text-center border-b border-gray-100">
        <div class="text-gray-400 text-5xl mb-3">🖨️</div>
        <div class="text-gray-600 font-semibold text-lg mb-1">لا توجد طابعات مضافة</div>
        <div class="text-gray-400 text-sm">اضغط على "إضافة طابعة" للبدء</div>
      </td>
    `;
    tbody.appendChild(emptyRow);
    return;
  }
  
  printers.forEach((p) => {
    const tr = document.createElement('tr');
    
    const statusBadge = p.is_active 
      ? '<span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">✅ مفعلة</span>'
      : '<span class="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">❌ موقوفة</span>';
    
    const typesHtml = (p.types||[]).length > 0
      ? (p.types||[]).map(t=>`<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">${escapeHtml(t)}</span>`).join(' ')
      : '<span class="text-gray-400 text-xs italic">لا توجد أقسام</span>';
    
    tr.innerHTML = `
      <td class="px-4 py-3 border-b border-gray-100 font-medium">${escapeHtml(p.name || p.device_name)}</td>
      <td class="px-4 py-3 border-b border-gray-100"><span class="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">${escapeHtml(p.device_name)}</span></td>
      <td class="px-4 py-3 border-b border-gray-100">
        <div class="flex flex-wrap gap-1">
          ${typesHtml}
        </div>
      </td>
      <td class="px-4 py-3 border-b border-gray-100 text-center">${statusBadge}</td>
      <td class="px-4 py-3 text-center border-b border-gray-100">
        <button class="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium" data-act="edit" data-id="${p.id}">✏️ تعديل</button>
      </td>
    `;
    
    tr.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if(!b) return;
      if(b.dataset.act==='edit'){
        selectPrinter(Number(b.dataset.id));
      }
    });
    
    tbody.appendChild(tr);
  });
}

function selectPrinter(id){
  const p = printers.find(x=>x.id===id);
  currentId = p ? p.id : null;
  pDevice.value = p ? (p.device_name||'') : '';
  pActive.value = p && !p.is_active ? '0' : '1';
  currentTypes = p ? (p.types||[]) : [];
  renderEditor();
}

function escapeHtml(s){ return String(s||'').replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }

btnAddPrinter.addEventListener('click', () => { if(!canKitchen('kitchen.add')) return; currentId=null; pDevice.value=''; pActive.value='1'; currentTypes=[]; renderEditor(); });
btnAddType.addEventListener('click', () => {
  const t = typeSelect.value; 
  if(!t) {
    showToast('يرجى اختيار قسم لإضافته', '#f59e0b', 3000);
    return; 
  }
  
  if(currentTypes.includes(t)){
    showToast('هذا القسم مضاف بالفعل', '#3b82f6', 3000);
    return;
  }
  
  currentTypes.push(t); 
  renderEditor();
  showToast(`تم إضافة قسم "${t}" بنجاح`, '#16a34a');
});

btnSave.addEventListener('click', async () => {
  if(!canKitchen('kitchen.edit')) return;
  
  setError('');
  const payload = {
    device_name: (pDevice.value||'').trim(),
    is_active: Number(pActive.value||'1') ? 1 : 0
  };
  
  if(!payload.device_name){ 
    showToast('اسم الطابعة مطلوب', '#ef4444', 4000);
    return; 
  }
  
  let success = false;
  if(currentId){
    const r = await window.api.kitchen_update(currentId, payload);
    if(!r.ok){ 
      showToast(r.error||'فشل في حفظ التغييرات', '#ef4444', 4000); 
      return; 
    }
    success = true;
    showToast('✓ تم حفظ التغييرات بنجاح', '#16a34a');
  } else {
    const r = await window.api.kitchen_add(payload);
    if(!r.ok){ 
      showToast(r.error||'فشل في إضافة الطابعة', '#ef4444', 4000); 
      return; 
    }
    currentId = r.id;
    success = true;
    showToast('✓ تمت إضافة الطابعة بنجاح', '#16a34a');
  }
  
  if (success) {
    await window.api.kitchen_set_routes(currentId, currentTypes);
    await refresh();
    currentId = null; 
    currentTypes = []; 
    pDevice.value = ''; 
    pActive.value = '1'; 
    renderEditor();
  }
});

btnDelete.addEventListener('click', async () => {
  if(!canKitchen('kitchen.delete')) return;
  if(!currentId){ 
    showToast('يرجى اختيار طابعة للحذف', '#f59e0b', 3000);
    return; 
  }
  
  const confirmed = await customConfirm('هل أنت متأكد من حذف هذه الطابعة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.', '🗑️');
  if(!confirmed) return;
  
  const r = await window.api.kitchen_delete(currentId);
  if(!r.ok){ 
    showToast(r.error||'فشل في حذف الطابعة', '#ef4444', 4000); 
    return; 
  }
  
  showToast('✓ تم حذف الطابعة بنجاح', '#16a34a');
  currentId = null; 
  currentTypes = []; 
  pDevice.value = ''; 
  pActive.value = '1'; 
  renderEditor();
  await refresh();
});

btnTest.addEventListener('click', async () => {
  if(!canKitchen('kitchen.test')) return;
  if(!currentId){ 
    showToast('يرجى اختيار طابعة أولاً', '#f59e0b', 3000);
    return; 
  }
  
  showToast('جاري إرسال أمر الطباعة...', '#3b82f6', 2000);
  
  const r = await window.api.kitchen_test_print(currentId);
  if(!r.ok){ 
    showToast(r.error||'فشل في طباعة الاختبار', '#ef4444', 4000);
    return;
  }
  
  showToast('✓ تم إرسال طباعة الاختبار بنجاح', '#16a34a');
});

async function loadSystemPrinters(){
  try{
    const r = await window.api.kitchen_list_system_printers();
    const items = r.ok ? (r.items||[]) : [];
    pDevice.innerHTML = '';
    items.forEach(pr => {
      const opt = document.createElement('option');
      opt.value = pr.name; opt.textContent = pr.name + (pr.isDefault ? ' (افتراضي)' : '');
      pDevice.appendChild(opt);
    });
  }catch(_){ pDevice.innerHTML = ''; }
}

async function refresh(){
  setError('');
  const r = await window.api.kitchen_list();
  if(!r.ok){
    showToast('فشل في تحميل قائمة الطابعات', '#ef4444', 4000);
    printers = [];
  } else {
    printers = r.items||[];
  }
  renderTable();
}

const btnHome = document.getElementById('btnBackHome'); 
if(btnHome){ 
  btnHome.onclick = () => { 
    window.location.href = '../main/index.html';
  };
}

(async function init(){
  await Promise.all([
    loadTypes(),
    loadSystemPrinters()
  ]);
  renderEditor();
  await refresh();
})();