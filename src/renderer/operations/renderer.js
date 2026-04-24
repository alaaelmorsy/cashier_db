const tbody = document.getElementById('tbody');
const errorDiv = document.getElementById('error');
const headerTitle = document.getElementById('headerTitle');
const btnBack = document.getElementById('btnBack');
const addBtn = document.getElementById('addBtn');
const refreshBtn = document.getElementById('refreshBtn');
const operationsCount = document.getElementById('operationsCount');
const thIndex = document.getElementById('thIndex');
const thName = document.getElementById('thName');
const thStatus = document.getElementById('thStatus');
const thActions = document.getElementById('thActions');

const dlg = document.getElementById('dlg');
const dlgTitle = document.getElementById('dlgTitle');
const f_nameLabel = document.getElementById('f_nameLabel');
const f_name = document.getElementById('f_name');
const dlgSave = document.getElementById('dlgSave');
const dlgCancel = document.getElementById('dlgCancel');

const confirmDlg = document.getElementById('confirmDlg');
const confirmTitle = document.getElementById('confirmTitle');
const confirmText = document.getElementById('confirmText');
const confirmOk = document.getElementById('confirmOk');
const confirmCancel = document.getElementById('confirmCancel');

let __perms = new Set();
let __opsLang = 'ar';
let editId = null;
let currentItems = [];

const __opsTranslations = {
  ar: {
    pageTitle: 'العمليات - POS SA',
    headerTitle: '⚙️ إدارة العمليات',
    btnBack: '⬅ العودة',
    addBtn: '➕ إضافة عملية',
    refreshBtn: '🔄 تحديث',
    thIndex: '#',
    thName: 'اسم العملية',
    thStatus: 'الحالة',
    thActions: 'الإجراءات',
    dlgTitleAdd: 'إضافة عملية جديدة',
    dlgTitleEdit: 'تعديل عملية: {{name}}',
    nameLabel: 'اسم العملية',
    namePlaceholder: 'أدخل اسم العملية...',
    cancelBtn: 'إلغاء',
    saveBtn: 'حفظ',
    savingAdd: '⏳ جاري الحفظ...',
    savingEdit: '⏳ جاري التعديل...',
    loadingUpdate: '⏳ جاري التحديث...',
    loadingDelete: '⏳ جاري الحذف...',
    statusActive: 'نشطة',
    statusInactive: 'موقوفة',
    sortOrder: 'ترتيب',
    btnEdit: '✏️ تعديل',
    btnStop: '⏸️ إيقاف',
    btnActivate: '▶️ تفعيل',
    btnDelete: '🗑️ حذف',
    emptyTitle: 'لا توجد عمليات محفوظة',
    emptySubtitle: 'ابدأ بإضافة عملية جديدة للمنتجات',
    confirmTitle: 'تأكيد',
    confirmDeleteTitle: 'تأكيد الحذف',
    confirmDeleteText: 'هل أنت متأكد من حذف العملية "{{name}}"؟\n\nهذا الإجراء لا يمكن التراجع عنه.',
    confirmOk: 'موافق',
    confirmCancel: 'إلغاء',
    confirmFallback: 'تأكيد؟',
    itemFallback: 'العملية',
    errOrderSave: 'فشل حفظ الترتيب',
    errLoadFailed: 'تعذر تحميل العمليات',
    errLoadData: 'حدث خطأ أثناء تحميل البيانات',
    errNameRequired: 'يرجى إدخال اسم العملية',
    errNameMin: 'اسم العملية يجب أن يكون على الأقل حرفين',
    errNameDuplicate: 'اسم العملية موجود مسبقاً، يرجى اختيار اسم آخر',
    errSaveFailed: 'فشل الحفظ',
    errSaveData: 'حدث خطأ أثناء حفظ البيانات',
    errItemMissing: 'العنصر غير موجود',
    errToggleFailed: 'فشل تحديث حالة العملية',
    errToggleData: 'حدث خطأ أثناء تحديث الحالة',
    errDeleteFailed: 'فشل حذف العملية',
    errDeleteData: 'حدث خطأ أثناء حذف العملية'
  },
  en: {
    pageTitle: 'Operations - POS SA',
    headerTitle: '⚙️ Manage Operations',
    btnBack: '⬅ Back',
    addBtn: '➕ Add Operation',
    refreshBtn: '🔄 Refresh',
    thIndex: '#',
    thName: 'Operation Name',
    thStatus: 'Status',
    thActions: 'Actions',
    dlgTitleAdd: 'Add New Operation',
    dlgTitleEdit: 'Edit Operation: {{name}}',
    nameLabel: 'Operation Name',
    namePlaceholder: 'Enter operation name...',
    cancelBtn: 'Cancel',
    saveBtn: 'Save',
    savingAdd: '⏳ Saving...',
    savingEdit: '⏳ Updating...',
    loadingUpdate: '⏳ Updating...',
    loadingDelete: '⏳ Deleting...',
    statusActive: 'Active',
    statusInactive: 'Inactive',
    sortOrder: 'Order',
    btnEdit: '✏️ Edit',
    btnStop: '⏸️ Disable',
    btnActivate: '▶️ Enable',
    btnDelete: '🗑️ Delete',
    emptyTitle: 'No saved operations',
    emptySubtitle: 'Start by adding a new operation for products',
    confirmTitle: 'Confirm',
    confirmDeleteTitle: 'Confirm Delete',
    confirmDeleteText: 'Are you sure you want to delete the operation "{{name}}"?\n\nThis action cannot be undone.',
    confirmOk: 'OK',
    confirmCancel: 'Cancel',
    confirmFallback: 'Confirm?',
    itemFallback: 'operation',
    errOrderSave: 'Failed to save order',
    errLoadFailed: 'Failed to load operations',
    errLoadData: 'An error occurred while loading data',
    errNameRequired: 'Please enter the operation name',
    errNameMin: 'Operation name must be at least 2 characters',
    errNameDuplicate: 'Operation name already exists, please choose another one',
    errSaveFailed: 'Save failed',
    errSaveData: 'An error occurred while saving data',
    errItemMissing: 'Item not found',
    errToggleFailed: 'Failed to update operation status',
    errToggleData: 'An error occurred while updating status',
    errDeleteFailed: 'Failed to delete operation',
    errDeleteData: 'An error occurred while deleting operation'
  }
};

