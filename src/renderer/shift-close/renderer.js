let currentUser = null;
let currentShift = null;
let shiftStats = null;
let permissions = new Set();

function hasPermission(key) {
  return permissions.has('shifts') && permissions.has(key);
}

async function loadPermissions() {
  try {
    const user = JSON.parse(localStorage.getItem('pos_user') || 'null');
    if (user && user.id) {
      const result = await window.api.perms_get_for_user(user.id);
      if (result && result.ok) {
        permissions = new Set(result.keys || []);
      }
    }
  } catch (err) {
    console.error('Load permissions error:', err);
  }
}

async function ensureShiftsEnabled() {
  try {
    const r = await window.api.settings_get();
    const s = r && r.ok ? (r.item || {}) : {};
    if (s.show_shifts === 0 || s.show_shifts === false) {
      showError('نظام الشفتات غير مفعل');
      setTimeout(() => {
        window.location.href = '../main/index.html';
      }, 1500);
      return false;
    }
  } catch (_) {
  }
  return true;
}

async function init() {
  try {
    currentUser = JSON.parse(localStorage.getItem('pos_user') || 'null');
    if (!currentUser || !currentUser.id) {
      window.location.href = '../login/index.html';
      return;
    }
    
    const enabled = await ensureShiftsEnabled();
    if (!enabled) return;
    
    await loadPermissions();
    
    if (!hasPermission('shifts.close')) {
      showError('لا تملك صلاحية إغلاق شفت! سيتم نقلك إلى الشاشة الرئيسية...');
      setTimeout(() => {
        window.location.href = '../main/index.html';
      }, 2000);
      return;
    }
    
    const shiftRes = await window.api.shift_get_current(currentUser.id);
    if (!shiftRes || !shiftRes.ok || !shiftRes.shift) {
      showError('لا يوجد شيفت مفتوح! سيتم نقلك إلى الشاشة الرئيسية...');
      setTimeout(() => {
        window.location.href = '../main/index.html';
      }, 2000);
      return;
    }
    
    currentShift = shiftRes.shift;
    
    await loadShiftData();
    
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
    
  } catch (err) {
    console.error('Init error:', err);
    showError('حدث خطأ أثناء التحميل');
  }
}

function parseDateTime(dateStr) {
  if (!dateStr) return null;
  
  if (dateStr instanceof Date) {
    return isNaN(dateStr.getTime()) ? null : dateStr;
  }
  
  const str = String(dateStr).trim();
  
  if (str.includes('T')) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }
  
  const parts = str.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (parts) {
    const year = parseInt(parts[1]);
    const month = parseInt(parts[2]) - 1;
    const day = parseInt(parts[3]);
    const hours = parseInt(parts[4]);
    const minutes = parseInt(parts[5]);
    const seconds = parseInt(parts[6]);
    
    const d = new Date(year, month, day, hours, minutes, seconds);
    return isNaN(d.getTime()) ? null : d;
  }
  
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

async function loadShiftData() {
  document.getElementById('shiftNo').textContent = currentShift.shift_no;
  document.getElementById('username').textContent = currentShift.username;
  
  const openedAt = parseDateTime(currentShift.opened_at);
  
  if (!openedAt) {
    console.error('Failed to parse shift opened_at date');
    document.getElementById('openedAt').textContent = '--';
    document.getElementById('duration').textContent = '--';
    return;
  }
  
  const year = openedAt.getFullYear();
  const month = String(openedAt.getMonth() + 1).padStart(2, '0');
  const day = String(openedAt.getDate()).padStart(2, '0');
  
  let hours24 = openedAt.getHours();
  const minutes = String(openedAt.getMinutes()).padStart(2, '0');
  
  const ampm = hours24 >= 12 ? 'م' : 'ص';
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;
  const hoursStr = String(hours12).padStart(2, '0');
  
  document.getElementById('openedAt').textContent = `${year}/${month}/${day} ${hoursStr}:${minutes} ${ampm}`;
  
  const duration = calculateDuration(currentShift.opened_at, new Date());
  document.getElementById('duration').textContent = duration;
  
  const detailsRes = await window.api.shift_get_by_id(currentShift.id);
  if (detailsRes && detailsRes.ok) {
    shiftStats = detailsRes;
    displayStats(detailsRes);
  }
}

