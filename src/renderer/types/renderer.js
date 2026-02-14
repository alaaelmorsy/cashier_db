const grid = document.getElementById('grid');
const errorDiv = document.getElementById('error');
const btnBack = document.getElementById('btnBack');

const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const mName = document.getElementById('m_name');
const mSave = document.getElementById('m_save');
const mCancel = document.getElementById('m_cancel');
const openAdd = document.getElementById('openAdd');
const refreshBtn = document.getElementById('refreshBtn');

const confirmModal = document.getElementById('confirmModal');
const cTitle = document.getElementById('c_title');
const cMessage = document.getElementById('c_message');
const cOk = document.getElementById('c_ok');
const cCancel = document.getElementById('c_cancel');

let __perms = new Set();
let __isAdmin = false;
let __showHideButton = true;

async function loadPerms(){
  try{
    const u = JSON.parse(localStorage.getItem('pos_user')||'null');
    __isAdmin = !!(u && String(u.role||'').toLowerCase()==='admin');
    if(u && u.id){
      const r = await window.api.perms_get_for_user(u.id);
      if(r && r.ok){ __perms = new Set(r.keys||[]); }
    }
  }catch(_){ __perms = new Set(); __isAdmin = false; }
}

async function loadSettings(){
  try{
    const res = await window.api.settings_get();
    if(res && res.item){
      __showHideButton = !!(res.item.show_hide_type_button);
    }
  }catch(_){ __showHideButton = true; }
}

function canType(k){ return __isAdmin || __perms.has(k); }

(async()=>{ 
  await loadPerms(); 
  await loadSettings();
  try{ if(openAdd && !canType('types.add')) openAdd.style.display='none'; }catch(_){ } 
})();

let modalMode = 'add';
let editId = null;
let errorTimeout = null;

if (btnBack) {
  btnBack.addEventListener('click', () => history.back());
}

function setError(msg, autoHide = false){ 
  errorDiv.textContent = msg || ''; 
  if(errorTimeout){
    clearTimeout(errorTimeout);
    errorTimeout = null;
  }
  if(autoHide && msg){
    errorTimeout = setTimeout(() => {
      errorDiv.textContent = '';
      errorTimeout = null;
    }, 5000);
  }
}

function safeShowModal(dlg) {
  try {
    dlg.showModal();
  } catch (_) {
    try {
      dlg.close();
      dlg.showModal();
    } catch (__) {}
  }
}

function showModal(mode, opts = {}){
  modalMode = mode;
  editId = opts.id ?? null;
  modalTitle.textContent = mode === 'add' ? 'إضافة نوع رئيسي' : 'تعديل نوع رئيسي';
  mName.value = (opts.name || '').trim();
  safeShowModal(modal);
  setTimeout(() => mName.focus(), 0);
}

function hideModal(){
  modal.close();
  mName.value = '';
  editId = null;
}

function showConfirm({ title = 'تأكيد', message = '', onOk }){
  cTitle.textContent = title;
  cMessage.textContent = message;
  safeShowModal(confirmModal);

  function cleanup(){
    confirmModal.close();
    cOk.removeEventListener('click', okHandler);
    cCancel.removeEventListener('click', cancelHandler);
  }
  function okHandler(){ cleanup(); onOk && onOk(); }
  function cancelHandler(){ cleanup(); }
  
  cOk.addEventListener('click', okHandler);
  cCancel.addEventListener('click', cancelHandler);
}

let toastTimer = null;
function showToast({ message = '', type = 'info', duration = 5000 }){
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  const colors = {
    success: '#16a34a',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };
  
  toast.style.background = colors[type] || colors.info;
  toast.textContent = message;
  toast.classList.remove('hidden');
  
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
}

