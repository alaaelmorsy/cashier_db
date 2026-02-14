// Payments screen: list credit invoices and settle fully
const rows = document.getElementById('rows');
const qInput = document.getElementById('q');
const q2Input = document.getElementById('q2');
const dateFrom = document.getElementById('dateFrom');
const dateTo = document.getElementById('dateTo');
const btnSearch = document.getElementById('btnSearch');
const btnClearDates = document.getElementById('btnClearDates');
const btnBack = document.getElementById('btnBack');

const dlgBackdrop = document.getElementById('dlgBackdrop');
const dlgTitle = document.getElementById('dlgTitle');
const dlgInvNo = document.getElementById('dlgInvNo');
const dlgTotal = document.getElementById('dlgTotal');
const dlgPaid = document.getElementById('dlgPaid');
const dlgRemaining = document.getElementById('dlgRemaining');
const rowPaid = document.getElementById('rowPaid');
const rowRemaining = document.getElementById('rowRemaining');
const amountVal = document.getElementById('amountVal');
const payMethod = document.getElementById('payMethod');
const notesVal = document.getElementById('notesVal');
const dlgCancel = document.getElementById('dlgCancel');
const dlgPartial = document.getElementById('dlgPartial');

const dlgPaymentsBackdrop = document.getElementById('dlgPaymentsBackdrop');
const dlgPaymentsInvNo = document.getElementById('dlgPaymentsInvNo');
const paymentsRows = document.getElementById('paymentsRows');
const dlgPaymentsClose = document.getElementById('dlgPaymentsClose');

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

let __settings = { default_print_format: 'thermal' };
let __currentSale = null;
let __list = [];
let __perms = new Set();
async function loadPerms(){
  try{
    const u = JSON.parse(localStorage.getItem('pos_user')||'null');
    if(u && u.id){ const r = await window.api.perms_get_for_user(u.id); if(r && r.ok){ __perms = new Set(r.keys||[]); } }
  }catch(_){ __perms = new Set(); }
}
function canPay(k){ return __perms.has('payments') && __perms.has(k); }
(async()=>{ await loadPerms(); })();

function fmt(a){ return Number(a||0).toFixed(2); }

function showDialog(show){
  dlgBackdrop.style.display = show ? 'flex' : 'none';
}

function forceCloseDialog() {
  dlgBackdrop.style.display = 'none';
  __currentSale = null;
  amountVal.value = '';
  notesVal.value = '';
  payMethod.value = 'cash';
  
  dlgPartial.disabled = false;
  dlgCancel.disabled = false;
  dlgPartial.innerHTML = '💵 دفع جزئي';
}

async function loadSettings(){ try{ const r = await window.api.settings_get(); if(r && r.ok){ __settings = { ...__settings, ...(r.item||{}) }; } }catch(_){}}

