// Invoices list: load and show basic info

// Permissions (align with main logic): hide actions if not granted
let __perms = new Set();
const __permsReady = (async()=>{ try{ const u=JSON.parse(localStorage.getItem('pos_user')||'null'); if(u&&u.id){ const r=await window.api.perms_get_for_user(u.id); if(r&&r.ok){ __perms = new Set(r.keys||[]); } } }catch(_){ __perms = new Set(); } })();
function hasInvoice(k){ return __perms.has(k); }
const tbody = document.getElementById('tbody');
const errorDiv = document.getElementById('error');
const q = document.getElementById('q');
const q2 = document.getElementById('q2');
// const refreshBtn = document.getElementById('refreshBtn'); // removed button

function setError(m){ errorDiv.textContent = m || ''; }
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
let __showEmpSelector = true;
// Batch screen-init: settings + total in ONE request (faster on remote/VPN)
const __settingsReady = (async()=>{
  try{
    const r = await (window.api.screen_init_invoices ? window.api.screen_init_invoices() : window.api.settings_get());
    if(r && r.ok){
      const s = r.settings || r.item || {};
      __defPrintFormat = (s.default_print_format === 'a4') ? 'a4' : 'thermal';
      __zatcaEnabled = !!(s.zatca_enabled);
      __showEmpSelector = s.show_employee_selector == null ? true : !!(s.show_employee_selector);
      if(r.total_invoices != null){ __totalInvoices = Number(r.total_invoices || 0); renderInvPager(); }
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

function onTableAction(e){
  const b = e.target.closest('button'); if(!b) return;
  const act = b.getAttribute('data-act');
  if(act==='view'){
    if(!hasInvoice('invoices.view')) return;
    const id = Number(b.getAttribute('data-id'));
    // open print view honoring default_print_format from settings
    const page = (__defPrintFormat === 'a4') ? 'print-a4.html' : 'print.html';
    const row = __allInvoices.find(x=>Number(x.id)===id) || {};
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
  if(act==='send'){
    const id = Number(b.getAttribute('data-id'));
    const isAr = (document.documentElement.lang || 'ar') !== 'en';
    const oldLabel = b.textContent;
    b.disabled = true; b.textContent = isAr ? '⏳ جاري الإرسال...' : '⏳ Sending...'; b.className = 'px-3 py-1.5 bg-gray-400 text-white rounded-lg text-sm font-medium cursor-wait'; setError(isAr ? '⏳ جاري الإرسال...' : '⏳ Sending...');
    (async () => {
      try{
        const resp = await window.electronAPI.localZatca.submitBySaleId(id);
        const raw = resp?.data;
        // Try detect rejection in success payload (e.g., NOT_REPORTED)
        const asStr = (typeof raw==='string') ? raw : JSON.stringify(raw||'');
        const obj = (()=>{ try{ return (typeof raw==='string')? JSON.parse(raw) : raw; }catch(_){ return null; } })();
        const notReported = /NOT[_\s-]?REPORTED/i.test(asStr) || (obj && (obj.statusCode==='NOT_REPORTED' || obj.status==='NOT_REPORTED' || obj?.data?.status==='NOT_REPORTED'));
        if(resp && resp.success && !notReported){
          const msg = (typeof resp.data === 'string') ? resp.data : JSON.stringify(resp.data);
          setError(isAr ? '✅ تم الإرسال بنجاح' : '✅ Sent successfully');
          // عرض رد الهيئة تلقائياً في نافذة منبثقة صغيرة
          try{ showZatcaResponseModal(raw || msg); }catch(_){ }
        } else {
          const msg = resp?.message || asStr || (isAr ? 'غير معروف' : 'Unknown');
          setError(isAr ? '❌ فشل الإرسال' : '❌ Send failed');
          // عرض رد الهيئة/الرسالة تلقائياً في نفس النافذة المنبثقة
          try{ showZatcaResponseModal(msg); }catch(_){ }
        }
        // Refresh list to reflect status/tooltip/button state
        await load(false);
      }catch(e){
        const emsg = (e?.message || String(e));
        setError((isAr ? '❌ تعذر الإرسال: ' : '❌ Failed to send: ') + emsg);
        try{ showZatcaResponseModal(emsg); }catch(_){ }
      } finally {
        // Restore button quickly if still present (list may rerender)
        try{ b.disabled = false; b.textContent = oldLabel; }catch(_){ }
      }
    })();
  }
  if(act==='show_zresp'){
    const id = Number(b.getAttribute('data-id'));
    const row = __allInvoices.find(x=>Number(x.id)===id) || {};
    showZatcaResponseModal(row.zatca_response || row.zatca_rejection_reason || '');
  }
  if(act==='editEmp'){
    if(!hasInvoice('invoices.view')) return;
    const id = Number(b.getAttribute('data-id'));
    openEmpEditModal(id);
  }
}

(function(){
  const modal = document.getElementById('zatcaModal');
  const closeBtn = document.getElementById('zatcaClose');
  if(closeBtn){ closeBtn.onclick = ()=>{ if(modal) modal.style.display='none'; }; }
  if(modal){ modal.addEventListener('click', (e)=>{ if(e.target===modal){ modal.style.display='none'; } }); }
})();

function showZatcaResponseModal(raw){
  const modal = document.getElementById('zatcaModal');
  const pre = document.getElementById('zatcaContent');
  let text = raw;
  try{
    const obj = (typeof raw==='string') ? JSON.parse(raw) : raw;
    text = JSON.stringify(obj, null, 2);
  }catch(_){ text = String(raw||''); }
  if(pre) pre.textContent = text;
  if(modal) modal.style.display = 'flex';
}

async function load(resetPage = true, beforeId = null){
  setError('');
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

  const r = await window.api.sales_list(query);
  if(!r.ok){ setError(r.error || ((document.documentElement.lang||'ar')!=='en' ? 'تعذر تحميل الفواتير' : 'Failed to load invoices')); return; }
  __allInvoices = r.items || [];
  __totalInvoices = r.total || 0;
  __invPage = r.page || __invPage;
  __invPageSize = (r.pageSize !== undefined) ? r.pageSize : __invPageSize;
  __lastId = r.last_id || null;
  renderRows(__allInvoices);
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

function showEmpToast(msg, type = 'success') {
  const t = document.getElementById('empToast');
  if (!t) return;
  const styles = {
    success: { bg: 'linear-gradient(135deg,#059669,#10b981)', icon: '✓', shadow: 'rgba(5,150,105,0.4)' },
    error:   { bg: 'linear-gradient(135deg,#dc2626,#ef4444)', icon: '✕', shadow: 'rgba(220,38,38,0.4)' },
    info:    { bg: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', icon: 'ℹ', shadow: 'rgba(29,78,216,0.4)' },
  };
  const s = styles[type] || styles.info;
  t.innerHTML = `<span style="margin-left:8px;font-size:16px;">${s.icon}</span>${msg}`;
  t.style.cssText = `display:block;position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:9999;min-width:280px;max-width:420px;padding:14px 22px;border-radius:12px;font-size:14px;font-weight:600;text-align:center;box-shadow:0 8px 32px ${s.shadow};background:${s.bg};color:#fff;pointer-events:none;animation:empToastIn 0.3s cubic-bezier(0.34,1.56,0.64,1);`;
  clearTimeout(t._tid);
  t._tid = setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.4s'; setTimeout(() => { t.style.display = 'none'; t.style.opacity = ''; t.style.transition = ''; }, 400); }, 2800);
}

function openEmpEditModal(saleId) {
  const modal = document.getElementById('empEditModal');
  const loading = document.getElementById('empEditLoading');
  const content = document.getElementById('empEditContent');
  const tbody = document.getElementById('empEditTbody');
  const title = document.getElementById('empEditInvoiceNo');
  const saveBtn = document.getElementById('empEditSave');
  const errDiv = document.getElementById('empEditError');

  modal.style.display = 'flex';
  loading.style.display = 'block';
  content.style.display = 'none';
  saveBtn.disabled = true;
  errDiv.style.display = 'none';

  (async () => {
    try {
      const r = await window.api.sales_get(saleId);
      if (!r || !r.ok) {
        errDiv.textContent = r?.error || 'فشل تحميل بيانات الفاتورة';
        errDiv.style.display = 'block';
        loading.style.display = 'none';
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
      errDiv.textContent = 'حدث خطأ: ' + (e.message || String(e));
      errDiv.style.display = 'block';
      loading.style.display = 'none';
    }
  })();
}

(function(){
  const modal = document.getElementById('empEditModal');
  const closeBtn = document.getElementById('empEditClose');
  const cancelBtn = document.getElementById('empEditCancel');
  const saveBtn = document.getElementById('empEditSave');
  const errDiv = document.getElementById('empEditError');

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
      if(errDiv) errDiv.style.display = 'none';
      try {
        const r = await window.api.sales_update_employee_items({ sale_id: saleId, items });
        if (r && r.ok) {
          if(modal) modal.style.display = 'none';
          showEmpToast('تم حفظ التعديلات بنجاح', 'success');
        } else {
          const msg = r?.error || 'فشل حفظ التعديلات';
          if(errDiv){ errDiv.textContent = msg; errDiv.style.display = 'block'; }
          showEmpToast(msg, 'error');
        }
      } catch (e) {
        const msg = 'حدث خطأ: ' + (e.message || String(e));
        if(errDiv){ errDiv.textContent = msg; errDiv.style.display = 'block'; }
        showEmpToast(msg, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '✓ حفظ التعديلات';
      }
    };
  }
})();
