// Invoices list: load and show basic info

// Permissions (align with main logic): hide actions if not granted
let __perms = new Set();
const __permsReady = (async()=>{ try{ const u=JSON.parse(localStorage.getItem('pos_user')||'null'); if(u&&u.id){ const r=await window.api.perms_get_for_user(u.id); if(r&&r.ok){ __perms = new Set(r.keys||[]); } } }catch(_){ __perms = new Set(); } })();
function hasInvoice(k){ return __perms.has(k); }
const tbody = document.getElementById('tbody');
const q = document.getElementById('q');
const q2 = document.getElementById('q2');

function isArabic(){ return (document.documentElement.lang || 'ar') !== 'en'; }

function showNotice(icon, title, message){
  return window.Swal.fire({
    icon,
    title,
    text: String(message || ''),
    confirmButtonText: isArabic() ? 'حسنًا' : 'OK',
    confirmButtonColor: icon === 'error' ? '#dc2626' : '#2563eb',
    heightAuto: false,
    customClass: {
      popup: `invoice-swal-popup${isArabic() ? ' invoice-swal-rtl' : ''}`,
      title: 'invoice-swal-title',
      htmlContainer: 'invoice-swal-text',
      confirmButton: 'invoice-swal-confirm',
    },
  });
}

function showLoadingNotice(title, message){
  return window.Swal.fire({
    title,
    text: message,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    heightAuto: false,
    didOpen: () => window.Swal.showLoading(),
    customClass: { popup: `invoice-swal-popup${isArabic() ? ' invoice-swal-rtl' : ''}` },
  });
}

function formatZatcaResponse(rawResponse){
  if(typeof rawResponse !== 'string') return JSON.stringify(rawResponse || {}, null, 2);
  try{
    return JSON.stringify(JSON.parse(rawResponse), null, 2);
  }catch(_){
    return rawResponse;
  }
}

function showZatcaResponseNotice(rawResponse){
  return window.Swal.fire({
    icon: 'info',
    title: isArabic() ? 'تفاصيل رد هيئة الزكاة' : 'ZATCA response details',
    text: formatZatcaResponse(rawResponse),
    width: 760,
    confirmButtonText: isArabic() ? 'إغلاق' : 'Close',
    confirmButtonColor: '#2563eb',
    heightAuto: false,
    customClass: {
      popup: `invoice-swal-popup${isArabic() ? ' invoice-swal-rtl' : ''}`,
      htmlContainer: 'zatca-response-text',
    },
  });
}
function fmtDate(s){
  try{
    // Force Gregorian calendar to match printed invoice format
    return new Intl.DateTimeFormat('en-GB-u-ca-gregory', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: 'numeric', minute: '2-digit', hour12: true
    }).format(new Date(s));
  }catch(_){ return s; }
}

// pagination state
let __allInvoices = [];
let __totalInvoices = 0;
let __invPage = 1;
let __invPageSize = 20;
let __lastId = null;
let __cursors = {};

// default print format from settings (thermal | a4)
let __defPrintFormat = 'thermal';
let __zatcaEnabled = false;
let __zatcaMode = 'unlinked'; // legacy | direct | unlinked — يحدد مسار الإرسال اليدوي
let __showEmpSelector = true;
// وضع الربط المباشر: أزرار الإرسال تستخدم القناة المباشرة بدل الوسيط المحلي
const __zatcaModeReady = (async()=>{
  try{
    const st = await window.electronAPI.zatcaDirect.getStatus();
    if(st && st.success){
      __zatcaMode = st.mode || 'unlinked';
      if(__zatcaMode === 'direct') __zatcaEnabled = true;
    }
  }catch(_){ }
})();
// Batch screen-init: settings + total in ONE request (faster on remote/VPN)
const __settingsReady = (async()=>{
  try{
    const r = await (window.api.screen_init_invoices ? window.api.screen_init_invoices() : window.api.settings_get());
    if(r && r.ok){
      const s = r.settings || r.item || {};
      __defPrintFormat = (s.default_print_format === 'a4') ? 'a4' : 'thermal';
      __zatcaEnabled = !!(s.zatca_enabled) || __zatcaMode === 'direct';
      __showEmpSelector = s.show_employee_selector == null ? true : !!(s.show_employee_selector);
      if(r.total_invoices != null){ __totalInvoices = Number(r.total_invoices || 0); renderInvPager(); }
      const statsBox = document.getElementById('zatcaStats');
      if(statsBox){
        if(__zatcaEnabled && r.zatca_stats){
          statsBox.classList.remove('hidden');
          statsBox.classList.add('flex');
          document.getElementById('zatcaStatSent').textContent = r.zatca_stats.sent || 0;
          document.getElementById('zatcaStatPending').textContent = r.zatca_stats.pending || 0;
          document.getElementById('zatcaStatFailed').textContent = r.zatca_stats.failed || 0;
        } else {
          statsBox.classList.add('hidden');
          statsBox.classList.remove('flex');
        }
      }
    }
  }catch(_){ /* ignore */ }
})();

