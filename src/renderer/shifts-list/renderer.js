let currentUser = null;
let allShifts = [];
let __page = 1;
let __pageSize = 20;
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

async function initializePermissions() {
  await loadPermissions();
  
  const printBtn = document.getElementById('modalPrintBtn');
  if (printBtn && !hasPermission('shifts.print')) {
    printBtn.style.display = 'none';
  }
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
    
    await initializePermissions();
    await loadStatistics();
    await loadShifts();
    
  } catch (err) {
    console.error('Init error:', err);
    showError('حدث خطأ أثناء التحميل');
  }
}

async function loadStatistics() {
  try {
    const filters = getFilters();
    const res = await window.api.shift_get_statistics(filters);
    
    if (res && res.ok && res.statistics) {
      const stats = res.statistics;
      document.getElementById('statTotal').textContent = stats.total_shifts || 0;
      document.getElementById('statOpen').textContent = stats.open_shifts || 0;
      document.getElementById('statClosed').textContent = stats.closed_shifts || 0;
      document.getElementById('statRevenue').textContent = formatCurrency(stats.total_revenue || 0);
      document.getElementById('statsContainer').style.display = 'grid';
    }
  } catch (err) {
    console.error('Load statistics error:', err);
  }
}

async function loadShifts() {
  try {
    const filters = getFilters();
    const res = await window.api.shift_list(filters);
    
    document.getElementById('loading').style.display = 'none';
    
    if (!res || !res.ok) {
      showError(res?.error || 'فشل تحميل الشيفتات');
      return;
    }
    
    allShifts = res.shifts || [];
    
    if (allShifts.length === 0) {
      document.getElementById('empty').style.display = 'block';
      document.getElementById('shiftsTable').style.display = 'none';
    } else {
      document.getElementById('empty').style.display = 'none';
      document.getElementById('shiftsTable').style.display = 'table';
      renderShifts();
    }
    
  } catch (err) {
    console.error('Load shifts error:', err);
    showError('حدث خطأ أثناء تحميل الشيفتات');
    document.getElementById('loading').style.display = 'none';
  }
}

function getFilters() {
  const filters = {};
  
  const status = document.getElementById('filterStatus').value;
  if (status) filters.status = status;
  
  const dateFrom = document.getElementById('filterDateFrom').value;
  if (dateFrom) filters.dateFrom = dateFrom + ' 00:00:00';
  
  const dateTo = document.getElementById('filterDateTo').value;
  if (dateTo) filters.dateTo = dateTo + ' 23:59:59';
  
  return filters;
}

function renderPager(total) {
  const top = document.getElementById('pagerTop');
  const bottom = document.getElementById('pagerBottom');
  const pages = (__pageSize && __pageSize > 0) ? Math.max(1, Math.ceil(total / __pageSize)) : 1;
  
  const btn = (label, disabled, go) => `<button class="btn ${disabled ? 'btn-secondary' : 'btn-primary'} btn-small" ${disabled ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} data-go="${go}">${label}</button>`;
  const html = [
    btn('⏮️', __page <= 1, 'first'),
    btn('◀️', __page <= 1, 'prev'),
    `<span style="padding: 6px 12px; font-size: 14px; font-weight: 600;">صفحة ${__page} من ${pages} (${total} شيفت)</span>`,
    btn('▶️', __page >= pages, 'next'),
    btn('⏭️', __page >= pages, 'last')
  ].join(' ');
  
  if (top) top.innerHTML = html;
  if (bottom) bottom.innerHTML = html;
  
  const onClick = (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const act = b.getAttribute('data-go');
    let newPage = __page;
    if (act === 'first') newPage = 1;
    else if (act === 'prev') newPage = Math.max(1, __page - 1);
    else if (act === 'next') newPage = Math.min(pages, __page + 1);
    else if (act === 'last') newPage = pages;
    
    if (newPage !== __page) {
      __page = newPage;
      renderShifts();
    }
  };
  
  if (top) top.onclick = onClick;
  if (bottom) bottom.onclick = onClick;
}