function render(items){
  __list = items || [];
  rows.innerHTML = '';
  
  if(!items || !items.length){ 
    rows.innerHTML = '<tr><td colspan="9" class="text-center py-16 text-gray-400"><div class="text-5xl mb-4 opacity-50">💰</div><div>لا توجد فواتير آجلة حالياً</div><div class="text-xs mt-2 opacity-70">جميع الفواتير مدفوعة 🎉</div></td></tr>'; 
    return; 
  }
  
  items.forEach((s, index) => {
    const paidAmt = Number(s.paid_amount||0);
    const remAmt = Number(s.remaining_amount||0);
    const grandTotal = Number(s.grand_total||0);
    const actualRem = remAmt > 0 ? remAmt : (grandTotal - paidAmt);
    const status = String(s.payment_status||'unpaid');
    
    let statusBadge = '';
    if(status === 'partial'){
      statusBadge = '<span class="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">⏳ دفع جزئي</span>';
    } else {
      statusBadge = '<span class="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">⏳ آجل - غير مدفوعة</span>';
    }
    
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-100';
    tr.innerHTML = `
      <td class="px-4 py-3 font-semibold text-blue-600">#${s.invoice_no}</td>
      <td class="px-4 py-3">${s.customer_name ? `👤 ${s.customer_name}` : '<span class="text-gray-400 italic">غير محدد</span>'}</td>
      <td class="px-4 py-3">${s.customer_phone ? `📱 ${s.customer_phone}` : '<span class="text-gray-400 italic">غير محدد</span>'}</td>
      <td class="px-4 py-3 font-bold text-green-600">${fmt(grandTotal)}</td>
      <td class="px-4 py-3 font-semibold text-cyan-600">${fmt(paidAmt)}</td>
      <td class="px-4 py-3 font-bold text-amber-600">${fmt(actualRem)}</td>
      <td class="px-4 py-3">📅 ${new Date(s.created_at).toLocaleDateString('en-US')}</td>
      <td class="px-4 py-3">${statusBadge}</td>
      <td class="px-4 py-3">
        <div class="flex gap-2 justify-center">
          <button data-act="settle" data-id="${s.id}" class="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium" title="سداد الفاتورة">💳 سداد</button>
          <button data-act="payments" data-id="${s.id}" class="px-3 py-1.5 bg-slate-600 text-white rounded-lg text-xs font-medium" title="سجل الدفعات" ${paidAmt > 0 ? '' : 'style="display:none;"'}>📊 السجل</button>
          <button data-act="view" data-id="${s.id}" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium" title="عرض تفاصيل الفاتورة">👁️ عرض</button>
        </div>
      </td>
    `;
    rows.appendChild(tr);
  });
  
  try{
    if(!canPay('payments.settle_full')){ 
      rows.querySelectorAll('button[data-act="settle"]').forEach(b=>b.remove()); 
    }
    if(!canPay('payments.view_invoice')){ 
      rows.querySelectorAll('button[data-act="view"]').forEach(b=>b.remove()); 
    }
    if(!canPay('payments.view_payments')){ 
      rows.querySelectorAll('button[data-act="payments"]').forEach(b=>b.remove()); 
    }
  }catch(_){ }
  
  if(!rows.__inited){ 
    rows.addEventListener('click', onRowsClick); 
    rows.__inited = true; 
  }
}