let __opsT = __opsTranslations.ar;

function _t(key, vars = null) {
  const value = (__opsT && __opsT[key] !== undefined) ? __opsT[key] : key;
  if (!vars) return value;
  return String(value).replace(/\{\{(\w+)\}\}/g, (_, name) => vars[name] ?? '');
}

function isArabicLocale() {
  return __opsLang.toLowerCase().startsWith('ar');
}

function setError(message) {
  errorDiv.textContent = message || '';
}

function safeShowModal(dlgEl) {
  try {
    dlgEl.showModal();
  } catch (_) {
    try {
      dlgEl.close();
      dlgEl.showModal();
    } catch (__) {}
  }
}

function focusFirstField() {
  try {
    window.focus?.();
    setTimeout(() => {
      f_name?.focus();
      f_name?.select?.();
    }, 0);
  } catch (_) {}
}

function formatOperationsCount(totalCount, activeCount) {
  return isArabicLocale()
    ? `${totalCount} عملية (${activeCount} نشطة)`
    : `${totalCount} operations (${activeCount} active)`;
}

function updateOperationsCount(items = currentItems) {
  const list = Array.isArray(items) ? items : [];
  const activeCount = list.filter(item => item.is_active).length;
  operationsCount.textContent = formatOperationsCount(list.length, activeCount);
}

function buildDialogTitle(itemName = '') {
  return editId ? _t('dlgTitleEdit', { name: itemName || '' }) : _t('dlgTitleAdd');
}

