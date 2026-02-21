// Invoices list: load and show basic info

// Permissions (align with main logic): hide actions if not granted
let __perms = new Set();
(async()=>{ try{ const u=JSON.parse(localStorage.getItem('pos_user')||'null'); if(u&&u.id){ const r=await window.api.perms_get_for_user(u.id); if(r&&r.ok){ __perms = new Set(r.keys||[]); } } }catch(_){ __perms = new Set(); } })();
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
// Load print format and ZATCA enabled from settings
(async()=>{
  try{
    const r = await window.api.settings_get();
    if(r && r.ok && r.item){
      __defPrintFormat = (r.item.default_print_format === 'a4') ? 'a4' : 'thermal';
      __zatcaEnabled = !!(r.item.zatca_enabled);
    }
  }catch(_){ /* ignore */ }
})();

function renderInvPager(){
  const top=document.getElementById('pagerTop'); const bottom=document.getElementById('pagerBottom');
  const pages = (__invPageSize > 0) ? Math.max(1, Math.ceil(__totalInvoices / __invPageSize)) : 1;
  const btn=(l,d,g)=>`<button class="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium" ${d?'disabled':''} data-go="${g}">${l}</button>`;
  const html=[btn('⏮️',__invPage<=1,'first'),btn('◀️',__invPage<=1,'prev'),`<span class="text-gray-600 font-medium px-2">صفحة ${__invPage} من ${pages} (إجمالي: ${__totalInvoices})</span>`,btn('▶️',__invPage>=pages,'next'),btn('⏭️',__invPage>=pages,'last')].join(' ');
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
  tbody.innerHTML='';
  list.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-100 last:border-b-0';
    const zatcaStatusCell = (() => {
      if(!__zatcaEnabled) return '<td class="px-4 py-3 text-center text-gray-400 text-sm">غير مفعل</td>';
      const rejected = row.zatca_status==='rejected';
      const sent = !rejected && (row.zatca_status==='submitted'||row.zatca_status==='accepted'||row.zatca_submitted);
      if(sent) return '<td class="px-4 py-3 text-center"><span class="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-bold">✅ تم الإرسال</span></td>';
      if(rejected) return '<td class="px-4 py-3 text-center"><span class="inline-block px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-bold">❌ فشل</span></td>';
      return '<td class="px-4 py-3 text-center"><span class="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-bold">⏳ لم يتم الإرسال</span></td>';
    })();
    tr.innerHTML = `
      <td class="px-4 py-3 text-gray-900 font-semibold">${row.invoice_no}</td>
      <td class="px-4 py-3 text-gray-700">${row.disp_customer_name || ''}</td>
      <td class="px-4 py-3 text-gray-700">${row.disp_customer_phone || ''}</td>
      <td class="px-4 py-3"><span class="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">${(() => { const L={cash:'كاش',card:'شبكة',credit:'آجل',mixed:'مختلط',tamara:'تمارا',tabby:'تابي'}; const k=String(row.payment_method||'').toLowerCase(); return L[k] || (row.payment_method||''); })()}</span></td>
      <td class="px-4 py-3 text-gray-900 font-bold">${Number(row.grand_total).toFixed(2)}</td>
      <td class="px-4 py-3 text-gray-600 text-sm">${fmtDate(row.created_at)}</td>
      ${zatcaStatusCell}
      <td class="px-4 py-3">
        <div class="flex flex-wrap gap-2 items-center">
          ${hasInvoice('invoices.view') ? `<button class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium" data-act="view" data-id="${row.id}">عرض الفاتورة</button>` : ''}
          ${(hasInvoice('invoices.view') && __zatcaEnabled) ? (()=>{ const rejected = row.zatca_status==='rejected'; const sent = !rejected && (row.zatca_status==='submitted'||row.zatca_status==='accepted'||row.zatca_submitted); const sendBtn = sent ? '' : `<button class=\"px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium\" data-act=\"send\" data-id=\"${row.id}\">📤 إرسال للهيئة</button>`; const viewBtn = (row.zatca_response||row.zatca_rejection_reason) ? `<button class=\"px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium\" data-act=\"show_zresp\" data-id=\"${row.id}\">📄 رد الهيئة</button>` : ''; return `${sendBtn} ${viewBtn}`; })() : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
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
    const params = new URLSearchParams({ id: String(id), ...(method?{pay:method}:{}) , ...(cash?{cash:String(cash)}:{}), refresh: '1', reprint: '1' });
    const url = `../sales/${page}?${params.toString()}`;
    const w = (__defPrintFormat === 'a4') ? 900 : 500;
    const h = (__defPrintFormat === 'a4') ? 1000 : 700;
    window.open(url, 'PRINT_VIEW', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
  }
  if(act==='send'){
    const id = Number(b.getAttribute('data-id'));
    const oldLabel = b.textContent;
    b.disabled = true; b.textContent = '⏳ جاري الإرسال...'; b.className = 'px-3 py-1.5 bg-gray-400 text-white rounded-lg text-sm font-medium cursor-wait'; setError('⏳ جاري الإرسال...');
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
          setError('✅ تم الإرسال بنجاح');
          // عرض رد الهيئة تلقائياً في نافذة منبثقة صغيرة
          try{ showZatcaResponseModal(raw || msg); }catch(_){ }
        } else {
          const msg = resp?.message || asStr || 'غير معروف';
          setError('❌ فشل الإرسال');
          // عرض رد الهيئة/الرسالة تلقائياً في نفس النافذة المنبثقة
          try{ showZatcaResponseModal(msg); }catch(_){ }
        }
        // Refresh list to reflect status/tooltip/button state
        await load(false);
      }catch(e){
        const emsg = (e?.message || String(e));
        setError('❌ تعذر الإرسال: ' + emsg);
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
  // إعادة تحميل إعدادات ZATCA والانتظار حتى اكتمالها قبل رسم الصفوف
  try{ const r = await window.api.settings_get(); if(r&&r.ok&&r.item){ __zatcaEnabled=!!(r.item.zatca_enabled); __defPrintFormat=(r.item.default_print_format==='a4')?'a4':'thermal'; } }catch(_){}

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
  if(!r.ok){ setError(r.error || 'تعذر تحميل الفواتير'); return; }
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