async function onRowsClick(e){
  const b = e.target.closest('button'); 
  if(!b) return;
  
  const act = b.getAttribute('data-act');
  const id = Number(b.getAttribute('data-id')||0);
  if(!id) return;
  
  if(act==='settle'){
    if(!canPay('payments.settle_full')) {
      showToast('ليس لديك صلاحية سداد الفواتير', '#f59e0b');
      return;
    }
    
    const sale = __list.find(x=>Number(x.id)===id);
    if(sale) {
      openSettleDialog(sale);
    }
  } else if(act==='payments'){
    if(!canPay('payments.view_payments')) {
      showToast('ليس لديك صلاحية عرض سجل الدفعات', '#f59e0b');
      return;
    }
    
    const sale = __list.find(x=>Number(x.id)===id);
    if(sale) {
      await openPaymentsDialog(sale);
    }
  } else if(act==='view'){
    if(!canPay('payments.view_invoice')) {
      showToast('ليس لديك صلاحية عرض الفواتير', '#f59e0b');
      return;
    }

    const page = (__settings?.default_print_format === 'a4') ? 'print-a4.html' : 'print.html';
    const sale = __list.find(x=>Number(x.id)===id) || {};
    const method = String(sale.payment_method||'');
    const cash = (method==='cash' && sale.settled_cash != null) ? Number(sale.settled_cash) : 0;
    const params = new URLSearchParams({ id: String(id), refresh: '1', ...(method?{pay:method}:{}) , ...(cash?{cash:String(cash)}:{}) });
    const url = `../sales/${page}?${params.toString()}`;
    const w = (__settings?.default_print_format === 'a4') ? 900 : 500;
    const h = (__settings?.default_print_format === 'a4') ? 1000 : 700;

    window.open(url, 'INVOICE_VIEW', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
    showToast('تم فتح الفاتورة في نافذة جديدة', '#06b6d4');
  }
}

// Maintain a local state so date filters apply only when user presses Search
const __state = { date_from: null, date_to: null };

async function load(){
  try {
    const filters = {
      q: (qInput.value||'').trim() || null,
      customer_q: (q2Input.value||'').trim() || null,
      date_from: __state.date_from,
      date_to: __state.date_to,
    };
    
    const r = await window.api.sales_list_credit(filters);
    
    if(!r || !r.ok){ 
      rows.innerHTML = '<tr><td colspan="9" class="text-center py-16 text-gray-400"><div class="text-5xl mb-4 opacity-50">❌</div><div class="text-red-600">تعذر تحميل فواتير الآجل</div><div class="text-xs mt-2 opacity-70">تحقق من اتصال الإنترنت وحاول مرة أخرى</div></td></tr>'; 
      showToast('فشل في تحميل البيانات', '#ef4444');
      return; 
    }
    
    render(r.items||[]);
  } catch (error) {
    rows.innerHTML = '<tr><td colspan="9" class="text-center py-16 text-gray-400"><div class="text-5xl mb-4 opacity-50">❌</div><div class="text-red-600">حدث خطأ غير متوقع</div></td></tr>';
    showToast('حدث خطأ غير متوقع', '#ef4444');
  }
}

function openSettleDialog(sale){
  __currentSale = sale;
  
  const paidAmt = Number(sale.paid_amount||0);
  const remAmt = Number(sale.remaining_amount||0);
  const grandTotal = Number(sale.grand_total||0);
  const actualRem = remAmt > 0 ? remAmt : (grandTotal - paidAmt);
  
  dlgInvNo.textContent = `#${sale.invoice_no}`;
  dlgTotal.textContent = `${fmt(grandTotal)} ريال`;
  
  if(paidAmt > 0){
    dlgPaid.textContent = `${fmt(paidAmt)} ريال`;
    dlgRemaining.textContent = `${fmt(actualRem)} ريال`;
    rowPaid.style.display = '';
    rowRemaining.style.display = '';
    dlgTitle.textContent = '💳 سداد الفاتورة (دفع جزئي)';
  } else {
    rowPaid.style.display = 'none';
    rowRemaining.style.display = 'none';
    dlgTitle.textContent = '💳 سداد الفاتورة';
  }
  
  amountVal.value = fmt(actualRem);
  payMethod.value = 'cash';
  notesVal.value = '';
  
  dlgPartial.disabled = false;
  dlgCancel.disabled = false;
  dlgPartial.innerHTML = '💵 دفع جزئي';
  
  dlgBackdrop.style.display = 'flex';
  
  amountVal.focus();
  
  showToast(`جاري تحضير سداد الفاتورة #${sale.invoice_no}`, '#06b6d4');
}

async function openPaymentsDialog(sale){
  dlgPaymentsInvNo.textContent = `#${sale.invoice_no}`;
  
  try {
    const r = await window.api.sales_get_payments(sale.id);
    
    if(!r || !r.ok){
      paymentsRows.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-400">فشل في تحميل سجل الدفعات</td></tr>';
      dlgPaymentsBackdrop.style.display = 'flex';
      return;
    }
    
    const payments = r.payments || [];
    
    if(!payments.length){
      paymentsRows.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-400">لا توجد دفعات لهذه الفاتورة</td></tr>';
    } else {
      paymentsRows.innerHTML = '';
      payments.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-100';
        const methodNames = { cash: '💵 كاش', card: '💳 شبكة', tamara: '🛍️ تمارا', tabby: '📱 تابي' };
        tr.innerHTML = `
          <td class="px-4 py-3">${new Date(p.created_at).toLocaleString('ar-SA')}</td>
          <td class="px-4 py-3 font-bold text-green-600">${fmt(p.amount)} ريال</td>
          <td class="px-4 py-3">${methodNames[p.payment_method] || p.payment_method}</td>
          <td class="px-4 py-3">${p.created_by_username || 'غير محدد'}</td>
        `;
        paymentsRows.appendChild(tr);
      });
    }
    
    dlgPaymentsBackdrop.style.display = 'flex';
  } catch(e) {
    console.error(e);
    paymentsRows.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-400">حدث خطأ في تحميل سجل الدفعات</td></tr>';
    dlgPaymentsBackdrop.style.display = 'flex';
  }
}

dlgPaymentsClose.addEventListener('click', () => {
  dlgPaymentsBackdrop.style.display = 'none';
});

dlgPaymentsBackdrop.addEventListener('click', (event) => {
  if (event.target === dlgPaymentsBackdrop) {
    dlgPaymentsBackdrop.style.display = 'none';
  }
});