let currentItems = [];
function renderCards(items){
  currentItems = Array.isArray(items)? items.slice() : [];
  grid.innerHTML = '';
  (currentItems||[]).forEach((t, idx) => {
    const card = document.createElement('div');
    card.className = 'type-card bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-3';
    card.setAttribute('draggable','true');
    card.dataset.index = String(idx);
    const active = !!t.is_active;
    
    const badgeClass = active 
      ? 'inline-block text-xs px-2 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 font-medium' 
      : 'inline-block text-xs px-2 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 font-medium';
    
    const isHidden = !!t.hidden_from_sales;
    
    const actionsHtml = `
      <div class="flex gap-2 flex-wrap">
        ${canType('types.edit') ? `<button class="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-sm font-medium" data-act="edit" data-id="${t.id}" data-name="${attrEscape(t.name)}">✏️ تعديل</button>` : ''}
        ${canType('types.toggle') ? `<button class="px-3 py-1.5 ${active ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'} rounded-lg text-sm font-medium" data-act="toggle" data-id="${t.id}">${active ? '⏸️ إيقاف' : '▶️ تفعيل'}</button>` : ''}
        ${(canType('types.toggle') && __showHideButton) ? `<button class="px-3 py-1.5 ${isHidden ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'} rounded-lg text-sm font-medium" data-act="toggle_hide" data-id="${t.id}">${isHidden ? '👁️ إظهار' : '🙈 إخفاء'}</button>` : ''}
        ${canType('types.delete') ? `<button class="px-3 py-1.5 bg-red-100 text-red-800 rounded-lg text-sm font-medium" data-act="delete" data-id="${t.id}">🗑️ حذف</button>` : ''}
      </div>`;
    
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="text-lg font-bold text-gray-800">${escapeHtml(t.name)}</div>
        <span class="${badgeClass}">${active ? 'نشط' : 'موقوف'}</span>
      </div>
      <div class="text-xs text-gray-500">#${t.id} · ترتيب: ${Number(t.sort_order||0)}</div>
      ${actionsHtml}
    `;
    
    card.addEventListener('dragstart', (e)=>{
      window.__type_dragIndex = idx;
      try{ e.dataTransfer.effectAllowed = 'move'; }catch(_){ }
    });
    card.addEventListener('dragover', (e)=>{ e.preventDefault(); card.classList.add('drag-over'); });
    card.addEventListener('dragleave', ()=> card.classList.remove('drag-over'));
    card.addEventListener('drop', async (e)=>{
      e.preventDefault(); card.classList.remove('drag-over');
      const from = Number(window.__type_dragIndex);
      const to = Number(card.dataset.index);
      if(isNaN(from) || isNaN(to) || from===to) return;
      const it = currentItems.splice(from,1)[0];
      currentItems.splice(to,0,it);
      const updates = currentItems.map((x,i)=>({ id: x.id, sort_order: i }));
      const r = await window.api.types_reorder(updates);
      if(!r.ok){ setError(r.error || 'فشل حفظ الترتيب'); return; }
      await loadTypes();
    });
    grid.appendChild(card);
  });
}

function escapeHtml(s){
  return String(s).replace(/[&<>"]+/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}
function attrEscape(s){
  return String(s).replace(/"/g, '&quot;');
}

async function loadTypes(){
  setError('');
  await loadSettings();
  const res = await window.api.types_list_all();
  if(!res.ok){ setError(res.error || 'تعذر تحميل الأنواع'); return; }
  renderCards(res.items);
}

// Open add modal
openAdd.addEventListener('click', () => {
  if(!canType('types.add')) return;
  setError('');
  showModal('add');
});

// Refresh button
refreshBtn?.addEventListener('click', () => loadTypes());

mCancel.addEventListener('click', hideModal);

mSave.addEventListener('click', async () => {
  const name = (mName.value || '').trim();
  if(!name){ setError('يرجى إدخال اسم النوع'); mName.focus(); return; }
  setError('');
  if(modalMode === 'add'){
    const res = await window.api.types_add({ name });
    if(!res.ok){ setError(res.error || 'فشل الحفظ'); return; }
  } else if(modalMode === 'edit' && editId){
    const res = await window.api.types_update(editId, { name });
    if(!res.ok){ setError(res.error || 'فشل التعديل'); return; }
  }
  hideModal();
  await loadTypes();
});

// Enter key to save inside modal
mName.addEventListener('keydown', (e) => {
  if(e.key === 'Enter'){
    e.preventDefault();
    mSave.click();
  }
});

// Grid actions: edit, toggle, delete
grid.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if(!btn) return;
  const id = Number(btn.dataset.id);
  const act = btn.dataset.act;
  setError('');

  if(act === 'edit'){
    if(!canType('types.edit')) return;
    const name = btn.dataset.name || '';
    showModal('edit', { id, name });
    return;
  }

  if(act === 'toggle'){
    if(!canType('types.toggle')) return;
    const r = await window.api.types_toggle(id);
    if(!r.ok){ setError(r.error || 'فشل تحديث الحالة'); return; }
    await loadTypes();
    return;
  }

  if(act === 'toggle_hide'){
    if(!canType('types.toggle')) return;
    const r = await window.api.types_toggle_hide(id);
    if(!r.ok){ setError(r.error || 'فشل تحديث حالة الإخفاء'); return; }
    await loadTypes();
    return;
  }

  if(act === 'delete'){
    if(!canType('types.delete')) return;
    showConfirm({
      title: 'تأكيد الحذف',
      message: 'هل تريد حذف هذا النوع بشكل نهائي؟',
      onOk: async () => {
        const r = await window.api.types_delete(id);
        if(!r.ok){ 
          if(r.cannotDelete){
            showToast({
              message: r.error || 'فشل الحذف',
              type: 'warning',
              duration: 6000
            });
          } else {
            setError(r.error || 'فشل الحذف'); 
          }
          return; 
        }
        await loadTypes();
      }
    });
    return;
  }
});

// Initial
loadTypes();