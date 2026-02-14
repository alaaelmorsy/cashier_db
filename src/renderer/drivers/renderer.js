// Drivers screen renderer
const btnBackHome = document.getElementById('btnBackHome');
if(btnBackHome){ btnBackHome.onclick = ()=>{ window.location.href = '../main/index.html'; }; }

const dSearch = document.getElementById('dSearch');
const dTbody = document.getElementById('dTbody');

// Dialog elements
const driverDialog = document.getElementById('driverDialog');
const addDriverBtn = document.getElementById('addDriverBtn');
const dlgName = document.getElementById('dlgName');
const dlgPhone = document.getElementById('dlgPhone');
const dlgTitle = document.getElementById('dlgTitle');
const dlgSave = document.getElementById('dlgSave');
const dlgCancel = document.getElementById('dlgCancel');

// Track edit mode
let editingDriverId = null;

// Permissions (child-only)
let __perms = new Set();
async function loadPerms(){
  try{
    const u = JSON.parse(localStorage.getItem('pos_user')||'null');
    if(u && u.id){ const r = await window.api.perms_get_for_user(u.id); if(r && r.ok){ __perms = new Set(r.keys||[]); } }
  }catch(_){ __perms = new Set(); }
}
function canDrv(k){ return __perms.has('drivers') && __perms.has(k); }