function renderInvPager(){
  const isAr = (document.documentElement.lang || 'ar') !== 'en';
  const top=document.getElementById('pagerTop'); const bottom=document.getElementById('pagerBottom');
  const pages = (__invPageSize > 0) ? Math.max(1, Math.ceil(__totalInvoices / __invPageSize)) : 1;
  const btn=(l,d,g)=>`<button class="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium" ${d?'disabled':''} data-go="${g}">${l}</button>`;
  const pageLabel = isAr
    ? `صفحة ${__invPage} من ${pages} (إجمالي: ${__totalInvoices})`
    : `Page ${__invPage} of ${pages} (Total: ${__totalInvoices})`;
  const html=[btn('⏮️',__invPage<=1,'first'),btn('◀️',__invPage<=1,'prev'),`<span class="text-gray-600 font-medium px-2">${pageLabel}</span>`,btn('▶️',__invPage>=pages,'next'),btn('⏭️',__invPage>=pages,'last')].join(' ');
  if(top) top.innerHTML=html; if(bottom) bottom.innerHTML=html;
  const onClick=(e)=>{
    const b=e.target.closest('button'); if(!b) return;
    const act=b.getAttribute('data-go');
    const pages=(__invPageSize>0)?Math.max(1,Math.ceil(__totalInvoices/__invPageSize)):1;
    if(act==='first'){
      __invPage=1; __cursors={}; load(false, null);
    } else if(act==='prev' && __invPage>1){
      __invPage=Math.max(1,__invPage-1);
      load(false, __cursors[__invPage]||null);
    } else if(act==='next' && __invPage<pages){
      __cursors[__invPage+1]=__lastId;
      __invPage=Math.min(pages,__invPage+1);
      load(false, __lastId);
    } else if(act==='last'){
      __invPage=pages; __cursors={};
      load(false, null);
    }
  };
  if(top) top.onclick=onClick; if(bottom) bottom.onclick=onClick;
}

