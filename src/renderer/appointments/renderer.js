let state = {
  rows: [],
  total: 0,
  page: 1,
  pageSize: 20,
  search: '',
  status: '',
  dateFrom: '',
  dateTo: '',
  editId: null,
  customers: []
};

const statusLabels = {
  booked: 'محجوز',
  confirmed: 'مؤكد',
  cancelled: 'ملغى',
  completed: 'تم'
};

let toastTimer = null;

let __perms = new Set();
async function loadPerms(){
  try{
    const u = JSON.parse(localStorage.getItem('pos_user')||'null');
    if(!u || !u.id) return;
    const r = await window.api.perms_get_for_user(u.id);
    if(r && r.ok){ __perms = new Set(r.keys||[]); }
  }catch(_){ __perms = new Set(); }
}
function canAppt(k){ return __perms.has('appointments') && __perms.has(k); }
function applyTop(){ 
  const addBtn = document.getElementById('addBtn');
  if(addBtn && !canAppt('appointments.add')) addBtn.style.display = 'none'; 
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.textContent = msg;
  toast.style.background = type === 'success' ? '#16a34a' : '#dc2626';
  toast.classList.add('show');
  
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function showError(msg) {
  const dlg = document.getElementById('dlg');
  const isDialogOpen = dlg && dlg.open;
  
  const err = isDialogOpen 
    ? document.getElementById('dialogError') 
    : document.getElementById('error');
  
  if (err) {
    err.textContent = msg;
    err.style.display = 'block';
    setTimeout(() => { 
      err.textContent = ''; 
      err.style.display = 'none';
    }, 5000);
  }
}

async function loadCustomers() {
  try {
    const result = await window.api.customers_list({ q: '', page: 1, pageSize: 0, active: "1" });
    if (result && result.ok) {
      state.customers = result.items || [];
      populateCustomerSelect();
      console.log('Loaded customers:', state.customers.length);
    } else {
      console.error('Failed to load customers:', result?.error);
      showError(result?.error || 'فشل تحميل العملاء');
    }
  } catch (err) {
    console.error('Failed to load customers:', err);
    showError('خطأ في تحميل العملاء');
  }
}

function populateCustomerSelect() {
  // No longer needed - using search autocomplete instead
}

function setupCustomerSearch() {
  const searchInput = document.getElementById('f_customer_search');
  const hiddenInput = document.getElementById('f_customer');
  const suggestionsDiv = document.getElementById('customerSuggestions');
  
  if (!searchInput || !hiddenInput || !suggestionsDiv) return;
  
  let selectedIndex = -1;
  
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    hiddenInput.value = '';
    selectedIndex = -1;
    
    if (!query) {
      suggestionsDiv.classList.add('hidden');
      return;
    }
    
    const filtered = state.customers.filter(c => {
      return (c.name && c.name.toLowerCase().includes(query)) || 
             (c.phone && c.phone.includes(query));
    });
    
    if (filtered.length === 0) {
      suggestionsDiv.innerHTML = '<div class="p-3 text-gray-500 text-sm">لا توجد نتائج</div>';
      suggestionsDiv.classList.remove('hidden');
      return;
    }
    
    suggestionsDiv.innerHTML = '';
    filtered.forEach((customer, index) => {
      const div = document.createElement('div');
      div.className = 'suggestion-item';
      div.innerHTML = `
        <div class="font-medium text-gray-900">${customer.name || 'بدون اسم'}</div>
        <div class="text-sm text-gray-600">${customer.phone || ''}</div>
      `;
      div.dataset.id = customer.id;
      div.dataset.name = customer.name;
      div.dataset.index = index;
      
      div.addEventListener('click', () => {
        selectCustomer(customer);
      });
      
      suggestionsDiv.appendChild(div);
    });
    
    suggestionsDiv.classList.remove('hidden');
  });
  
  searchInput.addEventListener('keydown', (e) => {
    const items = suggestionsDiv.querySelectorAll('.suggestion-item');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateSelection(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelection(items);
    } else if (e.key === 'Enter' && selectedIndex >= 0 && items[selectedIndex]) {
      e.preventDefault();
      items[selectedIndex].click();
    } else if (e.key === 'Escape') {
      suggestionsDiv.classList.add('hidden');
      selectedIndex = -1;
    }
  });
  
  function updateSelection(items) {
    items.forEach((item, idx) => {
      item.classList.toggle('selected', idx === selectedIndex);
    });
    if (items[selectedIndex]) {
      items[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }
  
  function selectCustomer(customer) {
    searchInput.value = `${customer.name} - ${customer.phone || ''}`;
    hiddenInput.value = customer.id;
    suggestionsDiv.classList.add('hidden');
    selectedIndex = -1;
  }
  
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
      suggestionsDiv.classList.add('hidden');
    }
  });
}

