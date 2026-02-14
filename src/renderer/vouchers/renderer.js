// Vouchers screen renderer
let currentTab = 'receipts';
let allVouchers = [];

// Pagination state (like invoices)
let __page = 1;
let __pageSize = 20; // 0 = all

// DOM elements
const tabs = document.querySelectorAll('.tab');
const receiptsTable = document.getElementById('receiptsTable');
const paymentsTable = document.getElementById('paymentsTable');
const receiptsBody = document.getElementById('receiptsBody');
const paymentsBody = document.getElementById('paymentsBody');
const searchInput = document.getElementById('searchInput');
const dateFrom = document.getElementById('dateFrom');
const dateTo = document.getElementById('dateTo');
const btnFilter = document.getElementById('btnFilter');
const btnClearFilter = document.getElementById('btnClearFilter');
const btnBack = document.getElementById('btnBack');
// Pager DOM
const pageSizeSel = document.getElementById('pageSize');
const pagerTop = document.getElementById('pagerTop');
const pagerBottom = null; // bottom pager not present yet; can be added if desired

// Stats
const totalReceipts = document.getElementById('totalReceipts');
const countReceipts = document.getElementById('countReceipts');
const totalPayments = document.getElementById('totalPayments');
const countPayments = document.getElementById('countPayments');

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.getAttribute('data-tab');
    switchTab(tabName);
  });
});

function switchTab(tabName) {
  currentTab = tabName;
  
  tabs.forEach(t => {
    if (t.getAttribute('data-tab') === tabName) {
      t.classList.remove('bg-gray-100', 'text-gray-600', 'hover:bg-gray-200');
      t.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700');
    } else {
      t.classList.remove('bg-blue-600', 'text-white', 'hover:bg-blue-700');
      t.classList.add('bg-gray-100', 'text-gray-600', 'hover:bg-gray-200');
    }
  });
  
  if (tabName === 'receipts') {
    receiptsTable.classList.remove('hidden');
    paymentsTable.classList.add('hidden');
  } else {
    receiptsTable.classList.add('hidden');
    paymentsTable.classList.remove('hidden');
  }
  __page = 1;
  renderVouchers();
  renderPager();
}

// Load vouchers
async function loadVouchers() {
  try {
    const filters = {};
    
    if (searchInput.value.trim()) {
      filters.search = searchInput.value.trim();
    }
    
    if (dateFrom.value) {
      filters.from_date = dateFrom.value;
    }
    
    if (dateTo.value) {
      filters.to_date = dateTo.value;
    }
    
    // Guard: Do not load any vouchers without filters
    if (Object.keys(filters).length === 0) {
      allVouchers = [];
      __page = 1; // reset page
      renderVouchers();
      updateStats();
      renderPager();
      showToast('⚠️ لن يتم عرض السندات حتى تقوم بالبحث أو تحديد الفترة', 'error');
      return;
    }

    console.log('Loading vouchers with filters:', filters);
    
    const result = await window.api.vouchers_list(filters);
    
    console.log('Vouchers result:', result);
    
    if (result && result.ok) {
      allVouchers = result.items || [];
      console.log(`Loaded ${allVouchers.length} vouchers`);
      __page = 1; // reset to first page on new load
      renderVouchers();
      updateStats();
      renderPager();
    } else {
      console.error('Failed to load vouchers:', result?.error);
      showToast('❌ فشل تحميل السندات: ' + (result?.error || 'خطأ غير معروف'), 'error');
    }
  } catch (error) {
    console.error('Load vouchers error:', error);
    showToast('❌ حدث خطأ أثناء تحميل السندات', 'error');
  }
}

function paginated(list){ if(!__pageSize||__pageSize<=0) return list; const s=(__page-1)*__pageSize; return list.slice(s, s+__pageSize); }
function renderPager(){
  const top = pagerTop;
  const total = (currentTab==='receipts')
    ? allVouchers.filter(v=>v.voucher_type==='receipt').length
    : allVouchers.filter(v=>v.voucher_type==='payment').length;
  const pages = (__pageSize && __pageSize>0) ? Math.max(1, Math.ceil(total / __pageSize)) : 1;
  const disablePrev = __page<=1;
  const disableNext = __page>=pages;
  const btn=(l,d,g)=>`<button class="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium" ${d?'disabled':''} data-go="${g}">${l}</button>`;
  const html=[btn('⏮️',disablePrev,'first'),btn('◀️',disablePrev,'prev'),`<span class="text-gray-600 font-medium px-2">صفحة ${__page} من ${pages}</span>`,btn('▶️',disableNext,'next'),btn('⏭️',disableNext,'last')].join(' ');
  if(top) top.innerHTML = html;
  const onClick=(e)=>{ const b=e.target.closest('button'); if(!b) return; const act=b.getAttribute('data-go'); if(act==='first') __page=1; if(act==='prev') __page=Math.max(1,__page-1); if(act==='next') __page=Math.min(pages,__page+1); if(act==='last') __page=pages; renderVouchers(); renderPager(); };
  if(top) top.onclick = onClick;
}