function renderRows(list){
  const isAr = (document.documentElement.lang || 'ar') !== 'en';
  const PMETH = isAr
    ? {cash:'كاش',card:'شبكة',credit:'آجل',mixed:'مختلط',tamara:'تمارا',tabby:'تابي'}
    : {cash:'Cash',card:'Network',credit:'Credit',mixed:'Mixed',tamara:'Tamara',tabby:'Tabby'};
  const T = isAr ? {
    disabled: 'غير مفعل',
    sent: '✅ تم الإرسال',
    failed: '❌ فشل',
    notSent: '⏳ لم يتم الإرسال',
    viewInvoice: 'عرض الفاتورة',
    sendZatca: '📤 إرسال للهيئة',
    zatcaResp: '📄 رد الهيئة',
    editEmployees: 'تعديل الموظفين',
  } : {
    disabled: 'Disabled',
    sent: '✅ Sent',
    failed: '❌ Failed',
    notSent: '⏳ Not Sent',
    viewInvoice: 'View invoice',
    sendZatca: '📤 Send to ZATCA',
    zatcaResp: '📄 ZATCA Response',
    editEmployees: 'Edit Employees',
  };
  const canView = hasInvoice('invoices.view');
  const frag = document.createDocumentFragment();
  list.forEach((row) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-100 last:border-b-0';
    const rejected = row.zatca_status==='rejected';
    const sent = !rejected && (row.zatca_status==='submitted'||row.zatca_status==='accepted'||row.zatca_submitted);
    const zatcaStatusCell = !__zatcaEnabled
      ? `<td class="px-4 py-3 text-center text-gray-400 text-sm">${T.disabled}</td>`
      : sent
        ? `<td class="px-4 py-3 text-center"><span class="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-bold">${T.sent}</span></td>`
        : rejected
          ? `<td class="px-4 py-3 text-center"><span class="inline-block px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-bold">${T.failed}</span></td>`
          : `<td class="px-4 py-3 text-center"><span class="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-bold">${T.notSent}</span></td>`;
    const pmeth = PMETH[String(row.payment_method||'').toLowerCase()] || (row.payment_method||'');
    let zatcaBtns = '';
    if(canView && __zatcaEnabled){
      const sendBtn = sent ? '' : `<button class="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium" data-act="send" data-id="${row.id}">${T.sendZatca}</button>`;
      const viewBtn = (row.zatca_response||row.zatca_rejection_reason) ? `<button class="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium" data-act="show_zresp" data-id="${row.id}">${T.zatcaResp}</button>` : '';
      zatcaBtns = sendBtn + ' ' + viewBtn;
    }
    tr.innerHTML = `
      <td class="px-4 py-3 text-gray-900 font-semibold">${row.invoice_no}</td>
      <td class="px-4 py-3 text-gray-700">${row.disp_customer_name || ''}</td>
      <td class="px-4 py-3 text-gray-700">${row.disp_customer_phone || ''}</td>
      <td class="px-4 py-3"><span class="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">${pmeth}</span></td>
      <td class="px-4 py-3 text-gray-900 font-bold">${Number(row.grand_total).toFixed(2)}</td>
      <td class="px-4 py-3 text-gray-600 text-sm">${fmtDate(row.created_at)}</td>
      ${zatcaStatusCell}
      <td class="px-4 py-3">
        <div class="flex flex-wrap gap-2 items-center">
          ${canView ? `<button class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium" data-act="view" data-id="${row.id}">${T.viewInvoice}</button>` : ''}
          ${canView && __showEmpSelector ? `<button style="padding:6px 14px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(124,58,237,0.35);display:inline-flex;align-items:center;gap:6px;transition:all 0.2s;" onmouseover="this.style.boxShadow='0 4px 14px rgba(124,58,237,0.5)';this.style.transform='translateY(-1px)'" onmouseout="this.style.boxShadow='0 2px 8px rgba(124,58,237,0.35)';this.style.transform=''" data-act="editEmp" data-id="${row.id}">${T.editEmployees}</button>` : ''}
          ${zatcaBtns}
        </div>
      </td>
    `;
    frag.appendChild(tr);
  });
  tbody.innerHTML='';
  tbody.appendChild(frag);
  if(!tbody.__inited){ tbody.addEventListener('click', onTableAction); tbody.__inited = true; }
  renderInvPager();
}

function openInvoiceView(row){
  if(!hasInvoice('invoices.view')) return;
  const id = Number(row.id);
  // open print view honoring default_print_format from settings
  const page = (__defPrintFormat === 'a4') ? 'print-a4.html' : 'print.html';
  const method = String(row.payment_method||'');
  // Prefer persisted settled_cash for settled cash invoices; fallback to full total
  const cash = (method==='cash')
    ? ((row.settled_cash != null) ? Number(row.settled_cash) : Number(row.grand_total||0))
    : 0;
  // إضافة refresh=1 لضمان تحميل البيانات المحدثة وعرض تاريخ الدفع
  // إضافة reprint=1 لمنع إرسال واتساب تلقائياً عند إعادة الطباعة
  const cashierName = String(row.created_by_username || '').trim();
  const params = new URLSearchParams({ id: String(id), ...(method?{pay:method}:{}) , ...(cash?{cash:String(cash)}:{}), refresh: '1', reprint: '1', ...(cashierName ? {cashier: cashierName} : {}) });
  const url = `../sales/${page}?${params.toString()}`;
  const w = (__defPrintFormat === 'a4') ? 900 : 500;
  const h = (__defPrintFormat === 'a4') ? 1000 : 700;
  window.open(url, 'PRINT_VIEW', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
}

function showZatcaSubmissionSuccess(isAr){
  const title = isAr ? 'تم إرسال الفاتورة بنجاح' : 'Invoice sent successfully';
  const message = isAr
    ? 'تم استلام الفاتورة بنجاح لدى هيئة الزكاة والضريبة والجمارك.'
    : 'The invoice was successfully received by ZATCA.';
  return window.Swal.fire({
    icon: 'success',
    title,
    text: message,
    confirmButtonText: isAr ? 'حسنًا' : 'OK',
    confirmButtonColor: '#2563eb',
    heightAuto: false,
    customClass: {
      popup: `invoice-swal-popup${isAr ? ' invoice-swal-rtl' : ''}`,
      title: 'invoice-swal-title',
      htmlContainer: 'invoice-swal-text',
      confirmButton: 'invoice-swal-confirm',
    },
  });
}

async function sendInvoiceToZatca(saleId, triggerButton){
  const arabic = isArabic();
  const originalLabel = triggerButton?.textContent;
  if(triggerButton){
    triggerButton.disabled = true;
    triggerButton.textContent = arabic ? '⏳ جاري الإرسال...' : '⏳ Sending...';
  }
  showLoadingNotice(
    arabic ? 'جاري إرسال الفاتورة' : 'Sending invoice',
    arabic ? 'يرجى الانتظار أثناء الاتصال بهيئة الزكاة والضريبة والجمارك.' : 'Please wait while connecting to ZATCA.'
  );
  try{
    await __zatcaModeReady;
    const submission = (__zatcaMode === 'direct')
      ? await window.electronAPI.zatcaDirect.submitSale(saleId)
      : await window.electronAPI.localZatca.submitBySaleId(saleId);
    const rawResponse = submission?.data;
    const responseText = typeof rawResponse === 'string' ? rawResponse : JSON.stringify(rawResponse || '');
    const parsedResponse = (()=>{ try{ return typeof rawResponse === 'string' ? JSON.parse(rawResponse) : rawResponse; }catch(_){ return null; } })();
    const notReported = /NOT[_\s-]?REPORTED/i.test(responseText)
      || (parsedResponse && (parsedResponse.statusCode === 'NOT_REPORTED' || parsedResponse.status === 'NOT_REPORTED' || parsedResponse?.data?.status === 'NOT_REPORTED'));
    window.Swal.close();
    if(submission?.success && !notReported){
      await showZatcaSubmissionSuccess(arabic);
    }else{
      const failureMessage = submission?.message || responseText || (arabic ? 'غير معروف' : 'Unknown');
      await showNotice('error', arabic ? 'فشل إرسال الفاتورة' : 'Invoice send failed', failureMessage);
    }
    await load(false);
  }catch(error){
    window.Swal.close();
    await showNotice(
      'error',
      arabic ? 'تعذر إرسال الفاتورة' : 'Unable to send invoice',
      error?.message || String(error)
    );
  }finally{
    if(triggerButton?.isConnected){
      triggerButton.disabled = false;
      triggerButton.textContent = originalLabel;
    }
  }
}

function onTableAction(e){
  const b = e.target.closest('button'); if(!b) return;
  const act = b.getAttribute('data-act');
  if(act==='view'){
    const id = Number(b.getAttribute('data-id'));
    const row = __allInvoices.find(x=>Number(x.id)===id) || {};
    openInvoiceView(row);
  }
  if(act==='send'){
    const id = Number(b.getAttribute('data-id'));
    sendInvoiceToZatca(id, b);
  }
  if(act==='show_zresp'){
    const id = Number(b.getAttribute('data-id'));
    const row = __allInvoices.find(x=>Number(x.id)===id) || {};
    showZatcaResponseNotice(row.zatca_response || row.zatca_rejection_reason || '');
  }
  if(act==='editEmp'){
    if(!hasInvoice('invoices.view')) return;
    const id = Number(b.getAttribute('data-id'));
    openEmpEditModal(id);
  }
}

// ─── Failed ZATCA invoices ───
let __failedZatcaPage = 1;
const __failedZatcaPageSize = 20;
let __failedZatcaItems = [];

function escapeHtml(text){
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function failedInvoiceRowMarkup(invoice, paymentMethods){
  const invoiceId = Number(invoice.id);
  const responseButton = (invoice.zatca_response || invoice.zatca_rejection_reason)
    ? `<button class="px-2 py-1 bg-purple-600 text-white rounded-md" data-failed-action="response" data-id="${invoiceId}">📄 ${isArabic() ? 'الرد' : 'Response'}</button>`
    : '';
  const viewButton = hasInvoice('invoices.view')
    ? `<button class="px-2 py-1 bg-blue-600 text-white rounded-md" data-failed-action="view" data-id="${invoiceId}">${isArabic() ? 'عرض' : 'View'}</button>`
    : '';
  const paymentMethod = paymentMethods[String(invoice.payment_method || '').toLowerCase()] || invoice.payment_method || '';
  return `<tr>
    <td>${escapeHtml(invoice.invoice_no)}</td><td>${escapeHtml(invoice.disp_customer_phone || invoice.customer_phone)}</td>
    <td>${escapeHtml(fmtDate(invoice.created_at))}</td><td>${escapeHtml(paymentMethod)}</td>
    <td><div class="flex gap-1 justify-center">${viewButton}<button class="px-2 py-1 bg-green-600 text-white rounded-md" data-failed-action="send" data-id="${invoiceId}">📤 ${isArabic() ? 'إرسال' : 'Send'}</button>${responseButton}</div></td>
  </tr>`;
}

function failedInvoiceRowsMarkup(invoices){
  const paymentMethods = isArabic()
    ? {cash:'كاش', card:'شبكة', credit:'آجل', mixed:'مختلط', tamara:'تمارا', tabby:'تابي'}
    : {cash:'Cash', card:'Network', credit:'Credit', mixed:'Mixed', tamara:'Tamara', tabby:'Tabby'};
  return invoices.map(invoice => failedInvoiceRowMarkup(invoice, paymentMethods)).join('');
}

function failedInvoicePagerMarkup(totalInvoices){
  const pageCount = Math.max(1, Math.ceil(totalInvoices / __failedZatcaPageSize));
  if(pageCount <= 1) return '';
  const previousDisabled = __failedZatcaPage <= 1 ? 'disabled' : '';
  const nextDisabled = __failedZatcaPage >= pageCount ? 'disabled' : '';
  return `<div class="flex justify-center items-center gap-2 mt-4">
    <button class="px-3 py-1 bg-blue-600 text-white rounded-md disabled:opacity-40" data-failed-page="prev" ${previousDisabled}>◀</button>
    <span>${isArabic() ? 'صفحة' : 'Page'} ${__failedZatcaPage} ${isArabic() ? 'من' : 'of'} ${pageCount}</span>
    <button class="px-3 py-1 bg-blue-600 text-white rounded-md disabled:opacity-40" data-failed-page="next" ${nextDisabled}>▶</button>
  </div>`;
}

function showFailedInvoicesList(totalInvoices){
  return window.Swal.fire({
    icon: 'error',
    title: isArabic() ? 'الفواتير التي فشل إرسالها' : 'Failed ZATCA invoices',
    html: `<div class="failed-invoices-list"><table><thead><tr><th>${isArabic() ? 'الفاتورة' : 'Invoice'}</th><th>${isArabic() ? 'الجوال' : 'Phone'}</th><th>${isArabic() ? 'التاريخ' : 'Date'}</th><th>${isArabic() ? 'الدفع' : 'Payment'}</th><th>${isArabic() ? 'الإجراءات' : 'Actions'}</th></tr></thead><tbody>${failedInvoiceRowsMarkup(__failedZatcaItems)}</tbody></table>${failedInvoicePagerMarkup(totalInvoices)}</div>`,
    width: 1050,
    confirmButtonText: isArabic() ? 'إغلاق' : 'Close',
    confirmButtonColor: '#475569',
    heightAuto: false,
    customClass: { popup: `invoice-swal-popup${isArabic() ? ' invoice-swal-rtl' : ''}` },
    didOpen: () => window.Swal.getPopup().addEventListener('click', onFailedInvoiceAction),
  });
}

async function onFailedInvoiceAction(event){
  const button = event.target.closest('button');
  if(!button) return;
  const pageAction = button.getAttribute('data-failed-page');
  if(pageAction){
    __failedZatcaPage += pageAction === 'next' ? 1 : -1;
    window.Swal.close();
    await loadFailedZatcaPage();
    return;
  }
  const invoice = __failedZatcaItems.find(row => Number(row.id) === Number(button.getAttribute('data-id')));
  if(!invoice) return;
  const action = button.getAttribute('data-failed-action');
  window.Swal.close();
  if(action === 'view') openInvoiceView(invoice);
  if(action === 'response') showZatcaResponseNotice(invoice.zatca_response || invoice.zatca_rejection_reason || '');
  if(action === 'send') await sendInvoiceToZatca(Number(invoice.id), button);
}

async function loadFailedZatcaPage(){
  showLoadingNotice(
    isArabic() ? 'جاري تحميل الفواتير الفاشلة' : 'Loading failed invoices',
    isArabic() ? 'يرجى الانتظار قليلًا.' : 'Please wait.'
  );
  try{
    const response = await window.api.sales_list({ type: 'invoice', zatca_status: 'rejected', page: __failedZatcaPage, pageSize: __failedZatcaPageSize });
    if(!response?.ok) throw new Error(response?.error || (isArabic() ? 'تعذر تحميل الفواتير' : 'Failed to load invoices'));
    window.Swal.close();
    __failedZatcaItems = response.items || [];
    if(!__failedZatcaItems.length){
      await showNotice('success', isArabic() ? 'لا توجد فواتير فاشلة' : 'No failed invoices', isArabic() ? 'جميع الفواتير بحالة جيدة.' : 'All invoices are in good standing.');
      return;
    }
    await showFailedInvoicesList(Number(response.total || __failedZatcaItems.length));
  }catch(error){
    window.Swal.close();
    await showNotice('error', isArabic() ? 'تعذر تحميل الفواتير الفاشلة' : 'Unable to load failed invoices', error?.message || String(error));
  }
}

const failedZatcaCard = document.getElementById('zatcaCardFailed');
if(failedZatcaCard){
  failedZatcaCard.addEventListener('click', () => {
    __failedZatcaPage = 1;
    loadFailedZatcaPage();
  });
}

async function load(resetPage = true, beforeId = null){
  await Promise.all([__settingsReady, __permsReady]);

  if(resetPage){ __invPage=1; __cursors={}; beforeId=null; }

  const query = {};
  const v1 = (q.value||'').trim();
  const v2 = (q2.value||'').trim();
  if(v1){ query.q = v1; }
  if(v2){ query.customer_q = v2; }
  query.type = 'invoice';
  query.page = __invPage;
  query.pageSize = __invPageSize;
  if(beforeId){ query.before_id = beforeId; }

  try{
    const response = await window.api.sales_list(query);
    if(!response?.ok) throw new Error(response?.error || (isArabic() ? 'تعذر تحميل الفواتير' : 'Failed to load invoices'));
    __allInvoices = response.items || [];
    __totalInvoices = response.total || 0;
    __invPage = response.page || __invPage;
    __invPageSize = response.pageSize !== undefined ? response.pageSize : __invPageSize;
    __lastId = response.last_id || null;
    renderRows(__allInvoices);
  }catch(error){
    await showNotice('error', isArabic() ? 'تعذر تحميل الفواتير' : 'Unable to load invoices', error?.message || String(error));
  }
}

// live search with debounce for both fields
(function(){
  let t=null;
  const trigger=()=>{ clearTimeout(t); t=setTimeout(()=>load(), 250); };
  q.addEventListener('input', trigger);
  q2.addEventListener('input', trigger);
})();

// init page size control
const pageSizeSel = document.getElementById('pageSize');
if(pageSizeSel){
  pageSizeSel.addEventListener('change', ()=>{
    __invPageSize = Number(pageSizeSel.value||20);
    load(true);
  });
}

load();

let __zatcaStatusRefreshTimer = null;
window.api.on_sales_changed((event) => {
  if(event && event.action === 'zatca_status_changed'){
    clearTimeout(__zatcaStatusRefreshTimer);
    __zatcaStatusRefreshTimer = setTimeout(() => load(false), 250);
  }
});

// Re-render rows when language changes so dynamic content updates immediately
try {
  window.api.app_on_locale_changed(() => {
    if(__allInvoices.length) renderRows(__allInvoices);
    else renderInvPager();
  });
} catch(_) {}

// ─── Employee Edit Modal ───
let __allEmployees = [];

(async function loadEmployees() {
  try {
    const r = await window.api.employees_list({});
    if (r && r.ok) __allEmployees = r.items || [];
  } catch (_) {}
})();

function openEmpEditModal(saleId) {
  const modal = document.getElementById('empEditModal');
  const loading = document.getElementById('empEditLoading');
  const content = document.getElementById('empEditContent');
  const tbody = document.getElementById('empEditTbody');
  const title = document.getElementById('empEditInvoiceNo');
  const saveBtn = document.getElementById('empEditSave');

  modal.style.display = 'flex';
  loading.style.display = 'block';
  content.style.display = 'none';
  saveBtn.disabled = true;

  (async () => {
    try {
      const r = await window.api.sales_get(saleId);
      if (!r || !r.ok) {
        loading.style.display = 'none';
        modal.style.display = 'none';
        showNotice('error', 'تعذر تحميل بيانات الفاتورة', r?.error || 'فشل تحميل بيانات الفاتورة');
        return;
      }
      const { sale, items } = r;
      title.textContent = sale.invoice_no;
      loading.style.display = 'none';
      content.style.display = 'block';

      tbody.innerHTML = items.map((it, idx) => {
        const opts = __allEmployees.map(emp =>
          `<option value="${emp.id}" ${String(it.employee_id) === String(emp.id) ? 'selected' : ''}>${emp.name}</option>`
        ).join('');
        const bg = idx % 2 === 0 ? '#fff' : '#f8fafc';
        return `<tr style="background:${bg};transition:background 0.15s;" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='${bg}'">
          <td style="padding:14px 20px;font-size:14px;font-weight:600;color:#1e293b;border-bottom:1px solid #f1f5f9;">${it.name}</td>
          <td style="padding:10px 20px;border-bottom:1px solid #f1f5f9;">
            <select data-item-id="${it.id}" class="emp-edit-select" style="width:100%;padding:9px 14px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;font-weight:500;color:#334155;background:#fff;outline:none;cursor:pointer;transition:border-color 0.2s;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.12)'" onblur="this.style.borderColor='#e2e8f0';this.style.boxShadow='none'">
              <option value="">— اختر الموظف —</option>
              ${opts}
            </select>
          </td>
        </tr>`;
      }).join('');

      saveBtn.disabled = false;
      saveBtn._saleId = saleId;
    } catch (e) {
      loading.style.display = 'none';
      modal.style.display = 'none';
      showNotice('error', 'تعذر تحميل بيانات الفاتورة', e?.message || String(e));
    }
  })();
}

(function(){
  const modal = document.getElementById('empEditModal');
  const closeBtn = document.getElementById('empEditClose');
  const cancelBtn = document.getElementById('empEditCancel');
  const saveBtn = document.getElementById('empEditSave');

  if (closeBtn) closeBtn.onclick = () => { if(modal) modal.style.display = 'none'; };
  if (cancelBtn) cancelBtn.onclick = () => { if(modal) modal.style.display = 'none'; };
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

  if (saveBtn) {
    saveBtn.onclick = async () => {
      const saleId = saveBtn._saleId;
      if (!saleId) return;
      const selects = document.querySelectorAll('.emp-edit-select');
      const items = Array.from(selects).map(sel => ({
        id: Number(sel.getAttribute('data-item-id')),
        employee_id: sel.value ? Number(sel.value) : null
      }));
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:empSpin 0.7s linear infinite;vertical-align:middle;margin-left:6px;"></span> جاري الحفظ...';
      showLoadingNotice('جاري حفظ التعديلات', 'يرجى الانتظار أثناء تحديث موظفي الفاتورة.');
      try {
        const r = await window.api.sales_update_employee_items({ sale_id: saleId, items });
        window.Swal.close();
        if (r && r.ok) {
          if(modal) modal.style.display = 'none';
          await showNotice('success', 'تم الحفظ بنجاح', 'تم حفظ تعديلات موظفي الفاتورة بنجاح.');
        } else {
          const msg = r?.error || 'فشل حفظ التعديلات';
          await showNotice('error', 'فشل حفظ التعديلات', msg);
        }
      } catch (e) {
        window.Swal.close();
        const msg = 'حدث خطأ: ' + (e.message || String(e));
        await showNotice('error', 'تعذر حفظ التعديلات', msg);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '✓ حفظ التعديلات';
      }
    };
  }
})();
