const tbody = document.getElementById('tbody');

function showNotice(icon, title, text){
  return window.Swal.fire({
    icon,
    title,
    text: String(text || ''),
    confirmButtonText: 'حسنًا',
    confirmButtonColor: icon === 'error' ? '#dc2626' : '#0f766e',
  });
}

function showSendingNotice(){
  return window.Swal.fire({
    title: 'جاري إرسال إشعار الدائن',
    text: 'يرجى الانتظار أثناء الاتصال بهيئة الزكاة والضريبة والجمارك.',
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => window.Swal.showLoading(),
  });
}

function formatZatcaResponse(raw){
  if(typeof raw !== 'string') return JSON.stringify(raw || {}, null, 2);
  try{
    return JSON.stringify(JSON.parse(raw), null, 2);
  }catch(_){
    return raw;
  }
}

function showZatcaResponseNotice(raw){
  return window.Swal.fire({
    icon: 'info',
    title: 'تفاصيل رد هيئة الزكاة',
    text: formatZatcaResponse(raw),
    width: 760,
    confirmButtonText: 'إغلاق',
    confirmButtonColor: '#2563eb',
    customClass: { htmlContainer: 'zatca-response-text' },
  });
}

let __perms = new Set();
(async()=>{ try{ const u=JSON.parse(localStorage.getItem('pos_user')||'null'); if(u&&u.id){ const r=await window.api.perms_get_for_user(u.id); if(r&&r.ok){ __perms=new Set(r.keys||[]); } } }catch(_){ __perms=new Set(); } })();
function canCN(k){ return __perms.has('credit_notes') && __perms.has(k); }
const q = document.getElementById('q');
const q2 = document.getElementById('q2');
const dateFrom = document.getElementById('dateFrom');
const dateTo = document.getElementById('dateTo');

function fmtDate(s){
  try{
    return new Intl.DateTimeFormat('en-GB-u-ca-gregory', {
      year:'numeric', month:'2-digit', day:'2-digit', hour:'numeric', minute:'2-digit', hour12:true
    }).format(new Date(s));
  }catch(_){ return s; }
}

async function submitCreditNoteByActiveMode(saleId){
  const status = await window.electronAPI.zatcaDirect.getStatus();
  if(!status || status.success !== true){
    throw new Error(status?.message || 'تعذر تحديد وضع الربط الإلكتروني');
  }
  if(status.mode === 'direct'){
    return window.electronAPI.zatcaDirect.submitCreditNote(saleId);
  }
  if(status.mode === 'legacy'){
    return window.electronAPI.localZatca.submitBySaleId(saleId);
  }
  throw new Error('الربط الإلكتروني غير مفعّل على هذا الجهاز');
}

let __all = [];
let __page = 1;
let __pageSize = 20;
let __defPrintFormat = 'thermal';
let __zatcaEnabled = false;
(async ()=>{ 
  try{ 
    const s=await window.api.settings_get(); 
    if(s&&s.ok){ 
      __defPrintFormat = (s.item?.default_print_format==='a4') ? 'a4' : 'thermal'; 
      __zatcaEnabled = !!(s.item?.zatca_enabled);
    } 
  }catch(_){ } 
})();

function paged(items){ if(!__pageSize||__pageSize<=0) return items; const s=(__page-1)*__pageSize; return items.slice(s,s+__pageSize); }
function renderPager(total){
  const top=document.getElementById('pagerTop'); const bottom=document.getElementById('pagerBottom');
  const pages = (__pageSize && __pageSize>0) ? Math.max(1, Math.ceil(total/ __pageSize)) : 1;
  const btn=(l,d,g)=>`<button class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium ${d?'opacity-50 cursor-not-allowed':''}" ${d?'disabled':''} data-go="${g}">${l}</button>`;
  const html=[btn('⏮️',__page<=1,'first'),btn('◀️',__page<=1,'prev'),`<span class="text-gray-600 font-medium">صفحة ${__page} من ${pages}</span>`,btn('▶️',__page>=pages,'next'),btn('⏭️',__page>=pages,'last')].join(' ');
  if(top) top.innerHTML=html; if(bottom) bottom.innerHTML=html;
  const onClick=(e)=>{ const b=e.target.closest('button'); if(!b) return; const act=b.getAttribute('data-go'); if(act==='first') __page=1; if(act==='prev') __page=Math.max(1,__page-1); if(act==='next') __page=Math.min(pages,__page+1); if(act==='last') __page=pages; renderRows(__all); };
  if(top) top.onclick = onClick; if(bottom) bottom.onclick = onClick;
}