function renderShifts() {
  const tbody = document.getElementById('shiftsBody');
  tbody.innerHTML = '';
  
  const total = allShifts.length;
  
  let shiftsToShow = allShifts;
  if (__pageSize > 0) {
    const start = (__page - 1) * __pageSize;
    const end = start + __pageSize;
    shiftsToShow = allShifts.slice(start, end);
  }
  
  const startIndex = __pageSize > 0 ? (__page - 1) * __pageSize + 1 : 1;
  
  shiftsToShow.forEach((shift, idx) => {
    const tr = document.createElement('tr');
    
    const openedAt = parseDateTime(shift.opened_at);
    const closedAt = shift.closed_at ? parseDateTime(shift.closed_at) : null;
    
    const duration = closedAt ? calculateDuration(shift.opened_at, shift.closed_at) : 'جاري...';
    
    const cashDiff = shift.cash_difference != null ? parseFloat(shift.cash_difference) : null;
    let diffHtml = '--';
    if (cashDiff !== null) {
      if (cashDiff > 0) {
        diffHtml = `<span class="diff-positive">+${formatCurrency(cashDiff)}</span>`;
      } else if (cashDiff < 0) {
        diffHtml = `<span class="diff-negative">${formatCurrency(cashDiff)}</span>`;
      } else {
        diffHtml = `<span class="diff-zero">0.00 \ue900</span>`;
      }
    }
    
    const canView = hasPermission('shifts.view');
    
    tr.innerHTML = `
      <td><strong>${startIndex + idx}</strong></td>
      <td>${shift.shift_no}</td>
      <td>${shift.username}</td>
      <td>${formatDateTime(openedAt)}</td>
      <td>${closedAt ? formatDateTime(closedAt) : '--'}</td>
      <td>${duration}</td>
      <td>${shift.total_invoices || 0}</td>
      <td>${formatCurrency(shift.total_sales || 0)}</td>
      <td>${diffHtml}</td>
      <td>
        <span class="badge badge-${shift.status}">
          ${shift.status === 'open' ? 'مفتوح' : 'مغلق'}
        </span>
      </td>
      <td>
        <div class="actions">
          ${canView ? `<button class="btn btn-secondary btn-small" onclick="viewShift(${shift.id})">عرض</button>` : '<span style="color: #999;">لا توجد صلاحية</span>'}
        </div>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
  
  renderPager(total);
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

function calculateDuration(start, end) {
  let startDate = start;
  let endDate = end;
  
  if (!(startDate instanceof Date)) {
    startDate = parseDateTime(start);
  }
  
  if (!(endDate instanceof Date)) {
    endDate = parseDateTime(end);
  }
  
  if (!startDate || !endDate) return '--';
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '--';
  
  const diff = endDate.getTime() - startDate.getTime();
  
  if (diff < 0) return '--';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}س ${minutes}د`;
}

function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  let hours24 = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  const ampm = hours24 >= 12 ? 'م' : 'ص';
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;
  const hoursStr = String(hours12).padStart(2, '0');
  
  return `${year}/${month}/${day} ${hoursStr}:${minutes} ${ampm}`;
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

function showSuccess(msg) {
  const successDiv = document.getElementById('successMsg');
  successDiv.textContent = msg;
  successDiv.classList.add('show');
  setTimeout(() => {
    successDiv.classList.remove('show');
  }, 5000);
}

let currentShiftDetails = null;
let liveUpdateInterval = null;

async function viewShift(shiftId) {
  if (!hasPermission('shifts.view')) {
    showError('لا تملك صلاحية عرض تفاصيل الشفت');
    return;
  }
  
  try {
    const res = await window.api.shift_get_by_id(shiftId);
    
    if (!res || !res.ok) {
      showError(res?.error || 'فشل تحميل تفاصيل الشيفت');
      return;
    }
    
    const shift = res.shift;
    const invoices = res.invoices || [];
    
    currentShiftDetails = { shift, invoices, shiftId };
    
    const openedAt = formatDateTime(parseDateTime(shift.opened_at));
    const closedAt = shift.closed_at ? formatDateTime(parseDateTime(shift.closed_at)) : '--';
    const duration = shift.closed_at ? 
      calculateDuration(shift.opened_at, shift.closed_at) : 
      'جاري...';
    
    const cashDiff = shift.cash_difference != null ? parseFloat(shift.cash_difference) : null;
    let diffClass = '';
    let diffText = '--';
    if (cashDiff !== null) {
      if (cashDiff > 0) {
        diffClass = 'diff-positive';
        diffText = `+${formatCurrency(cashDiff)}`;
      } else if (cashDiff < 0) {
        diffClass = 'diff-negative';
        diffText = formatCurrency(cashDiff);
      } else {
        diffClass = 'diff-zero';
        diffText = '0.00 \ue900';
      }
    }
    
    const statusBadge = shift.status === 'open' ? 
      '<span class="badge badge-open">مفتوح</span>' : 
      '<span class="badge badge-closed">مغلق</span>';
    
    let modalContent = `
      <div style="background: #f5f5f5; padding: 8px 12px; border-radius: 8px; margin-bottom: 10px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 12px;">
        <div><strong>الشفت:</strong> ${shift.shift_no}</div>
        <div><strong>الكاشير:</strong> ${shift.username}</div>
        <div style="text-align: center;">${statusBadge}</div>
        <div><strong>الفتح:</strong> ${openedAt}</div>
        <div><strong>الإغلاق:</strong> ${closedAt}</div>
        <div><strong>المدة:</strong> ${duration}</div>
      </div>
      
      <div style="background: rgba(76, 175, 80, 0.08); border-radius: 8px; padding: 10px; margin-bottom: 8px; border: 2px solid rgba(76, 175, 80, 0.3);">
        <div style="text-align: center; margin-bottom: 6px;">
          <div style="font-size: 12px; color: #2e7d32; font-weight: 700;">💰 إجمالي المبيعات</div>
          <div style="font-size: 22px; font-weight: 800; color: #4CAF50;" id="liveTotalSales">${formatCurrency(shift.total_sales || 0)}</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #2e7d32; margin-bottom: 2px; font-weight: 600;">عدد الفواتير</div>
            <div style="font-size: 15px; font-weight: 700; color: #4CAF50;" id="liveInvoicesCount">${shift.total_invoices || 0}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #2e7d32; margin-bottom: 2px; font-weight: 600;">💵 نقدي</div>
            <div style="font-size: 15px; font-weight: 700; color: #4CAF50;" id="liveGrossCashSales">${formatCurrency(shift.gross_cash_sales || 0)}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #2e7d32; margin-bottom: 2px; font-weight: 600;">💳 بطاقة</div>
            <div style="font-size: 15px; font-weight: 700; color: #4CAF50;" id="liveGrossCardSales">${formatCurrency(shift.gross_card_sales || 0)}</div>
          </div>
        </div>
      </div>
      
      <div style="background: rgba(244, 67, 54, 0.08); border-radius: 8px; padding: 10px; margin-bottom: 8px; border: 2px solid rgba(244, 67, 54, 0.3);">
        <div style="text-align: center; margin-bottom: 6px;">
          <div style="font-size: 12px; color: #c62828; font-weight: 700;">🔄 إجمالي المعالجات</div>
          <div style="font-size: 22px; font-weight: 800; color: #d32f2f;" id="liveRefundsAmount">${formatCurrency(shift.total_refunds_amount || 0)}</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #c62828; margin-bottom: 2px; font-weight: 600;">عدد المعالجات</div>
            <div style="font-size: 15px; font-weight: 700; color: #d32f2f;" id="liveRefundsCount">${shift.total_refunds || 0}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #c62828; margin-bottom: 2px; font-weight: 600;">💵 نقدي</div>
            <div style="font-size: 15px; font-weight: 700; color: #d32f2f;" id="liveRefundsCash">${formatCurrency(shift.refunds_cash || 0)}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; color: #c62828; margin-bottom: 2px; font-weight: 600;">💳 بطاقة</div>
            <div style="font-size: 15px; font-weight: 700; color: #d32f2f;" id="liveRefundsCard">${formatCurrency(shift.refunds_card || 0)}</div>
          </div>
        </div>
      </div>
      
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 12px; margin-bottom: 10px; box-shadow: 0 3px 10px rgba(102, 126, 234, 0.3);">
        <div style="text-align: center; margin-bottom: 8px;">
          <div style="font-size: 12px; color: rgba(255,255,255,0.9); margin-bottom: 4px; font-weight: 700;">📊 صافي المبيعات</div>
          <div style="font-size: 24px; font-weight: 800; color: #fff;" id="liveNetSales">${formatCurrency((shift.total_sales || 0) - (shift.total_refunds_amount || 0))}</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2);">
          <div style="text-align: center;">
            <div style="font-size: 11px; color: rgba(255,255,255,0.85); margin-bottom: 3px; font-weight: 600;">💵 نقدي</div>
            <div style="font-size: 18px; font-weight: 700; color: #fff;" id="liveNetCashSales">${formatCurrency(shift.cash_sales || 0)}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 11px; color: rgba(255,255,255,0.85); margin-bottom: 3px; font-weight: 600;">💳 بطاقة</div>
            <div style="font-size: 18px; font-weight: 700; color: #fff;" id="liveNetCardSales">${formatCurrency(shift.card_sales || 0)}</div>
          </div>
        </div>
      </div>
      
      ${shift.status === 'closed' ? `
      <div style="background: #fff3e0; border-radius: 8px; padding: 10px; margin-bottom: 8px; border: 1px solid #ffb74d;">
        <div style="text-align: center; margin-bottom: 6px; font-size: 11px; color: #f57c00; font-weight: 700;">💰 النقدية</div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 11px;">
          <div style="text-align: center;">
            <div style="color: #666; margin-bottom: 2px;">الافتتاحي</div>
            <div style="font-weight: 700; color: #333;">${formatCurrency(shift.opening_cash || 0)}</div>
          </div>
          <div style="text-align: center;">
            <div style="color: #666; margin-bottom: 2px;">المتوقع</div>
            <div style="font-weight: 700; color: #333;">${formatCurrency(shift.expected_cash || 0)}</div>
          </div>
          <div style="text-align: center;">
            <div style="color: #666; margin-bottom: 2px;">الفعلي</div>
            <div style="font-weight: 700; color: #333;">${formatCurrency(shift.actual_cash || 0)}</div>
          </div>
          <div style="text-align: center;">
            <div style="color: #666; margin-bottom: 2px;">الفارق</div>
            <div style="font-weight: 700;" class="${diffClass}">${diffText}</div>
          </div>
        </div>
      </div>
      ` : `
      <div style="background: #fff3e0; border-radius: 8px; padding: 10px; margin-bottom: 8px; border: 1px solid #ffb74d;">
        <div style="text-align: center; font-size: 11px; color: #666; margin-bottom: 4px;">💰 الرصيد الافتتاحي</div>
        <div style="text-align: center; font-size: 18px; font-weight: 700; color: #f57c00;">${formatCurrency(shift.opening_cash || 0)}</div>
      </div>
      `}
      
      ${shift.opening_notes || shift.closing_notes ? `
      <div style="background: #f5f5f5; border-radius: 8px; padding: 8px; font-size: 11px;">
        <div style="margin-bottom: 4px; font-weight: 700; color: #555;">📝 الملاحظات</div>
        ${shift.opening_notes ? `<div style="margin-bottom: 4px;"><strong>الفتح:</strong> ${shift.opening_notes}</div>` : ''}
        ${shift.closing_notes ? `<div><strong>الإغلاق:</strong> ${shift.closing_notes}</div>` : ''}
      </div>
      ` : ''}
    `;
    
    document.getElementById('modalBody').innerHTML = modalContent;
    document.getElementById('shiftDetailsModal').classList.add('show');
    
    if (shift.status === 'open') {
      startLiveUpdates(shiftId);
    }
    
  } catch (err) {
    console.error('View shift error:', err);
    showError('حدث خطأ أثناء عرض التفاصيل');
  }
}

async function updateLiveData(shiftId) {
  try {
    const res = await window.api.shift_get_by_id(shiftId);
    if (res && res.ok && res.shift) {
      const shift = res.shift;
      
      const invoicesEl = document.getElementById('liveInvoicesCount');
      const totalSalesEl = document.getElementById('liveTotalSales');
      const grossCashEl = document.getElementById('liveGrossCashSales');
      const grossCardEl = document.getElementById('liveGrossCardSales');
      const refundsEl = document.getElementById('liveRefundsCount');
      const refundsAmountEl = document.getElementById('liveRefundsAmount');
      const refundsCashEl = document.getElementById('liveRefundsCash');
      const refundsCardEl = document.getElementById('liveRefundsCard');
      const netSalesEl = document.getElementById('liveNetSales');
      const netCashEl = document.getElementById('liveNetCashSales');
      const netCardEl = document.getElementById('liveNetCardSales');
      
      if (invoicesEl) invoicesEl.textContent = shift.total_invoices || 0;
      if (totalSalesEl) totalSalesEl.innerHTML = formatCurrency(shift.total_sales || 0);
      if (grossCashEl) grossCashEl.innerHTML = formatCurrency(shift.gross_cash_sales || 0);
      if (grossCardEl) grossCardEl.innerHTML = formatCurrency(shift.gross_card_sales || 0);
      
      if (refundsEl) refundsEl.textContent = shift.total_refunds || 0;
      if (refundsAmountEl) refundsAmountEl.innerHTML = formatCurrency(shift.total_refunds_amount || 0);
      if (refundsCashEl) refundsCashEl.innerHTML = formatCurrency(shift.refunds_cash || 0);
      if (refundsCardEl) refundsCardEl.innerHTML = formatCurrency(shift.refunds_card || 0);
      
      if (netSalesEl) netSalesEl.innerHTML = formatCurrency((shift.total_sales || 0) - (shift.total_refunds_amount || 0));
      if (netCashEl) netCashEl.innerHTML = formatCurrency(shift.cash_sales || 0);
      if (netCardEl) netCardEl.innerHTML = formatCurrency(shift.card_sales || 0);
      
      if (currentShiftDetails) {
        currentShiftDetails.shift = shift;
      }
    }
  } catch (err) {
    console.error('Live update error:', err);
  }
}

function startLiveUpdates(shiftId) {
  stopLiveUpdates();
  liveUpdateInterval = setInterval(() => {
    updateLiveData(shiftId);
  }, 3000);
}

function stopLiveUpdates() {
  if (liveUpdateInterval) {
    clearInterval(liveUpdateInterval);
    liveUpdateInterval = null;
  }
}

function closeModal() {
  stopLiveUpdates();
  document.getElementById('shiftDetailsModal').classList.remove('show');
  currentShiftDetails = null;
}

async function printShiftDetails() {
  if (!hasPermission('shifts.print')) {
    showError('لا تملك صلاحية طباعة تفاصيل الشفت');
    return;
  }
  
  if (!currentShiftDetails) return;
  
  const { shift, invoices } = currentShiftDetails;
  
  const openedAt = formatDateTime(parseDateTime(shift.opened_at));
  const closedAt = shift.closed_at ? formatDateTime(parseDateTime(shift.closed_at)) : '--';
  const duration = shift.closed_at ? 
    calculateDuration(shift.opened_at, shift.closed_at) : 
    'جاري...';
  
  const cashDiff = shift.cash_difference != null ? parseFloat(shift.cash_difference) : null;
  let diffText = '--';
  if (cashDiff !== null) {
    if (cashDiff > 0) {
      diffText = `+${formatCurrency(cashDiff)}`;
    } else {
      diffText = formatCurrency(cashDiff);
    }
  }
  
  const assetsRes = await window.api.get_assets_path();
  const fontsPath = assetsRes && assetsRes.ok ? assetsRes.path : '';
  const fontUrlBase = fontsPath ? `file:///${fontsPath.replace(/\\/g, '/')}` : '../../../assets/fonts';

  const settingsRes = await window.api.settings_get();
  const settings = settingsRes && settingsRes.ok ? (settingsRes.item || {}) : {};
  const marginLeft = Math.max(0, Number(settings.print_margin_left_mm || 0));
  const marginRight = Math.max(0, Number(settings.print_margin_right_mm || 0));
  
  let printContent = `
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="utf-8">
      <title>تفاصيل الشفت - ${shift.shift_no}</title>
      <style>
        :root{ --m-left: ${marginLeft}mm; --m-right: ${marginRight}mm; }
        @page {
          size: 80mm auto;
          margin: 0;
        }
        @font-face{
          font-family: 'Cairo';
          src: url('${fontUrlBase}/Cairo-Regular.ttf') format('truetype');
          font-weight: 400;
        }
        @font-face{
          font-family: 'Cairo';
          src: url('${fontUrlBase}/Cairo-Bold.ttf') format('truetype');
          font-weight: 700;
        }
        @font-face{
          font-family: 'saudi_riyal';
          src: url('${fontUrlBase}/saudi-riyal.woff') format('woff'),
               url('${fontUrlBase}/saudi-riyal.ttf') format('truetype');
          font-display: swap;
          unicode-range: U+E900;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Cairo', 'saudi_riyal', system-ui, -apple-system, Arial, sans-serif;
          padding-top: 8px;
          padding-bottom: 8px;
          padding-left: var(--m-left);
          padding-right: var(--m-right);
          direction: rtl;
          font-size: 12px;
          width: 80mm;
          margin: 0 auto;
        }
        h1 { 
          text-align: center; 
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 2px solid #333;
        }
        .section-title { 
          font-size: 13px; 
          font-weight: 700; 
          margin-top: 10px; 
          margin-bottom: 4px;
          padding: 3px 0;
          border-bottom: 1px solid #999;
        }
        .row {
          display: flex;
          justify-content: space-between;
          padding: 3px 0;
          border-bottom: 1px dashed #ddd;
        }
        .row:last-child {
          border-bottom: none;
        }
        .label {
          font-weight: 600;
        }
        .value {
          text-align: left;
          font-size: 16px;
          font-weight: 700;
        }
        .divider {
          border-top: 2px solid #333;
          margin: 8px 0;
        }
        .positive { color: #2e7d32; font-weight: 700; }
        .negative { color: #c62828; font-weight: 700; }
        .zero { color: #757575; font-weight: 600; }
      </style>
    </head>
    <body>
      <h1>تفاصيل الشفت</h1>
      
      <div class="section-title">معلومات الشفت</div>
      <div class="row">
        <span class="label">رقم الشفت</span>
        <span class="value">${shift.shift_no}</span>
      </div>
      <div class="row">
        <span class="label">الكاشير</span>
        <span class="value">${shift.username}</span>
      </div>
      <div class="row">
        <span class="label">وقت الفتح</span>
        <span class="value">${openedAt}</span>
      </div>
      <div class="row">
        <span class="label">وقت الإغلاق</span>
        <span class="value">${closedAt}</span>
      </div>
      <div class="row">
        <span class="label">المدة</span>
        <span class="value">${duration}</span>
      </div>
      <div class="row">
        <span class="label">الحالة</span>
        <span class="value">${shift.status === 'open' ? 'مفتوح' : 'مغلق'}</span>
      </div>
      
      <div class="divider"></div>
      <div class="section-title">صافي المبيعات (بعد المعالجات)</div>
      <div class="row">
        <span class="label">عدد الفواتير</span>
        <span class="value">${shift.total_invoices || 0}</span>
      </div>
      <div class="row">
        <span class="label">صافي المبيعات</span>
        <span class="value">${formatCurrency((shift.total_sales || 0) - (shift.total_refunds_amount || 0))}</span>
      </div>
      <div class="row">
        <span class="label">💵 نقدي</span>
        <span class="value">${formatCurrency(shift.cash_sales || 0)}</span>
      </div>
      <div class="row">
        <span class="label">💳 بطاقة</span>
        <span class="value">${formatCurrency(shift.card_sales || 0)}</span>
      </div>
      
      ${shift.status === 'closed' ? `
      <div class="divider"></div>
      <div class="section-title">النقدية</div>
      <div class="row">
        <span class="label">الرصيد الافتتاحي</span>
        <span class="value">${formatCurrency(shift.opening_cash || 0)}</span>
      </div>
      <div class="row">
        <span class="label">النقدية المتوقعة</span>
        <span class="value">${formatCurrency(shift.expected_cash || 0)}</span>
      </div>
      <div class="row">
        <span class="label">النقدية الفعلية</span>
        <span class="value">${formatCurrency(shift.actual_cash || 0)}</span>
      </div>
      <div class="row">
        <span class="label">الفارق</span>
        <span class="value ${cashDiff > 0 ? 'positive' : cashDiff < 0 ? 'negative' : 'zero'}">${diffText}</span>
      </div>
      ` : ''}
      
      ${shift.opening_notes || shift.closing_notes ? `
      <div class="divider"></div>
      <div class="section-title">الملاحظات</div>
      ${shift.opening_notes ? `
      <div class="row">
        <span class="label">ملاحظات الفتح</span>
      </div>
      <div style="padding: 4px 0; font-size: 11px;">${shift.opening_notes}</div>
      ` : ''}
      ${shift.closing_notes ? `
      <div class="row">
        <span class="label">ملاحظات الإغلاق</span>
      </div>
      <div style="padding: 4px 0; font-size: 11px;">${shift.closing_notes}</div>
      ` : ''}
      ` : ''}
      
      <div class="divider"></div>
    </body>
    </html>
  `;
  
  try {
    await window.api.print_html(printContent, {
      silent: true,
      printBackground: true,
      copies: 1
    });
  } catch (error) {
    console.error('Print error:', error);
  }
}

document.getElementById('backBtn').addEventListener('click', () => {
  window.location.href = '../main/index.html';
});

document.getElementById('applyFiltersBtn').addEventListener('click', async () => {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('shiftsTable').style.display = 'none';
  document.getElementById('empty').style.display = 'none';
  
  __page = 1;
  await loadStatistics();
  await loadShifts();
});

document.getElementById('pageSize').addEventListener('change', (e) => {
  __pageSize = parseInt(e.target.value) || 0;
  __page = 1;
  renderShifts();
});

document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
document.getElementById('modalPrintBtn').addEventListener('click', printShiftDetails);

document.getElementById('shiftDetailsModal').addEventListener('click', (e) => {
  if (e.target.id === 'shiftDetailsModal') {
    closeModal();
  }
});

document.getElementById('filterDateFrom').addEventListener('click', function() {
  this.showPicker && this.showPicker();
});

document.getElementById('filterDateTo').addEventListener('click', function() {
  this.showPicker && this.showPicker();
});

init();
