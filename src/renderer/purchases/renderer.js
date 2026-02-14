const errorDiv = document.getElementById('error');
const dlg = document.getElementById('dlg');
const dlgTitle = document.getElementById('dlgTitle');
const dlgSave = document.getElementById('dlgSave');
const dlgCancel = document.getElementById('dlgCancel');
const p_name = document.getElementById('p_name');
const p_dt_input = document.getElementById('p_dt');
const p_apply_vat = document.getElementById('p_apply_vat');
const p_vat = document.getElementById('p_vat');
const p_cost = document.getElementById('p_cost');
const p_payment_method = document.getElementById('p_payment_method');
const p_notes = document.getElementById('p_notes');
const t_sub = document.getElementById('t_sub');
const t_vat = document.getElementById('t_vat');
const t_grand = document.getElementById('t_grand');

const f_from = document.getElementById('f_from');
const f_to = document.getElementById('f_to');
const btnFilter = document.getElementById('btnFilter');
const btnClearFilter = document.getElementById('btnClearFilter');
const tbody = document.getElementById('tbody');
const btnOpenModal = document.getElementById('btnOpenModal');
const btnExportCsv = document.getElementById('btnExportCsv');
const refreshBtn = document.getElementById('refreshBtn');
const pageSizeSelect = document.getElementById('pageSizeSelect');

let editId = null;
let __allPurchases = [];
let __purPage = 1;
let __purPageSize = 20;