function rowTpl(d){
  const statusBadge = d.active 
    ? '<span class="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">✅ نشط</span>'
    : '<span class="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">⏸️ موقوف</span>';
  const toggleBtnClass = d.active ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600';
  const toggleIcon = d.active ? '⏸️' : '▶️';
  const toggleText = d.active ? 'إيقاف' : 'تنشيط';
  
  return `<tr class="border-b border-gray-100 hover:bg-gray-50">
    <td class="px-4 py-3">
      <div class="px-3 py-2 font-medium text-gray-800">${d.name||'-'}</div>
    </td>
    <td class="px-4 py-3">
      <div class="px-3 py-2 text-gray-700">${d.phone||'-'}</div>
    </td>
    <td class="px-4 py-3 text-center">
      ${statusBadge}
    </td>
    <td class="px-4 py-3 text-center">
      <div class="flex gap-2 justify-center items-center whitespace-nowrap">
        ${canDrv('drivers.edit') ? `<button data-act="edit" data-id="${d.id}" data-name="${(d.name||'').replace(/"/g, '&quot;')}" data-phone="${(d.phone||'').replace(/"/g, '&quot;')}" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium whitespace-nowrap">✏️ تعديل</button>` : ''}
        ${canDrv('drivers.toggle') ? `<button data-act="toggle" data-id="${d.id}" class="px-3 py-1.5 ${toggleBtnClass} text-white rounded-lg text-sm font-medium whitespace-nowrap">${toggleIcon} ${toggleText}</button>` : ''}
        ${canDrv('drivers.delete') ? `<button data-act="delete" data-id="${d.id}" class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium whitespace-nowrap">🗑️ حذف</button>` : ''}
      </div>
    </td>
  </tr>`;
}

async function load(term){
  // إظهار مؤشر تحميل
  dTbody.innerHTML = `
    <tr>
      <td colspan="4" class="text-center py-10 text-gray-500">
        ⏳ جاري تحميل البيانات...
      </td>
    </tr>
  `;
  
  try {
    const r = await window.api.drivers_list({ term: term||'', only_active: 0 });
    if(r && r.ok){
      const items = r.items || [];
      if(items.length > 0){
        dTbody.innerHTML = items.map(rowTpl).join('');
      } else {
        // رسالة عندما لا توجد بيانات
        const emptyMessage = term ? 
          `<tr>
            <td colspan="4" class="text-center py-10">
              <div class="text-gray-400 space-y-2">
                <div class="text-4xl">🔍</div>
                <h3 class="text-lg font-semibold text-gray-700">لا توجد نتائج</h3>
                <p class="text-sm text-gray-500">لم يتم العثور على سائقين يطابقون البحث "${term}"</p>
              </div>
            </td>
          </tr>` :
          `<tr>
            <td colspan="4" class="text-center py-10">
              <div class="text-gray-400 space-y-2">
                <div class="text-4xl">🚗</div>
                <h3 class="text-lg font-semibold text-gray-700">لا يوجد سائقون حالياً</h3>
                <p class="text-sm text-gray-500">ابدأ بإضافة سائق جديد من الأعلى</p>
              </div>
            </td>
          </tr>`;
        dTbody.innerHTML = emptyMessage;
      }
    } else {
      // خطأ في التحميل
      dTbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center py-10 text-red-600">
            <div class="space-y-2">
              <div class="text-2xl">❌</div>
              <p class="font-semibold">حدث خطأ في تحميل البيانات</p>
              <p class="text-sm">يرجى المحاولة مرة أخرى</p>
            </div>
          </td>
        </tr>
      `;
    }
  } catch(err) {
    dTbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center py-10 text-red-600">
          <div class="space-y-2">
            <div class="text-2xl">❌</div>
            <p class="font-semibold">خطأ في الاتصال بقاعدة البيانات</p>
            <p class="text-sm">${err.message || 'يرجى المحاولة مرة أخرى'}</p>
          </div>
        </td>
      </tr>
    `;
  }
}

// Open dialog for adding driver
function openAddDialog(){
  if(!canDrv('drivers.add')) return;
  
  // Reset form and edit mode
  editingDriverId = null;
  dlgName.value = '';
  dlgPhone.value = '';
  dlgTitle.textContent = 'إضافة سائق جديد';
  
  // Show dialog
  try {
    driverDialog.showModal();
    setTimeout(() => dlgName.focus(), 100);
  } catch(e) {
    console.error('Error opening dialog:', e);
  }
}

// Open dialog for editing driver
function openEditDialog(id, name, phone){
  if(!canDrv('drivers.edit')) return;
  
  // Set edit mode
  editingDriverId = id;
  dlgName.value = name || '';
  dlgPhone.value = phone || '';
  dlgTitle.textContent = 'تعديل بيانات السائق';
  
  // Show dialog
  try {
    driverDialog.showModal();
    setTimeout(() => dlgName.focus(), 100);
  } catch(e) {
    console.error('Error opening dialog:', e);
  }
}

// Close dialog
function closeDialog(){
  editingDriverId = null;
  try {
    driverDialog.close();
  } catch(e) {
    driverDialog.removeAttribute('open');
  }
}

// Save driver from dialog
async function saveDriver(){
  const name = (dlgName.value||'').trim();
  const phone = (dlgPhone.value||'').trim();
  
  if(!name){ 
    showToast('⚠️ يرجى إدخال اسم السائق', 'error'); 
    dlgName.focus();
    return; 
  }
  
  // Disable button during processing
  const originalText = dlgSave.innerHTML;
  dlgSave.innerHTML = '⏳ جاري الحفظ...';
  dlgSave.disabled = true;
  
  try {
    let r;
    if(editingDriverId){
      // Edit mode
      if(!canDrv('drivers.edit')) return;
      r = await window.api.drivers_update(editingDriverId, { name, phone });
      if(r && r.ok){ 
        showToast('✅ تم تحديث بيانات السائق بنجاح!', 'success');
        closeDialog();
        await load(dSearch.value||''); 
      } else {
        showToast('❌ فشل في تحديث البيانات', 'error');
      }
    } else {
      // Add mode
      if(!canDrv('drivers.add')) return;
      r = await window.api.drivers_add({ name, phone });
      if(r && r.ok){ 
        showToast('✅ تم إضافة السائق بنجاح!', 'success');
        closeDialog();
        await load(dSearch.value||''); 
      } else {
        showToast('❌ فشل في إضافة السائق', 'error');
      }
    }
  } catch(err) {
    showToast('❌ خطأ في الاتصال', 'error');
  } finally {
    // Restore button
    dlgSave.innerHTML = originalText;
    dlgSave.disabled = false;
  }
}

function showToast(message, type = 'success'){
  const toast = document.getElementById('toast');
  if(toast){
    toast.innerHTML = message;
    const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
    toast.className = `toast show ${bgColor}`;
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
}

(async()=>{ await loadPerms(); try{ if(addDriverBtn && !canDrv('drivers.add')) addDriverBtn.style.display='none'; }catch(_){ } await load(dSearch?.value||''); })();

// Dialog event listeners
addDriverBtn?.addEventListener('click', openAddDialog);
dlgSave?.addEventListener('click', saveDriver);
dlgCancel?.addEventListener('click', closeDialog);

// Close dialog when clicking outside
driverDialog?.addEventListener('click', (e) => {
  const rect = driverDialog.getBoundingClientRect();
  if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
    closeDialog();
  }
});

// Support Enter key in dialog
dlgName?.addEventListener('keypress', (e) => {
  if(e.key === 'Enter') {
    e.preventDefault();
    if(dlgPhone) dlgPhone.focus();
    else saveDriver();
  }
});

dlgPhone?.addEventListener('keypress', (e) => {
  if(e.key === 'Enter') {
    e.preventDefault();
    saveDriver();
  }
});

// Search functionality
dSearch?.addEventListener('keypress', (e) => {
  if(e.key === 'Enter') {
    e.preventDefault();
    load(dSearch.value||'');
  }
});

dSearch?.addEventListener('input', ()=> load(dSearch.value||''));

dTbody?.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button'); 
  if(!btn) return;
  
  const id = Number(btn.getAttribute('data-id'));
  const act = btn.getAttribute('data-act');
  const originalText = btn.innerHTML;
  
  if(act==='edit'){
    const name = btn.getAttribute('data-name') || '';
    const phone = btn.getAttribute('data-phone') || '';
    openEditDialog(id, name, phone);
    
  } else if(act==='toggle'){
    if(!canDrv('drivers.toggle')) return;
    
    btn.innerHTML = '⏳ جاري التحديث...';
    btn.disabled = true;
    
    try {
      const result = await window.api.drivers_toggle(id);
      if(result && result.ok) {
        showToast('✅ تم تحديث حالة السائق!', 'success');
      } else {
        showToast('❌ فشل في تحديث الحالة', 'error');
      }
      await load(dSearch.value||'');
    } catch(err) {
      showToast('❌ خطأ في الاتصال', 'error');
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
    
  } else if(act==='delete'){
    if(!canDrv('drivers.delete')) return;
    
    const row = btn.closest('tr');
    const nameDiv = row.querySelector('td:first-child div');
    const driverName = nameDiv?.textContent?.trim() || 'هذا السائق';

    // Use custom non-blocking dialog for a better UX in Electron
    const confirmDlg = document.getElementById('confirmDlg');
    const confirmText = document.getElementById('confirmText');
    const confirmIcon = document.getElementById('confirmIcon');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmHeaderIcon = document.getElementById('confirmHeaderIcon');
    const confirmOk = document.getElementById('confirmOk');
    const confirmCancel = document.getElementById('confirmCancel');

    async function safeShowModal(d){ try{ d.showModal(); }catch(_){ try{ d.close?.(); }catch(__){} try{ d.showModal(); }catch(__){} } }

    let proceed = false;
    if(confirmDlg && confirmText && confirmOk && confirmCancel){
      if(confirmTitle) confirmTitle.textContent = 'تأكيد حذف السائق';
      if(confirmHeaderIcon) confirmHeaderIcon.textContent = '⚠️';
      if(confirmIcon) confirmIcon.textContent = '🗑️';
      confirmText.textContent = `هل أنت متأكد من حذف السائق "${driverName}"؟\n\nسيتم حذف السائق نهائياً ولا يمكن التراجع عن هذا الإجراء.`;
      const onOk = ()=>{ proceed=true; try{ confirmDlg.close(); }catch(_){ confirmDlg.removeAttribute('open'); } };
      const onCancel = ()=>{ proceed=false; try{ confirmDlg.close(); }catch(_){ confirmDlg.removeAttribute('open'); } };
      confirmOk.addEventListener('click', onOk, { once:true });
      confirmCancel.addEventListener('click', onCancel, { once:true });
      try{ await safeShowModal(confirmDlg); }catch(_){ }
      await new Promise(resolve=>{ confirmDlg.addEventListener('close', ()=>{ setTimeout(()=>{ window.focus?.(); resolve(); },0); }, { once:true }); });
    } else {
      proceed = confirm(`🗑️ تأكيد حذف السائق "${driverName}"؟\n\nسيتم حذف السائق نهائياً ولا يمكن التراجع عن هذا الإجراء.`);
    }

    if(proceed){
      btn.innerHTML = '⏳ جاري الحذف...';
      btn.disabled = true;
      try {
        const result = await window.api.drivers_delete(id);
        if(result && result.ok) {
          showToast('✅ تم حذف السائق بنجاح!', 'success');
          await load(dSearch.value||'');
        } else {
          showToast('❌ فشل في حذف السائق', 'error');
          btn.innerHTML = originalText;
          btn.disabled = false;
        }
      } catch(err) {
        showToast('❌ خطأ في الاتصال', 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    }
  }
});

window.addEventListener('DOMContentLoaded', ()=>{ load(''); });