function applyOperationsLocale(lang) {
  __opsLang = String(lang || 'ar');
  const isAr = __opsLang.toLowerCase().startsWith('ar');
  __opsT = isAr ? __opsTranslations.ar : __opsTranslations.en;

  document.documentElement.lang = isAr ? 'ar' : 'en';
  document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  document.title = _t('pageTitle');

  if (headerTitle) headerTitle.textContent = _t('headerTitle');
  if (btnBack) btnBack.textContent = _t('btnBack');
  if (addBtn) addBtn.textContent = _t('addBtn');
  if (refreshBtn) refreshBtn.textContent = _t('refreshBtn');
  if (thIndex) thIndex.textContent = _t('thIndex');
  if (thName) thName.textContent = _t('thName');
  if (thStatus) thStatus.textContent = _t('thStatus');
  if (thActions) thActions.textContent = _t('thActions');
  if (f_nameLabel) f_nameLabel.textContent = _t('nameLabel');
  if (f_name) f_name.placeholder = _t('namePlaceholder');
  if (dlgCancel) dlgCancel.textContent = _t('cancelBtn');
  if (dlgSave && !dlgSave.disabled) dlgSave.textContent = _t('saveBtn');
  if (confirmCancel) confirmCancel.textContent = _t('confirmCancel');
  if (confirmOk) confirmOk.textContent = _t('confirmOk');
  if (confirmTitle && !confirmDlg?.open) confirmTitle.textContent = _t('confirmTitle');
  if (dlgTitle) {
    const currentItem = currentItems.find(item => item.id === editId);
    dlgTitle.textContent = buildDialogTitle(currentItem?.name || f_name?.value || '');
  }

  renderTable();
}

(async () => {
  try {
    const result = await window.api.app_get_locale();
    applyOperationsLocale((result && result.lang) || 'ar');
  } catch (_) {
    applyOperationsLocale('ar');
  }
  const originalBurst = window.__i18n_burst;
  window.__i18n_burst = (lang) => {
    try {
      applyOperationsLocale(lang);
    } catch (_) {}
    try {
      originalBurst && originalBurst(lang);
    } catch (_) {}
  };
})();

async function loadPerms() {
  try {
    const user = JSON.parse(localStorage.getItem('pos_user') || 'null');
    if (!user || !user.id) return;
    const response = await window.api.perms_get_for_user(user.id);
    if (response && response.ok) {
      __perms = new Set(response.keys || []);
    }
  } catch (_) {
    __perms = new Set();
  }
}

function hasPermission(key) {
  return __perms.has('operations') && __perms.has(key);
}

function closeDlg() {
  try {
    dlg.close();
  } catch (_) {
    dlg.removeAttribute('open');
  }
}

function openAdd() {
  editId = null;
  dlgTitle.textContent = _t('dlgTitleAdd');
  f_name.value = '';
  focusFirstField();
  safeShowModal(dlg);
}

function openEdit(item) {
  editId = item.id;
  dlgTitle.textContent = buildDialogTitle(item.name || '');
  f_name.value = item.name || '';
  focusFirstField();
  safeShowModal(dlg);
}

(async () => {
  await loadPerms();
  try {
    if (addBtn && !hasPermission('operations.add')) {
      addBtn.style.display = 'none';
    }
  } catch (_) {}
})();

