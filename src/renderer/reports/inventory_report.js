const fmtQty = (n) => Number(n || 0).toLocaleString('en', { maximumFractionDigits: 2 });
const rangeEl = document.getElementById('range');
const fromAtEl = document.getElementById('fromAt');
const toAtEl = document.getElementById('toAt');
const reportTypeEl = document.getElementById('reportType');

function bindDatePicker(input, labelSelector) {
  if (!input) return;
  const openPicker = () => {
    try { input.showPicker(); } catch (_) { }
    try { input.focus(); } catch (_) { }
  };
  input.addEventListener('click', openPicker);
  input.addEventListener('focus', openPicker);
  const label = labelSelector ? document.querySelector(labelSelector) : null;
  if (label) { label.addEventListener('click', openPicker); }
}

bindDatePicker(fromAtEl, 'label[for="fromAt"]');
bindDatePicker(toAtEl, 'label[for="toAt"]');

let currentItems = [];

const btnBack = document.getElementById('btnBack');
if (btnBack) { btnBack.onclick = () => { window.location.href = './index.html'; }; }

(function initDefaultDates() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}T23:59`;
  const firstDay = `${yyyy}-${mm}-01T00:00`;
  if (fromAtEl && !fromAtEl.value) fromAtEl.value = firstDay;
  if (toAtEl && !toAtEl.value) toAtEl.value = todayStr;
})();

function renderTable(items, reportType) {
  const thead = document.querySelector('#inventoryTable thead tr');
  const tbody = document.getElementById('inventoryTbody');
  const tfoot = document.getElementById('inventoryTfoot');
  const sectionTitle = document.getElementById('sectionTitle');
  const isSold = reportType !== 'not_sold';

  if (sectionTitle) sectionTitle.textContent = isSold ? 'الأصناف المباعة' : 'الأصناف الغير مباعة';

  if (thead) {
    thead.innerHTML = isSold
      ? '<th>الصنف</th><th>التصنيف</th><th>الكمية المباعة</th><th>الكمية الحالية</th>'
      : '<th>الصنف</th><th>التصنيف</th><th>الكمية الحالية</th>';
  }

  if (!tbody) return;

  if (!items || items.length === 0) {
    const cols = isSold ? 4 : 3;
    tbody.innerHTML = `<tr><td colspan="${cols}" class="muted" style="text-align:center;padding:20px">لا توجد بيانات للفترة المحددة</td></tr>`;
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  let totalSold = 0;
  let totalStock = 0;

  tbody.innerHTML = items.map((item, idx) => {
    const sold = Number(item.qty_sold || 0);
    const stock = Number(item.stock_qty || 0);
    totalSold += sold;
    totalStock += stock;
    if (isSold) {
      return `<tr>
        <td>${item.name || ''}</td>
        <td>${item.category || '-'}</td>
        <td>${fmtQty(sold)}</td>
        <td>${fmtQty(stock)}</td>
      </tr>`;
    } else {
      return `<tr>
        <td>${item.name || ''}</td>
        <td>${item.category || '-'}</td>
        <td>${fmtQty(stock)}</td>
      </tr>`;
    }
  }).join('');

  if (tfoot) {
    if (isSold) {
      tfoot.innerHTML = `<tr>
        <th colspan="2">الإجمالي</th>
        <th>${fmtQty(totalSold)}</th>
        <th>${fmtQty(totalStock)}</th>
      </tr>`;
    } else {
      tfoot.innerHTML = `<tr>
        <th colspan="2">الإجمالي</th>
        <th>${fmtQty(totalStock)}</th>
      </tr>`;
    }
  }
}

async function loadReport(fromDate, toDate) {
  const reportType = reportTypeEl?.value || 'sold';
  const tbody = document.getElementById('inventoryTbody');
  const cols = reportType === 'not_sold' ? 3 : 4;
  if (tbody) tbody.innerHTML = `<tr><td colspan="${cols}" class="muted" style="text-align:center;padding:20px">جاري التحميل...</td></tr>`;

  if (rangeEl) {
    const fmt = v => v ? v.replace('T', ' ') : v;
    rangeEl.textContent = `الفترة: ${fmt(fromDate)} إلى ${fmt(toDate)}`;
  }

  try {
    const res = await window.api.reports_inventory({ date_from: fromDate, date_to: toDate, report_type: reportType });
    if (!res || !res.ok) {
      alert(res?.error || 'حدث خطأ أثناء تحميل البيانات');
      return;
    }
    currentItems = res.items || [];
    renderTable(currentItems, reportType);
  } catch (e) {
    console.error(e);
    alert('حدث خطأ: ' + e.message);
  }
}

(function wireRange() {
  const btn = document.getElementById('applyRangeBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      const from = fromAtEl?.value || '';
      const to = toAtEl?.value || '';
      if (!from || !to) { alert('يرجى تحديد الفترة (من وإلى)'); return; }
      loadReport(from, to);
    });
  }
})();

(function attachExportHandlers() {
  let exporting = false;

  const btnPdf = document.getElementById('exportPdfBtn');
  if (btnPdf) {
    btnPdf.addEventListener('click', async () => {
      if (exporting) return; exporting = true; btnPdf.disabled = true;
      try {
        const period = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.replace(/[^0-9_\-–: ]+/g, '').replace(/\s+/g, ' ').trim() : '';
        const safe = (period || '').replace(/[: ]/g, '_');
        const title = `inventory-report-${safe || Date.now()}.pdf`;

        const clone = document.documentElement.cloneNode(true);

        try {
          const header = clone.querySelector('header');
          if (header) header.remove();
          const rangeBar = clone.querySelector('.range-bar');
          if (rangeBar) rangeBar.remove();
          clone.querySelectorAll('.input, .btn, label, .toolbar').forEach(el => el.remove());

          const container = clone.querySelector('.container');
          if (container) {
            const titleSection = clone.ownerDocument.createElement('div');
            titleSection.className = 'pdf-title-section';
            const rType = reportTypeEl?.value || 'sold';
            const rTypeLabel = rType === 'not_sold' ? 'الأصناف الغير مباعة' : 'الأصناف المباعة';
            titleSection.innerHTML = `
              <h1 class="pdf-main-title">تقرير الجرد - ${rTypeLabel}</h1>
              <div class="pdf-period">${rangeEl?.textContent || ''}</div>
            `;
            container.insertBefore(titleSection, container.firstChild);
          }
        } catch (_) { }

        const style = clone.ownerDocument.createElement('style');
        style.textContent = `
          * { font-family: 'Cairo', sans-serif !important; font-weight: 700 !important; }
          body { background: #fff !important; margin: 0; padding: 10px 20px; }
          .container { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
          .pdf-title-section { text-align: center !important; margin: 0 0 20px 0 !important; padding: 10px 0 15px 0 !important; border-bottom: 3px solid #3b82f6 !important; }
          .pdf-main-title { font-size: 28px !important; font-weight: 700 !important; color: #0f172a !important; margin: 0 0 12px 0 !important; }
          .pdf-period { font-size: 15px !important; color: #64748b !important; font-weight: 700 !important; }
          .section { background: #fff !important; border: 1px solid #e6eaf0 !important; border-radius: 12px !important; padding: 16px !important; margin: 12px 0 !important; page-break-inside: avoid; }
          h3 { color: #0f172a !important; font-size: 18px !important; margin: 0 0 12px 0 !important; font-weight: 700 !important; }
          table { width: 100% !important; border-collapse: collapse !important; margin: 8px 0 !important; page-break-inside: auto; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          th, td { padding: 10px !important; border: 1px solid #e6eaf0 !important; text-align: center !important; font-size: 13px !important; }
          th { background: #eef2ff !important; color: #0b3daa !important; font-weight: 700 !important; }
          tfoot th { background: #f1f5f9 !important; color: #0f172a !important; font-weight: 700 !important; border-top: 2px solid #3b82f6 !important; }
          td { color: #0f172a !important; }
          .muted { color: #64748b !important; font-size: 13px !important; }
          header, #range, .range-bar, .toolbar, .btn, .input, label { display: none !important; margin: 0 !important; padding: 0 !important; height: 0 !important; }
        `;
        clone.querySelector('head')?.appendChild(style);

        const html = '<!doctype html>' + clone.outerHTML;
        await window.api.pdf_export(html, { saveMode: 'auto', filename: title, pageSize: 'A4' });
      } catch (e) { console.error(e); alert('تعذر إنشاء PDF'); }
      finally { exporting = false; btnPdf.disabled = false; }
    });
  }

  const btnExcel = document.getElementById('exportExcelBtn');
  if (btnExcel) {
    btnExcel.addEventListener('click', async () => {
      if (exporting) return; exporting = true; btnExcel.disabled = true;
      try {
        const lines = [];
        const esc = (v) => ('"' + String(v ?? '').replace(/"/g, '""') + '"');

        if (rangeEl && rangeEl.textContent) {
          lines.push(esc('الفترة'), esc(rangeEl.textContent.trim()));
          lines.push('');
        }

        const excelType = reportTypeEl?.value || 'sold';
        const isSoldExcel = excelType !== 'not_sold';
        if (isSoldExcel) {
          lines.push(['الصنف', 'التصنيف', 'الكمية المباعة', 'الكمية الحالية'].map(esc).join(','));
        } else {
          lines.push(['الصنف', 'التصنيف', 'الكمية الحالية'].map(esc).join(','));
        }
        currentItems.forEach((item) => {
          if (isSoldExcel) {
            lines.push([item.name || '', item.category || '-', Number(item.qty_sold || 0), Number(item.stock_qty || 0)].map(esc).join(','));
          } else {
            lines.push([item.name || '', item.category || '-', Number(item.stock_qty || 0)].map(esc).join(','));
          }
        });

        if (currentItems.length > 0) {
          const totalSold = currentItems.reduce((s, it) => s + Number(it.qty_sold || 0), 0);
          const totalStock = currentItems.reduce((s, it) => s + Number(it.stock_qty || 0), 0);
          if (isSoldExcel) {
            lines.push(['الإجمالي', '', totalSold, totalStock].map(esc).join(','));
          } else {
            lines.push(['الإجمالي', '', totalStock].map(esc).join(','));
          }
        }

        const csv = lines.join('\n');
        const period = (rangeEl && rangeEl.textContent) ? rangeEl.textContent.replace(/[^0-9_\-–: ]+/g, '').replace(/\s+/g, ' ').trim() : '';
        const filename = `inventory-report-${(period || '').replace(/[: ]/g, '_') || Date.now()}.csv`;
        await window.api.csv_export(csv, { saveMode: 'auto', filename });
      } catch (e) { console.error(e); alert('تعذر إنشاء Excel'); }
      finally { exporting = false; btnExcel.disabled = false; }
    });
  }
})();

(function autoLoad() {
  // تم إيقاف التحميل التلقائي بناء على طلب المستخدم
  // const from = fromAtEl?.value || '';
  // const to = toAtEl?.value || '';
  // if (from && to) loadReport(from, to);
})();
