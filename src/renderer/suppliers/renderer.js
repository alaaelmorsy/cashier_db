// Suppliers screen: add/list/edit/toggle/delete
const tbody = document.getElementById('tbody');
const errorDiv = document.getElementById('error');
const addBtn = document.getElementById('addBtn');
const refreshBtn = document.getElementById('refreshBtn');

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
function canSup(k){ return __perms.has('suppliers') && __perms.has(k); }
function applyTop(){ if(addBtn && !canSup('suppliers.add')) addBtn.style.display = 'none'; }

const dlg = document.getElementById('dlg');
const dlgTitle = document.getElementById('dlgTitle');
const f_name = document.getElementById('f_name');
const f_phone = document.getElementById('f_phone');
const f_vat = document.getElementById('f_vat');
const dlgSave = document.getElementById('dlgSave');
const dlgCancel = document.getElementById('dlgCancel');

let editId = null;
let __allSuppliers = [];
let __supPage = 1;
let __supPageSize = 20;

function setError(msg){ errorDiv.textContent = msg || ''; }
function clearDialog(){ f_name.value=''; f_phone.value=''; f_vat.value=''; }
function openAddDialog(){ editId=null; dlgTitle.textContent='➕ إضافة مورد جديد'; clearDialog(); safeShowModal(dlg); }
function openEditDialog(item){ editId=item.id; dlgTitle.textContent='✏️ تعديل بيانات المورد'; f_name.value=item.name||''; f_phone.value=item.phone||''; f_vat.value=item.vat_number||''; safeShowModal(dlg); }
function closeDialog(){ dlg.close(); }

