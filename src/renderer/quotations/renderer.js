const loading = document.getElementById('loading');
const content = document.getElementById('content');
const quotationsBody = document.getElementById('quotationsBody');
const emptyState = document.getElementById('emptyState');
const btnBack = document.getElementById('btnBack');
const btnRefresh = document.getElementById('btnRefresh');
const errorDiv = document.getElementById('error');

const searchInput = document.getElementById('searchInput');
const pageSizeSelect = document.getElementById('pageSizeSelect');
const paginationTop = document.getElementById('paginationTop');
const paginationBottom = document.getElementById('paginationBottom');

const confirmDlg = document.getElementById('confirmDlg');
const confirmTitle = document.getElementById('confirmTitle');
const confirmText = document.getElementById('confirmText');
const confirmOk = document.getElementById('confirmOk');
const confirmCancel = document.getElementById('confirmCancel');

let state = {
  search: '',
  page: 1,
  pageSize: 20,
  total: 0
};

function setError(msg) { 
  errorDiv.textContent = msg || ''; 
}

if (btnBack) {
  btnBack.addEventListener('click', () => {
    window.location.href = '../main/index.html';
  });
}

if (btnRefresh) {
  btnRefresh.addEventListener('click', () => loadQuotations());
}

let searchDebounce;
if (searchInput) {
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.search = (searchInput?.value || '').trim();
      state.page = 1;
      loadQuotations();
    }, 300);
  });
}

if (pageSizeSelect) {
  pageSizeSelect.addEventListener('change', () => {
    state.pageSize = Number(pageSizeSelect.value || 20);
    state.page = 1;
    loadQuotations();
  });
}

function formatCurrency(amount) {
  const val = Number(amount || 0).toFixed(2);
  return `${val} \uE900`;
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d);
  } catch (_) {
    return dateStr;
  }
}

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
  const disablePrev = state.page <= 1;
  const disableNext = state.page >= totalPages;
  
  const btn = (label, disabled, action) => `<button class="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium" ${disabled ? 'disabled' : ''} data-action="${action}">${label}</button>`;
  
  const html = [
    btn('⏮️', disablePrev, 'first'),
    btn('◀️', disablePrev, 'prev'),
    `<span class="text-gray-600 font-medium px-2">صفحة ${state.page} من ${totalPages}</span>`,
    btn('▶️', disableNext, 'next'),
    btn('⏭️', disableNext, 'last')
  ].join(' ');
  
  if (paginationTop) paginationTop.innerHTML = html;
  if (paginationBottom) paginationBottom.innerHTML = html;
  
  const handleClick = (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    if (action === 'first') state.page = 1;
    if (action === 'prev') state.page = Math.max(1, state.page - 1);
    if (action === 'next') state.page = Math.min(totalPages, state.page + 1);
    if (action === 'last') state.page = totalPages;
    loadQuotations();
  };
  
  if (paginationTop) paginationTop.onclick = handleClick;
  if (paginationBottom) paginationBottom.onclick = handleClick;
}

let toastTimer = null;
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  const bgColor = type === 'success' ? '#16a34a' : '#ef4444';
  toast.style.background = bgColor;
  toast.textContent = message;
  toast.classList.remove('hidden');
  
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
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

async function customConfirm(message, title = 'تأكيد') {
  if (!confirmDlg) return false;
  
  confirmTitle.textContent = title;
  confirmText.textContent = message;
  
  safeShowModal(confirmDlg);
  
  return new Promise((resolve) => {
    const handleOk = () => {
      confirmDlg.close();
      cleanup();
      resolve(true);
    };
    const handleCancel = () => {
      confirmDlg.close();
      cleanup();
      resolve(false);
    };
    const cleanup = () => {
      confirmOk.removeEventListener('click', handleOk);
      confirmCancel.removeEventListener('click', handleCancel);
    };
    
    confirmOk.addEventListener('click', handleOk);
    confirmCancel.addEventListener('click', handleCancel);
  });
}