let toastTimer = null;
function showToast({ message = '', type = 'info', duration = 5000 }) {
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

function renderEmptyState() {
  tbody.innerHTML = `
    <tr>
      <td colspan="4" class="text-center py-12 text-gray-400">
        <div class="text-5xl mb-3">📝</div>
        <div class="font-semibold mb-1">${_t('emptyTitle')}</div>
        <div class="text-sm">${_t('emptySubtitle')}</div>
      </td>
    </tr>
  `;
}

function renderRows(items) {
  tbody.innerHTML = '';

  (items || []).forEach((it, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-100 last:border-b-0';

    const actions = [];
    if (hasPermission('operations.edit')) {
      actions.push(`<button class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium" data-act="edit" data-id="${it.id}">${_t('btnEdit')}</button>`);
    }
    if (hasPermission('operations.toggle')) {
      const toggleClass = it.is_active ? 'bg-amber-600' : 'bg-green-600';
      const toggleText = it.is_active ? _t('btnStop') : _t('btnActivate');
      actions.push(`<button class="px-3 py-1.5 ${toggleClass} text-white rounded-lg text-sm font-medium" data-act="toggle" data-id="${it.id}">${toggleText}</button>`);
    }
    if (hasPermission('operations.delete')) {
      actions.push(`<button class="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium" data-act="del" data-id="${it.id}">${_t('btnDelete')}</button>`);
    }

    const statusBadge = it.is_active
      ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-semibold"><span class="w-1.5 h-1.5 bg-green-600 rounded-full"></span>${_t('statusActive')}</span>`
      : `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-semibold"><span class="w-1.5 h-1.5 bg-red-600 rounded-full"></span>${_t('statusInactive')}</span>`;

    tr.innerHTML = `
      <td class="px-4 py-3 text-gray-500 font-bold">${idx + 1}</td>
      <td class="px-4 py-3">
        <div class="font-semibold text-gray-800">${it.name}</div>
        <div class="text-xs text-gray-500 mt-0.5">${_t('sortOrder')}: ${Number(it.sort_order || 0)}</div>
      </td>
      <td class="px-4 py-3">${statusBadge}</td>
      <td class="px-4 py-3"><div class="flex gap-2 flex-wrap justify-end">${actions.join('')}</div></td>
    `;

    tr.setAttribute('draggable', 'true');
    tr.dataset.index = String(idx);
    tr.addEventListener('dragstart', (event) => {
      window.__op_dragIndex = idx;
      try {
        event.dataTransfer.effectAllowed = 'move';
      } catch (_) {}
    });
    tr.addEventListener('dragover', (event) => {
      event.preventDefault();
    });
    tr.addEventListener('drop', async (event) => {
      event.preventDefault();
      const from = Number(window.__op_dragIndex);
      const to = Number(tr.dataset.index);
      if (isNaN(from) || isNaN(to) || from === to) return;
      const item = currentItems.splice(from, 1)[0];
      currentItems.splice(to, 0, item);
      for (let i = 0; i < currentItems.length; i += 1) {
        const currentItem = currentItems[i];
        const newOrder = i;
        if (Number(currentItem.sort_order || 0) !== newOrder) {
          const response = await window.api.ops_update(currentItem.id, {
            name: currentItem.name,
            sort_order: newOrder,
            is_active: currentItem.is_active
          });
          if (!response.ok) {
            setError(response.error || _t('errOrderSave'));
            return;
          }
          currentItem.sort_order = newOrder;
        }
      }
      await load();
    });
    tbody.appendChild(tr);
  });
}

function renderTable() {
  updateOperationsCount(currentItems);
  if (!currentItems.length) {
    renderEmptyState();
    return;
  }
  renderRows(currentItems);
}

async function load() {
  setError('');

  try {
    const response = await window.api.ops_list();
    if (!response.ok) {
      setError(response.error || _t('errLoadFailed'));
      currentItems = [];
      renderTable();
      return;
    }

    currentItems = response.items || [];
    renderTable();
  } catch (error) {
    currentItems = [];
    setError(_t('errLoadData'));
    renderTable();
    console.error('Error loading operations:', error);
  }
}

addBtn.addEventListener('click', openAdd);
refreshBtn.addEventListener('click', load);

dlgCancel.addEventListener('click', closeDlg);

dlgSave.addEventListener('click', async () => {
  setError('');
  const name = (f_name.value || '').trim();

  if (!name) {
    setError(_t('errNameRequired'));
    f_name.focus();
    return;
  }

  if (name.length < 2) {
    setError(_t('errNameMin'));
    f_name.focus();
    return;
  }

  const duplicateItem = currentItems.find(item => item.name.trim().toLowerCase() === name.toLowerCase() && item.id !== editId);
  if (duplicateItem) {
    setError(_t('errNameDuplicate'));
    f_name.focus();
    return;
  }

  dlgSave.disabled = true;
  dlgSave.textContent = editId ? _t('savingEdit') : _t('savingAdd');

  try {
    let response;
    if (editId) {
      const item = currentItems.find(x => x.id === editId);
      const currentOrder = item ? Number(item.sort_order || 0) : 0;
      response = await window.api.ops_update(editId, {
        name,
        sort_order: currentOrder,
        is_active: item ? item.is_active : 1
      });
    } else {
      const next = currentItems.length ? Math.max(...currentItems.map(x => Number(x.sort_order || 0))) + 1 : 0;
      response = await window.api.ops_add({ name, sort_order: next });
    }

    if (!response.ok) {
      setError(response.error || _t('errSaveFailed'));
      return;
    }

    closeDlg();
    await load();
  } catch (error) {
    setError(_t('errSaveData'));
    console.error('Error saving operation:', error);
  } finally {
    dlgSave.disabled = false;
    dlgSave.textContent = _t('saveBtn');
  }
});

tbody.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  const id = Number(button.dataset.id);
  const action = button.dataset.act;
  setError('');

  const item = currentItems.find(x => x.id === id);
  if (!item && action !== 'del') {
    setError(_t('errItemMissing'));
    return;
  }

  if (action === 'edit') {
    openEdit(item);
    return;
  }

  if (action === 'toggle') {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = _t('loadingUpdate');

    try {
      const response = await window.api.ops_toggle(id);
      if (!response.ok) {
        setError(response.error || _t('errToggleFailed'));
        return;
      }
      await load();
    } catch (error) {
      setError(_t('errToggleData'));
      console.error('Error toggling operation:', error);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
    return;
  }

  if (action === 'del') {
    const itemName = item ? item.name : _t('itemFallback');
    const confirmMessage = _t('confirmDeleteText', { name: itemName });
    const ok = await customConfirm(_t('confirmDeleteTitle'), confirmMessage);
    if (!ok) return;

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = _t('loadingDelete');

    try {
      const response = await window.api.ops_delete(id);
      if (!response.ok) {
        if (response.cannotDelete) {
          showToast({
            message: response.error || _t('errDeleteFailed'),
            type: 'warning',
            duration: 6000
          });
        } else {
          setError(response.error || _t('errDeleteFailed'));
        }
        return;
      }
      await load();
      setTimeout(() => {
        window.focus?.();
      }, 0);
    } catch (error) {
      setError(_t('errDeleteData'));
      console.error('Error deleting operation:', error);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && dlg.open) {
    closeDlg();
  }

  if (event.key === 'Enter' && dlg.open) {
    event.preventDefault();
    dlgSave.click();
  }

  if ((event.ctrlKey || event.altKey) && event.key === 'n') {
    event.preventDefault();
    if (addBtn.style.display !== 'none') {
      openAdd();
    }
  }

  if (event.key === 'F5') {
    event.preventDefault();
    load();
  }
});

async function customConfirm(title, text) {
  if (!confirmDlg || !confirmText || !confirmOk || !confirmCancel) {
    return window.confirm(text || title || _t('confirmFallback'));
  }
  if (confirmTitle) confirmTitle.textContent = title || _t('confirmTitle');
  confirmText.textContent = text || '';
  let result = false;
  const onOk = () => {
    result = true;
    try {
      confirmDlg.close();
    } catch (_) {}
  };
  const onCancel = () => {
    result = false;
    try {
      confirmDlg.close();
    } catch (_) {}
  };
  confirmOk.addEventListener('click', onOk, { once: true });
  confirmCancel.addEventListener('click', onCancel, { once: true });
  try {
    safeShowModal(confirmDlg);
  } catch (_) {}
  return new Promise(resolve => {
    confirmDlg.addEventListener('close', () => {
      setTimeout(() => {
        window.focus?.();
        resolve(result);
      }, 0);
    }, { once: true });
  });
}

dlg.addEventListener('click', (event) => {
  if (event.target === dlg) {
    closeDlg();
  }
});

if (btnBack) {
  btnBack.addEventListener('click', () => history.back());
}

load();