function renderVouchers() {
  const receipts = allVouchers.filter(v => v.voucher_type === 'receipt');
  const payments = allVouchers.filter(v => v.voucher_type === 'payment');
  
  if (receipts.length === 0) {
    receiptsBody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-12 text-gray-400">
          <div class="text-5xl mb-3">🟢</div>
          <div>لا توجد سندات قبض</div>
        </td>
      </tr>
    `;
  } else {
    const items = (currentTab==='receipts') ? paginated(receipts) : receipts;
    receiptsBody.innerHTML = items.map(v => `
      <tr class="border-b border-gray-100 last:border-b-0">
        <td class="px-4 py-3 text-gray-900 font-semibold">${escapeHtml(v.voucher_no)}</td>
        <td class="px-4 py-3 text-gray-600 text-sm">${formatDateTime(v.created_at)}</td>
        <td class="px-4 py-3 text-gray-700">${escapeHtml(v.entity_name || '-')}<br><small class="text-gray-500">${escapeHtml(v.entity_phone || '')}</small></td>
        <td class="px-4 py-3 text-gray-700">${escapeHtml(v.invoice_no || '-')}</td>
        <td class="px-4 py-3 text-green-700 font-bold">${Number(v.amount || 0).toFixed(2)} <span class="currency-symbol">\uE900</span></td>
        <td class="px-4 py-3 text-gray-700">${getPaymentMethodLabel(v.payment_method)}</td>
        <td class="px-4 py-3 text-gray-700">${escapeHtml(v.user_name || '-')}</td>
        <td class="px-4 py-3 text-gray-600 text-sm max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title="${escapeHtml(v.notes || '')}">${escapeHtml(v.notes || '-')}</td>
        <td class="px-4 py-3">
          <div class="flex gap-2 whitespace-nowrap">
            <button class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium" onclick="viewVoucher(${v.id}, 'receipt')">👁️ عرض</button>
            <button class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium" onclick="deleteVoucher(${v.id})">🗑️ حذف</button>
          </div>
        </td>
      </tr>
    `).join('');
  }
  
  if (payments.length === 0) {
    paymentsBody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-12 text-gray-400">
          <div class="text-5xl mb-3">🟡</div>
          <div>لا توجد سندات صرف</div>
        </td>
      </tr>
    `;
  } else {
    const items = (currentTab==='payments') ? paginated(payments) : payments;
    paymentsBody.innerHTML = items.map(v => `
      <tr class="border-b border-gray-100 last:border-b-0">
        <td class="px-4 py-3 text-gray-900 font-semibold">${escapeHtml(v.voucher_no)}</td>
        <td class="px-4 py-3 text-gray-600 text-sm">${formatDateTime(v.created_at)}</td>
        <td class="px-4 py-3 text-gray-700">${escapeHtml(v.entity_name || '-')}<br><small class="text-gray-500">${escapeHtml(v.entity_phone || '')}</small></td>
        <td class="px-4 py-3 text-gray-700">${escapeHtml(v.invoice_no || '-')}</td>
        <td class="px-4 py-3 text-amber-700 font-bold">${Number(v.amount || 0).toFixed(2)} <span class="currency-symbol">\uE900</span></td>
        <td class="px-4 py-3 text-gray-700">${getPaymentMethodLabel(v.payment_method)}</td>
        <td class="px-4 py-3 text-gray-700">${escapeHtml(v.user_name || '-')}</td>
        <td class="px-4 py-3 text-gray-600 text-sm max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" title="${escapeHtml(v.notes || '')}">${escapeHtml(v.notes || '-')}</td>
        <td class="px-4 py-3">
          <div class="flex gap-2 whitespace-nowrap">
            <button class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium" onclick="viewVoucher(${v.id}, 'payment')">👁️ عرض</button>
            <button class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium" onclick="deleteVoucher(${v.id})">🗑️ حذف</button>
          </div>
        </td>
      </tr>
    `).join('');
  }
}

function updateStats() {
  const receipts = allVouchers.filter(v => v.voucher_type === 'receipt');
  const payments = allVouchers.filter(v => v.voucher_type === 'payment');
  
  const totalR = receipts.reduce((sum, v) => sum + Number(v.amount || 0), 0);
  const totalP = payments.reduce((sum, v) => sum + Number(v.amount || 0), 0);
  
  totalReceipts.innerHTML = totalR.toFixed(2) + ' <span class="currency-symbol">\uE900</span>';
  countReceipts.textContent = `${receipts.length} سند`;
  
  totalPayments.innerHTML = totalP.toFixed(2) + ' <span class="currency-symbol">\uE900</span>';
  countPayments.textContent = `${payments.length} سند`;
}