async function load() {
  try {
    const result = await window.api.appointments_list({
      search: state.search,
      page: state.page,
      pageSize: state.pageSize,
      status: state.status,
      dateFrom: state.dateFrom,
      dateTo: state.dateTo
    });

    if (!result || !result.ok) {
      showError(result?.error || 'فشل تحميل المواعيد');
      return;
    }

    state.rows = result.rows || [];
    state.total = result.total || 0;
    render();
  } catch (err) {
    showError('خطأ في تحميل المواعيد: ' + (err.message || err));
  }
}

function render() {
  const tbody = document.getElementById('tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (state.rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="px-4 py-8 text-center text-gray-500">لا توجد مواعيد</td></tr>';
    return;
  }

  state.rows.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-100 hover:bg-blue-50 transition-colors';
    
    const statusClass = `status-${row.status}`;
    const statusText = statusLabels[row.status] || row.status;
    const depositText = row.deposit ? `${parseFloat(row.deposit).toFixed(2)} ريال` : '-';
    
    const buttons = [
      `<button class="whatsapp-btn px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors" data-id="${row.id}" data-phone="${row.customer_phone || ''}" data-name="${row.customer_name || ''}">📱 واتساب</button>`,
      `<button class="pdf-btn px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-medium" data-id="${row.id}">📄 PDF</button>`,
      canAppt('appointments.edit') ? `<button class="edit-btn px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium" data-id="${row.id}">✏️ تعديل</button>` : '',
      canAppt('appointments.delete') ? `<button class="delete-btn px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium" data-id="${row.id}">🗑️ حذف</button>` : ''
    ].filter(Boolean).join(' ');
    
    tr.innerHTML = `
      <td class="px-4 py-3 text-sm text-gray-700">${idx + 1}</td>
      <td class="px-4 py-3 text-sm font-medium text-gray-900">${row.customer_name || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-700">${row.customer_phone || '-'}</td>
      <td class="px-4 py-3 text-sm text-gray-700">${formatDate(row.appointment_date)}</td>
      <td class="px-4 py-3 text-sm text-gray-700">${formatTime(row.appointment_time)}</td>
      <td class="px-4 py-3"><span class="status-badge ${statusClass}">${statusText}</span></td>
      <td class="px-4 py-3 text-sm font-medium text-green-700">${depositText}</td>
      <td class="px-4 py-3 text-sm text-gray-600">${row.notes ? row.notes.substring(0, 50) + (row.notes.length > 50 ? '...' : '') : '-'}</td>
      <td class="px-4 py-3">
        <div class="flex gap-2 flex-wrap">
          ${buttons}
        </div>
      </td>
    `;
    
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.whatsapp-btn').forEach(btn => {
    btn.addEventListener('click', () => sendWhatsAppMessage(parseInt(btn.dataset.id), btn.dataset.phone, btn.dataset.name));
  });

  document.querySelectorAll('.pdf-btn').forEach(btn => {
    btn.addEventListener('click', () => exportAppointmentPDF(parseInt(btn.dataset.id)));
  });

  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEdit(parseInt(btn.dataset.id)));
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => confirmDelete(parseInt(btn.dataset.id)));
  });

  renderPager();
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB');
}

function formatTime(timeStr) {
  if (!timeStr) return '-';
  return timeStr.substring(0, 5);
}

