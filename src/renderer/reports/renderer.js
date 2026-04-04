function translateReportsUI(isAr){
  const t = isAr ? {
    pageTitle: '📊 التقارير',
    backBtn: '⬅ العودة',
    dailyReportTitle: 'التقرير اليومي',
    dailyReportDesc: 'عرض تقرير اليوم اعتمادًا على ساعة الإقفال',
    periodReportTitle: 'تقرير الفترة',
    periodReportDesc: 'اختر تاريخ ووقت من — إلى لعرض التقرير',
    allInvoicesTitle: 'تقرير جميع الفواتير',
    allInvoicesDesc: 'جلب كل الفواتير لفترة من — إلى مع الإجماليات',
    purchasesTitle: 'تقرير المصروفات',
    purchasesDesc: 'حدد الفترة من — إلى لعرض مصروفاتك مع الإجماليات',
    customerInvoicesTitle: 'تقرير العملاء',
    customerInvoicesDesc: 'فواتير عميل محدد لفترة من — إلى مع الإجماليات',
    creditInvoicesTitle: 'تقرير الفواتير الدائنة',
    creditInvoicesDesc: 'يعرض فواتير الآجل غير المسددة للفترة المحددة',
    unpaidInvoicesTitle: 'تقرير الفواتير غير مدفوعة',
    unpaidInvoicesDesc: 'جلب الفواتير غير المدفوعة للفترة من — إلى',
    typesTitle: 'تقرير الأنواع',
    typesDesc: 'تجميع المبيعات حسب الأنواع للفترة من — إلى',
    purchaseInvoicesTitle: 'تقرير فواتير الشراء',
    purchaseInvoicesDesc: 'عرض فواتير الشراء من الموردين للفترة المحددة',
    customerStatementTitle: 'كشف حساب عميل',
    customerStatementDesc: 'عرض بيانات العميل والفواتير مع الإجماليات للفترة',
    supplierStatementTitle: 'كشف حساب مورد',
    supplierStatementDesc: 'عرض فواتير الشراء وسندات الصرف للمورد خلال الفترة',
    employeeReportTitle: 'تقرير الموظفين',
    employeeReportDesc: 'فواتير وسندات موظف محدد لفترة من — إلى مع الإجماليات',
    expiryReportTitle: 'تقرير صلاحية المنتجات',
    expiryReportDesc: 'عرض المنتجات حسب تاريخ الصلاحية المحدد',
    inventoryReportTitle: 'تقرير الجرد',
    inventoryReportDesc: 'الأصناف مع الكمية المباعة والكمية الحالية للفترة من — إلى'
  } : {
    pageTitle: '📊 Reports',
    backBtn: '⬅ Back',
    dailyReportTitle: 'Daily report',
    dailyReportDesc: 'View today\'s report based on closing time',
    periodReportTitle: 'Period report',
    periodReportDesc: 'Select period to view purchases with totals',
    allInvoicesTitle: 'All invoices report',
    allInvoicesDesc: 'Fetch all invoices for a period with totals',
    purchasesTitle: 'Purchases report',
    purchasesDesc: 'Select period to view purchases with totals',
    customerInvoicesTitle: 'Customer invoices report',
    customerInvoicesDesc: 'Invoices for a specific customer with totals',
    creditInvoicesTitle: 'Credit invoices report',
    creditInvoicesDesc: 'Shows unpaid credit invoices for the period',
    unpaidInvoicesTitle: 'Unpaid invoices report',
    unpaidInvoicesDesc: 'Fetch unpaid invoices for the period',
    typesTitle: 'Types report',
    typesDesc: 'Aggregate sales by types for the period',
    purchaseInvoicesTitle: 'Purchase invoices report',
    purchaseInvoicesDesc: 'View purchase invoices from suppliers for the period',
    customerStatementTitle: 'Customer statement',
    customerStatementDesc: 'View customer details and invoices with totals for the period',
    supplierStatementTitle: 'Supplier statement',
    supplierStatementDesc: 'View purchase invoices and payment vouchers for supplier during period',
    employeeReportTitle: 'Employee report',
    employeeReportDesc: 'Invoices and vouchers for a specific employee with totals',
    expiryReportTitle: 'Products expiry report',
    expiryReportDesc: 'View products by specified expiry date',
    inventoryReportTitle: 'Inventory report',
    inventoryReportDesc: 'Products with sold qty and current stock for the selected period'
  };
  
  try{
    const pageTitle = document.querySelector('header .text-xl');
    if(pageTitle) pageTitle.textContent = t.pageTitle;
    
    const btnBack = document.getElementById('btnBack');
    if(btnBack) btnBack.textContent = t.backBtn;
    
    const updateCard = (cardId, titleKey, descKey) => {
      const card = document.getElementById(cardId);
      if(card){
        const h3 = card.querySelector('h3');
        const p = card.querySelector('p');
        if(h3) h3.textContent = t[titleKey];
        if(p) p.textContent = t[descKey];
      }
    };
    
    updateCard('dailyReport', 'dailyReportTitle', 'dailyReportDesc');
    updateCard('periodReport', 'periodReportTitle', 'periodReportDesc');
    updateCard('allInvoicesReport', 'allInvoicesTitle', 'allInvoicesDesc');
    updateCard('purchasesReport', 'purchasesTitle', 'purchasesDesc');
    updateCard('customerInvoicesReport', 'customerInvoicesTitle', 'customerInvoicesDesc');
    updateCard('creditInvoicesReport', 'creditInvoicesTitle', 'creditInvoicesDesc');
    updateCard('unpaidInvoicesReport', 'unpaidInvoicesTitle', 'unpaidInvoicesDesc');
    updateCard('typesReport', 'typesTitle', 'typesDesc');
    updateCard('purchaseInvoicesReport', 'purchaseInvoicesTitle', 'purchaseInvoicesDesc');
    updateCard('customerStatementReport', 'customerStatementTitle', 'customerStatementDesc');
    updateCard('supplierStatementReport', 'supplierStatementTitle', 'supplierStatementDesc');
    updateCard('employeeReport', 'employeeReportTitle', 'employeeReportDesc');
    updateCard('expiryReport', 'expiryReportTitle', 'expiryReportDesc');
    updateCard('inventoryReport', 'inventoryReportTitle', 'inventoryReportDesc');
  }catch(_){}
}