function supPaginated(items){
  if(!__supPageSize || __supPageSize<=0) return items;
  const start = (__supPage-1)*__supPageSize;
  return items.slice(start, start+__supPageSize);
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

function renderSupPager(total){
  const top = document.getElementById('pagerTop');
  const bottom = document.getElementById('pagerBottom');
  const pages = (__supPageSize && __supPageSize>0) ? Math.max(1, Math.ceil(total/ __supPageSize)) : 1;
  const btn = (label, disabled, go)=>`<button class="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium" ${disabled?'disabled':''} data-go="${go}" title="${getPageBtnTitle(go)}">${label}</button>`;
  const html = [
    btn('⏮️', __supPage<=1, 'first'),
    btn('◀️', __supPage<=1, 'prev'),
    `<span class="text-gray-600 font-medium px-2">صفحة ${__supPage} من ${pages}</span>`,
    btn('▶️', __supPage>=pages, 'next'),
    btn('⏭️', __supPage>=pages, 'last')
  ].join(' ');
  if(top) top.innerHTML = html; if(bottom) bottom.innerHTML = html;
  const onClick = (e)=>{
    const b = e.target.closest('button'); if(!b) return;
    const act = b.getAttribute('data-go');
    const pages = (__supPageSize && __supPageSize>0) ? Math.max(1, Math.ceil(total/ __supPageSize)) : 1;
    if(act==='first') __supPage=1;
    if(act==='prev') __supPage=Math.max(1,__supPage-1);
    if(act==='next') __supPage=Math.min(pages,__supPage+1);
    if(act==='last') __supPage=pages;
    renderRows(__allSuppliers);
  };
  if(top) top.onclick = onClick;
  if(bottom) bottom.onclick = onClick;
}

async function loadSuppliers(){
  setError('');
  const query = { q: (document.getElementById('q')?.value || '').trim() };
  const res = await window.api.suppliers_list(query);
  if(!res.ok){ 
    showToast(res.error || 'تعذر تحميل قائمة الموردين', '#ef4444', 4000); 
    return; 
  }
  __allSuppliers = res.items || [];
  __supPage = 1;
  renderRows(__allSuppliers);
}

function renderRows(allItems){
  __allSuppliers = allItems || [];
  const displayed = supPaginated(__allSuppliers);
  tbody.innerHTML='';
  
  displayed.forEach((c, idx) => {
    const tr = document.createElement('tr');
    const rowNumber = (__supPage - 1) * __supPageSize + idx + 1;
    const actions = [
      canSup('suppliers.edit') ? `<button class="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium" data-act="edit" data-id="${c.id}" title="تعديل بيانات المورد">✏️ تعديل</button>` : '',
      canSup('suppliers.toggle') ? `<button class="px-3 py-1.5 bg-amber-600 text-white rounded text-xs font-medium" data-act="toggle" data-id="${c.id}" title="${c.is_active? 'إيقاف المورد':'تفعيل المورد'}">${c.is_active? '⏸️ إيقاف':'▶️ تفعيل'}</button>` : '',
      (c.total_due > 0 ? `<button class="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium" data-act="pay" data-id="${c.id}" title="سداد فاتورة شراء">💳 سداد</button>` : ''),
      canSup('suppliers.delete') ? `<button class="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium" data-act="delete" data-id="${c.id}" title="حذف المورد نهائياً">🗑️ حذف</button>` : ''
    ].join(' ');
    tr.innerHTML = `
      <td class="px-4 py-3 text-center border-b border-gray-100">${rowNumber}</td>
      <td class="px-4 py-3 border-b border-gray-100 font-medium">${c.name}</td>
      <td class="px-4 py-3 border-b border-gray-100">${c.phone||'—'}</td>
      <td class="px-4 py-3 border-b border-gray-100 font-mono text-sm">${c.vat_number||'—'}</td>
      <td class="px-4 py-3 border-b border-gray-100 text-center">${c.is_active ? '<span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">✓ نشط</span>' : '<span class="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">✗ موقوف</span>'}</td>
      <td class="px-4 py-3 border-b border-gray-100 text-center font-mono font-semibold text-teal-700">${Number(c.total_due||0).toFixed(2)}</td>
      <td class="px-4 py-3 text-center border-b border-gray-100"><div class="flex gap-2 justify-center flex-wrap">${actions}</div></td>`;
    tbody.appendChild(tr);
  });
  
  if (!displayed || displayed.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="7" class="px-4 py-12 text-center border-b border-gray-100">
        <div class="text-gray-400 text-lg">📭</div>
        <div class="text-gray-600 font-medium mt-2">لا توجد موردين حالياً</div>
        <div class="text-gray-400 text-sm mt-1">اضغط على "إضافة مورد" لبدء إضافة البيانات</div>
      </td>
    `;
    tbody.appendChild(tr);
  }
  
  renderSupPager(__allSuppliers.length);
}

if(addBtn) addBtn.addEventListener('click', () => { if(!canSup('suppliers.add')) return; openAddDialog(); });
refreshBtn.addEventListener('click', loadSuppliers);

const pageSizeSelect = document.getElementById('pageSize');
if(pageSizeSelect){
  pageSizeSelect.addEventListener('change', ()=>{
    __supPageSize = Number(pageSizeSelect.value)||0;
    __supPage = 1;
    renderRows(__allSuppliers);
  });
}

document.getElementById('q').addEventListener('input', () => { loadSuppliers(); });

dlgCancel.addEventListener('click', closeDialog);

dlgSave.addEventListener('click', async () => {
  setError('');
  const payload = {
    name: f_name.value.trim(),
    phone: f_phone.value.trim() || null,
    vat_number: f_vat.value.trim() || null,
  };
  if(payload.vat_number && !/^\d{15}$/.test(payload.vat_number)){ 
    showToast('الرقم الضريبي يجب أن يكون 15 رقماً بالضبط', '#ef4444', 4000); 
    return; 
  }
  if(!payload.name){ 
    showToast('يرجى إدخال اسم المورد - هذا الحقل مطلوب', '#ef4444', 4000); 
    return; 
  }
  let res;
  if(editId){ res = await window.api.suppliers_update(editId, payload); }
  else { res = await window.api.suppliers_add(payload); }
  if(!res.ok){ 
    showToast(res.error || 'فشل في حفظ بيانات المورد', '#ef4444', 4000); 
    return; 
  }
  showToast(editId ? '✓ تم تحديث بيانات المورد بنجاح' : '✓ تم إضافة المورد بنجاح', '#16a34a');
  closeDialog();
  await loadSuppliers();
});

tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if(!btn) return;
  const id = Number(btn.dataset.id);
  const act = btn.dataset.act;
  setError('');

  if(act==='edit'){
    if(!canSup('suppliers.edit')) return;
    const res = await window.api.suppliers_get(id);
    if(!res.ok){ 
      showToast(res.error || 'تعذر جلب بيانات المورد', '#ef4444', 4000); 
      return; 
    }
    openEditDialog(res.item);
  }
  if(act==='toggle'){
    if(!canSup('suppliers.toggle')) return;
    const res = await window.api.suppliers_toggle(id);
    if(!res.ok){ 
      showToast(res.error || 'فشل في تحديث حالة المورد', '#ef4444', 4000); 
      return; 
    }
    showToast('✓ تم تحديث حالة المورد بنجاح', '#16a34a');
    await loadSuppliers();
  }
  if(act==='delete'){
    if(!canSup('suppliers.delete')) return;
    const supplier = __allSuppliers.find(s => s.id === id);
    const supplierName = supplier ? supplier.name : 'هذا المورد';
    const confirmed = await customConfirm(`هل أنت متأكد من حذف المورد "${supplierName}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`, '🗑️');
    if(!confirmed) return;
    const res = await window.api.suppliers_delete(id);
    if(!res.ok){ 
      showToast(res.error || 'فشل في حذف المورد', '#ef4444', 4000);
      return; 
    }
    showToast('✓ تم حذف المورد بنجاح', '#16a34a');
    await loadSuppliers();
  }
  if(act==='pay'){
    const r = await window.api.suppliers_get(id);
    if(!r || !r.ok){ showToast('تعذر جلب بيانات المورد', '#ef4444', 4000); return; }
    await openPayDialog(r.item);
  }
});