payMethod.addEventListener('change', ()=>{
  const methodNames = { cash: 'كاش', card: 'شبكة', tamara: 'تمارا', tabby: 'تابي' };
  showToast(`تم اختيار طريقة الدفع: ${methodNames[payMethod.value]}`, '#06b6d4');
});

dlgCancel.addEventListener('click', (event)=>{ 
  event.preventDefault();
  event.stopPropagation();
  forceCloseDialog();
  showToast('تم إلغاء عملية السداد', '#06b6d4');
});

async function doPartialPayment(){
  if(!__currentSale) return;
  
  dlgPartial.disabled = true;
  dlgCancel.disabled = true;
  
  try {
    const amount = Number(amountVal.value||0);
    const method = payMethod.value;
    const cashReceived = (method==='cash') ? amount : null;
    const notes = (notesVal.value||'').trim();
    
    if(!amount || amount <= 0){
      showToast('يرجى إدخال المبلغ المدفوع', '#f59e0b');
      dlgPartial.disabled = false;
      dlgCancel.disabled = false;
      return;
    }
    
    const paidAmt = Number(__currentSale.paid_amount||0);
    const remAmt = Number(__currentSale.remaining_amount||0);
    const grandTotal = Number(__currentSale.grand_total||0);
    const actualRem = remAmt > 0 ? remAmt : (grandTotal - paidAmt);
    
    if(amount > actualRem){
      showToast(`لا يمكن دفع مبلغ أكبر من المبلغ المتبقي. المبلغ المتبقي: ${fmt(actualRem)} ريال`, '#ef4444');
      dlgPartial.disabled = false;
      dlgCancel.disabled = false;
      return;
    }
    
    const user = JSON.parse(localStorage.getItem('pos_user')||'null');
    
    const r = await window.api.sales_settle_partial({
      sale_id: __currentSale.id,
      amount,
      method,
      cash_received: cashReceived,
      notes,
      user_id: user?.id || null,
      username: user?.username || null
    });
    
    if(!r || !r.ok){
      showToast(r?.error||'تعذر تسجيل الدفعة', '#ef4444');
      dlgPartial.disabled = false;
      dlgCancel.disabled = false;
      return;
    }
    
    dlgPartial.innerHTML = '✅ تم التسجيل!';
    
    const paymentId = r.payment_id || Date.now();
    const customerName = __currentSale.customer_name || null;
    
    showToast(`تم تسجيل دفعة بمبلغ ${fmt(amount)} ريال - المتبقي: ${fmt(r.new_remaining)} ريال`, '#16a34a');
    
    try{
      // الحصول على رقم السند التسلسلي أولاً
      let voucherNo = 'RV-' + paymentId; // fallback
      if(window.api.vouchers_get_next_number){
        try{
          const voucherResult = await window.api.vouchers_get_next_number('receipt');
          if(voucherResult && voucherResult.ok && voucherResult.voucher_no){
            voucherNo = voucherResult.voucher_no;
          }
        }catch(e){
          console.error('Failed to get voucher number:', e);
        }
      }
      
      const receiptParams = new URLSearchParams({
        receipt_no: voucherNo,
        invoice_no: String(__currentSale.invoice_no),
        amount: String(amount),
        payment_method: method,
        user_name: user?.username || 'غير محدد',
        date: new Date().toISOString(),
        auto_print: '0'
      });
      
      if(customerName){ receiptParams.set('customer_name', customerName); }
      if(__currentSale.customer_id){ receiptParams.set('customer_id', String(__currentSale.customer_id)); }
      if(__currentSale.customer_phone){ receiptParams.set('customer_phone', String(__currentSale.customer_phone)); }
      if(__currentSale.customer_vat){ receiptParams.set('customer_vat', String(__currentSale.customer_vat)); }
      if(notes){ receiptParams.set('notes', notes); }
      const receiptUrl = `./receipt-print.html?${receiptParams.toString()}`;
      window.open(receiptUrl, 'RECEIPT_PRINT', 'width=900,height=1000,menubar=no,toolbar=no,location=no,status=no');
      
      // حفظ سند القبض في قاعدة البيانات
      if(window.api.vouchers_create){
        window.api.vouchers_create({
          voucher_no: voucherNo,
          voucher_type: 'receipt',
          amount: amount,
          payment_method: method,
          notes: notes || '',
          entity_type: 'customer',
          entity_id: __currentSale.customer_id || null,
          entity_name: customerName || '',
          entity_phone: __currentSale.customer_phone || '',
          entity_tax_number: __currentSale.customer_vat || '',
          invoice_no: String(__currentSale.invoice_no),
          user_id: user?.id || null,
          user_name: user?.username || ''
        }).catch(err => console.error('Failed to save receipt voucher:', err));
      }
    }catch(err){
      console.error('Failed to open receipt print:', err);
    }
    
    showDialog(false);
    __currentSale = null;
    load();
    
  } catch (error) {
    console.error(error);
    showToast('حدث خطأ غير متوقع', '#ef4444');
  } finally {
    dlgPartial.disabled = false;
    dlgCancel.disabled = false;
    dlgPartial.innerHTML = '💵 دفع جزئي';
  }
}