async function loadQuotations() {
  try {
    loading.style.display = 'block';
    content.style.display = 'none';
    setError('');

    const result = await window.api.quotations_list({
      search: state.search,
      page: state.page,
      pageSize: state.pageSize
    });
    
    loading.style.display = 'none';
    content.style.display = 'block';

    if (!result.ok) {
      setError('فشل تحميل عروض الأسعار: ' + (result.error || ''));
      return;
    }

    const quotations = result.quotations || [];
    state.total = Number(result.total || quotations.length || 0);
    state.page = Number(result.page || state.page);
    state.pageSize = Number(result.pageSize || state.pageSize);

    renderPagination();
    
    if (quotations.length === 0) {
      quotationsBody.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    
    quotationsBody.innerHTML = quotations.map((q, i) => `
      <tr class="border-b border-gray-100 last:border-b-0">
        <td class="px-4 py-3 text-gray-700 font-medium">${((state.page - 1) * state.pageSize) + i + 1}</td>
        <td class="px-4 py-3 text-gray-900 font-semibold">${q.quotation_no}</td>
        <td class="px-4 py-3 text-gray-600 text-sm">${formatDate(q.created_at)}</td>
        <td class="px-4 py-3 text-gray-700">${q.customer_name || '<span class="text-gray-400">غير محدد</span>'}</td>
        <td class="px-4 py-3 text-gray-700">${q.customer_phone || '-'}</td>
        <td class="px-4 py-3 text-gray-700">${q.cashier_name || '-'}</td>
        <td class="px-4 py-3 text-gray-900 font-bold text-blue-600">${formatCurrency(q.total)}</td>
        <td class="px-4 py-3">
          <div class="flex flex-wrap gap-2 items-center">
            <button class="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium" data-action="view" data-id="${q.id}">👁 عرض</button>
            <button class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium" data-action="restore" data-id="${q.id}">📄 استعادة</button>
            <button class="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium" data-action="delete" data-id="${q.id}" data-no="${q.quotation_no}">🗑 حذف</button>
          </div>
        </td>
      </tr>
    `).join('');
    
    quotationsBody.onclick = handleTableAction;
    
  } catch (e) {
    loading.style.display = 'none';
    content.style.display = 'block';
    setError('حدث خطأ: ' + e.message);
  }
}

async function handleTableAction(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  
  const action = btn.getAttribute('data-action');
  const id = Number(btn.getAttribute('data-id'));
  
  if (action === 'view') {
    await viewQuotation(id);
  } else if (action === 'restore') {
    await restoreToInvoice(id);
  } else if (action === 'delete') {
    const quotationNo = btn.getAttribute('data-no');
    await deleteQuotation(id, quotationNo);
  }
}

async function viewQuotation(id) {
  try {
    const result = await window.api.quotations_get(id);
    if (!result.ok) {
      setError('فشل تحميل عرض السعر: ' + (result.error || ''));
      return;
    }

    const q = result.quotation;
    const items = q.items || [];
    
    const totals = {
      sub_total: q.subtotal,
      discount_type: q.discount_type || 'none',
      discount_value: q.discount_value || 0,
      discount_amount: q.discount_amount || 0,
      extra_value: q.extra_amount || 0,
      vat_total: q.vat_amount,
      grand_total: q.total,
      tobacco_fee: q.tobacco_fee || 0,
      total_after_discount: (q.subtotal || 0) - (q.discount_amount || 0),
      tax_treatment: q.tax_treatment || 'standard'
    };

    sessionStorage.setItem('quotation_cart', JSON.stringify(items));
    sessionStorage.setItem('quotation_totals', JSON.stringify(totals));
    sessionStorage.setItem('quotation_customer_id', q.customer_id || '');
    sessionStorage.setItem('quotation_notes', q.notes || '');
    sessionStorage.setItem('quotation_number', q.quotation_no);
    sessionStorage.setItem('quotation_date', q.created_at);
    sessionStorage.setItem('quotation_cashier', q.cashier_name || '');
    sessionStorage.setItem('quotation_view_mode', 'true');
    
    const w = 800, h = 900;
    window.open('../sales/quotation.html', 'QUOTATION_VIEW', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
    
  } catch (e) {
    setError('حدث خطأ: ' + e.message);
  }
}

async function deleteQuotation(id, quotationNo) {
  const confirmed = await customConfirm(
    `هل تريد حذف عرض السعر رقم ${quotationNo}؟`,
    'حذف عرض السعر'
  );
  
  if (!confirmed) return;

  try {
    const result = await window.api.quotations_delete(id);
    if (!result.ok) {
      showToast('فشل حذف عرض السعر: ' + (result.error || ''), 'error');
      return;
    }

    showToast('✓ تم حذف عرض السعر بنجاح', 'success');
    loadQuotations();
    
  } catch (e) {
    showToast('حدث خطأ: ' + e.message, 'error');
  }
}

async function restoreToInvoice(id) {
  try {
    const result = await window.api.quotations_get(id);
    if (!result.ok) {
      setError('فشل تحميل عرض السعر: ' + (result.error || ''));
      return;
    }

    const q = result.quotation;
    const items = q.items || [];
    
    const hasInvalidItems = items.some(it => !it.id && !it.product_id);
    if (hasInvalidItems) {
      const confirmed = await customConfirm(
        'عرض السعر هذا تم حفظه بصيغة قديمة ولا يحتوي على معرفات المنتجات.\n\nلا يمكن استعادته للطباعة كفاتورة.\n\nيُرجى حذف هذا العرض وإنشاء عرض سعر جديد.\n\nهل تريد حذف هذا العرض الآن؟',
        'عرض سعر قديم'
      );
      
      if (confirmed) {
        const deleteResult = await window.api.quotations_delete(id);
        if (deleteResult.ok) {
          showToast('✓ تم حذف عرض السعر القديم', 'success');
          loadQuotations();
        }
      }
      return;
    }
    
    const totals = {
      sub_total: q.subtotal,
      discount_type: q.discount_type || 'none',
      discount_value: q.discount_value || 0,
      discount_amount: q.discount_amount || 0,
      extra_value: q.extra_amount || 0,
      vat_total: q.vat_amount,
      grand_total: q.total,
      tobacco_fee: q.tobacco_fee || 0,
      total_after_discount: (q.subtotal || 0) - (q.discount_amount || 0),
      tax_treatment: q.tax_treatment || 'standard'
    };

    sessionStorage.setItem('restore_cart', JSON.stringify(items));
    sessionStorage.setItem('restore_totals', JSON.stringify(totals));
    sessionStorage.setItem('restore_customer_id', q.customer_id || '');
    sessionStorage.setItem('restore_notes', q.notes || '');
    
    window.location.href = '../sales/index.html';
    
  } catch (e) {
    setError('حدث خطأ: ' + e.message);
  }
}

loadQuotations();