function renderRows(list){
  tbody.innerHTML='';
  const items = paged(list);
  items.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-100';
    const rejected = row.zatca_status==='rejected';
    const sent = !rejected && (row.zatca_status==='submitted'||row.zatca_status==='accepted'||row.zatca_submitted);
    const label = sent ? '✅ تم الإرسال' : '📤 إرسال للهيئة';
    const dis = sent ? 'disabled' : '';
    const tipSrc = row.zatca_rejection_reason || row.zatca_response || '';
    const title = tipSrc ? `title="${String(tipSrc).replace(/"/g,'&quot;')}`.slice(0, 2048) + '"' : '';
    const failBadge = rejected ? `<span class="text-red-600 mx-1">❌ فشل الإرسال</span>` : '';
    const viewBtn = (row.zatca_response||row.zatca_rejection_reason) ? `<button class="px-3 py-1.5 bg-slate-600 text-white rounded-lg text-xs font-medium" data-act="show_zresp" data-id="${row.id}">📄 رد الهيئة</button>` : '';
    tr.innerHTML = `
      <td class="px-4 py-3">${((__page-1)*(__pageSize||list.length))+i+1}</td>
      <td class="px-4 py-3 font-semibold text-blue-600">${row.invoice_no}</td>
      <td class="px-4 py-3">${row.ref_base_invoice_no || ''}</td>
      <td class="px-4 py-3">${row.customer_name || ''}</td>
      <td class="px-4 py-3">${row.customer_phone || ''}</td>
      <td class="px-4 py-3 font-bold text-green-600">${Math.abs(Number(row.grand_total||0)).toFixed(2)}</td>
      <td class="px-4 py-3">${fmtDate(row.created_at)}</td>
      <td class="px-4 py-3">
        <div class="flex gap-2 flex-wrap justify-center">
          ${canCN('credit_notes.view') ? `<button class="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium" data-act="view-cn" data-id="${row.id}">عرض الإشعار</button>` : ''}
          ${row.ref_base_sale_id && canCN('credit_notes.view_base') ? `<button class="px-3 py-1.5 bg-slate-600 text-white rounded-lg text-xs font-medium" data-act="view-base" data-base="${row.ref_base_sale_id}">عرض الفاتورة</button>` : ''}
          ${(canCN('credit_notes.view') && __zatcaEnabled) ? `${failBadge}<button class="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium ${sent?'opacity-50 cursor-not-allowed':''}" ${dis} data-act="send" data-id="${row.id}" ${title}>${label}</button> ${viewBtn}` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if(!tbody.__inited){ tbody.addEventListener('click', onTableAction); tbody.__inited = true; }
  renderPager(list.length);
}

function onTableAction(e){
  const b = e.target.closest('button'); if(!b) return;
  const act = b.getAttribute('data-act');
  if(act === 'view-cn'){
    if(!canCN('credit_notes.view')) return;
    const id = Number(b.getAttribute('data-id'));
    const page = (__defPrintFormat === 'a4') ? 'print-a4.html' : 'print.html';
    // For credit note print: include base parameters for proper labeling
    const row = __all.find(x=>Number(x.id)===id) || {};
    // إضافة refresh=1 لضمان تحميل البيانات المحدثة وعرض تاريخ الدفع
    const params = new URLSearchParams({ id: String(id), pay: 'refund', base: String(row.ref_base_sale_id||''), base_no: String(row.ref_base_invoice_no||''), refresh: '1' });
    const url = `../sales/${page}?${params.toString()}`;
    const w = (__defPrintFormat === 'a4') ? 900 : 500;
    const h = (__defPrintFormat === 'a4') ? 1000 : 700;
    window.open(url, 'PRINT_VIEW', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
  }
  if(act === 'view-base'){
    if(!canCN('credit_notes.view_base')) return;
    const baseId = Number(b.getAttribute('data-base'));
    const page = (__defPrintFormat === 'a4') ? 'print-a4.html' : 'print.html';
    // إضافة refresh=1 لضمان تحميل البيانات المحدثة وعرض تاريخ الدفع
    const url = `../sales/${page}?id=${baseId}&refresh=1&hide_pay_remain=1`;
    const w = (__defPrintFormat === 'a4') ? 900 : 500;
    const h = (__defPrintFormat === 'a4') ? 1000 : 700;
    window.open(url, 'PRINT_VIEW', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
  }
  if(act === 'send'){
    const id = Number(b.getAttribute('data-id'));
    const old = b.textContent; b.disabled = true; b.textContent = '⏳ جاري الإرسال...'; 
    showSendingNotice();
    (async()=>{
      try{
        const resp = await submitCreditNoteByActiveMode(id);
        const rawResponse = resp?.data;
        const responseText = (typeof rawResponse==='string') ? rawResponse : JSON.stringify(rawResponse||'');
        const parsedResponse = (()=>{ try{ return (typeof rawResponse==='string')? JSON.parse(rawResponse) : rawResponse; }catch(_){ return null; } })();
        const notReported = /NOT[_\s-]?REPORTED/i.test(responseText) || (parsedResponse && (parsedResponse.statusCode==='NOT_REPORTED' || parsedResponse.status==='NOT_REPORTED' || parsedResponse?.data?.status==='NOT_REPORTED'));
        if(resp && resp.success && !notReported){
          window.Swal.close();
          showNotice('success', 'تم الإرسال بنجاح', 'تم إرسال إشعار الدائن إلى الهيئة بنجاح.');
        }else{
          const failureMessage = resp?.message || responseText || 'غير معروف';
          window.Swal.close();
          showNotice('error', 'فشل إرسال إشعار الدائن', failureMessage);
        }
        await load();
      }catch(e){
        const failureMessage = e?.message || String(e);
        window.Swal.close();
        showNotice('error', 'تعذر إرسال إشعار الدائن', failureMessage);
      }finally{
        try{ b.disabled = false; b.textContent = old; }catch(_){ }
      }
    })();
  }
  if(act === 'show_zresp'){
    const id = Number(b.getAttribute('data-id'));
    const row = __all.find(x=>Number(x.id)===id);
    if(row){
      const resp = row.zatca_response || row.zatca_rejection_reason || '';
      showZatcaResponseNotice(resp);
    }
  }
}

async function load(){
  // إعادة تحميل إعدادات ZATCA لتحديث حالة الأزرار
  try{
    const s = await window.api.settings_get();
    if(s && s.ok && s.item){
      __zatcaEnabled = !!(s.item.zatca_enabled);
    }
  }catch(_){ }
  
  const query = { type: 'credit' };
  const v1 = (q.value||'').trim();
  const v2 = (q2.value||'').trim();
  if(v1){ query.q = v1; }
  if(v2){ query.customer_q = v2; }
  const df = (dateFrom.value||'').trim();
  const dt = (dateTo.value||'').trim();
  if(df){ query.date_from = df.replace('T',' ') + (df.length===16 ? ':00' : ''); }
  if(dt){ query.date_to = dt.replace('T',' ') + (dt.length===16 ? ':59' : ''); }
  __page = 1;
  try{
    const response = await window.api.sales_list(query);
    if(!response || !response.ok){
      throw new Error(response?.error || 'حدث خطأ أثناء تحميل البيانات');
    }
    // keep only credit notes in case backend filter not applied in older schema
    __all = (response.items||[]).filter(x => String(x.doc_type||'')==='credit_note');
    renderRows(__all);
  }catch(error){
    await showNotice('error', 'تعذر تحميل الإشعارات الدائنة', error?.message || String(error));
  }
}

(function(){ let t=null; const trigger=()=>{ clearTimeout(t); t=setTimeout(()=>load(), 250); }; q.addEventListener('input', trigger); q2.addEventListener('input', trigger); })();

// زر تطبيق التاريخ
const applyBtn = document.getElementById('applyBtn');
if(applyBtn){ applyBtn.addEventListener('click', ()=>{ load(); }); }

const pageSizeSel = document.getElementById('pageSize');
if(pageSizeSel){ pageSizeSel.addEventListener('change', ()=>{ __pageSize = Number(pageSizeSel.value||20); __page = 1; renderRows(__all); }); }

const btnBack = document.getElementById('btnBack');
if(btnBack){ btnBack.onclick = ()=>{ history.back(); }; }

load();
