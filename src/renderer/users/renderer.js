const tbody = document.getElementById('tbody');
const errorDiv = document.getElementById('error');
const noticeDiv = document.getElementById('notice');
const addUserBtn = document.getElementById('addUserBtn');
const refreshBtn = document.getElementById('refreshBtn');

const dlg = document.getElementById('userDialog');
const dlgTitle = document.getElementById('dlgTitle');
const dlgUsername = document.getElementById('dlgUsername');
const dlgFullname = document.getElementById('dlgFullname');
const dlgPassword = document.getElementById('dlgPassword');
const dlgRole = document.getElementById('dlgRole');
const dlgActive = document.getElementById('dlgActive');
const dlgSave = document.getElementById('dlgSave');
const dlgClose = document.getElementById('dlgClose');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');

if(togglePasswordBtn){
  togglePasswordBtn.addEventListener('click', () => {
    const type = dlgPassword.type === 'password' ? 'text' : 'password';
    dlgPassword.type = type;
    togglePasswordBtn.textContent = type === 'password' ? '👁️' : '🙈';
  });
}

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

function setError(msg){ errorDiv.textContent = msg || ''; }
function clearDialog(){ 
  dlgUsername.value=''; 
  dlgFullname.value=''; 
  dlgPassword.value=''; 
  dlgRole.value='cashier'; 
  dlgActive.value='1'; 
  if(dlgPassword) dlgPassword.type = 'password';
  if(togglePasswordBtn) togglePasswordBtn.textContent = '👁️';
}

// Ensure dialog opens reliably and inputs can receive focus (Electron focus quirk workaround)
function safeShowModal(d){
  try{ d.showModal(); }
  catch(_){ try{ d.close(); d.showModal(); }catch(__){} }
}
function focusFirstField(){
  try{
    window.focus();
    setTimeout(()=>{ if(dlgUsername){ dlgUsername.focus(); dlgUsername.select(); } else if(dlg && dlg.focus){ dlg.focus(); } }, 0);
  }catch(_){ }
}

async function openDialog(title, data){
  dlgTitle.textContent = title;
  // Reset password field visibility
  if(dlgPassword) dlgPassword.type = 'password';
  if(togglePasswordBtn) togglePasswordBtn.textContent = '👁️';

  if(data){
    dlgUsername.value = data.username || '';
    dlgFullname.value = data.full_name || '';
    dlgPassword.value = data.password || '';
    dlgRole.value = data.role || 'cashier';
    dlgActive.value = String(data.is_active ?? 1);
    dlgUsername.disabled = true;
    
    if(data.role === 'admin' && data.is_active === 1){
      const res = await window.api.users_count_active_admins();
      if(res.ok && res.count <= 1){
        dlgRole.disabled = true;
        dlgRole.title = 'لا يمكن تغيير دور آخر مدير نشط';
      } else {
        dlgRole.disabled = false;
        dlgRole.title = '';
      }
    } else {
      dlgRole.disabled = false;
      dlgRole.title = '';
    }
  } else {
    clearDialog();
    dlgUsername.disabled = false;
    dlgRole.disabled = false;
    dlgRole.title = '';
  }
  safeShowModal(dlg);
  focusFirstField();
}

function closeDialog(){ dlg.close(); }

// Permissions
let __perms = new Set();
async function loadPerms(){ try{ const u=JSON.parse(localStorage.getItem('pos_user')||'null'); if(u&&u.id){ const r=await window.api.perms_get_for_user(u.id); if(r&&r.ok){ __perms=new Set(r.keys||[]); } } }catch(_){ __perms=new Set(); } }
function canUser(k){ return __perms.has(k); }