// Pay dialog elements
const payDlg = document.getElementById('payDlg');
const payInvoiceSelect = document.getElementById('pay_invoice_select');
const payInvoiceNo = document.getElementById('pay_invoice_no');
const payDueView = document.getElementById('pay_due_view');
const payAmount = document.getElementById('pay_amount');
const payNote = document.getElementById('pay_note');
const paySave = document.getElementById('paySave');
const payCancel = document.getElementById('payCancel');
let __paySupplierId = null;
let __payInvoices = [];

async function loadSupplierCreditInvoices(supplierId){
  const res = await window.api.purchase_invoices_list({ supplier_id: supplierId });
  const items = (res && res.ok && Array.isArray(res.items)) ? res.items : [];
  __payInvoices = items.filter(x => {
    const m = String(x.payment_method||'').trim().toLowerCase();
    const isCredit = (m === 'credit' || m === 'آجل' || m === 'اجل');
    return isCredit && Number(x.amount_due||0) > 0;
  });
  if(payInvoiceSelect){
    payInvoiceSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— اختر فاتورة —';
    payInvoiceSelect.appendChild(placeholder);
    __payInvoices.forEach(inv => {
      const opt = document.createElement('option');
      opt.value = String(inv.id);
      const raw = String(inv.invoice_no||'');
      const m = raw.match(/^PI-\d{6}-(\d+)$/);
      const dispNo = m ? String(Number(m[1])) : (raw || String(inv.id||''));
      opt.textContent = `${dispNo} — المتبقي ${Number(inv.amount_due||0).toFixed(2)}`;
      payInvoiceSelect.appendChild(opt);
    });
  }
  if(payInvoiceNo) payInvoiceNo.value = '';
  if(payDueView) payDueView.value = '';
  if(payAmount) payAmount.value = '';
}

function updateSelectedInvoiceFields(){
  const selId = Number(payInvoiceSelect?.value||0);
  const inv = __payInvoices.find(x => Number(x.id) === selId);
  if(!inv){
    if(payInvoiceNo) payInvoiceNo.value = '';
    if(payDueView) payDueView.value = '';
    if(payAmount) payAmount.value = '';
    return;
  }
  if(payInvoiceNo){
    const raw = String(inv.invoice_no||'');
    const m = raw.match(/^PI-\d{6}-(\d+)$/);
    payInvoiceNo.value = m ? String(Number(m[1])) : (raw || String(inv.id||''));
  }
  if(payDueView) payDueView.value = Number(inv.amount_due||0).toFixed(2);
  if(payAmount) payAmount.value = Number(inv.amount_due||0).toFixed(2);
}

if(payInvoiceSelect){
  payInvoiceSelect.addEventListener('change', updateSelectedInvoiceFields);
}

