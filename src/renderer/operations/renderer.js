try{ window.api && window.api.app_on_locale_changed && window.api.app_on_locale_changed((L)=>{ try{ window.__i18n_burst && window.__i18n_burst(L); }catch(_){ } }); }catch(_){ }

const tbody = document.getElementById('tbody');
const errorDiv = document.getElementById('error');
const btnBack = document.getElementById('btnBack');
const addBtn = document.getElementById('addBtn');
const refreshBtn = document.getElementById('refreshBtn');
const operationsCount = document.getElementById('operationsCount');

const dlg = document.getElementById('dlg');
const dlgTitle = document.getElementById('dlgTitle');
const f_name = document.getElementById('f_name');
const dlgSave = document.getElementById('dlgSave');
const dlgCancel = document.getElementById('dlgCancel');

let __perms = new Set();
async function loadPerms(){
  try{
    const u = JSON.parse(localStorage.getItem('pos_user')||'null');
    if(!u || !u.id) return;
    const r = await window.api.perms_get_for_user(u.id);
    if(r && r.ok){ __perms = new Set(r.keys||[]); }
  }catch(_){ __perms = new Set(); }
}

let editId = null;
let currentItems = [];

if (btnBack) {
  btnBack.addEventListener('click', () => history.back());
}

function setError(m){ errorDiv.textContent = m || ''; }
function safeShowModal(d){ try{ d.showModal(); } catch(_){ try{ d.close(); d.showModal(); }catch(__){} } }
function focusFirstField(){ try{ window.focus?.(); setTimeout(()=>{ f_name?.focus(); f_name?.select?.(); },0); }catch(_){} }

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

function openAdd(){
  editId=null; 
  dlgTitle.textContent='إضافة عملية جديدة'; 
  f_name.value='';
  focusFirstField();
  safeShowModal(dlg);
}
function openEdit(item){ 
  editId=item.id; 
  dlgTitle.textContent='تعديل عملية: ' + item.name; 
  f_name.value=item.name||''; 
  focusFirstField();
  safeShowModal(dlg);
}
function closeDlg(){ try{ dlg.close(); }catch(_){ dlg.removeAttribute('open'); } }

// initial load perms and hide top actions based on permissions
(async ()=>{ 
  await loadPerms();
  try{
    if(addBtn && !(__perms.has('operations') && __perms.has('operations.add'))){ addBtn.style.display='none'; }
  }catch(_){ }
})();

function renderRows(items){
  tbody.innerHTML='';
  const has = (k)=> __perms.has('operations') && __perms.has(k);
  
  const activeCount = (items||[]).filter(item => item.is_active).length;
  const totalCount = (items||[]).length;
  operationsCount.textContent = `${totalCount} عملية (${activeCount} نشطة)`;
  
  (items||[]).forEach((it, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-100 last:border-b-0';
    
    const actions = [];
    if(has('operations.edit')) {
      actions.push(`<button class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium" data-act="edit" data-id="${it.id}">✏️ تعديل</button>`);
    }
    if(has('operations.toggle')) {
      const toggleClass = it.is_active ? 'bg-amber-600' : 'bg-green-600';
      const toggleText = it.is_active ? '⏸️ إيقاف' : '▶️ تفعيل';
      actions.push(`<button class="px-3 py-1.5 ${toggleClass} text-white rounded-lg text-sm font-medium" data-act="toggle" data-id="${it.id}">${toggleText}</button>`);
    }
    if(has('operations.delete')) {
      actions.push(`<button class="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium" data-act="del" data-id="${it.id}">🗑️ حذف</button>`);
    }
    
    const statusBadge = it.is_active 
      ? '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-semibold"><span class="w-1.5 h-1.5 bg-green-600 rounded-full"></span>نشطة</span>'
      : '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-semibold"><span class="w-1.5 h-1.5 bg-red-600 rounded-full"></span>موقوفة</span>';
    
    tr.innerHTML = `
      <td class="px-4 py-3 text-gray-500 font-bold">${idx+1}</td>
      <td class="px-4 py-3">
        <div class="font-semibold text-gray-800">${it.name}</div>
        <div class="text-xs text-gray-500 mt-0.5">ترتيب: ${Number(it.sort_order||0)}</div>
      </td>
      <td class="px-4 py-3">${statusBadge}</td>
      <td class="px-4 py-3"><div class="flex gap-2 flex-wrap justify-end">${actions.join('')}</div></td>
    `;
    
    tr.setAttribute('draggable','true');
    tr.dataset.index = String(idx);
    tr.addEventListener('dragstart', (e) => {
      window.__op_dragIndex = idx;
      try{ e.dataTransfer.effectAllowed = 'move'; }catch(_){ }
    });
    tr.addEventListener('dragover', (e) => { e.preventDefault(); });
    tr.addEventListener('drop', async (e) => {
      e.preventDefault();
      const from = Number(window.__op_dragIndex);
      const to = Number(tr.dataset.index);
      if(isNaN(from) || isNaN(to) || from===to) return;
      const item = currentItems.splice(from,1)[0];
      currentItems.splice(to,0,item);
      for(let i=0;i<currentItems.length;i++){
        const it2 = currentItems[i];
        const newOrder = i;
        if(Number(it2.sort_order||0) !== newOrder){
          const r = await window.api.ops_update(it2.id, { name: it2.name, sort_order: newOrder, is_active: it2.is_active });
          if(!r.ok){ setError(r.error||'فشل حفظ الترتيب'); return; }
          it2.sort_order = newOrder;
        }
      }
      await load();
    });
    tbody.appendChild(tr);
  });
}