(async function initReportsLocale(){
  try{
    const r = await window.api.app_get_locale();
    const lang = (r && r.lang) || 'ar';
    const isAr = lang === 'ar';
    document.documentElement.lang = isAr ? 'ar' : 'en';
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    translateReportsUI(isAr);
  }catch(_){
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    translateReportsUI(true);
  }
  try{
    window.api.app_on_locale_changed((L)=>{
      const isAr = L === 'ar';
      document.documentElement.lang = isAr ? 'ar' : 'en';
      document.documentElement.dir = isAr ? 'rtl' : 'ltr';
      translateReportsUI(isAr);
    });
  }catch(_){}
})();

const btnBack = document.getElementById('btnBack');
if(btnBack){ btnBack.onclick = ()=>{ window.location.href = '../main/index.html'; } }

// Fetch permissions from DB and hide cards not allowed
let __keys = new Set();
async function loadPerms(){
  try{
    const u = JSON.parse(localStorage.getItem('pos_user')||'null');
    if(!u || !u.id) return;
    const r = await window.api.perms_get_for_user(u.id);
    if(r && r.ok){ __keys = new Set(r.keys||[]); }
  }catch(_){ __keys = new Set(); }
}
function canReport(k){ return __keys.has('reports') && __keys.has(k); }
function hide(id){ const el=document.getElementById(id); if(el){ el.classList.add('hidden'); el.style.display='none'; } }
(async ()=>{
  await loadPerms();
  if(!canReport('reports.view_daily')) hide('dailyReport');
  if(!canReport('reports.view_period')) hide('periodReport');
  if(!canReport('reports.view_all_invoices')) hide('allInvoicesReport');
  if(!canReport('reports.view_purchases')) hide('purchasesReport');
  if(!canReport('reports.view_customer_invoices')) hide('customerInvoicesReport');
  if(!canReport('reports.view_credit_invoices')) hide('creditInvoicesReport');
  if(!canReport('reports.view_unpaid_invoices')) hide('unpaidInvoicesReport');
  if(!canReport('reports.view_types')) hide('typesReport');
  if(!canReport('reports.view_purchase_invoices')) hide('purchaseInvoicesReport');
  if(!canReport('reports.view_customer_statement')) hide('customerStatementReport');
  if(!canReport('reports.view_supplier_statement')) hide('supplierStatementReport');
  if(!canReport('reports.view_expiry')) hide('expiryReport');
  if(!canReport('reports.view_inventory')) hide('inventoryReport');
})();

const dailyCard = document.getElementById('dailyReport');
if(dailyCard){ dailyCard.onclick = ()=>{ window.location.href = './daily.html'; } }

const periodCard = document.getElementById('periodReport');
if(periodCard){ periodCard.onclick = ()=>{ window.location.href = './period.html'; } }

const allInvCard = document.getElementById('allInvoicesReport');
if(allInvCard){ allInvCard.onclick = ()=>{ window.location.href = './all_invoices.html'; } }

const purchasesCard = document.getElementById('purchasesReport');
if(purchasesCard){ purchasesCard.onclick = ()=>{ window.location.href = './purchases.html'; } }

const custInvCard = document.getElementById('customerInvoicesReport');
if(custInvCard){ custInvCard.onclick = ()=>{ window.location.href = './customer_invoices.html'; } }

const creditInvCard = document.getElementById('creditInvoicesReport');
if(creditInvCard){ creditInvCard.onclick = ()=>{ window.location.href = './credit_invoices.html'; } }

const unpaidInvCard = document.getElementById('unpaidInvoicesReport');
if(unpaidInvCard){ unpaidInvCard.onclick = ()=>{ window.location.href = './unpaid_invoices.html'; } }

const typesCard = document.getElementById('typesReport');
if(typesCard){ typesCard.onclick = ()=>{ window.location.href = './types.html'; } }

const purchaseInvCard = document.getElementById('purchaseInvoicesReport');
if(purchaseInvCard){ purchaseInvCard.onclick = ()=>{ window.location.href = './purchase_invoices_report.html'; } }

const custStatementCard = document.getElementById('customerStatementReport');
if(custStatementCard){ custStatementCard.onclick = ()=>{ window.location.href = './customer_statement.html'; } }

const supplierStatementCard = document.getElementById('supplierStatementReport');
if(supplierStatementCard){ supplierStatementCard.onclick = ()=>{ window.location.href = './supplier_statement.html'; } }

const employeeReportCard = document.getElementById('employeeReport');
if(employeeReportCard){ employeeReportCard.onclick = ()=>{ window.location.href = './employee_report.html'; } }

const expiryReportCard = document.getElementById('expiryReport');
if(expiryReportCard){ expiryReportCard.onclick = ()=>{ window.location.href = './expiry_report.html'; } }

const inventoryReportCard = document.getElementById('inventoryReport');
if(inventoryReportCard){ inventoryReportCard.onclick = ()=>{ window.location.href = './inventory_report.html'; } }