function safeShowModal(d){
  try{ d.showModal(); }
  catch(_){ try{ d.close(); d.showModal(); } catch(__){} }
}
function focusFirstField(){
  try{
    window.focus?.();
    setTimeout(()=>{ p_name?.focus(); p_name?.select?.(); }, 0);
  }catch(_){}
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

// Custom confirm/alert using in-app HTML dialog
const confirmDlg = document.getElementById('confirmDlg');
const confirmText = document.getElementById('confirmText');
const confirmOk = document.getElementById('confirmOk');
const confirmCancel = document.getElementById('confirmCancel');
const confirmTitle = document.getElementById('confirmTitle');
const confirmIcon = document.getElementById('confirmIcon');

async function customConfirm(title, text, options={}){
  if(!confirmDlg || !confirmText || !confirmOk || !confirmCancel){
    return window.confirm(text || title || 'تأكيد؟');
  }
  
  // تحديد النوع (delete, warning, info)
  const type = options.type || 'info';
  const isDanger = type === 'delete';
  
  // تحديث العنوان والأيقونة
  if(confirmTitle) confirmTitle.textContent = title || 'تأكيد';
  
  // إضافة أيقونة حسب نوع الرسالة
  if(confirmIcon){
    if(isDanger) confirmIcon.textContent = '🗑️'; // أيقونة حذف
    else if(type === 'warning') confirmIcon.textContent = '⚠️'; // تحذير
    else if(type === 'success') confirmIcon.textContent = '✓'; // نجاح
    else confirmIcon.textContent = '❓'; // استفسار عام
  }
  
  confirmText.textContent = text || '';
  
  // تحديث لون الزر OK حسب النوع
  if(isDanger){
    confirmOk.className = 'btn danger';
    confirmOk.textContent = '🗑️ حذف نهائياً';
  } else {
    confirmOk.className = 'btn primary';
    confirmOk.textContent = '✓ موافق';
  }
  
  let res = false;
  const onOk = ()=>{ res = true; try{ confirmDlg.close(); }catch(_){ confirmDlg.removeAttribute('open'); } };
  const onCancel = ()=>{ res = false; try{ confirmDlg.close(); }catch(_){ confirmDlg.removeAttribute('open'); } };
  confirmOk.addEventListener('click', onOk, { once: true });
  confirmCancel.addEventListener('click', onCancel, { once: true });
  try{ safeShowModal(confirmDlg); }catch(_){ }
  return await new Promise(resolve=>{
    confirmDlg.addEventListener('close', ()=>{ setTimeout(()=>{ window.focus?.(); resolve(res); },0); }, { once: true });
  });
}

async function customAlert(text){
  if(!confirmDlg || !confirmText || !confirmOk || !confirmCancel){
    window.alert(text);
    return;
  }
  if(confirmTitle) confirmTitle.textContent = 'تنبيه';
  if(confirmIcon) confirmIcon.textContent = 'ℹ️'; // أيقونة معلومات
  confirmText.textContent = text || '';
  confirmOk.className = 'btn primary';
  confirmOk.textContent = '✓ موافق';
  const prev = confirmCancel.style.display;
  confirmCancel.style.display = 'none';
  const onOk = ()=>{ try{ confirmDlg.close(); }catch(_){ confirmDlg.removeAttribute('open'); } };
  confirmOk.addEventListener('click', onOk, { once: true });
  try{ safeShowModal(confirmDlg); }catch(_){ }
  await new Promise(resolve=>{
    confirmDlg.addEventListener('close', ()=>{ confirmCancel.style.display = prev; setTimeout(()=>{ window.focus?.(); resolve(); },0); }, { once: true });
  });
}

function setError(m){ 
  errorDiv.innerHTML = m ? `⚠️ ${m}` : '';
  if(m) {
    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function compute(){
  const apply = Number(p_apply_vat.value||1) === 1;
  const vatPct = Math.max(0, Number(p_vat.value||15));
  const cost = Math.max(0, Number(p_cost.value||0));
  let sub=0, vat=0, grand=0;
  if(apply){
    const r = vatPct/100;
    sub = cost / (1 + r);
    vat = cost - sub;
    grand = cost;
  } else {
    sub = cost;
    vat = 0;
    grand = cost;
  }
  t_sub.value = sub.toFixed(2);
  t_vat.value = vat.toFixed(2);
  t_grand.value = grand.toFixed(2);
}
[p_apply_vat, p_vat, p_cost].forEach(el => el.addEventListener('input', compute));

function purPaginated(items){
  if(!__purPageSize || __purPageSize<=0) return items;
  const start = (__purPage-1)*__purPageSize; 
  return items.slice(start, start+__purPageSize);
}

function getPageBtnTitle(action) {
  switch(action) {
    case 'first': return 'الانتقال إلى الصفحة الأولى';
    case 'prev': return 'الانتقال إلى الصفحة السابقة';
    case 'next': return 'الانتقال إلى الصفحة التالية';
    case 'last': return 'الانتقال إلى الصفحة الأخيرة';
    default: return '';
  }
}

function renderPurPager(total){
  const top = document.getElementById('pagerTop');
  const bottom = document.getElementById('pagerBottom');
  const pages = (__purPageSize && __purPageSize>0) ? Math.max(1, Math.ceil(total/ __purPageSize)) : 1;
  const btn = (label, disabled, go)=>`<button class="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium" ${disabled?'disabled':''} data-go="${go}" title="${getPageBtnTitle(go)}">${label}</button>`;
  const html = [
    btn('⏮️', __purPage<=1, 'first'),
    btn('◀️', __purPage<=1, 'prev'),
    `<span class="text-gray-600 font-medium px-2">صفحة ${__purPage} من ${pages}</span>`,
    btn('▶️', __purPage>=pages, 'next'),
    btn('⏭️', __purPage>=pages, 'last')
  ].join(' ');
  if(top) top.innerHTML = html; if(bottom) bottom.innerHTML = html;
  const onClick = (e)=>{
    const b = e.target.closest('button'); if(!b) return;
    const act = b.getAttribute('data-go');
    const pages = (__purPageSize && __purPageSize>0) ? Math.max(1, Math.ceil(total/ __purPageSize)) : 1;
    if(act==='first') __purPage=1;
    if(act==='prev') __purPage=Math.max(1,__purPage-1);
    if(act==='next') __purPage=Math.min(pages,__purPage+1);
    if(act==='last') __purPage=pages;
    renderRows(__allPurchases);
  };
  if(top) top.onclick = onClick;
  if(bottom) bottom.onclick = onClick;
}

function enableForm(){
  try{
    // Remove any inert/aria-hidden in the whole document that might block interactions
    document.querySelectorAll('[inert]').forEach(n => n.removeAttribute('inert'));
    document.querySelectorAll('[aria-hidden="true"]').forEach(n => n.removeAttribute('aria-hidden'));

    // Ensure dialog itself is interactive
    dlg.removeAttribute('inert');
    if (!dlg.hasAttribute('open') && typeof dlg.showModal !== 'function') {
      dlg.setAttribute('open', '');
    }
    dlg.style.pointerEvents = 'auto';

    // Re-enable all controls inside the dialog
    const controls = dlg.querySelectorAll('input, select, textarea, button');
    controls.forEach(el => {
      el.disabled = false;
      el.readOnly = false;
      el.removeAttribute('disabled');
      el.removeAttribute('readonly');
      el.removeAttribute('aria-disabled');
      if (el.style) el.style.pointerEvents = 'auto';
      if (el.getAttribute('tabindex') === '-1') el.removeAttribute('tabindex');
    });

    // Explicitly force-enable the key inputs that were reported as inactive
    ;[p_name, p_vat, p_cost, p_notes].forEach(el => {
      if (!el) return;
      el.disabled = false;
      el.readOnly = false;
      el.removeAttribute('disabled');
      el.removeAttribute('readonly');
      el.removeAttribute('aria-disabled');
      if (el.style) el.style.pointerEvents = 'auto';
    });
  }catch(_){ /* ignore */ }
}

// Stronger re-enable helper used after dialog state changes
function forceEnableAll(){
  try{
    document.querySelectorAll('[inert]').forEach(n => n.removeAttribute('inert'));
    document.querySelectorAll('[aria-hidden="true"]').forEach(n => n.removeAttribute('aria-hidden'));
    if (dlg) {
      dlg.removeAttribute('inert');
      dlg.style.pointerEvents = 'auto';
      const controls = dlg.querySelectorAll('input, select, textarea, button');
      controls.forEach(el => {
        el.disabled = false; el.readOnly = false;
        el.removeAttribute('disabled'); el.removeAttribute('readonly'); el.removeAttribute('aria-disabled');
        if (el.style) el.style.pointerEvents = 'auto';
        if (el.getAttribute('tabindex') === '-1') el.removeAttribute('tabindex');
      });
      ;[p_name, p_dt_input, p_apply_vat, p_vat, p_cost, p_payment_method, p_notes].forEach(el => {
        if (!el) return;
        el.disabled = false; el.readOnly = false;
        el.removeAttribute('disabled'); el.removeAttribute('readonly'); el.removeAttribute('aria-disabled');
        if (el.style) el.style.pointerEvents = 'auto';
      });
    }
  }catch(_){ /* ignore */ }
}

// Re-apply enabling multiple times to beat any race conditions after DOM updates
function reinforceEnable(retries = 6){
  forceEnableAll();
  // Explicitly hit the reported fields
  ;[p_name, p_vat, p_cost, p_notes].forEach(el => {
    try{
      if (!el) return;
      el.disabled = false; el.readOnly = false;
      el.removeAttribute('disabled'); el.removeAttribute('readonly'); el.removeAttribute('aria-disabled');
      if (el.style) el.style.pointerEvents = 'auto';
    }catch(_){ }
  });
  if(retries > 0){ setTimeout(()=>reinforceEnable(retries-1), 60); }
}

function openAdd(){
  editId = null;
  if(dlgTitle) dlgTitle.textContent = '➕ إضافة مصروفات جديدة';
  enableForm();
  [p_name, p_dt_input, p_apply_vat, p_vat, p_cost, p_payment_method, p_notes].forEach(el => {
    if (!el) return;
    el.disabled = false; el.readOnly = false;
    el.removeAttribute('disabled'); el.removeAttribute('readonly'); el.removeAttribute('aria-disabled');
    if (el.style) el.style.pointerEvents = 'auto';
  });
  p_name.value = ''; p_notes.value = ''; p_cost.value = '0';
  p_vat.value = '15'; p_apply_vat.value = '1';
  if (p_payment_method) p_payment_method.value = 'cash';
  const now = new Date();
  const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  p_dt_input.value = iso;
  compute(); setError('');
  if (typeof dlg.showModal === 'function') { safeShowModal(dlg); } else { dlg.setAttribute('open', ''); }
  setTimeout(()=>{ enableForm(); forceEnableAll(); reinforceEnable(); },0);
  focusFirstField();
}
function openEdit(item){
  editId = item.id;
  if(dlgTitle) dlgTitle.textContent = '✏️ تعديل مصروفات';
  enableForm();
  [p_name, p_dt_input, p_apply_vat, p_vat, p_cost, p_payment_method, p_notes].forEach(el => {
    if (!el) return;
    el.disabled = false; el.readOnly = false;
    el.removeAttribute('disabled'); el.removeAttribute('readonly'); el.removeAttribute('aria-disabled');
    if (el.style) el.style.pointerEvents = 'auto';
  });
  p_name.value = item.name || ''; p_notes.value = item.notes || '';
  p_cost.value = Number(item.grand_total || 0).toFixed(2);
  p_vat.value = Number(item.vat_percent || 15);
  p_apply_vat.value = String(item.apply_vat ? 1 : 0);
  if (p_payment_method) p_payment_method.value = (item.payment_method || 'cash');
  // Prefer exact original date/time from stored purchase_at (or _display_at),
  // fallback to purchase_date at 00:00 if time isn't available
  try{
    let isoLocal = '';
    const d0 = item._display_at || item.purchase_at || item.created_at;
    if (d0) {
      const d = (d0 instanceof Date) ? d0 : new Date(String(d0).replace(' ', 'T'));
      if (!isNaN(d.getTime())) {
        // Convert to local-friendly YYYY-MM-DDTHH:mm expected by datetime-local input
        isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      }
    }
    if (!isoLocal && item.purchase_date) {
      isoLocal = `${String(item.purchase_date)}T00:00`;
    }
    p_dt_input.value = isoLocal;
  }catch(_){ p_dt_input.value=''; }
  compute(); setError('');
  if (typeof dlg.showModal === 'function') { safeShowModal(dlg); } else { dlg.setAttribute('open', ''); }
  // Ensure enabling after opening as well
  setTimeout(()=>{ enableForm(); forceEnableAll(); },0);
  // Focus name for immediate typing
  focusFirstField();
}

function closeDlg(){ if(typeof dlg.close==='function'){ dlg.close(); } else { dlg.removeAttribute('open'); } }

if(dlg){
  dlg.addEventListener('close', ()=>{
    setTimeout(()=>{ enableForm(); forceEnableAll(); reinforceEnable(); },0);
    // أعِد ضبط الحقول حتى لا تبقى معطلة أو تحمل قيمًا قديمة بعد الإغلاق
    [p_name, p_dt_input, p_apply_vat, p_vat, p_cost, p_payment_method, p_notes, t_sub, t_vat, t_grand].forEach(el => {
      if (!el) return;
      el.disabled = false;
      el.readOnly = false;
      el.removeAttribute('disabled');
      el.removeAttribute('readonly');
      el.removeAttribute('aria-disabled');
      if (el.style) el.style.pointerEvents = 'auto';
      if (el.getAttribute('tabindex') === '-1') el.removeAttribute('tabindex');
    });
  });
}

dlgCancel.addEventListener('click', closeDlg);
// Permissions
let __perms = new Set();
async function loadPerms(){ try{ const u=JSON.parse(localStorage.getItem('pos_user')||'null'); if(u&&u.id){ const r=await window.api.perms_get_for_user(u.id); if(r&&r.ok){ __perms=new Set(r.keys||[]); } } }catch(_){ __perms=new Set(); } }
function canPurch(k){ return __perms.has('purchases') && __perms.has(k); }
(async()=>{ await loadPerms(); try{ if(btnExportCsv && !canPurch('purchases.export_csv')) btnExportCsv.style.display='none'; if(btnExportPdf && !canPurch('purchases.export_pdf')) btnExportPdf.style.display='none'; if(btnOpenModal && !canPurch('purchases.add')) btnOpenModal.style.display='none'; }catch(_){ } })();

btnOpenModal.addEventListener('click', ()=>{ if(!canPurch('purchases.add')) return; openAdd(); });

dlgSave.addEventListener('click', async () => {
  setError('');
  
  // تعطيل الزر أثناء المعالجة
  const originalText = dlgSave.innerHTML;
  dlgSave.innerHTML = '⏳ جاري الحفظ...';
  dlgSave.disabled = true;
  
  try {
    // parse datetime-local
    const dt = p_dt_input.value; // yyyy-MM-ddTHH:mm
    let purchase_date = '', purchase_time = '';
    if(dt){
      const m = dt.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/);
      if(m){
        purchase_date = m[1];
        // convert to 12h
        let hh = parseInt(m[2],10); const mm = m[3]; const ap = (hh>=12)?'PM':'AM'; hh = (hh%12)||12; purchase_time = `${String(hh).padStart(2,'0')}:${mm} ${ap}`;
      }
    }
    const payload = {
      name: (p_name.value||'').trim(),
      purchase_date,
      purchase_time,
      apply_vat: Number(p_apply_vat.value||1)===1,
      vat_percent: Number(p_vat.value||15),
      cost: Number(p_cost.value||0),
      payment_method: (p_payment_method && p_payment_method.value) || 'cash',
      notes: (p_notes.value||'').trim() || null
    };
    if(!payload.name){ 
      setError('يرجى إدخال اسم المصروفات'); 
      dlgSave.innerHTML = originalText;
      dlgSave.disabled = false;
      return; 
    }
    if(!payload.purchase_date){ 
      setError('يرجى اختيار التاريخ'); 
      dlgSave.innerHTML = originalText;
      dlgSave.disabled = false;
      return; 
    }
    if(isNaN(payload.cost) || payload.cost < 0){ 
      setError('قيمة التكلفة غير صحيحة'); 
      dlgSave.innerHTML = originalText;
      dlgSave.disabled = false;
      return; 
    }
    
    let r;
    if(editId){ 
      r = await window.api.purchases_update(editId, payload);
      if(r.ok) showToast('✅ تم تحديث المصروفات بنجاح', '#16a34a');
    }
    else { 
      r = await window.api.purchases_add(payload);
      if(r.ok) showToast('✅ تمت إضافة المصروفات بنجاح', '#16a34a');
    }
    if(!r.ok){ 
      setError(r.error||'فشل الحفظ'); 
      dlgSave.innerHTML = originalText;
      dlgSave.disabled = false;
      return; 
    }
    
    await loadList();
    closeDlg();
  } finally {
    // استعادة الزر
    dlgSave.innerHTML = originalText;
    dlgSave.disabled = false;
  }
});

function fmtDisplay(dt){
  try{
    const d = (dt instanceof Date) ? dt : new Date(String(dt||'').replace(' ','T'));
    if(isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    let h=d.getHours(); const m=String(d.getMinutes()).padStart(2,'0'); const ap=(h>=12)?'PM':'AM'; h=(h%12)||12; const hh=String(h).padStart(2,'0');
    return `${yyyy}-${mm}-${dd} ${hh}:${m} ${ap}`;
  }catch(_){ return ''; }
}

function renderRows(allItems){
  __allPurchases = allItems || [];
  const displayed = purPaginated(__allPurchases);
  tbody.innerHTML='';
  displayed.forEach((it, idx) => {
    const tr = document.createElement('tr');
    const paymentIcon = (it.payment_method||'cash')==='network' ? '💳' : '💵';
    const paymentText = (it.payment_method||'cash')==='network' ? 'شبكة' : 'كاش';
    const vatIcon = it.apply_vat ? '✅' : '❌';
    const vatText = it.apply_vat ? 'نعم' : 'لا';
    const rowNumber = (__purPage - 1) * __purPageSize + idx + 1;
    
    tr.innerHTML = `
      <td class="px-4 py-3 text-center border-b border-gray-100">${rowNumber}</td>
      <td class="px-4 py-3 border-b border-gray-100 text-sm">${fmtDisplay(it._display_at || it.purchase_at)}</td>
      <td class="px-4 py-3 border-b border-gray-100 font-medium">${it.name || ''}</td>
      <td class="px-4 py-3 text-center border-b border-gray-100">${paymentIcon} ${paymentText}</td>
      <td class="px-4 py-3 text-center border-b border-gray-100">${vatIcon}</td>
      <td class="px-4 py-3 text-center border-b border-gray-100 font-mono">${Number(it.sub_total||0).toFixed(2)}</td>
      <td class="px-4 py-3 text-center border-b border-gray-100 font-mono text-amber-600">${Number(it.vat_total||0).toFixed(2)}</td>
      <td class="px-4 py-3 text-center border-b border-gray-100 font-mono font-semibold text-green-700">${Number(it.grand_total||0).toFixed(2)}</td>
      <td class="px-4 py-3 border-b border-gray-100 text-sm text-gray-500">${it.notes || '—'}</td>
      <td class="px-4 py-3 text-center border-b border-gray-100">
        <div class="flex gap-2 justify-center">
          ${canPurch('purchases.edit') ? `<button class="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium" data-act="edit" data-id="${it.id}">✏️ تعديل</button>` : ''}
          ${canPurch('purchases.delete') ? `<button class="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium" data-act="del" data-id="${it.id}">🗑️ حذف</button>` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  if (!displayed || displayed.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="10" class="px-4 py-12 text-center border-b border-gray-100">
        <div class="text-gray-400 text-lg">📭</div>
        <div class="text-gray-600 font-medium mt-2">لا توجد مصروفات حالياً</div>
        <div class="text-gray-400 text-sm mt-1">اضغط على "إضافة مصروفات" لبدء إضافة البيانات</div>
      </td>
    `;
    tbody.appendChild(tr);
  }
  renderPurPager(__allPurchases.length);
}

tbody.addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if(!b) return;
  const id = Number(b.dataset.id); const act = b.dataset.act;
  if(act==='edit'){
    const item = (__allPurchases||[]).find(x=>x.id===id);
    if(!item){ setError('العنصر غير موجود'); return; }
    // Normalize purchase_at to a valid Date only if needed
    if(item._display_at && !isNaN(new Date(item._display_at).getTime())){
      item.purchase_at = item._display_at;
    } else if(item.purchase_at){
      if(!(item.purchase_at instanceof Date)){
        const v = String(item.purchase_at);
        const s = v.includes('T') ? v : v.replace(' ', 'T');
        const d = new Date(s);
        if(!isNaN(d.getTime())) item.purchase_at = d;
      }
    }
    openEdit(item);
  }
  if(act==='del'){
    const ok = await customConfirm('حذف المصروفات', 'هل أنت متأكد من حذف هذا السجل؟\nلا يمكن التراجع عن هذا الإجراء.', { type: 'delete' });
    if(!ok) return;
    const r = await window.api.purchases_delete(id);
    if(!r.ok){ setError(r.error||'فشل الحذف'); return; }
    showToast('✅ تم حذف المصروفات بنجاح', '#16a34a');
    await loadList();
    setTimeout(()=>{
      window.focus?.();
      enableForm();
      forceEnableAll();
      reinforceEnable();
    },0);
  }
});

async function loadList(){
  setError('');
  tbody.innerHTML = `
    <tr>
      <td colspan="10" class="px-4 py-12 text-center text-gray-400">
        ⏳ جاري تحميل البيانات...
      </td>
    </tr>
  `;
  
  try {
    const q = {}; 
    if(f_from.value) {
      const fromDateTime = f_from.value.replace('T', ' ') + ':00';
      q.from_at = fromDateTime;
    }
    if(f_to.value) {
      const toDateTime = f_to.value.replace('T', ' ') + ':00';
      q.to_at = toDateTime;
    }
    
    const r = await window.api.purchases_list(q);
    if(!r.ok){ 
      setError(r.error||'تعذر تحميل المصروفات'); 
      tbody.innerHTML = '';
      setTimeout(()=>{ enableForm(); forceEnableAll(); },0);
      return; 
    }
    
    const items = (r.items||[]).map(it=>{
      if(it.purchase_at){
        const d = new Date(String(it.purchase_at).replace(' ','T'));
        if(!isNaN(d.getTime())) it._display_at = d;
      }
      return it;
    });
    
    renderRows(items);
    setTimeout(()=>{ enableForm(); forceEnableAll(); },0);
  } catch(err) {
    setError('خطأ في الاتصال بقاعدة البيانات');
    tbody.innerHTML = '';
    setTimeout(()=>{ enableForm(); forceEnableAll(); },0);
  }
}

function exportCsv(items){
  const header = ['#','التاريخ','الاسم','طريقة الدفع','تطبيق الضريبة','الصافي','الضريبة','الإجمالي','ملاحظات'];
  const rows = items.map((it,i)=>{
    const dateStr = (()=>{
      const d0 = it._display_at || it.purchase_at || it.created_at || (it.purchase_date ? (it.purchase_date+'T00:00:00') : '');
      const d = new Date(String(d0).replace(' ','T'));
      if(isNaN(d.getTime())) return '';
      const yyyy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0');
      let h=d.getHours(); const m=String(d.getMinutes()).padStart(2,'0'); const ap=(h>=12)?'PM':'AM'; h=(h%12)||12; const hh=String(h).padStart(2,'0');
      return `${yyyy}-${mm}-${dd} ${hh}:${m} ${ap}`;
    })();
    return [
      i+1,
      dateStr,
      it.name||'', ((it.payment_method||'cash')==='network'?'شبكة':'كاش'), it.apply_vat?'نعم':'لا',
      Number(it.sub_total||0).toFixed(2),
      Number(it.vat_total||0).toFixed(2),
      Number(it.grand_total||0).toFixed(2),
      (it.notes||'').replace(/\n/g,' ')
    ];
  });
  const csv = [header, ...rows].map(r=>r.map(cell=>{
    const s = String(cell ?? '');
    if(/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  }).join(',')).join('\n');
  // Arabic-friendly: add UTF-8 BOM for Excel
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='purchases.csv'; a.click();
  URL.revokeObjectURL(url);
}

async function exportPdf(items){
  // Build printable HTML
  const rows = items.map((it,i)=>{
    const dateStr = (()=>{
      const d0 = it._display_at || it.purchase_at || it.created_at || (it.purchase_date ? (it.purchase_date+'T00:00:00') : '');
      const d = new Date(String(d0).replace(' ','T'));
      if(isNaN(d.getTime())) return '';
      const yyyy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0');
      let h=d.getHours(); const m=String(d.getMinutes()).padStart(2,'0'); const ap=(h>=12)?'PM':'AM'; h=(h%12)||12; const hh=String(h).padStart(2,'0');
      return `${yyyy}-${mm}-${dd} ${hh}:${m} ${ap}`;
    })();
    const pay = ((it.payment_method||'cash')==='network') ? 'شبكة' : 'كاش';
    return `<tr>
      <td>${i+1}</td>
      <td>${dateStr}</td>
      <td>${(it.name||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td>
      <td>${pay}</td>
      <td>${it.apply_vat?'نعم':'لا'}</td>
      <td>${Number(it.sub_total||0).toFixed(2)}</td>
      <td>${Number(it.vat_total||0).toFixed(2)}</td>
      <td>${Number(it.grand_total||0).toFixed(2)}</td>
      <td>${(it.notes||'').toString().replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td>
    </tr>`;
  }).join('');
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
  <title>تصدير المصروفات</title>
  <style>body{font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;}
  table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;text-align:right}
  thead th{background:#f3f7ff;color:#0b3daa}</style></head>
  <body><h3>قائمة المصروفات</h3>
  <table><thead><tr><th>#</th><th>التاريخ</th><th>الاسم</th><th>طريقة الدفع</th><th>ضريبة؟</th><th>الصافي</th><th>الضريبة</th><th>الإجمالي</th><th>ملاحظات</th></tr></thead>
  <tbody>${rows}</tbody></table></body></html>`;
  const r = await window.api.pdf_export(html, { pageSize: 'A4', printBackground: true, saveMode: 'auto', filename: 'purchases.pdf' });
  if(!r || !r.ok){ await customAlert('تعذر إنشاء PDF'); }
}

btnExportCsv.addEventListener('click', async ()=>{
  exportCsv(__allPurchases);
});

if(refreshBtn) refreshBtn.addEventListener('click', ()=> loadList());

if(pageSizeSelect) {
  pageSizeSelect.addEventListener('change', () => {
    const val = Number(pageSizeSelect.value || 20);
    __purPageSize = val || 0;
    __purPage = 1;
    renderRows(__allPurchases);
  });
}

(function init(){
  const btnBack = document.getElementById('btnBack');
  if (btnBack) btnBack.addEventListener('click', ()=>{ history.back(); });
  loadList();
})();

btnFilter.addEventListener('click', () => {
  __purPage = 1;
  loadList();
});

btnClearFilter.addEventListener('click', () => {
  f_from.value = '';
  f_to.value = '';
  __purPage = 1;
  loadList();
});