function calculateDuration(start, end) {
  let startDate = start;
  let endDate = end;
  
  if (!(startDate instanceof Date)) {
    startDate = parseDateTime(start);
  }
  
  if (!(endDate instanceof Date)) {
    endDate = parseDateTime(end);
  }
  
  if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return '--';
  }
  
  const diff = endDate.getTime() - startDate.getTime();
  
  if (diff < 0) {
    return '--';
  }
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours} ساعة و ${minutes} دقيقة`;
}

function displayStats(data) {
  const invoices = data.invoices || [];
  
  const regularInvoices = invoices.filter(inv => !inv.doc_type || inv.doc_type === 'invoice');
  const creditNotes = invoices.filter(inv => inv.doc_type === 'credit_note');
  
  const totalInvoices = regularInvoices.length;
  const totalRefunds = creditNotes.length;
  
  let grossSales = 0;
  let grossCashSales = 0;
  let grossCardSales = 0;
  let totalRefundsAmount = 0;
  let refundsCash = 0;
  let refundsCard = 0;
  
  regularInvoices.forEach(inv => {
    const amount = parseFloat(inv.grand_total) || 0;
    grossSales += amount;
    
    if (inv.payment_method === 'cash') {
      grossCashSales += amount;
    } else if (inv.payment_method === 'card') {
      grossCardSales += amount;
    } else if (inv.payment_method === 'split') {
      grossCashSales += amount / 2;
      grossCardSales += amount / 2;
    }
  });
  
  creditNotes.forEach(inv => {
    const amount = Math.abs(parseFloat(inv.grand_total) || 0);
    totalRefundsAmount += amount;
    
    if (inv.payment_method === 'cash') {
      refundsCash += amount;
    } else if (inv.payment_method === 'card') {
      refundsCard += amount;
    } else if (inv.payment_method === 'split') {
      refundsCash += amount / 2;
      refundsCard += amount / 2;
    }
  });
  
  const netCashSales = grossCashSales - refundsCash;
  const netCardSales = grossCardSales - refundsCard;
  const netSales = grossSales - totalRefundsAmount;
  
  document.getElementById('totalInvoices').textContent = totalInvoices;
  document.getElementById('grossSales').textContent = formatCurrency(grossSales);
  document.getElementById('grossCashSales').textContent = formatCurrency(grossCashSales);
  document.getElementById('grossCardSales').textContent = formatCurrency(grossCardSales);
  
  document.getElementById('totalRefunds').textContent = totalRefunds;
  document.getElementById('totalRefundsAmount').textContent = formatCurrency(totalRefundsAmount);
  document.getElementById('refundsCash').textContent = formatCurrency(refundsCash);
  document.getElementById('refundsCard').textContent = formatCurrency(refundsCard);
  
  document.getElementById('netSales').textContent = formatCurrency(netSales);
  document.getElementById('netCashSales').textContent = formatCurrency(netCashSales);
  document.getElementById('netCardSales').textContent = formatCurrency(netCardSales);
  
  const openingCash = parseFloat(currentShift.opening_cash) || 0;
  const expectedCash = openingCash + netCashSales;
  
  document.getElementById('openingCash').textContent = formatCurrency(openingCash);
  document.getElementById('cashSalesAmount').textContent = formatCurrency(netCashSales);
  document.getElementById('expectedCash').textContent = formatCurrency(expectedCash);
  
  window.expectedCashValue = expectedCash;
}

function formatCurrency(amount) {
  return parseFloat(amount).toFixed(2) + ' \ue900';
}

function showError(msg) {
  const errorDiv = document.getElementById('errorMsg');
  errorDiv.textContent = msg;
  errorDiv.classList.add('show');
  setTimeout(() => {
    errorDiv.classList.remove('show');
  }, 5000);
}

document.getElementById('actualCash').addEventListener('input', (e) => {
  const actualCash = parseFloat(e.target.value) || 0;
  const expected = window.expectedCashValue || 0;
  const difference = actualCash - expected;
  
  const alertDiv = document.getElementById('differenceAlert');
  
  if (e.target.value.trim() === '') {
    alertDiv.style.display = 'none';
    return;
  }
  
  alertDiv.style.display = 'block';
  alertDiv.className = 'difference-alert';
  
  if (difference > 0) {
    alertDiv.classList.add('positive');
    alertDiv.textContent = `✅ زيادة: ${formatCurrency(difference)}`;
  } else if (difference < 0) {
    alertDiv.classList.add('negative');
    alertDiv.textContent = `⚠️ نقص: ${formatCurrency(Math.abs(difference))}`;
  } else {
    alertDiv.classList.add('zero');
    alertDiv.textContent = '✅ النقدية متطابقة تماماً';
  }
});

document.getElementById('closeShiftForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const actualCash = parseFloat(document.getElementById('actualCash').value) || 0;
  const closingNotes = document.getElementById('closingNotes').value.trim();
  const expected = window.expectedCashValue || 0;
  const difference = actualCash - expected;
  
  document.getElementById('modalExpectedCash').innerHTML = formatCurrency(expected);
  document.getElementById('modalActualCash').innerHTML = formatCurrency(actualCash);
  
  const diffElement = document.getElementById('modalDifference');
  diffElement.innerHTML = formatCurrency(difference);
  diffElement.className = 'modal-info-value';
  if (difference > 0) {
    diffElement.classList.add('positive');
  } else if (difference < 0) {
    diffElement.classList.add('negative');
  } else {
    diffElement.classList.add('zero');
  }
  
  document.getElementById('confirmModal').classList.add('show');
});

document.getElementById('modalCancelBtn').addEventListener('click', () => {
  document.getElementById('confirmModal').classList.remove('show');
});

document.getElementById('modalConfirmBtn').addEventListener('click', async () => {
  document.getElementById('confirmModal').classList.remove('show');
  
  const submitBtn = document.getElementById('submitBtn');
  const actualCash = parseFloat(document.getElementById('actualCash').value) || 0;
  const closingNotes = document.getElementById('closingNotes').value.trim();
  
  submitBtn.disabled = true;
  submitBtn.textContent = 'جاري إغلاق الشيفت...';
  
  try {
    const result = await window.api.shift_close({
      shiftId: currentShift.id,
      actualCash,
      closingNotes: closingNotes || null
    });
    
    if (result && result.ok) {
      localStorage.removeItem('current_shift');
      localStorage.removeItem('pos_user');
      
      submitBtn.textContent = '✅ تم إغلاق الشيفت بنجاح';
      submitBtn.style.background = '#4CAF50';
      
      setTimeout(() => {
        window.location.href = '../login/index.html';
      }, 1500);
    } else {
      showError(result.error || 'فشل إغلاق الشيفت');
      submitBtn.disabled = false;
      submitBtn.textContent = '🔒 إغلاق الشيفت';
    }
  } catch (err) {
    console.error('Close shift error:', err);
    showError('حدث خطأ أثناء إغلاق الشيفت');
    submitBtn.disabled = false;
    submitBtn.textContent = '🔒 إغلاق الشيفت';
  }
});

document.getElementById('cancelBtn').addEventListener('click', () => {
  window.location.href = '../main/index.html';
});

init();