async function doFullPayment(){
  if(!__currentSale) return;
  
  dlgOk.disabled = true;
  dlgPartial.disabled = true;
  dlgCancel.disabled = true;
  
  try {
    const methodToUse = 'cash';
    const paidAmt = Number(__currentSale.paid_amount||0);
    const grandTotal = Number(__currentSale.grand_total||0);
    const remaining = grandTotal - paidAmt;
    
    let cash = remaining;
    
    if(paidAmt > 0){
      const amount = remaining;
      const r = await window.api.sales_settle_full({ sale_id: __currentSale.id, method: methodToUse, cash: amount });
      
      if(!r || !r.ok){
        showToast(r?.error||'تعذر تسوية الفاتورة', '#ef4444');
        dlgOk.disabled = false;
        dlgPartial.disabled = false;
        dlgCancel.disabled = false;
        return;
      }
      
      dlgOk.innerHTML = '✅ تم السداد!';
      
      try{
        const page = (__settings?.default_print_format === 'a4') ? 'print-a4.html' : 'print.html';
        const url = `../sales/${page}?id=${encodeURIComponent(__currentSale.id)}&pay=${encodeURIComponent(methodToUse)}&cash=${encodeURIComponent(String(amount))}&refresh=1`;
        const w = (__settings?.default_print_format === 'a4') ? 900 : 500;
        const h = (__settings?.default_print_format === 'a4') ? 1000 : 700;
        window.open(url, 'PRINT', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
        showToast(`تم سداد الفاتورة #${__currentSale.invoice_no} بالكامل وإرسالها للطباعة`, '#16a34a');
        
        // حفظ سند القبض في قاعدة البيانات مع رقم تسلسلي
        const user = JSON.parse(localStorage.getItem('pos_user')||'{}');
        if(window.api.vouchers_get_next_number && window.api.vouchers_create){
          window.api.vouchers_get_next_number('receipt').then(result => {
            if(result && result.ok && result.voucher_no){
              return window.api.vouchers_create({
                voucher_no: result.voucher_no,
                voucher_type: 'receipt',
                amount: amount,
                payment_method: methodToUse,
                notes: 'سداد كامل للفاتورة #' + __currentSale.invoice_no,
                entity_type: 'customer',
                entity_id: __currentSale.customer_id || null,
                entity_name: __currentSale.customer_name || '',
                entity_phone: __currentSale.customer_phone || '',
                entity_tax_number: __currentSale.customer_vat || '',
                invoice_no: String(__currentSale.invoice_no),
                user_id: user?.id || null,
                user_name: user?.username || ''
              });
            }
          }).catch(err => console.error('Failed to save receipt voucher:', err));
        }
      }catch(_){
        showToast(`تم سداد الفاتورة #${__currentSale.invoice_no} بالكامل`, '#16a34a');
      }
    } else {
      const r = await window.api.sales_settle_full({ sale_id: __currentSale.id, method: methodToUse, cash });
      
      if(!r || !r.ok){
        showToast(r?.error||'تعذر تسوية الفاتورة', '#ef4444');
        dlgOk.disabled = false;
        dlgPartial.disabled = false;
        dlgCancel.disabled = false;
        return;
      }
      
      dlgOk.innerHTML = '✅ تم السداد!';
      
      try{
        const page = (__settings?.default_print_format === 'a4') ? 'print-a4.html' : 'print.html';
        const url = `../sales/${page}?id=${encodeURIComponent(__currentSale.id)}&pay=${encodeURIComponent(methodToUse)}&cash=${encodeURIComponent(String(cash))}&refresh=1`;
        const w = (__settings?.default_print_format === 'a4') ? 900 : 500;
        const h = (__settings?.default_print_format === 'a4') ? 1000 : 700;
        window.open(url, 'PRINT', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
        showToast(`تم سداد الفاتورة #${__currentSale.invoice_no} بنجاح وإرسالها للطباعة`, '#16a34a');
        
        // حفظ سند القبض في قاعدة البيانات مع رقم تسلسلي
        const user = JSON.parse(localStorage.getItem('pos_user')||'{}');
        if(window.api.vouchers_get_next_number && window.api.vouchers_create){
          window.api.vouchers_get_next_number('receipt').then(result => {
            if(result && result.ok && result.voucher_no){
              return window.api.vouchers_create({
                voucher_no: result.voucher_no,
                voucher_type: 'receipt',
                amount: cash,
                payment_method: methodToUse,
                notes: 'سداد كامل للفاتورة #' + __currentSale.invoice_no,
                entity_type: 'customer',
                entity_id: __currentSale.customer_id || null,
                entity_name: __currentSale.customer_name || '',
                entity_phone: __currentSale.customer_phone || '',
                entity_tax_number: __currentSale.customer_vat || '',
                invoice_no: String(__currentSale.invoice_no),
                user_id: user?.id || null,
                user_name: user?.username || ''
              });
            }
          }).catch(err => console.error('Failed to save receipt voucher:', err));
        }
      }catch(_){
        showToast(`تم سداد الفاتورة #${__currentSale.invoice_no} بنجاح`, '#16a34a');
      }
    }
    
    showDialog(false);
    __currentSale = null;
    load();
    
  } catch (error) {
    console.error(error);
    showToast('حدث خطأ غير متوقع', '#ef4444');
  } finally {
    dlgOk.disabled = false;
    dlgPartial.disabled = false;
    dlgCancel.disabled = false;
    dlgOk.innerHTML = '✅ سداد كامل';
  }
}

dlgPartial.addEventListener('click', doPartialPayment);

dlgBackdrop.addEventListener('click', (event) => {
  if (event.target === dlgBackdrop) {
    forceCloseDialog();
    showToast('تم إلغاء عملية السداد', '#06b6d4');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && dlgBackdrop.style.display === 'flex') {
    event.preventDefault();
    forceCloseDialog();
    showToast('تم إلغاء عملية السداد', '#06b6d4');
  }
});

btnSearch.addEventListener('click', ()=>{
  __state.date_from = dateFrom.value || null;
  __state.date_to = dateTo.value || null;
  
  load();
});

btnClearDates.addEventListener('click', ()=>{
  dateFrom.value = '';
  dateTo.value = '';
  __state.date_from = null;
  __state.date_to = null;
  
  load();
  showToast('تم مسح المرشحات', '#06b6d4');
});

btnBack.addEventListener('click', ()=>{
  window.location.href = '../main/index.html';
});

// Live filtering with faster debounce on text inputs
function debounce(fn, delay=150){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), delay); }; }
const trigger = debounce(()=>load(), 150);
qInput.addEventListener('input', trigger);
q2Input.addEventListener('input', trigger);

// Dates no longer auto-trigger load; they apply only when pressing Search
// Keep listeners minimal to avoid accidental reloads

// ESC clears the active field and reloads immediately
[qInput, q2Input, dateFrom, dateTo].forEach(el=>{
  el.addEventListener('keydown', (e)=>{
    if(e.key==='Escape'){
      el.value='';
      load();
    }
  });
});

// Double-click on date to clear and reload
;[dateFrom, dateTo].forEach(inp=>{
  inp.addEventListener('dblclick', ()=>{ inp.value=''; load(); });
});

(async function init(){ 
  await loadSettings(); 
  await load(); 
})();