function formatDateForInput(dateValue) {
  if (!dateValue) return '';
  const d = new Date(dateValue);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function renderPager() {
  const totalPages = state.pageSize > 0 ? Math.ceil(state.total / state.pageSize) : 1;
  const pagerHtml = totalPages > 1 ? `
    <button id="prevPage" class="px-4 py-2 bg-slate-600 text-white rounded-lg font-medium" ${state.page <= 1 ? 'disabled' : ''}>السابق</button>
    <span class="px-4 py-2 text-gray-700 font-medium">صفحة ${state.page} من ${totalPages}</span>
    <button id="nextPage" class="px-4 py-2 bg-slate-600 text-white rounded-lg font-medium" ${state.page >= totalPages ? 'disabled' : ''}>التالي</button>
  ` : '';

  const pagerTop = document.getElementById('pagerTop');
  const pagerBottom = document.getElementById('pagerBottom');
  if (pagerTop) pagerTop.innerHTML = pagerHtml;
  if (pagerBottom) pagerBottom.innerHTML = pagerHtml;

  if (totalPages > 1) {
    const prev = document.querySelectorAll('#prevPage');
    const next = document.querySelectorAll('#nextPage');
    prev.forEach(btn => btn.addEventListener('click', () => { if (state.page > 1) { state.page--; load(); } }));
    next.forEach(btn => btn.addEventListener('click', () => { if (state.page < totalPages) { state.page++; load(); } }));
  }
}

async function openAdd() {
  if (!canAppt('appointments.add')) {
    showError('ليس لديك صلاحية حجز المواعيد');
    return;
  }
  state.editId = null;
  document.getElementById('dlgTitle').textContent = '📅 حجز موعد جديد';
  document.getElementById('f_customer').value = '';
  document.getElementById('f_customer_search').value = '';
  document.getElementById('f_date').value = '';
  document.getElementById('f_time').value = '';
  document.getElementById('f_deposit').value = '';
  document.getElementById('f_notes').value = '';
  document.getElementById('f_status').value = 'booked';
  document.getElementById('statusSection').style.display = 'none';
  hideNewCustomerForm();
  
  // تعيين الحد الأدنى للتاريخ إلى اليوم
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('f_date').setAttribute('min', today);
  
  const dialogError = document.getElementById('dialogError');
  if (dialogError) {
    dialogError.textContent = '';
    dialogError.style.display = 'none';
  }
  
  await loadCustomers();
  
  document.getElementById('dlg').showModal();
}

async function openEdit(id) {
  if (!canAppt('appointments.edit')) {
    showError('ليس لديك صلاحية تعديل المواعيد');
    return;
  }
  try {
    await loadCustomers();
    
    const dialogError = document.getElementById('dialogError');
    if (dialogError) {
      dialogError.textContent = '';
      dialogError.style.display = 'none';
    }
    
    const result = await window.api.appointments_get(id);
    if (!result || !result.ok) {
      showError(result?.error || 'فشل تحميل بيانات الموعد');
      return;
    }

    const row = result.row;
    state.editId = id;
    document.getElementById('dlgTitle').textContent = '✏️ تعديل الموعد';
    document.getElementById('f_customer').value = row.customer_id || '';
    
    const customer = state.customers.find(c => c.id === row.customer_id);
    if (customer) {
      document.getElementById('f_customer_search').value = `${customer.name} - ${customer.phone || ''}`;
    } else {
      document.getElementById('f_customer_search').value = row.customer_name || '';
    }
    
    // تعيين الحد الأدنى للتاريخ إلى اليوم
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('f_date').setAttribute('min', today);
    
    document.getElementById('f_date').value = formatDateForInput(row.appointment_date);
    document.getElementById('f_time').value = row.appointment_time || '';
    document.getElementById('f_deposit').value = row.deposit || '';
    document.getElementById('f_notes').value = row.notes || '';
    document.getElementById('f_status').value = row.status || 'booked';
    document.getElementById('statusSection').style.display = 'block';
    hideNewCustomerForm();
    document.getElementById('dlg').showModal();
  } catch (err) {
    showError('خطأ في تحميل البيانات: ' + (err.message || err));
  }
}

async function save() {
  let customerId = document.getElementById('f_customer').value;
  const date = document.getElementById('f_date').value;
  const time = document.getElementById('f_time').value;
  const deposit = document.getElementById('f_deposit').value;
  const notes = document.getElementById('f_notes').value;
  const status = document.getElementById('f_status').value;

  if (document.getElementById('newCustomerForm').style.display !== 'none') {
    showError('يرجى حفظ العميل الجديد أولاً أو إلغاء إضافته');
    return;
  }

  if (!customerId) {
    showError('يرجى اختيار عميل');
    return;
  }

  if (!date) {
    showError('يرجى تحديد تاريخ الموعد');
    return;
  }

  if (!time) {
    showError('يرجى تحديد وقت الموعد');
    return;
  }

  // التحقق من أن الموعد ليس في الماضي
  const now = new Date();
  const appointmentDateTime = new Date(`${date}T${time}`);
  
  if (appointmentDateTime < now) {
    showError('لا يمكن حجز موعد في الماضي');
    return;
  }

  const payload = {
    customer_id: parseInt(customerId),
    appointment_date: date,
    appointment_time: time,
    deposit: deposit ? parseFloat(deposit) : 0,
    notes: notes || null,
    status: status || 'booked'
  };

  try {
    let result;
    if (state.editId) {
      payload.id = state.editId;
      result = await window.api.appointments_update(payload);
    } else {
      result = await window.api.appointments_add(payload);
    }

    if (!result || !result.ok) {
      showError(result?.error || 'فشل حفظ الموعد');
      return;
    }

    showToast(state.editId ? 'تم تعديل الموعد بنجاح' : 'تم حجز الموعد بنجاح');
    document.getElementById('dlg').close();
    load();
  } catch (err) {
    showError('خطأ في حفظ الموعد: ' + (err.message || err));
  }
}

function confirmDelete(id) {
  if (!canAppt('appointments.delete')) {
    showError('ليس لديك صلاحية حذف المواعيد');
    return;
  }
  document.getElementById('confirmText').textContent = 'هل أنت متأكد من حذف هذا الموعد؟';
  document.getElementById('confirmDlg').showModal();
  
  document.getElementById('confirmOk').onclick = async () => {
    try {
      const result = await window.api.appointments_delete(id);
      if (!result || !result.ok) {
        showError(result?.error || 'فشل حذف الموعد');
        return;
      }
      showToast('تم حذف الموعد بنجاح');
      document.getElementById('confirmDlg').close();
      load();
    } catch (err) {
      showError('خطأ في حذف الموعد: ' + (err.message || err));
    }
  };
}

function showNewCustomerForm() {
  document.getElementById('newCustomerForm').style.display = 'block';
  document.getElementById('nc_name').value = '';
  document.getElementById('nc_phone').value = '';
  document.getElementById('nc_email').value = '';
  document.getElementById('nc_address').value = '';
}

function hideNewCustomerForm() {
  document.getElementById('newCustomerForm').style.display = 'none';
}

async function saveNewCustomer() {
  const name = document.getElementById('nc_name').value.trim();
  const phone = document.getElementById('nc_phone').value.trim();
  const email = document.getElementById('nc_email').value.trim();
  const address = document.getElementById('nc_address').value.trim();

  if (!phone) {
    showError('رقم الجوال مطلوب للعميل الجديد');
    return;
  }

  try {
    const result = await window.api.customers_add({
      name: name || phone,
      phone: phone,
      email: email || null,
      address: address || null,
      vat_number: null,
      cr_number: null,
      national_address: null,
      notes: null
    });

    if (!result || !result.ok) {
      showError(result?.error || 'فشل إضافة العميل');
      return;
    }

    showToast('تم إضافة العميل بنجاح');
    await loadCustomers();
    document.getElementById('f_customer').value = result.id;
    document.getElementById('f_customer_search').value = `${name || phone} - ${phone}`;
    hideNewCustomerForm();
  } catch (err) {
    showError('خطأ في إضافة العميل: ' + (err.message || err));
  }
}

document.getElementById('addBtn').addEventListener('click', openAdd);
document.getElementById('refreshBtn').addEventListener('click', load);

document.getElementById('q').addEventListener('input', (e) => {
  state.search = e.target.value;
  state.page = 1;
  load();
});

document.getElementById('statusFilter').addEventListener('change', (e) => {
  state.status = e.target.value;
  state.page = 1;
  load();
});

const dateFromInput = document.getElementById('dateFrom');
const dateToInput = document.getElementById('dateTo');

dateFromInput.addEventListener('change', (e) => {
  state.dateFrom = e.target.value;
  state.page = 1;
  load();
});

dateFromInput.addEventListener('click', () => {
  if (dateFromInput.showPicker) {
    dateFromInput.showPicker();
  }
});

dateToInput.addEventListener('change', (e) => {
  state.dateTo = e.target.value;
  state.page = 1;
  load();
});

dateToInput.addEventListener('click', () => {
  if (dateToInput.showPicker) {
    dateToInput.showPicker();
  }
});

document.getElementById('pageSize').addEventListener('change', (e) => {
  state.pageSize = parseInt(e.target.value);
  state.page = 1;
  load();
});

document.getElementById('dlgSave').addEventListener('click', save);
document.getElementById('dlgCancel').addEventListener('click', () => {
  document.getElementById('dlg').close();
});

document.getElementById('confirmCancel').addEventListener('click', () => {
  document.getElementById('confirmDlg').close();
});

document.getElementById('newCustomerBtn').addEventListener('click', showNewCustomerForm);
document.getElementById('cancelNewCustomerBtn').addEventListener('click', hideNewCustomerForm);
document.getElementById('saveNewCustomerBtn').addEventListener('click', saveNewCustomer);

const dialogDateInput = document.getElementById('f_date');
const dialogTimeInput = document.getElementById('f_time');

dialogDateInput.addEventListener('click', () => {
  if (dialogDateInput.showPicker) {
    dialogDateInput.showPicker();
  }
});

dialogTimeInput.addEventListener('click', () => {
  if (dialogTimeInput.showPicker) {
    dialogTimeInput.showPicker();
  }
});

function formatTime12Hour(timeStr) {
  if (!timeStr) return '-';
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'مساءً' : 'صباحاً';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

async function sendWhatsAppMessage(appointmentId, phone, customerName) {
  try {
    // 0. التحقق من اتصال الإنترنت
    if (!navigator.onLine) {
      if(typeof window.showWhatsAppErrorNotification === 'function'){
        window.showWhatsAppErrorNotification('no-internet', 'لا يمكن إرسال الرسالة حالياً');
      } else {
        showError('❌ لا يوجد اتصال بالإنترنت!\n\nالرجاء التحقق من اتصال الجهاز بالإنترنت ثم المحاولة مرة أخرى.');
      }
      return;
    }

    // 1. التحقق من اتصال WhatsApp
    const statusCheck = await window.api.whatsapp_status();
    if (!statusCheck || !statusCheck.success || !statusCheck.connected) {
      if(typeof window.showWhatsAppErrorNotification === 'function'){
        window.showWhatsAppErrorNotification('not-connected', 'يرجى ربط WhatsApp أولاً');
      } else {
        showError('❌ WhatsApp غير متصل!\n\nالرجاء الذهاب إلى إدارة WhatsApp وربط الحساب أولاً.\n\nتأكد من:\n• اتصال الجهاز بالإنترنت\n• مسح رمز QR في شاشة إدارة WhatsApp');
      }
      return;
    }

    // 2. التحقق من رقم الجوال
    let rawPhone = String(phone || '').trim();
    if (!rawPhone) {
      showError('لا يوجد رقم جوال لهذا العميل');
      return;
    }

    // تحويل الأرقام السعودية من 05XXXXXXXX إلى 9665XXXXXXXX
    if (/^05\d{8}$/.test(rawPhone)) {
      rawPhone = '966' + rawPhone.slice(1);
    }
    rawPhone = rawPhone.replace(/[^\d+]/g, '');

    // 3. جلب بيانات الموعد والإعدادات
    showToast('⏳ جاري تحضير سند الحجز...', 'success');
    
    const [appointmentResult, settingsResult, logoResult] = await Promise.all([
      window.api.appointments_get(appointmentId),
      window.api.settings_get(),
      window.api.settings_image_get()
    ]);

    if (!appointmentResult || !appointmentResult.ok) {
      showError('فشل تحميل بيانات الحجز');
      return;
    }

    const appointment = appointmentResult.row;
    const settings = (settingsResult && settingsResult.ok) ? settingsResult.item : {};
    
    // 4. إنشاء HTML للـ PDF (نفس كود exportAppointmentPDF)
    let logoData = '';
    if (logoResult && logoResult.ok && logoResult.base64) {
      logoData = `data:${logoResult.mime || 'image/png'};base64,${logoResult.base64}`;
    } else if (settings.logo_path) {
      if (settings.logo_path.startsWith('assets/')) {
        logoData = `../../${settings.logo_path}`;
      } else {
        logoData = settings.logo_path;
      }
    }
    
    const statusText = statusLabels[appointment.status] || appointment.status;
    const depositText = appointment.deposit ? `${parseFloat(appointment.deposit).toFixed(2)} ريال` : '-';
    const notesText = appointment.notes || '-';
    
    const companyNameAr = settings.seller_legal_name || settings.company_name || '';
    const companyNameEn = settings.company_name_en || settings.seller_legal_name_en || '';
    
    const companyInfoAr = [];
    if (settings.company_location) companyInfoAr.push(settings.company_location);
    if (settings.mobile) companyInfoAr.push('جوال: ' + settings.mobile);
    if (settings.email) companyInfoAr.push('إيميل: ' + settings.email);
    if (settings.seller_vat_number) companyInfoAr.push('الرقم الضريبي: ' + settings.seller_vat_number);
    if (settings.commercial_register) companyInfoAr.push('السجل التجاري: ' + settings.commercial_register);
    const companyInfoArText = companyInfoAr.join('\n');
    
    const companyInfoEn = [];
    if (settings.company_location_en) companyInfoEn.push(settings.company_location_en);
    if (settings.mobile) companyInfoEn.push('Mobile: ' + settings.mobile);
    if (settings.email) companyInfoEn.push('Email: ' + settings.email);
    if (settings.seller_vat_number) companyInfoEn.push('VAT: ' + settings.seller_vat_number);
    if (settings.commercial_register) companyInfoEn.push('CR: ' + settings.commercial_register);
    const companyInfoEnText = companyInfoEn.join('\n');
    
    const html = `
<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <style>
    @font-face {
      font-family: 'Cairo';
      src: url('../../../assets/fonts/Cairo-Black.ttf') format('truetype');
      font-weight: 900;
      font-display: swap;
    }
    
    * {
      font-family: 'Cairo', sans-serif !important;
      font-weight: 900 !important;
      box-sizing: border-box;
    }
    
    body {
      background: #fff !important;
      margin: 0;
      padding: 0;
      color: #000 !important;
      font-size: 11px;
    }
    
    .page {
      width: 190mm;
      min-height: auto;
      max-height: 277mm;
      margin: 0 auto;
      padding: 0;
      box-sizing: border-box;
      page-break-inside: avoid;
      page-break-after: avoid;
    }
    
    .header {
      display: flex;
      flex-direction: column;
      gap: 2px;
      border-bottom: 2px solid #cbd5e1;
      padding-bottom: 4px;
      margin-bottom: 6px;
      page-break-inside: avoid;
    }
    
    .headerTop {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 4px;
    }
    
    .company-box {
      font-size: 11px;
      overflow: hidden;
    }
    
    .company-box.ar {
      text-align: right;
      direction: rtl;
    }
    
    .company-box.en {
      text-align: left;
      direction: ltr;
    }
    
    .company-box h1 {
      margin: 0 0 2px 0;
      font-size: 14px;
      font-weight: 800;
      color: #000;
    }
    
    .company-box .muted {
      white-space: pre-wrap;
      font-size: 10px;
      color: #000;
      font-weight: 900;
      line-height: 1.3;
    }
    
    .brand-center {
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .brand-center img {
      width: 60px;
      height: 60px;
      border-radius: 8px;
      object-fit: contain;
      border: 1px solid #cbd5e1;
      background: #fff;
      display: block;
    }
    
    .section-badge {
      display: inline-block;
      margin: 4px 0;
      padding: 3px 6px;
      background: #e5e7eb;
      border: 1px solid #cbd5e1;
      border-radius: 3px;
      font-weight: 800;
      color: #0f172a;
      font-size: 12px;
      text-align: center;
    }
    
    .details-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin-top: 8px;
      border: 3px solid #000;
      border-radius: 8px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    
    .details-table th,
    .details-table td {
      padding: 8px 10px;
      border-bottom: 2px solid #000;
      font-size: 12px;
      font-weight: 900;
      color: #000;
    }
    
    .details-table tr:last-child th,
    .details-table tr:last-child td {
      border-bottom: none;
    }
    
    .details-table th {
      background: #eef2ff;
      color: #0b3daa;
      text-align: center;
      width: 35%;
      border-left: 3px solid #000;
      vertical-align: middle;
    }
    
    .details-table td {
      text-align: center;
      background: #fff;
      vertical-align: middle;
    }
    
    .status-badge-inline {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 800;
    }
    
    .status-booked { background: #fef08a; color: #854d0e; }
    .status-confirmed { background: #bfdbfe; color: #1e40af; }
    .status-cancelled { background: #fecaca; color: #991b1b; }
    .status-completed { background: #86efac; color: #166534; }
    
    .notes-cell {
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      line-height: 1.3;
      min-height: 30px;
      text-align: center;
    }
    
    @media print {
      @page { size: A4; margin: 10mm; }
      .page { page-break-inside: avoid !important; }
      .header, .details-table { page-break-inside: avoid !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="headerTop">
        <div class="company-box ar">
          ${companyNameAr ? `<h1>${companyNameAr}</h1>` : ''}
          ${companyInfoArText ? `<div class="muted" id="companyInfoAr">${companyInfoArText}</div>` : ''}
        </div>
        
        <div class="brand-center">
          ${logoData ? `<img src="${logoData}" alt="شعار المحل" onerror="this.style.display='none'" />` : '<div style="width:60px;height:60px;"></div>'}
        </div>
        
        <div class="company-box en">
          ${companyNameEn ? `<h1>${companyNameEn}</h1>` : ''}
          ${companyInfoEnText ? `<div class="muted" id="companyInfoEn">${companyInfoEnText}</div>` : ''}
        </div>
      </div>
    </div>
    
    <div style="text-align: center;">
      <span class="section-badge">📅 سند حجز موعد</span>
    </div>
    
    <table class="details-table">
      <tr>
        <th>اسم العميل</th>
        <td>${appointment.customer_name || '-'}</td>
      </tr>
      <tr>
        <th>رقم الجوال</th>
        <td>${appointment.customer_phone || '-'}</td>
      </tr>
      <tr>
        <th>تاريخ الموعد</th>
        <td>${formatDate(appointment.appointment_date)}</td>
      </tr>
      <tr>
        <th>وقت الموعد</th>
        <td>${formatTime12Hour(appointment.appointment_time)}</td>
      </tr>
      <tr>
        <th>الحالة</th>
        <td><span class="status-badge-inline status-${appointment.status}">${statusText}</span></td>
      </tr>
      <tr>
        <th>العربون</th>
        <td>${depositText}</td>
      </tr>
      <tr>
        <th>الملاحظات</th>
        <td><div class="notes-cell">${notesText}</div></td>
      </tr>
    </table>
  </div>
</body>
</html>
    `;
    
    // 5. تصدير PDF إلى ملف مؤقت
    const filename = `appointment-${appointment.customer_name || 'booking'}-${appointmentId}.pdf`;
    const pdfResult = await window.api.pdf_export(html, { 
      printBackground: true, 
      saveMode: 'auto', 
      filename: filename,
      pageSize: 'A4',
      openAfterSave: false  // منع فتح الملف تلقائيًا
    });
    
    if (!pdfResult || !pdfResult.ok) {
      showError('❌ تعذر إنشاء PDF للحجز');
      return;
    }

    // 6. إرسال PDF عبر WhatsApp
    console.log('PDF created at:', pdfResult.path);
    const companyName = settings.seller_legal_name || settings.company_name || 'مؤسستنا';
    const caption = `سند حجز موعد ${appointment.customer_name || ''} من ${companyName}`;
    
    console.log('Sending to phone:', rawPhone);
    console.log('PDF path:', pdfResult.path);
    
    const sendResult = await window.api.whatsapp_send_file(
      rawPhone, 
      pdfResult.path, 
      filename, 
      caption
    );

    // 7. عرض النتيجة
    if (sendResult && sendResult.success) {
      showToast('✅ تم إرسال سند الحجز عبر WhatsApp بنجاح!', 'success');
    } else if (sendResult && sendResult.limitReached) {
      showError('❌ تم انتهاء عدد الرسائل المتاحة! يرجى التواصل مع الدعم الفني للتجديد.');
    } else {
      const errMsg = sendResult?.error || 'خطأ غير معروف';
      showError('❌ فشل إرسال سند الحجز: ' + errMsg);
    }
  } catch (err) {
    console.error('Error sending WhatsApp PDF:', err);
    showError('خطأ في إرسال سند الحجز: ' + (err.message || err));
  }
}

async function exportAppointmentPDF(appointmentId) {
  try {
    const [appointmentResult, settingsResult, logoResult] = await Promise.all([
      window.api.appointments_get(appointmentId),
      window.api.settings_get(),
      window.api.settings_image_get()
    ]);

    if (!appointmentResult || !appointmentResult.ok) {
      showError('فشل تحميل بيانات الحجز');
      return;
    }

    const appointment = appointmentResult.row;
    const settings = (settingsResult && settingsResult.ok) ? settingsResult.item : {};
    
    let logoData = '';
    if (logoResult && logoResult.ok && logoResult.base64) {
      logoData = `data:${logoResult.mime || 'image/png'};base64,${logoResult.base64}`;
    } else if (settings.logo_path) {
      if (settings.logo_path.startsWith('assets/')) {
        logoData = `../../${settings.logo_path}`;
      } else {
        logoData = settings.logo_path;
      }
    }
    
    console.log('Logo data available:', logoData ? 'Yes' : 'No', logoData ? logoData.substring(0, 50) + '...' : '');
    
    const statusText = statusLabels[appointment.status] || appointment.status;
    const depositText = appointment.deposit ? `${parseFloat(appointment.deposit).toFixed(2)} ريال` : '-';
    const notesText = appointment.notes || '-';
    
    const companyNameAr = settings.seller_legal_name || settings.company_name || '';
    const companyNameEn = settings.company_name_en || settings.seller_legal_name_en || '';
    
    const companyInfoAr = [];
    if (settings.company_location) companyInfoAr.push(settings.company_location);
    if (settings.mobile) companyInfoAr.push('جوال: ' + settings.mobile);
    if (settings.email) companyInfoAr.push('إيميل: ' + settings.email);
    if (settings.seller_vat_number) companyInfoAr.push('الرقم الضريبي: ' + settings.seller_vat_number);
    if (settings.commercial_register) companyInfoAr.push('السجل التجاري: ' + settings.commercial_register);
    const companyInfoArText = companyInfoAr.join('\n');
    
    const companyInfoEn = [];
    if (settings.company_location_en) companyInfoEn.push(settings.company_location_en);
    if (settings.mobile) companyInfoEn.push('Mobile: ' + settings.mobile);
    if (settings.email) companyInfoEn.push('Email: ' + settings.email);
    if (settings.seller_vat_number) companyInfoEn.push('VAT: ' + settings.seller_vat_number);
    if (settings.commercial_register) companyInfoEn.push('CR: ' + settings.commercial_register);
    const companyInfoEnText = companyInfoEn.join('\n');
    
    const html = `
<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <style>
    @font-face {
      font-family: 'Cairo';
      src: url('../../../assets/fonts/Cairo-Black.ttf') format('truetype');
      font-weight: 900;
      font-display: swap;
    }
    
    * {
      font-family: 'Cairo', sans-serif !important;
      font-weight: 900 !important;
      box-sizing: border-box;
    }
    
    body {
      background: #fff !important;
      margin: 0;
      padding: 0;
      color: #000 !important;
      font-size: 11px;
    }
    
    .page {
      width: 190mm;
      min-height: auto;
      max-height: 277mm;
      margin: 0 auto;
      padding: 0;
      box-sizing: border-box;
      page-break-inside: avoid;
      page-break-after: avoid;
    }
    
    .header {
      display: flex;
      flex-direction: column;
      gap: 2px;
      border-bottom: 2px solid #cbd5e1;
      padding-bottom: 4px;
      margin-bottom: 6px;
      page-break-inside: avoid;
    }
    
    .headerTop {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 4px;
    }
    
    .company-box {
      font-size: 11px;
      overflow: hidden;
    }
    
    .company-box.ar {
      text-align: right;
      direction: rtl;
    }
    
    .company-box.en {
      text-align: left;
      direction: ltr;
    }
    
    .company-box h1 {
      margin: 0 0 2px 0;
      font-size: 14px;
      font-weight: 800;
      color: #000;
    }
    
    .company-box .muted {
      white-space: pre-wrap;
      font-size: 10px;
      color: #000;
      font-weight: 900;
      line-height: 1.3;
    }
    
    .brand-center {
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .brand-center img {
      width: 60px;
      height: 60px;
      border-radius: 8px;
      object-fit: contain;
      border: 1px solid #cbd5e1;
      background: #fff;
      display: block;
    }
    
    .section-badge {
      display: inline-block;
      margin: 4px 0;
      padding: 3px 6px;
      background: #e5e7eb;
      border: 1px solid #cbd5e1;
      border-radius: 3px;
      font-weight: 800;
      color: #0f172a;
      font-size: 12px;
      text-align: center;
    }
    
    .details-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin-top: 8px;
      border: 3px solid #000;
      border-radius: 8px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    
    .details-table th,
    .details-table td {
      padding: 8px 10px;
      border-bottom: 2px solid #000;
      font-size: 12px;
      font-weight: 900;
      color: #000;
    }
    
    .details-table tr:last-child th,
    .details-table tr:last-child td {
      border-bottom: none;
    }
    
    .details-table th {
      background: #eef2ff;
      color: #0b3daa;
      text-align: center;
      width: 35%;
      border-left: 3px solid #000;
      vertical-align: middle;
    }
    
    .details-table td {
      text-align: center;
      background: #fff;
      vertical-align: middle;
    }
    
    .status-badge-inline {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 800;
    }
    
    .status-booked { background: #fef08a; color: #854d0e; }
    .status-confirmed { background: #bfdbfe; color: #1e40af; }
    .status-cancelled { background: #fecaca; color: #991b1b; }
    .status-completed { background: #86efac; color: #166534; }
    
    .notes-cell {
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      line-height: 1.3;
      min-height: 30px;
      text-align: center;
    }
    
    @media print {
      @page { size: A4; margin: 10mm; }
      .page { page-break-inside: avoid !important; }
      .header, .details-table { page-break-inside: avoid !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="headerTop">
        <div class="company-box ar">
          ${companyNameAr ? `<h1>${companyNameAr}</h1>` : ''}
          ${companyInfoArText ? `<div class="muted" id="companyInfoAr">${companyInfoArText}</div>` : ''}
        </div>
        
        <div class="brand-center">
          ${logoData ? `<img src="${logoData}" alt="شعار المحل" onerror="this.style.display='none'" />` : '<div style="width:60px;height:60px;"></div>'}
        </div>
        
        <div class="company-box en">
          ${companyNameEn ? `<h1>${companyNameEn}</h1>` : ''}
          ${companyInfoEnText ? `<div class="muted" id="companyInfoEn">${companyInfoEnText}</div>` : ''}
        </div>
      </div>
    </div>
    
    <div style="text-align: center;">
      <span class="section-badge">📅 سند حجز موعد</span>
    </div>
    
    <table class="details-table">
      <tr>
        <th>اسم العميل</th>
        <td>${appointment.customer_name || '-'}</td>
      </tr>
      <tr>
        <th>رقم الجوال</th>
        <td>${appointment.customer_phone || '-'}</td>
      </tr>
      <tr>
        <th>تاريخ الموعد</th>
        <td>${formatDate(appointment.appointment_date)}</td>
      </tr>
      <tr>
        <th>وقت الموعد</th>
        <td>${formatTime12Hour(appointment.appointment_time)}</td>
      </tr>
      <tr>
        <th>الحالة</th>
        <td><span class="status-badge-inline status-${appointment.status}">${statusText}</span></td>
      </tr>
      <tr>
        <th>العربون</th>
        <td>${depositText}</td>
      </tr>
      <tr>
        <th>الملاحظات</th>
        <td><div class="notes-cell">${notesText}</div></td>
      </tr>
    </table>
  </div>
</body>
</html>
    `;
    
    const filename = `appointment-${appointment.customer_name || 'booking'}-${appointmentId}.pdf`;
    await window.api.pdf_export(html, { saveMode: 'auto', filename: filename, pageSize: 'A4' });
    
  } catch (err) {
    console.error('Error exporting appointment PDF:', err);
    showError('فشل تصدير PDF: ' + (err.message || err));
  }
}

(async function init() {
  await loadPerms();
  applyTop();
  await loadCustomers();
  setupCustomerSearch();
  load();
})();