async function openPayDialog(supplier){
  __paySupplierId = supplier?.id || null;
  await loadSupplierCreditInvoices(__paySupplierId);
  if(payNote){ payNote.value=''; }
  if(payDlg && typeof payDlg.showModal==='function'){ safeShowModal(payDlg); }
}
function closePayDialog(){ try{ payDlg && payDlg.close && payDlg.close(); }catch(_){ } }
if(payCancel) payCancel.addEventListener('click', closePayDialog);

paySave && paySave.addEventListener('click', async () => {
  try{
    const selId = Number(payInvoiceSelect?.value||0);
    if(!selId){ showToast('يرجى اختيار فاتورة', '#ef4444', 4000); return; }
    const inv = __payInvoices.find(x => Number(x.id) === selId);
    if(!inv){ showToast('الفاتورة المحددة غير صالحة', '#ef4444', 4000); return; }
    if(__paySupplierId && Number(inv.supplier_id) !== Number(__paySupplierId)){ showToast('الفاتورة لا تخص هذا المورد', '#ef4444', 4000); return; }
    const note = (payNote?.value||'').trim() || null;
    let amount = Number(payAmount?.value||0);
    if(!(amount>0)){ showToast('المبلغ غير صحيح', '#ef4444', 4000); return; }
    const due = Number(inv.amount_due||0);
    if(amount > due){ amount = due; }
    const res = await window.api.purchase_invoices_pay({ purchase_id: inv.id, invoice_no: String(inv.invoice_no||''), amount, note });
    if(!res || !res.ok){ showToast('فشل تسجيل السداد', '#ef4444', 4000); return; }
    showToast('✓ تم تسجيل السداد بنجاح', '#16a34a');
    closePayDialog();
    printPaymentVoucher(inv, amount, note);
    await loadSuppliers();
  }catch(e){ showToast('حدث خطأ أثناء السداد', '#ef4444', 4000); }
});

async function printPaymentVoucher(invoice, amount, note){
  try{
    const supplierRes = await window.api.suppliers_get(invoice.supplier_id);
    const supplier = (supplierRes && supplierRes.ok && supplierRes.item) ? supplierRes.item : {};
    const user = JSON.parse(localStorage.getItem('pos_user')||'{}');
    const userName = user.name || user.username || 'غير معروف';
    const raw = String(invoice.invoice_no||'');
    const m = raw.match(/^PI-\d{6}-(\d+)$/);
    const displayInvoiceNo = m ? String(Number(m[1])) : (raw || String(invoice.id||''));
    const result = await window.api.vouchers_get_next_number('payment');
    if (!result || !result.ok || !result.voucher_no) {
      showToast('فشل في توليد رقم السند', '#ef4444', 3000);
      return;
    }
    const voucherNo = result.voucher_no;
    const params = new URLSearchParams({
      voucher_no: voucherNo,
      invoice_no: displayInvoiceNo,
      amount: String(amount),
      user_name: userName,
      supplier_id: String(supplier.id||''),
      supplier_name: supplier.name||'',
      supplier_phone: supplier.phone||'',
      supplier_vat: supplier.vat_number||'',
      reason: 'سداد فاتورة شراء رقم ' + displayInvoiceNo,
      notes: note||'',
      date: new Date().toISOString()
    });
    const url = `payment-voucher-print.html?${params.toString()}`;
    window.open(url, '_blank', 'width=900,height=1200');
    if(window.api.vouchers_create){
      window.api.vouchers_create({
        voucher_no: voucherNo,
        voucher_type: 'payment',
        amount: amount,
        payment_method: 'cash',
        notes: note || '',
        entity_type: 'supplier',
        entity_id: supplier.id || null,
        entity_name: supplier.name || '',
        entity_phone: supplier.phone || '',
        entity_tax_number: supplier.vat_number || '',
        invoice_no: displayInvoiceNo,
        user_id: null,
        user_name: userName
      }).catch(err => console.error('Failed to save payment voucher:', err));
    }
  }catch(e){
    console.error('Error printing payment voucher:', e);
    showToast('فشل في فتح سند الصرف للطباعة', '#ef4444', 3000);
  }
}

(async function init(){ await loadPerms(); applyTop(); await loadSuppliers(); })();