function renderRows(list){
  tbody.innerHTML = '';
  
  list.forEach((u, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-100';
    tr.innerHTML = `
      <td class="px-4 py-3 font-semibold text-gray-600">${idx+1}</td>
      <td class="px-4 py-3 font-semibold text-blue-600">${u.username}</td>
      <td class="px-4 py-3">${u.full_name || '-'}</td>
      <td class="px-4 py-3"><span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">${u.role === 'admin' ? '👨‍💼 مدير' : '💰 كاشير'}</span></td>
      <td class="px-4 py-3"><span class="px-3 py-1 ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} rounded-full text-xs font-semibold">${u.is_active ? '✅ نشط' : '❌ موقوف'}</span></td>
      <td class="px-4 py-3">
        <div class="flex gap-2 justify-center items-center">
          ${canUser('users.edit') ? `<button class="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium whitespace-nowrap" data-act="edit" data-id="${u.id}">✏️ تعديل</button>` : ''}
          ${canUser('users.toggle') ? `<button class="px-3 py-1.5 ${u.is_active ? 'bg-red-600' : 'bg-green-600'} text-white rounded-lg text-xs font-medium whitespace-nowrap" data-act="toggle" data-id="${u.id}">${u.is_active ? '❌ إيقاف' : '✅ تفعيل'}</button>` : ''}
          ${canUser('users.delete') ? `<button class="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium whitespace-nowrap" data-act="delete" data-id="${u.id}">🗑️ حذف</button>` : ''}
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

async function loadUsers(){
  setError('');
  if(noticeDiv) noticeDiv.textContent = '';
  const res = await window.api.users_list();
  if(!res.ok){ setError(res.error || 'تعذر تحميل المستخدمين'); return; }
  const list = (res.items || []).filter(u => u.username !== 'superAdmin');
  renderRows(list);
}

(async()=>{ await loadPerms(); try{ if(addUserBtn && !canUser('users.add')) addUserBtn.style.display='none'; }catch(_){ } await loadUsers(); })();

addUserBtn.addEventListener('click', async () => { if(!canUser('users.add')) return; await openDialog('إضافة مستخدم'); });
refreshBtn.addEventListener('click', loadUsers);

dlgClose.addEventListener('click', closeDialog);

dlgSave.addEventListener('click', async () => {
  setError('');
  const payload = {
    username: dlgUsername.value.trim(),
    full_name: dlgFullname.value.trim(),
    password: dlgPassword.value,
    role: dlgRole.value,
    is_active: dlgActive.value === '1' ? 1 : 0,
  };
  if(!payload.username){ setError('يرجى إدخال اسم المستخدم'); return; }

  const editing = dlgUsername.disabled; // اذا disabled يعني تعديل
  let res;
  if(editing){
    res = await window.api.users_update(payload.username, payload);
  } else {
    if(!payload.password){ setError('يرجى إدخال كلمة المرور'); return; }
    res = await window.api.users_add(payload);
  }
  if(!res.ok){ setError(res.error || 'فشل الحفظ'); return; }
  closeDialog();
  showToast(editing ? '✓ تم التحديث بنجاح' : '✓ تمت الإضافة بنجاح', '#16a34a');
  await loadUsers();
});

// Lightweight custom confirm using <dialog> to avoid native confirm focus issues in Electron
const confirmDlg = document.getElementById('confirmDlg');
const confirmTitle = document.getElementById('confirmTitle');
const confirmText = document.getElementById('confirmText');
const confirmOk = document.getElementById('confirmOk');
const confirmCancel = document.getElementById('confirmCancel');
const confirmIcon = document.getElementById('confirmIcon');

function customConfirm(title, text, options = {}){
  return new Promise((resolve)=>{
    if(!confirmDlg){ resolve(window.confirm(text)); return; }
    
    // Handle type-based styling and icons
    const type = options.type || 'default';
    
    // Update icon based on type
    if(confirmIcon){
      if(type === 'delete'){
        confirmIcon.textContent = '🗑️';
      } else {
        confirmIcon.textContent = '❓';
      }
    }
    
    // Update button styling based on type
    if(confirmOk){
      confirmOk.className = 'px-5 py-2.5 rounded-lg font-medium';
      if(type === 'delete'){
        confirmOk.className += ' bg-red-600 text-white';
        confirmOk.textContent = '🗑️ حذف نهائياً';
      } else {
        confirmOk.className += ' bg-slate-600 text-white';
        confirmOk.textContent = 'موافق';
      }
    }
    
    confirmTitle && (confirmTitle.textContent = String(title||'تأكيد'));
    confirmText && (confirmText.textContent = String(text||''));
    try{ confirmDlg.showModal(); }
    catch(_){ try{ confirmDlg.close(); confirmDlg.showModal(); }catch(__){} }
    const onOk = ()=>{ cleanup(); resolve(true); };
    const onCancel = ()=>{ cleanup(); resolve(false); };
    function cleanup(){
      confirmOk && confirmOk.removeEventListener('click', onOk);
      confirmCancel && confirmCancel.removeEventListener('click', onCancel);
      try{ confirmDlg.close(); }catch(_){ }
      try{ window.focus(); }catch(_){ }
    }
    confirmOk && confirmOk.addEventListener('click', onOk);
    confirmCancel && confirmCancel.addEventListener('click', onCancel);
    confirmDlg.addEventListener('cancel', onCancel, { once:true });
    setTimeout(()=>{ try{ confirmOk && confirmOk.focus(); }catch(_){ } }, 0);
  });
}

tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if(!btn) return;
  const id = Number(btn.dataset.id);
  const act = btn.dataset.act;
  setError('');

  if(act === 'edit'){
    if(!canUser('users.edit')) return;
    const res = await window.api.users_get(id);
    if(!res.ok){ setError(res.error || 'تعذر جلب المستخدم'); return; }
    await openDialog('تعديل مستخدم', res.item);
  }
  if(act === 'toggle'){
    if(!canUser('users.toggle')) return;
    // تحقق محلي قبل الطلب: منع إيقاف آخر مدير نشط وإظهار التنبيه فقط عند المحاولة
    try{
      const resList = await window.api.users_list();
      const list = resList.ok ? (resList.items||[]) : [];
      const target = list.find(x => Number(x.id)===Number(id));
      const activeAdmins = list.filter(x => x.role==='admin' && Number(x.is_active)).length;
      if(target && target.role==='admin' && Number(target.is_active)===1 && activeAdmins<=1){
        if(noticeDiv){ noticeDiv.textContent = 'تنبيه: يوجد مدير واحد نشط فقط. لن يسمح التطبيق بإيقافه.'; }
        return;
      }
    }catch(_){ /* في حال فشل الجلب، سيمنع الباك-إند */ }

    const res = await window.api.users_toggle(id);
    if(!res.ok){ setError(res.error || 'فشل تحديث الحالة'); return; }
    showToast('✓ تم تحديث الحالة بنجاح', '#16a34a');
    await loadUsers();
  }
  if(act === 'delete'){
    if(!canUser('users.delete')) return;
    const ok = await customConfirm('تأكيد حذف المستخدم', 'هل أنت متأكد من حذف هذا المستخدم نهائياً؟\nلا يمكن التراجع عن هذا الإجراء.', { type: 'delete' });
    if(!ok) return;
    const res = await window.api.users_delete(id);
    if(!res.ok){ setError(res.error || 'فشل الحذف'); return; }
    showToast('✓ تم الحذف بنجاح', '#16a34a');
    await loadUsers();
  }
});