// View voucher (re-open print dialog)
async function viewVoucher(id, type) {
  try {
    const result = await window.api.vouchers_get(id);
    
    if (result && result.ok && result.item) {
      const v = result.item;
      
      // Build URL based on type
      let printUrl;
      if (type === 'receipt') {
        // Receipt print URL - include customer_id to load full customer data and pass created_at date
        printUrl = `../payments/receipt-print.html?voucher_no=${encodeURIComponent(v.voucher_no)}&customer_id=${encodeURIComponent(v.entity_id || '')}&customer_name=${encodeURIComponent(v.entity_name || '')}&customer_phone=${encodeURIComponent(v.entity_phone || '')}&customer_tax=${encodeURIComponent(v.entity_tax_number || '')}&invoice_no=${encodeURIComponent(v.invoice_no || '')}&amount=${v.amount}&method=${encodeURIComponent(v.payment_method || 'cash')}&notes=${encodeURIComponent(v.notes || '')}&user_name=${encodeURIComponent(v.user_name || '')}&date=${encodeURIComponent(v.created_at || '')}`;
      } else {
        // Payment voucher print URL
        printUrl = `../suppliers/payment-voucher-print.html?voucher_no=${encodeURIComponent(v.voucher_no)}&supplier_name=${encodeURIComponent(v.entity_name || '')}&supplier_phone=${encodeURIComponent(v.entity_phone || '')}&supplier_tax=${encodeURIComponent(v.entity_tax_number || '')}&invoice_no=${encodeURIComponent(v.invoice_no || '')}&amount=${v.amount}&method=${encodeURIComponent(v.payment_method || 'cash')}&notes=${encodeURIComponent(v.notes || '')}&user_name=${encodeURIComponent(v.user_name || '')}`;
      }
      
      window.open(printUrl, '_blank', 'width=800,height=900');
    } else {
      showToast('❌ فشل في تحميل بيانات السند', 'error');
    }
  } catch (error) {
    console.error('View voucher error:', error);
    showToast('❌ حدث خطأ', 'error');
  }
}

async function deleteVoucher(id) {
  const confirmDlg = document.getElementById('confirmDlg');
  const confirmText = document.getElementById('confirmText');
  const confirmTitle = document.getElementById('confirmTitle');
  const confirmOk = document.getElementById('confirmOk');
  const confirmCancel = document.getElementById('confirmCancel');

  async function safeShowModal(d){ try{ d.showModal(); }catch(_){ try{ d.close?.(); }catch(__){} try{ d.showModal(); }catch(__){} } }

  let proceed = false;
  if(confirmDlg && confirmText && confirmOk && confirmCancel){
    if(confirmTitle) confirmTitle.textContent = 'تأكيد حذف السند';
    confirmText.textContent = 'هل أنت متأكد من حذف هذا السند بشكل نهائي؟\n\nلا يمكن التراجع عن هذا الإجراء.';
    const onOk = ()=>{ proceed=true; try{ confirmDlg.close(); }catch(_){ confirmDlg.removeAttribute('open'); } };
    const onCancel = ()=>{ proceed=false; try{ confirmDlg.close(); }catch(_){ confirmDlg.removeAttribute('open'); } };
    confirmOk.addEventListener('click', onOk, { once:true });
    confirmCancel.addEventListener('click', onCancel, { once:true });
    try{ await safeShowModal(confirmDlg); }catch(_){ }
    await new Promise(resolve=>{ confirmDlg.addEventListener('close', ()=>{ setTimeout(()=>{ window.focus?.(); resolve(); },0); }, { once:true }); });
  } else {
    proceed = confirm('هل تريد حذف هذا السند بشكل نهائي؟');
  }

  if (!proceed) return;

  try {
    const result = await window.api.vouchers_delete(id);
    if (result && result.ok) {
      showToast('✅ تم حذف السند بنجاح', 'success');
      await loadVouchers();
    } else {
      showToast('❌ فشل في حذف السند', 'error');
    }
  } catch (err) {
    console.error('Delete voucher error:', err);
    showToast('❌ حدث خطأ أثناء الحذف', 'error');
  }
}

// Filter
btnFilter.addEventListener('click', () => {
  __page = 1; // reset
  loadVouchers();
});

btnClearFilter.addEventListener('click', () => {
  searchInput.value = '';
  dateFrom.value = '';
  dateTo.value = '';
  __page = 1; // reset
  loadVouchers();
});

// Search on Enter
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    __page = 1; // reset
    loadVouchers();
  }
});

// Back button
btnBack.addEventListener('click', () => {
  window.location.href = '../main/index.html';
});

// Utility functions
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text || '').replace(/[&<>"']/g, m => map[m]);
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    // Return Gregorian date with English (Latin) digits only: YYYY-MM-DD
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch (e) {
    return dateStr;
  }
}

function getPaymentMethodLabel(method) {
  const labels = {
    'cash': '💵 نقدي',
    'card': '💳 بطاقة',
    'transfer': '🏦 تحويل',
    'other': '📝 أخرى'
  };
  return labels[method] || method || '-';
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

if (pageSizeSel) {
  pageSizeSel.addEventListener('change', () => {
    __pageSize = Number(pageSizeSel.value || 20);
    __page = 1;
    renderVouchers();
    renderPager();
  });
}

renderVouchers();
updateStats();
renderPager();

// Page size control
if(pageSizeSel){
  pageSizeSel.addEventListener('change', ()=>{
    const v = Number(pageSizeSel.value||20);
    __pageSize = v;
    __page = 1;
    renderVouchers();
    renderPager();
  });
}