async function load(){
  setError('');
  
  try {
    const r = await window.api.ops_list();
    if(!r.ok){ 
      setError(r.error||'تعذر تحميل العمليات'); 
      operationsCount.textContent = '0 عملية';
      return; 
    }
    
    currentItems = r.items || [];
    renderRows(currentItems);
    
    if(currentItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center py-12 text-gray-400">
            <div class="text-5xl mb-3">📝</div>
            <div class="font-semibold mb-1">لا توجد عمليات محفوظة</div>
            <div class="text-sm">ابدأ بإضافة عملية جديدة للمنتجات</div>
          </td>
        </tr>
      `;
    }
  } catch(err) {
    setError('حدث خطأ أثناء تحميل البيانات');
    operationsCount.textContent = '0 عملية';
    console.error('Error loading operations:', err);
  }
}

addBtn.addEventListener('click', openAdd);
refreshBtn.addEventListener('click', load);

dlgCancel.addEventListener('click', closeDlg);

dlgSave.addEventListener('click', async () => {
  setError('');
  const name = (f_name.value||'').trim();
  
  if(!name){ 
    setError('يرجى إدخال اسم العملية'); 
    f_name.focus();
    return; 
  }

  if(name.length < 2) {
    setError('اسم العملية يجب أن يكون على الأقل حرفين');
    f_name.focus();
    return;
  }

  // Check for duplicate names (excluding current item when editing)
  const duplicateItem = currentItems.find(item => 
    item.name.trim().toLowerCase() === name.toLowerCase() && 
    item.id !== editId
  );
  
  if(duplicateItem) {
    setError('اسم العملية موجود مسبقاً، يرجى اختيار اسم آخر');
    f_name.focus();
    return;
  }

  // Disable save button during operation
  dlgSave.disabled = true;
  dlgSave.textContent = editId ? '⏳ جاري التعديل...' : '⏳ جاري الحفظ...';

  try {
    let r;
    if(editId){
      // تعديل الاسم فقط، لا نغيّر الترتيب بالأرقام
      const item = currentItems.find(x=>x.id===editId);
      const currentOrder = item ? Number(item.sort_order||0) : 0;
      r = await window.api.ops_update(editId, { name, sort_order: currentOrder, is_active: item ? item.is_active : 1 });
    } else {
      // الإضافة: ضعه في آخر الترتيب
      const next = (currentItems.length ? Math.max(...currentItems.map(x => Number(x.sort_order||0))) + 1 : 0);
      r = await window.api.ops_add({ name, sort_order: next });
    }
    
    if(!r.ok){ 
      setError(r.error||'فشل الحفظ'); 
      return; 
    }
    
    closeDlg();
    await load();
  } catch(err) {
    setError('حدث خطأ أثناء حفظ البيانات');
    console.error('Error saving operation:', err);
  } finally {
    // Re-enable save button
    dlgSave.disabled = false;
    dlgSave.textContent = editId ? '💾 حفظ العملية' : '💾 حفظ العملية';
  }
});

tbody.addEventListener('click', async (e) => {
  const b = e.target.closest('button'); 
  if(!b) return;
  
  const id = Number(b.dataset.id); 
  const act = b.dataset.act;
  setError('');
  
  // Find the item
  const item = (currentItems||[]).find(x=>x.id===id);
  if(!item && act !== 'del'){ 
    setError('العنصر غير موجود'); 
    return; 
  }
  
  if(act==='edit'){
    openEdit(item);
    return;
  }
  
  if(act==='toggle'){
    // Disable button during operation
    const originalText = b.textContent;
    b.disabled = true;
    b.textContent = '⏳ جاري التحديث...';
    
    try {
      const r = await window.api.ops_toggle(id); 
      if(!r.ok){ 
        setError(r.error||'فشل تحديث حالة العملية'); 
        return; 
      }
      await load();
    } catch(err) {
      setError('حدث خطأ أثناء تحديث الحالة');
      console.error('Error toggling operation:', err);
    } finally {
      b.disabled = false;
      b.textContent = originalText;
    }
    return;
  }
  
  if(act==='del'){
    const itemName = item ? item.name : 'العملية';
    const confirmMessage = `هل أنت متأكد من حذف العملية "${itemName}"؟\n\nهذا الإجراء لا يمكن التراجع عنه.`;

    const ok = await customConfirm('تأكيد الحذف', confirmMessage);
    if(!ok) return;
    
    // Disable button during operation
    const originalText = b.textContent;
    b.disabled = true;
    b.textContent = '⏳ جاري الحذف...';
    
    try {
      const r = await window.api.ops_delete(id); 
      if(!r.ok){ 
        if(r.cannotDelete){
          showToast({
            message: r.error || 'فشل حذف العملية',
            type: 'warning',
            duration: 6000
          });
        } else {
          setError(r.error||'فشل حذف العملية'); 
        }
        return; 
      }
      await load();
      setTimeout(()=>{ window.focus?.(); },0);
    } catch(err) {
      setError('حدث خطأ أثناء حذف العملية');
      console.error('Error deleting operation:', err);
    } finally {
      b.disabled = false;
      b.textContent = originalText;
    }
    return;
  }
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // ESC to close modal
  if(e.key === 'Escape' && dlg.open) {
    closeDlg();
  }
  
  // Enter to save when modal is open
  if(e.key === 'Enter' && dlg.open) {
    e.preventDefault();
    dlgSave.click();
  }
  
  // Ctrl+N or Alt+N to add new operation
  if((e.ctrlKey || e.altKey) && e.key === 'n') {
    e.preventDefault();
    if(addBtn.style.display !== 'none') {
      openAdd();
    }
  }
  
  // F5 to refresh
  if(e.key === 'F5') {
    e.preventDefault();
    load();
  }
});

const confirmDlg = document.getElementById('confirmDlg');
const confirmTitle = document.getElementById('confirmTitle');
const confirmText = document.getElementById('confirmText');
const confirmOk = document.getElementById('confirmOk');
const confirmCancel = document.getElementById('confirmCancel');

async function customConfirm(title, text){
  if(!confirmDlg || !confirmText || !confirmOk || !confirmCancel){
    return window.confirm(text || title || 'تأكيد؟');
  }
  if(confirmTitle) confirmTitle.textContent = title || 'تأكيد';
  confirmText.textContent = text || '';
  let res=false;
  const onOk = ()=>{ res=true; try{ confirmDlg.close(); }catch(_){ } };
  const onCancel = ()=>{ res=false; try{ confirmDlg.close(); }catch(_){ } };
  confirmOk.addEventListener('click', onOk, { once:true });
  confirmCancel.addEventListener('click', onCancel, { once:true });
  try{ safeShowModal(confirmDlg); }catch(_){ }
  return await new Promise(resolve=>{
    confirmDlg.addEventListener('close', ()=>{ setTimeout(()=>{ window.focus?.(); resolve(res); },0); }, { once:true });
  });
}

// Close modal when clicking backdrop
dlg.addEventListener('click', (e) => {
  if(e.target === dlg) {
    closeDlg();
  }
});

// Initial load
load();