// Sales screen: scan by barcode or pick from catalog, compute totals w/ VAT and currency settings
// Language support: apply locale to html element
function getPaymentMethodLabel(method, isAr){
  const labels = {
    cash: isAr ? 'كاش' : 'Cash',
    card: isAr ? 'شبكة' : 'Card',
    credit: isAr ? 'آجل' : 'Credit',
    mixed: isAr ? 'مختلط' : 'Mixed',
    tamara: isAr ? 'تمارا' : 'Tamara',
    tabby: isAr ? 'تابي' : 'Tabby'
  };
  return labels[method] || method;
}

function getDiscountLabel(type, value, isAr){
  if(type === 'percent'){
    return isAr ? `خصم ${Math.round(Number(value))}%` : `${Math.round(Number(value))}% off`;
  } else if(type === 'amount'){
    return isAr ? 'خصم نقدي' : 'Cash discount';
  } else if(type === 'coupon'){
    return isAr ? (value || 'كوبون') : (value || 'Coupon');
  } else if(type === 'offer'){
    return isAr ? 'خصم عرض' : 'Offer discount';
  }
  return isAr ? 'خصم' : 'Discount';
}

function translateUI(isAr){
  const t = isAr ? {
    subtotalLabel: 'قبل الضريبة',
    vatLabel: 'ض.القيمة المضافة',
    grandTotalLabel: 'الإجمالي',
    extraLabel: 'إضافى',
    discountLabel: 'خصم',
    afterDiscountLabel: 'بعد الخصم',
    tobaccoFeeLabel: 'رسوم تبغ',
    paymentMethodLabel: '💰 طريقة الدفع',
    amountPaidLabel: '💵 المبلغ المدفوع',
    extraValueLabel: '➕ الإضافى',
    discountTypeLabel: '🏷️ نوع الخصم',
    discountValueLabel: '💲 قيمة الخصم',
    couponLabel: '🎟️ كوبون',
    customerLabel: '👤 العميل',
    driverLabel: '🚗 السائق',
    notesLabel: '📝 ملاحظات',
    customerPlaceholder: 'اختر عميلًا',
    couponPlaceholder: 'الكوبون',
    addCustomerBtn: '➕ عميل',
    noDriver: 'بدون سائق',
    noDiscount: 'بدون خصم',
    discountPercent: 'خصم %',
    discountAmount: 'خصم نقدي',
    notesPlaceholder: 'ملاحظاتك...',
    holdBtn: '⏸️ تعليق',
    holdBtnTitle: 'تعليق الفاتورة',
    heldInvoicesBtn: '📋 المعلقة',
    heldInvoicesBtnTitle: 'عرض الفواتير المعلقة',
    heldInvoicesSearchPlaceholder: '🔍 ابحث برقم أو اسم العميل',
    processBtn: 'معالجة',
    partialBtn: 'جزئية',
    fullBtn: 'كاملة',
    clearBtn: '🗑️ تفريغ',
    invoiceNoPlaceholder: 'رقم الفاتورة',
    productTh: 'المنتج',
    operationTh: 'العملية',
    priceTh: 'السعر',
    qtyTh: 'الكمية',
    totalTh: 'الإجمالي',
    barcodePlaceholder: '📦 باركود',
    searchNamePlaceholder: '🔍 ابحث بالاسم',
    printInvoiceBtn: '🧾 طباعة الفاتورة',
    quotationBtn: '📄 عرض السعر',
    addCustomerModalTitle: '➕ إضافة عميل جديد',
    customerNameLabel: '👤 اسم العميل الكامل',
    customerNamePlaceholder: 'أدخل اسم العميل...',
    phoneLabel: '📱 رقم الجوال',
    phonePlaceholder: 'مثال: 0501234567',
    emailLabel: '📧 البريد الإلكتروني',
    emailPlaceholder: 'مثال: customer@example.com',
    addressLabel: '📍 العنوان',
    addressPlaceholder: 'أدخل عنوان العميل...',
    vatNumberLabel: '🏢 الرقم الضريبي (اختياري)',
    vatNumberPlaceholder: 'مثال: 300123456700003',
    crNumberLabel: '🧾 رقم السجل التجاري (اختياري)',
    crNumberPlaceholder: 'مثال: 1010123456',
    nationalAddressLabel: '🏠 العنوان الوطني (اختياري)',
    nationalAddressPlaceholder: 'مثال: 1234-حي-مدينة-رمز بريدي',
    additionalNotesLabel: '📝 ملاحظات إضافية',
    additionalNotesPlaceholder: 'أي ملاحظات خاصة بالعميل...',
    cancelBtn: '❌ إلغاء',
    saveBtn: '✅ حفظ البيانات'
  } : {
    subtotalLabel: 'Subtotal (before VAT)',
    vatLabel: 'VAT',
    grandTotalLabel: 'Grand total (incl. VAT)',
    extraLabel: 'Extra',
    discountLabel: 'Discount',
    afterDiscountLabel: 'After discount',
    tobaccoFeeLabel: 'Tobacco fee',
    paymentMethodLabel: '💰 Payment method',
    amountPaidLabel: '💵 Amount paid',
    extraValueLabel: '➕ Extra',
    discountTypeLabel: '🏷️ Discount type',
    discountValueLabel: '💲 Discount value',
    couponLabel: '🎟️ Coupon',
    customerLabel: '👤 Customer',
    driverLabel: '🚗 Driver',
    notesLabel: '📝 Notes',
    customerPlaceholder: 'Choose customer',
    couponPlaceholder: 'Coupon',
    addCustomerBtn: '➕ Add',
    noDriver: 'No driver',
    noDiscount: 'No discount',
    discountPercent: 'Discount %',
    discountAmount: 'Cash discount',
    notesPlaceholder: 'Your notes...',
    holdBtn: '⏸️ Hold',
    holdBtnTitle: 'Hold invoice',
    heldInvoicesBtn: '📋 Held',
    heldInvoicesBtnTitle: 'Show held invoices',
    heldInvoicesSearchPlaceholder: '🔍 Search by customer ID or name',
    processBtn: 'Process',
    partialBtn: 'Partial',
    fullBtn: 'Full',
    clearBtn: '🗑️ Clear',
    invoiceNoPlaceholder: 'Invoice no.',
    productTh: 'Product',
    operationTh: 'Operation',
    priceTh: 'Price',
    qtyTh: 'Qty',
    totalTh: 'Total',
    barcodePlaceholder: '📦 Barcode',
    searchNamePlaceholder: '🔍 Search by name',
    printInvoiceBtn: '🧾 Print invoice',
    quotationBtn: '📄 Quotation',
    addCustomerModalTitle: '➕ Add new customer',
    customerNameLabel: '👤 Customer',
    customerNamePlaceholder: 'Enter customer name...',
    phoneLabel: '📱 Phone',
    phonePlaceholder: 'E.g.: 0501234567',
    emailLabel: '📧 Email',
    emailPlaceholder: 'E.g.: customer@example.com',
    addressLabel: '📍 Address',
    addressPlaceholder: 'Enter customer address...',
    vatNumberLabel: '🏢 VAT Number (optional)',
    vatNumberPlaceholder: 'E.g.: 300123456700003',
    crNumberLabel: '🧾 CR Number (optional)',
    crNumberPlaceholder: 'E.g.: 1010123456',
    nationalAddressLabel: '🏠 National Address (optional)',
    nationalAddressPlaceholder: 'E.g.: 1234-district-city-postal',
    additionalNotesLabel: '📝 Notes',
    additionalNotesPlaceholder: 'Any notes about customer...',
    cancelBtn: '❌ Cancel',
    saveBtn: '✅ Save data'
  };
  
  try{
    const labels = document.querySelectorAll('label');
    labels.forEach(label=>{
      const text = label.textContent.trim();
      if(text.includes('طريقة الدفع') || text.includes('Payment method')) label.textContent = t.paymentMethodLabel;
      else if(text.includes('المبلغ المدفوع') || text.includes('Amount paid')) label.textContent = t.amountPaidLabel;
      else if(text.includes('الإضافى') || text.includes('Extra')) label.textContent = t.extraValueLabel;
      else if(text.includes('نوع الخصم') || text.includes('Discount type')) label.textContent = t.discountTypeLabel;
      else if(text.includes('قيمة الخصم') || text.includes('Discount value')) label.textContent = t.discountValueLabel;
      else if(text.includes('كوبون') || text.includes('Coupon')) label.textContent = t.couponLabel;
      else if(text.includes('العميل') || text.includes('Customer')) label.textContent = t.customerLabel;
      else if(text.includes('السائق') || text.includes('Driver')) label.textContent = t.driverLabel;
      else if(text.includes('ملاحظات') || text.includes('Notes')) label.textContent = t.notesLabel;
    });
    
    const subtotalLabelEl = document.getElementById('subtotalLabel');
    if(subtotalLabelEl) subtotalLabelEl.textContent = t.subtotalLabel;
    
    const vatLabelEl = document.getElementById('vatLabel');
    if(vatLabelEl) vatLabelEl.textContent = t.vatLabel;
    
    const grandTotalLabelEl = document.getElementById('grandTotalLabel');
    if(grandTotalLabelEl) grandTotalLabelEl.textContent = t.grandTotalLabel;
    
    const extraLabelEl = document.getElementById('extraLabel');
    if(extraLabelEl) extraLabelEl.textContent = t.extraLabel;
    
    const afterDiscountLabelEl = document.getElementById('afterDiscountLabel');
    if(afterDiscountLabelEl) afterDiscountLabelEl.textContent = t.afterDiscountLabel;
    
    const tobaccoFeeLabelEl = document.getElementById('tobaccoFeeLabel');
    if(tobaccoFeeLabelEl) tobaccoFeeLabelEl.textContent = t.tobaccoFeeLabel;
    
    const discountLabelEl = document.getElementById('discountLabel');
    if(discountLabelEl && (discountLabelEl.textContent.includes('خصم') || discountLabelEl.textContent.includes('Discount'))) {
      discountLabelEl.textContent = t.discountLabel;
    }
    
    const customerSearchEl = document.getElementById('customerSearch');
    if(customerSearchEl) customerSearchEl.placeholder = t.customerPlaceholder;
    
    const couponCodeEl = document.getElementById('couponCode');
    if(couponCodeEl) couponCodeEl.placeholder = t.couponPlaceholder;
    
    const btnAddCustomer = document.getElementById('btnAddCustomer');
    if(btnAddCustomer) btnAddCustomer.textContent = t.addCustomerBtn;
    
    const driverSelect = document.getElementById('driverSelect');
    if(driverSelect && driverSelect.options[0]) {
      driverSelect.options[0].textContent = t.noDriver;
    }
    
    const discountType = document.getElementById('discountType');
    if(discountType && discountType.options.length >= 3){
      discountType.options[0].textContent = t.noDiscount;
      discountType.options[1].textContent = t.discountPercent;
      discountType.options[2].textContent = t.discountAmount;
    }
    
    const notesEl = document.getElementById('notes');
    if(notesEl) notesEl.placeholder = t.notesPlaceholder;
    
    const paymentMethod = document.getElementById('paymentMethod');
    if(paymentMethod){
      Array.from(paymentMethod.options).forEach(opt=>{
        opt.textContent = getPaymentMethodLabel(opt.value, isAr);
      });
    }
    
    // Translate buttons
    const btnHoldInvoice = document.getElementById('btnHoldInvoice');
    if(btnHoldInvoice) {
      btnHoldInvoice.textContent = t.holdBtn;
      btnHoldInvoice.title = t.holdBtnTitle;
    }
    
    const btnShowHeldInvoices = document.getElementById('btnShowHeldInvoices');
    if(btnShowHeldInvoices) {
      btnShowHeldInvoices.textContent = t.heldInvoicesBtn;
      btnShowHeldInvoices.title = t.heldInvoicesBtnTitle;
    }
    
    const btnProcessInvoice = document.getElementById('btnProcessInvoice');
    if(btnProcessInvoice) btnProcessInvoice.textContent = t.processBtn;
    
    const btnProcessPartial = document.getElementById('btnProcessPartial');
    if(btnProcessPartial) btnProcessPartial.textContent = t.partialBtn;
    
    const btnProcessFull = document.getElementById('btnProcessFull');
    if(btnProcessFull) btnProcessFull.textContent = t.fullBtn;
    
    const btnClear = document.getElementById('btnClear');
    if(btnClear) btnClear.textContent = t.clearBtn;
    
    // Translate placeholders
    const processInvoiceNo = document.getElementById('processInvoiceNo');
    if(processInvoiceNo) processInvoiceNo.placeholder = t.invoiceNoPlaceholder;
    
    const scanBarcode = document.getElementById('scanBarcode');
    if(scanBarcode) scanBarcode.placeholder = t.barcodePlaceholder;
    
    const searchByNameEl = document.getElementById('searchByName');
    if(searchByNameEl) searchByNameEl.placeholder = t.searchNamePlaceholder;

    const heldInvoicesSearch = document.getElementById('heldInvoicesSearch');
    if(heldInvoicesSearch) heldInvoicesSearch.placeholder = t.heldInvoicesSearchPlaceholder;
    
    // Translate table headers
    const ths = document.querySelectorAll('.cart-scroll table thead th');
    if(ths.length >= 5){
      ths[0].textContent = t.productTh;
      ths[1].textContent = t.operationTh;
      ths[2].textContent = t.priceTh;
      ths[3].textContent = t.qtyTh;
      ths[4].textContent = t.totalTh;
    }
    
    // Translate top buttons
    const btnPayTop = document.getElementById('btnPayTop');
    if(btnPayTop){
      const span = btnPayTop.querySelector('span:last-child');
      if(span) span.textContent = isAr ? 'طباعة الفاتورة' : 'Print invoice';
    }
    
    const btnQuotation = document.getElementById('btnQuotation');
    if(btnQuotation){
      const span = btnQuotation.querySelector('span:last-child');
      if(span) span.textContent = isAr ? 'عرض السعر' : 'Quotation';
    }
    
    // Translate Add Customer Modal
    const addCustomerModalHeader = document.querySelector('#addCustomerModal header div');
    if(addCustomerModalHeader) addCustomerModalHeader.textContent = t.addCustomerModalTitle;
    
    const modalLabels = document.querySelectorAll('#addCustomerModal label');
    modalLabels.forEach(label => {
      const text = label.textContent.trim();
      if(text.includes('اسم العميل') || text.includes('Customer name')) {
        label.innerHTML = t.customerNameLabel;
      } else if(text.includes('رقم الجوال') || text.includes('Phone')) {
        label.innerHTML = t.phoneLabel + ' <span style="color:#dc2626;">*</span>';
      } else if(text.includes('البريد الإلكتروني') || text.includes('Email')) {
        label.textContent = t.emailLabel;
      } else if(text.includes('العنوان') && !text.includes('الوطني') && !text.includes('National')) {
        label.textContent = t.addressLabel;
      } else if(text.includes('الرقم الضريبي') || text.includes('VAT Number')) {
        label.textContent = t.vatNumberLabel;
      } else if(text.includes('السجل التجاري') || text.includes('CR Number')) {
        label.textContent = t.crNumberLabel;
      } else if(text.includes('العنوان الوطني') || text.includes('National Address')) {
        label.textContent = t.nationalAddressLabel;
      } else if(text.includes('ملاحظات إضافية') || text.includes('Notes')) {
        label.textContent = t.additionalNotesLabel;
      }
    });
    
    const acmName = document.getElementById('acmName');
    if(acmName) acmName.placeholder = t.customerNamePlaceholder;
    
    const acmPhone = document.getElementById('acmPhone');
    if(acmPhone) acmPhone.placeholder = t.phonePlaceholder;
    
    const acmEmail = document.getElementById('acmEmail');
    if(acmEmail) acmEmail.placeholder = t.emailPlaceholder;
    
    const acmAddress = document.getElementById('acmAddress');
    if(acmAddress) acmAddress.placeholder = t.addressPlaceholder;
    
    const acmVat = document.getElementById('acmVat');
    if(acmVat) acmVat.placeholder = t.vatNumberPlaceholder;
    
    const acmCr = document.getElementById('acmCr');
    if(acmCr) acmCr.placeholder = t.crNumberPlaceholder;
    
    const acmNatAddr = document.getElementById('acmNatAddr');
    if(acmNatAddr) acmNatAddr.placeholder = t.nationalAddressPlaceholder;
    
    const acmNotes = document.getElementById('acmNotes');
    if(acmNotes) acmNotes.placeholder = t.additionalNotesPlaceholder;
    
    const acmCancel = document.getElementById('acmCancel');
    if(acmCancel) acmCancel.textContent = t.cancelBtn;
    
    const acmSave = document.getElementById('acmSave');
    if(acmSave) acmSave.textContent = t.saveBtn;
  }catch(_){}
}

(async function initLocale(){
  try{
    const r = await window.api.app_get_locale();
    const lang = (r && r.lang) || 'ar';
    const isAr = lang === 'ar';
    document.documentElement.lang = isAr ? 'ar' : 'en';
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    translateUI(isAr);
  }catch(_){
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    translateUI(true);
  }
  // Listen for locale changes
  try{
    window.api.app_on_locale_changed((L)=>{
      const isAr = L === 'ar';
      document.documentElement.lang = isAr ? 'ar' : 'en';
      document.documentElement.dir = isAr ? 'rtl' : 'ltr';
      translateUI(isAr);
    });
  }catch(_){}
})();

// Permissions helper: read from localStorage once
let __perms = [];
try{ __perms = JSON.parse(localStorage.getItem('pos_perms')||'[]') || []; }catch(_){ __perms = []; }
function can(key){ return __perms.includes('sales') && (__perms.includes(key) || !key.includes('.')); }

// No Shift Modal Handler
function showNoShiftModal() {
  return new Promise((resolve) => {
    const modal = document.getElementById('noShiftModal');
    const cancelBtn = document.getElementById('noShiftModalCancelBtn');
    const continueBtn = document.getElementById('noShiftModalContinueBtn');
    
    modal.classList.add('show');
    
    const handleCancel = () => {
      modal.classList.remove('show');
      cleanup();
      resolve(false);
    };
    
    const handleContinue = () => {
      modal.classList.remove('show');
      cleanup();
      resolve(true);
    };
    
    const handleBackdrop = (e) => {
      if (e.target.id === 'noShiftModal') {
        handleCancel();
      }
    };
    
    const cleanup = () => {
      cancelBtn.removeEventListener('click', handleCancel);
      continueBtn.removeEventListener('click', handleContinue);
      modal.removeEventListener('click', handleBackdrop);
    };
    
    cancelBtn.addEventListener('click', handleCancel);
    continueBtn.addEventListener('click', handleContinue);
    modal.addEventListener('click', handleBackdrop);
  });
}

const errorDiv = document.getElementById('error');
const barcode = document.getElementById('scanBarcode');
const searchByName = document.getElementById('searchByName');
const nameSuggest = document.getElementById('nameSuggest');
// Normalize Arabic-Indic digits to ASCII for barcode input
function normalizeDigits(s){
  if(!s) return '';
  return String(s).replace(/[\u0660-\u0669\u06F0-\u06F9]/g, ch => {
    const code = ch.charCodeAt(0);
    if(code>=0x0660 && code<=0x0669) return String(code - 0x0660);
    if(code>=0x06F0 && code<=0x06F9) return String(code - 0x06F0);
    return ch;
  }).trim();
}
const btnScan = null; // لم نعد نستخدم زر منفصل للمسح
const btnRefresh = null; // تم إخفاء زر التحديث
const typeTabs = document.getElementById('typeTabs');
const catalog = document.getElementById('catalog');

// Check if device is primary (main) or secondary
let isMainDevice = true;
async function checkDeviceType() {
  try {
    const r = await window.api.db_get_config();
    if (r && r.ok && r.config) {
      const host = (r.config.host || '').toLowerCase();
      isMainDevice = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    }
  } catch(_) {
    isMainDevice = true;
  }
}
(async ()=>{ await checkDeviceType(); })();

// Request cache with memory management (secondary devices only)
const requestCache = new Map();
const MAX_CACHE_SIZE = 100;

async function cachedRequest(cacheKey, asyncFn, ttl = 30000) {
  if (isMainDevice) {
    return await asyncFn();
  }
  
  if (requestCache.has(cacheKey)) {
    const cached = requestCache.get(cacheKey);
    if (Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
  }
  
  const result = await asyncFn();
  
  if (requestCache.size >= MAX_CACHE_SIZE) {
    const firstKey = requestCache.keys().next().value;
    requestCache.delete(firstKey);
  }
  
  requestCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

setInterval(() => {
  if (isMainDevice) return;
  
  const now = Date.now();
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > 60000) {
      requestCache.delete(key);
    }
  }
}, 30000);

// Catalog search state
let __nameQuery = '';
let __searchTimer = null;
const tbody = document.getElementById('tbody');

// ===== نظام تجميع الاستعلامات Batch Loading System =====
const batchLoader = {
  queues: {
    images: new Map(),
    operations: new Map(),
    offers: new Map(),
    customerPrices: new Map()
  },
  timers: {},
  batchDelay: 30, // تأخير 30ms لتجميع الطلبات
  
  add(type, key, productId, additionalData = {}) {
    if (!this.queues[type]) return Promise.reject(new Error('Invalid batch type'));
    
    // إذا كان الطلب موجوداً بالفعل، أرجع الوعد الموجود
    if (this.queues[type].has(key)) {
      return this.queues[type].get(key).promise;
    }
    
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    
    this.queues[type].set(key, { productId, additionalData, resolve, reject, promise });
    
    // إلغاء المؤقت السابق وإنشاء جديد
    if (this.timers[type]) clearTimeout(this.timers[type]);
    this.timers[type] = setTimeout(() => this.flush(type), this.batchDelay);
    
    return promise;
  },
  
  async flush(type) {
    const queue = this.queues[type];
    if (!queue || queue.size === 0) return;
    
    const items = Array.from(queue.entries());
    queue.clear();
    
    try {
      switch(type) {
        case 'images':
          await this.flushImages(items);
          break;
        case 'operations':
          await this.flushOperations(items);
          break;
        case 'offers':
          await this.flushOffers(items);
          break;
        case 'customerPrices':
          await this.flushCustomerPrices(items);
          break;
      }
    } catch(error) {
      items.forEach(([_key, item]) => item.reject(error));
    }
  },
  
  async flushImages(items) {
    // تحميل الصور بشكل متوازي لكن بحد أقصى 10 في نفس الوقت
    const chunks = [];
    for (let i = 0; i < items.length; i += 10) {
      chunks.push(items.slice(i, i + 10));
    }
    
    for (const chunk of chunks) {
      await Promise.all(chunk.map(async ([key, item]) => {
        try {
          const result = await cachedRequest(
            `img_${item.productId}`,
            () => window.api.products_image_get(item.productId),
            30000
          );
          item.resolve(result);
        } catch(error) {
          item.reject(error);
        }
      }));
    }
  },
  
  async flushOperations(items) {
    // تحميل العمليات بشكل متوازي
    const chunks = [];
    for (let i = 0; i < items.length; i += 10) {
      chunks.push(items.slice(i, i + 10));
    }
    
    for (const chunk of chunks) {
      await Promise.all(chunk.map(async ([key, item]) => {
        try {
          const result = await cachedRequest(
            `ops_${item.productId}`,
            () => window.api.prod_ops_list(item.productId),
            30000
          );
          item.resolve(result);
        } catch(error) {
          item.reject(error);
        }
      }));
    }
  },
  
  async flushOffers(items) {
    await Promise.all(items.map(async ([key, item]) => {
      try {
        const result = await cachedRequest(
          key,
          () => window.api.offers_find_for_product({
            product_id: item.productId,
            operation_id: item.additionalData.operationId
          }),
          30000
        );
        item.resolve(result);
      } catch(error) {
        item.reject(error);
      }
    }));
  },
  
  async flushCustomerPrices(items) {
    await Promise.all(items.map(async ([key, item]) => {
      try {
        const payload = {
          customer_id: Number(item.additionalData.customerId),
          product_id: item.productId
        };
        if (item.additionalData.operationId != null) {
          payload.operation_id = Number(item.additionalData.operationId);
        }
        const result = await cachedRequest(key, () => window.api.cust_price_find(payload), 30000);
        item.resolve(result);
      } catch(error) {
        item.reject(error);
      }
    }));
  }
};

// ===== Web Worker للحسابات الثقيلة =====
let calculationsWorker = null;
let workerReady = false;

function initCalculationsWorker() {
  if (calculationsWorker) return;
  
  try {
    calculationsWorker = new Worker('./calculations-worker.js');
    workerReady = true;
    
    calculationsWorker.onerror = (error) => {
      console.error('Worker error:', error);
      workerReady = false;
    };
  } catch(error) {
    console.warn('Could not create Web Worker, falling back to main thread:', error);
    workerReady = false;
  }
}

// ===== Debouncing محسّن لـ computeTotals =====
let computeTotalsTimer = null;
let computeTotalsQueue = [];
const COMPUTE_DEBOUNCE_MS = 100;

function scheduleComputeTotals() {
  if (computeTotalsTimer) clearTimeout(computeTotalsTimer);
  computeTotalsTimer = setTimeout(() => {
    computeTotals();
  }, COMPUTE_DEBOUNCE_MS);
}
// Low-stock banner elements
const lowStockBanner = document.getElementById('lowStockBanner');
const lowStockList = document.getElementById('lowStockList');
const lowStockTitle = document.getElementById('lowStockTitle');
const salesToast = document.getElementById('salesToast');
// عناصر معالجة الفاتورة السابقة
const processInvoiceNoEl = document.getElementById('processInvoiceNo');
const btnProcessInvoice = document.getElementById('btnProcessInvoice');
const btnProcessPartial = document.getElementById('btnProcessPartial');
const btnProcessFull = document.getElementById('btnProcessFull');
let __processedSaleId = null; // لتخزين معرف الفاتورة المُعالجة
let __processedSaleData = null; // لتخزين بيانات الفاتورة المُعالجة (خصم، إضافي، إلخ)

const subTotalEl = document.getElementById('subTotal');
const vatTotalEl = document.getElementById('vatTotal');
const grandTotalEl = document.getElementById('grandTotal');
const discountTypeEl = document.getElementById('discountType');
const discountValueEl = document.getElementById('discountValue');
const extraValueEl = document.getElementById('extraValue');
const discountAmountEl = document.getElementById('discountAmount');
const discountLabelEl = document.getElementById('discountLabel');
const discountSummaryRowEl = document.getElementById('discountSummaryRow');
const afterDiscountEl = document.getElementById('afterDiscount');
const afterDiscountRowEl = document.getElementById('afterDiscountRow');
// Summary row for Extra (before tax)
const extraSummaryRowEl = document.getElementById('extraSummaryRow');
const extraAmountEl = document.getElementById('extraAmount');

const paymentMethod = document.getElementById('paymentMethod');
const cashReceived = document.getElementById('cashReceived');
// Coupon controls
const couponCodeEl = document.getElementById('couponCode');
const applyCouponBtn = null; // زر التطبيق لم يعد مستخدمًا
const couponInfoEl = document.getElementById('couponInfo');
let __coupon = null; // { code, mode, value, amount }
let __globalOffer = null; // { mode, value }
if(cashReceived){
  cashReceived.addEventListener('input', () => {
    const s = (cashReceived.value||'').trim();
    // لا تعرض تحذيرًا إذا كان الحقل فارغًا
    if(s === ''){ setError(''); if(__currentRoomId){ __saveRoomCart(__currentRoomId, cart); } return; }
    const val = Number(s);
    if(isNaN(val) || val < 0){ setError('قيمة غير صحيحة للمبلغ المدفوع'); return; }
    const need = Number((window.__sale_calcs?.grand_total || 0));
    // لا تعرض رسالة "أقل من الإجمالي" في وضع مختلط
    if(paymentMethod && paymentMethod.value === 'mixed'){
      setError('');
    } else {
      if(val < need){
        setError('المبلغ المدفوع أقل من الإجمالي شامل الضريبة');
      } else {
        setError('');
      }
    }
    if(__currentRoomId){ __saveRoomCart(__currentRoomId, cart); }
  });
}
const customerDropdown = document.getElementById('customerDropdown');
const customerSearch = document.getElementById('customerSearch');
const customerList = document.getElementById('customerList');
let __allCustomers = []; // cache for filtering
let __customerSearchResults = [];
let __selectedCustomerId = '';

// Drivers dropdown (select)
const driverSelect = document.getElementById('driverSelect');
const driverMeta = document.getElementById('driverMeta');
let __allDrivers = []; // cache
let __selectedDriverId = '';
let __currentShiftId = null; // current active shift for invoices

// Employees cache for product assignment
let __allEmployees = [];

// const customerName = document.getElementById('customerName'); // أزلنا الإدخال اليدوي للاسم
const notes = document.getElementById('notes');
const btnPay = document.getElementById('btnPay');
const btnClear = document.getElementById('btnClear');
const btnAddCustomer = document.getElementById('btnAddCustomer');

// أعلى الصفحة: أزرار مثبتة تنفذ نفس إجراءات الأزرار السفلية
const btnPayTop = document.getElementById('btnPayTop');
const btnQuotation = document.getElementById('btnQuotation');
const btnKitchenTop = null; // removed kitchen top button from UI
const btnClearTop = document.getElementById('btnClearTop');
if(btnPayTop){ if(!__perms.includes('sales.print')) btnPayTop.style.display='none'; btnPayTop.addEventListener('click', ()=>{ document.getElementById('btnPay')?.click(); }); btnPayTop.title = 'اختصار: F1'; }

// زر طباعة عرض السعر
if(btnQuotation){ 
  btnQuotation.addEventListener('click', ()=>{
    if(cart.length === 0){ 
      __showSalesToast('أضف منتجات أولاً', { icon:'⚠️', danger:true, ms:5000 }); 
      return; 
    }
    // تجميع بيانات السلة
    const cartData = cart.map(it => {
      const empId = it.employee_id;
      const emp = empId ? __allEmployees.find(e => Number(e.id) === Number(empId)) : null;
      return {
        id: it.id,
        product_id: it.id,
        name: it.name,
        name_en: it.name_en || null,
        barcode: it.barcode || '',
        description: it.description || '',
        operation_id: it.operation_id || null,
        operation_name: it.operation_name || '',
        price: Number(it.price||0),
        qty: Number(it.qty||1),
        total: Number(it.price||0) * Number(it.qty||1),
        unit_name: it.unit_name || null,
        unit_multiplier: it.unit_multiplier || 1,
        category: it.category || null,
        is_tobacco: it.is_tobacco || 0,
        employee_id: it.employee_id || null,
        employee_name: emp ? emp.name : '',
        image_path: it.image_path || null,
        manualPriceEdit: it.manualPriceEdit || false
      };
    });
    
    // حساب الإجماليات (نفس منطق الحساب في الفاتورة)
    const calcs = window.__sale_calcs || {};
    const totals = {
      sub_total: calcs.sub_total || 0,
      vat_total: calcs.vat_total || 0,
      grand_total: calcs.grand_total || 0,
      discount_type: calcs.discount_type || 'none',
      discount_value: calcs.discount_value || 0,
      discount_amount: calcs.discount_amount || 0,
      total_after_discount: calcs.sub_after_discount || calcs.sub_total || 0,
      extra_value: calcs.extra_value || 0,
      tobacco_fee: calcs.tobacco_fee || 0
    };
    
    // حفظ البيانات في sessionStorage لاستخدامها في صفحة العرض
    sessionStorage.setItem('quotation_cart', JSON.stringify(cartData));
    sessionStorage.setItem('quotation_totals', JSON.stringify(totals));
    // حفظ معرف العميل إن كان محدداً
    sessionStorage.setItem('quotation_customer_id', __selectedCustomerId || '');
    // حفظ ملاحظات عرض السعر من شاشة البيع إن وُجدت
    const notesVal = notes ? (notes.value || '') : '';
    sessionStorage.setItem('quotation_notes', notesVal);
    // مسح وضع العرض لضمان الحفظ التلقائي
    sessionStorage.removeItem('quotation_view_mode');
    sessionStorage.removeItem('quotation_number');
    sessionStorage.removeItem('quotation_date');
    sessionStorage.removeItem('quotation_cashier');
    
    // فتح نافذة عرض السعر
    const w = 800, h = 900;
    window.open('./quotation.html', 'QUOTATION', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
    
    // تفريغ السلة بعد طباعة عرض السعر
    cart = [];
    if(__currentRoomId){ __saveRoomCart(__currentRoomId, cart); }
    renderCart();
    
    // تفريغ العميل بعد طباعة عرض السعر
    __selectedCustomerId = '';
    if(customerSearch){ customerSearch.value = ''; }
    if(customerList){ customerList.innerHTML=''; customerList.style.display='none'; }
    // إرجاع الأسعار للأسعار العادية
    revertPricesToBase().then(() => loadCatalog());
    setTimeout(() => { const barcodeInput = document.getElementById('scanBarcode'); if(barcodeInput) barcodeInput.focus(); }, 300);
    
    // إعادة تعيين الحقول للفاتورة التالية
    if(discountTypeEl){ discountTypeEl.value = 'none'; }
    if(discountValueEl){ discountValueEl.value = ''; }
    if(extraValueEl){ extraValueEl.value = ''; }
    // تفريغ حقل الملاحظات بعد طباعة عرض السعر
    if(notes){ notes.value = ''; }
    computeTotals();
    // حفظ حالة الغرفة مجددًا لتحديث الملاحظات المفرغة
    if(__currentRoomId){ __saveRoomCart(__currentRoomId, cart); }
  });
}

const btnZatcaSendTop = document.getElementById('btnZatcaSendTop');
if(btnZatcaSendTop){ if(!__perms.includes('sales.print')) btnZatcaSendTop.style.display='none'; btnZatcaSendTop.addEventListener('click', async ()=>{
  try{
    const v = prompt('أدخل رقم الفاتورة لإرسالها للهيئة:');
    if(!v) return;
    const r = await window.zatcaSendByInvoiceNo(v);
    alert(r.ok ? ('تم الإرسال بنجاح\n' + (r.message||'')) : ('فشل الإرسال\n' + (r.error||'')));
  }catch(e){ alert('تعذر الإرسال: ' + (e?.message||String(e))); }
}); }

// Helper: resolve invoice_no -> sale_id then submit via local bridge
window.zatcaSendByInvoiceNo = async function(invoiceNo){
  const inv = String(invoiceNo||'').trim();
  if(!inv) return { ok:false, error:'رقم الفاتورة مطلوب' };
  try{
    // Try to fetch by search; backend prioritizes invoice matching on q
    const r = await window.api.sales_list({ q: inv });
    if(!r || !r.ok) return { ok:false, error: r?.error || 'تعذر البحث عن الفاتورة' };
    const items = Array.isArray(r.items) ? r.items : [];
    // Prefer exact match on invoice_no; fallback to first
    const row = items.find(x => String(x.invoice_no) === inv) || items[0];
    if(!row) return { ok:false, error:'لم يتم العثور على فاتورة بهذا الرقم' };
    const resp = await window.electronAPI.localZatca.submitBySaleId(Number(row.id));
    if(resp && resp.success){
      const msg = (typeof resp.data === 'string') ? resp.data : JSON.stringify(resp.data);
      return { ok:true, message: msg };
    } else {
      const detail = (resp && (resp.message || resp.error || resp.data)) || 'فشل الإرسال';
      return { ok:false, error: typeof detail==='string' ? detail : JSON.stringify(detail) };
    }
  }catch(e){
    // Show richer error if available (from preload)
    const msg = e && e.message || String(e);
    return { ok:false, error: msg };
  }
};


if(btnClearTop){ if(!__perms.includes('sales.clear')) btnClearTop.style.display='none'; btnClearTop.addEventListener('click', ()=>{ document.getElementById('btnClear')?.click(); }); btnClearTop.title = 'اختصار: F2'; }

// اختصارات لوحة المفاتيح: F1 للطباعة، F2 لتفريغ السلة، F3 لطباعة عرض السعر
window.addEventListener('keydown', (e) => {
  if(e.key === 'F1'){
    e.preventDefault();
    document.getElementById('btnPay')?.click();
  } else if(e.key === 'F2'){
    e.preventDefault();
    document.getElementById('btnClear')?.click();
  } else if(e.key === 'F3'){
    e.preventDefault();
    document.getElementById('btnQuotation')?.click();
  }
});

// Rooms support: parse room from URL and set header badge, and persist cart per room
const __urlParams = new URLSearchParams(location.search);
// Force default (non-room) sales screen regardless of URL
const __currentRoomId = '';
let __currentRoomName = '';
async function __fetchRoomMeta(id){ try{ const r = await window.api.rooms_list(); if(r.ok){ return (r.items||[]).find(x => String(x.id)===String(id)) || null; } }catch(_){ } return null; }
async function __loadRoomCart(id){
  try{
    const r = await window.api.rooms_get_session(id);
    if(r.ok && r.session){
      const c = r.session.cart_json ? JSON.parse(r.session.cart_json||'[]') : [];
      const s = r.session.state_json ? JSON.parse(r.session.state_json||'{}') : {};
      // Restore UI state if present
      if(discountTypeEl && s.discount_type){ discountTypeEl.value = s.discount_type; }
      if(discountValueEl && typeof s.discount_value !== 'undefined'){ discountValueEl.value = String(s.discount_value); }
      if(extraValueEl && typeof s.extra_value !== 'undefined'){ extraValueEl.value = String(s.extra_value); }
      if(paymentMethod && s.payment_method){ paymentMethod.value = s.payment_method; }
      if(cashReceived && typeof s.cash_received !== 'undefined' && s.cash_received !== null){ cashReceived.value = String(s.cash_received); }
      if(notes && typeof s.notes === 'string'){ notes.value = s.notes; }
      if(typeof s.customer_id !== 'undefined' && s.customer_id){ __selectedCustomerId = String(s.customer_id); }
      if(typeof s.driver_id !== 'undefined' && s.driver_id){ __selectedDriverId = String(s.driver_id); }
      return Array.isArray(c) ? c : [];
    }
  }catch(_){ }
  return [];
}
async function __saveRoomCart(id, c){
  try{
    const cashVal = (cashReceived && (cashReceived.value||'').trim() !== '') ? Number(cashReceived.value||0) : null;
    const state = {
      discount_type: discountTypeEl ? discountTypeEl.value : 'none',
      discount_value: discountValueEl ? Number(discountValueEl.value||0) : 0,
      extra_value: extraValueEl ? Number(extraValueEl.value||0) : 0,
      payment_method: paymentMethod ? paymentMethod.value : 'cash',
      cash_received: cashVal,
      notes: notes ? (notes.value||'') : '',
      customer_id: __selectedCustomerId ? Number(__selectedCustomerId) : null,
      driver_id: __selectedDriverId ? Number(__selectedDriverId) : null,
    };
    await window.api.rooms_save_cart(id, c, state);
  }catch(_){ }
}
async function __clearRoomSession(id){ try{ await window.api.rooms_clear(id); }catch(_){ } }
(async () => {
  // ربط أزرار التنقل وعرض زر الغرف فقط عند العمل ضمن غرفة
  const nav = document.querySelector('header nav');
  if(nav){
    const btnRooms = document.getElementById('btnBackRooms');
    const btnHome = document.getElementById('btnBackHome');
    const btnCloseShift = document.getElementById('btnCloseShift');
    
    if(btnHome){ btnHome.onclick = ()=>{ window.location.href='../main/index.html'; }; }
    
    if(btnCloseShift){
      btnCloseShift.onclick = async ()=>{
        try{
          const currentShift = JSON.parse(localStorage.getItem('current_shift') || 'null');
          if(!currentShift){
            return;
          }
          
          const modal = document.getElementById('closeShiftModal');
          if(modal){
            modal.classList.add('show');
          }
        }catch(err){
          console.error('Close shift error:', err);
        }
      };
    }
    
    const closeShiftModalCancelBtn = document.getElementById('closeShiftModalCancelBtn');
    if(closeShiftModalCancelBtn){
      closeShiftModalCancelBtn.onclick = ()=>{
        const modal = document.getElementById('closeShiftModal');
        if(modal){ modal.classList.remove('show'); }
      };
    }
    
    const closeShiftModalContinueBtn = document.getElementById('closeShiftModalContinueBtn');
    if(closeShiftModalContinueBtn){
      closeShiftModalContinueBtn.onclick = ()=>{
        window.location.href = '../shift-close/index.html';
      };
    }
    
    if(!__currentRoomId){
      if(btnRooms){ btnRooms.style.display = 'none'; }
      // Kitchen buttons removed from UI; nothing to hide
    }
  }

  // زر معالجة الفاتورة السابقة
  if(btnProcessInvoice){
    // Hide if no permission
    if(!__perms.includes('sales.process_invoice')){ btnProcessInvoice.style.display='none'; if(processInvoiceNoEl) processInvoiceNoEl.style.display='none'; }
    btnProcessInvoice.addEventListener('click', async () => {
      const v = processInvoiceNoEl ? processInvoiceNoEl.value : '';
      // تحقق أولاً هل سبق معالجتها
      try{
        const chk = await window.api.sales_has_credit_for_invoice({ invoice_no: v });
        if(chk && chk.ok){
          if(chk.credit_unpaid){
            showErrorNotification('❌ هذه فاتورة آجل غير مسددة ولا يمكن عمل معالجة لها قبل السداد');
            return;
          }
          if(chk.processed){
            showErrorNotification('⚠️ تم عمل معالجة لهذه الفاتورة من قبل');
            return;
          }
        }
      }catch(_){ /* ignore */ }
      await loadInvoiceIntoCartByNumber(v);
    });
  }
  if(processInvoiceNoEl){
    processInvoiceNoEl.addEventListener('keydown', (e) => { if(e.key==='Enter'){ e.preventDefault(); btnProcessInvoice?.click(); } });
  }
  if(btnProcessFull){
    btnProcessFull.addEventListener('click', async () => {
      if(!__processedSaleId){ showErrorNotification('⚠️ لا توجد فاتورة مُعالجة'); return; }
      try{
        const r = await window.api.sales_refund_full({ sale_id: __processedSaleId });
        if(!r || !r.ok){ showErrorNotification('❌ ' + (r?.error||'تعذر معالجة كامل الفاتورة')); return; }
        showSuccessNotification('✓ تم إنشاء إشعار دائن وإرجاع المخزون بنجاح', 5000);
        // افتح نافذة الطباعة مباشرة لإشعار الدائن الجديد
        try{
          const fmt = (settings && settings.default_print_format === 'a4') ? 'a4' : 'thermal';
          const page = fmt === 'a4' ? 'print-a4.html' : 'print.html';
          const params = new URLSearchParams({ id: String(r.credit_sale_id), pay: String(r.base_payment_method||''), base: String(r.base_sale_id||''), base_no: String(r.base_invoice_no||'') });
          const w = fmt==='a4' ? 800 : 500;
          const h = fmt==='a4' ? 900 : 700;
          window.open(`../sales/${page}?${params.toString()}`, 'PRINT_VIEW', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
        }catch(_){ /* ignore */ }
        // بعد فتح الطباعة، أعد شاشة فاتورة جديدة إلى حالتها (تفريغ السلة وتمكين الحقول)
        try{
          cart = []; renderCart();
          // إعادة حالة المعالجة وإظهار عناصر الواجهة
          setProcessingMode(false);
          // تفريغ خانة معالجة الفاتورة وإعادة ضبط الحالة
          try{ if(processInvoiceNoEl){ processInvoiceNoEl.value=''; } }catch(_){ }
          __processedSaleId = null;
          __processedSaleData = null;
          // إعادة طريقة الدفع إلى الافتراضي
          try{
            const methods = Array.isArray(settings.payment_methods) && settings.payment_methods.length ? settings.payment_methods : ['cash'];
            if(settings.default_payment_method && methods.includes(settings.default_payment_method)){
              paymentMethod.value = settings.default_payment_method;
            } else { paymentMethod.value = methods[0]; }
          }catch(_){ }
          // تفريغ الحقول الأخرى
          if(cashReceived){ cashReceived.value=''; cashReceived.placeholder='المبلغ المدفوع'; cashReceived.disabled=false; }
          if(discountTypeEl){ discountTypeEl.value='none'; }
          if(discountValueEl){ discountValueEl.value=''; }
          if(extraValueEl){ extraValueEl.value=''; }
          if(notes){ notes.value=''; }
          __selectedCustomerId = '';
          __selectedDriverId = '';
          try{ customerSearch.value=''; customerList.style.display='none'; if(driverSelect){ driverSelect.value=''; } }catch(_){ }
          if(__currentRoomId){ await __saveRoomCart(__currentRoomId, cart); try{ await window.api.rooms_set_status(__currentRoomId, 'vacant'); }catch(_){ } }
          setTimeout(() => { const barcodeInput = document.getElementById('scanBarcode'); if(barcodeInput) barcodeInput.focus(); }, 300);
        }catch(_){ }
      }catch(e){ console.error(e); showErrorNotification('❌ تعذر معالجة كامل الفاتورة'); }
    });
  }

  if(btnProcessPartial){
    btnProcessPartial.addEventListener('click', async () => {
      if(!__processedSaleId){ showErrorNotification('⚠️ لا توجد فاتورة مُعالجة'); return; }
      
      // التحقق من وجود خصم أو إضافي في الفاتورة
      if(__processedSaleData){
        const hasDiscount = __processedSaleData.discount_type && __processedSaleData.discount_type !== 'none' && Number(__processedSaleData.discount_amount||0) > 0;
        const hasExtra = Number(__processedSaleData.extra_value||0) > 0;
        
        if(hasDiscount || hasExtra){
          showErrorNotification('⚠️ لا يمكن عمل معالجة جزئية لفاتورة تحتوي على خصم أو إضافي. استخدم معالجة كامل الفاتورة');
          return;
        }
      }
      
      try{
        await showPartialRefundModal(__processedSaleId);
      }catch(e){ console.error(e); showErrorNotification('❌ تعذر فتح نافذة الإرجاع الجزئي'); }
    });
  }

  if(__currentRoomId){
    const meta = await __fetchRoomMeta(__currentRoomId);
    __currentRoomName = meta ? meta.name : (`غرفة #${__currentRoomId}`);
    const hdrTitle = document.querySelector('header div span');
    if(hdrTitle){ hdrTitle.textContent = `فاتورة جديدة - ${__currentRoomName}`; }
    if(nav){
      const btnRooms = document.getElementById('btnBackRooms');
      if(btnRooms){ btnRooms.style.display = ''; btnRooms.onclick = ()=>{ window.location.href='../rooms/index.html'; }; }
    }
    const savedCart = await __loadRoomCart(__currentRoomId);
    if(Array.isArray(savedCart) && savedCart.length){ cart = savedCart; setTimeout(renderCart,0); }
  }
  // طبّق إخفاء/تعطيل العناصر بحسب الصلاحيات الفرعية قبل أي تهيئة أخرى
  try{
    const need = [
      { sel: '#btnPayTop', key: 'sales.print' },
      { sel: '#btnKitchenTop', key: 'sales.kitchen' },
      { sel: '#btnClearTop', key: 'sales.clear' },
      { sel: '#btnProcessInvoice', key: 'sales.process_invoice' },
      { sel: '#discountType', key: 'sales.discount' },
      { sel: '#discountValue', key: 'sales.discount' },
      { sel: '#extraValue', key: 'sales.extra' },
      { sel: '#couponCode', key: 'sales.coupon' },
    ];
    need.forEach(({ sel, key }) => {
      const el = document.querySelector(sel);
      if(!el) return;
      if(!( __perms.includes('sales') && __perms.includes(key) )){
        // أخفِ العنصر بالكامل: إذا كان داخل حاوية .controls أخفِ الحاوية حتى تختفي التسمية أيضاً
        const container = el.closest('.controls');
        if(container){ container.style.display = 'none'; }
        else { el.style.display = 'none'; }
      }
    });
  }catch(_){ }

  // اجلب الإعدادات لتعبئة إعدادات العملة/الضرائب ورسوم التبغ
  try{
    const st = await window.api.settings_get();
    if(st && st.ok && st.item){
      const it = st.item;
      settings.vat_percent = Number.isFinite(Number(it.vat_percent)) ? Number(it.vat_percent) : 15;
      settings.prices_include_vat = it.prices_include_vat ? 1 : 0;
      settings.currency_code = it.currency_code || settings.currency_code;
      // استبدل الرمز القديم ﷼ بحرف الرمز الجديد المخصص \ue900 إن وُجد
      const sym = (it.currency_symbol || settings.currency_symbol || '').trim();
      settings.currency_symbol = (sym === '﷼' || sym === 'SAR' || sym === 'ريال') ? '\ue900' : sym;
      settings.currency_symbol_position = (it.currency_symbol_position==='before' ? 'before' : 'after');
      const pm = Array.isArray(it.payment_methods) ? it.payment_methods : [];
      settings.payment_methods = pm.length ? pm : settings.payment_methods;
      // قيم افتراضية لرسوم التبغ إذا لم تُخزن بعد في الإعدادات
      settings.tobacco_fee_percent = Number(it.tobacco_fee_percent ?? settings.tobacco_fee_percent ?? 100);
      settings.tobacco_min_fee_amount = Number(it.tobacco_min_fee_amount ?? settings.tobacco_min_fee_amount ?? 25);
      // سلوك السلة: فصل تكرار نفس الصنف كسطر جديد
      settings.cart_separate_duplicate_lines = it.cart_separate_duplicate_lines ? 1 : 0;
      // إظهار/إخفاء تنبيه انخفاض المخزون: إذا لم يكن محددًا بالإعدادات المخزنة، الافتراضي التفعيل ليتماشى مع شاشة الإعدادات
      settings.show_low_stock_alerts = (typeof it.show_low_stock_alerts === 'undefined') ? true : !!it.show_low_stock_alerts;
      settings.low_stock_threshold = Number(it.low_stock_threshold ?? settings.low_stock_threshold ?? 5);
      const btnCloseShift = document.getElementById('btnCloseShift');
      if(btnCloseShift){
        if(it.show_shifts === 0 || it.show_shifts === false){
          btnCloseShift.style.display = 'none';
        } else {
          btnCloseShift.style.display = '';
        }
      }
      customerDisplayEnabled = !!it.customer_display_enabled;
      currencyCodeForDisplay = it.currency_code || 'SAR';
      // عبئ خيارات الدفع في الواجهة
      if(paymentMethod){
        paymentMethod.innerHTML='';
        const methods = settings.payment_methods;
        methods.forEach(m => {
          const opt = document.createElement('option'); opt.value=m; opt.textContent=getPaymentMethodLabel(m, document.documentElement.lang === 'ar'); paymentMethod.appendChild(opt);
        });
        // اضبط الافتراضي إن وجد
        if(it.default_payment_method && methods.includes(it.default_payment_method)) paymentMethod.value = it.default_payment_method;
      }
      // Require phone minimum 10 digits
      settings.require_phone_min_10 = !!it.require_phone_min_10;
    }
  }catch(_){ }
  // استمع لتغييرات الإعدادات القادمة من شاشة الإعدادات بدون إعادة فتح
  try{
    window.addEventListener('storage', (e) => {
      // Clear offers cache when excluded products are updated
      if(e && e.key === 'clear_offers_cache'){
        try{
          requestCache.clear();
          console.log('Offers cache cleared');
        }catch(_){ }
      }
      if(e && e.key === 'pos_settings_tobacco' && e.newValue){
        try{
          const ov = JSON.parse(e.newValue||'{}');
          if(typeof ov.tobacco_fee_percent !== 'undefined') settings.tobacco_fee_percent = Number(ov.tobacco_fee_percent);
          if(typeof ov.tobacco_min_fee_amount !== 'undefined') settings.tobacco_min_fee_amount = Number(ov.tobacco_min_fee_amount);
          // أعد الحساب فورًا ليظهر الأثر
          computeTotals();
        }catch(_){ }
      }
      // التقط تحديثات تنبيهات المخزون فوراً من شاشة الإعدادات
      if(e && e.key === 'pos_settings_lowstock' && e.newValue){
        try{
          const lv = JSON.parse(e.newValue||'{}');
          if(typeof lv.show_low_stock_alerts !== 'undefined') settings.show_low_stock_alerts = !!lv.show_low_stock_alerts;
          if(typeof lv.low_stock_threshold !== 'undefined') settings.low_stock_threshold = Math.max(0, Number(lv.low_stock_threshold));
          // إذا تم إيقاف التنبيهات، أخفِ الشريط فورًا وألغِ أي مؤقّتات وأي عرض لاحق
          try{
            if(settings.show_low_stock_alerts === false){
              __lowStockEpoch++; // invalidate pending banners
              if(__lowStockTimer){ clearTimeout(__lowStockTimer); __lowStockTimer = null; }
              if(lowStockBanner){ lowStockBanner.style.display='none'; lowStockBanner.classList.remove('show'); }
              if(lowStockList){ lowStockList.innerHTML=''; }
            }
          }catch(_){ }
        }catch(_){ }
      }
      // التقط تحديثات زر عرض السعر فوراً من شاشة الإعدادات
      if(e && e.key === 'pos_settings_quotation' && e.newValue){
        try{
          const qv = JSON.parse(e.newValue||'{}');
          if(typeof qv.show_quotation_button !== 'undefined'){
            const showBtn = !!qv.show_quotation_button;
            if(btnQuotation){ btnQuotation.style.display = showBtn ? '' : 'none'; }
            // عند إخفاء زر عرض السعر: تكبير زر الطباعة ليأخذ المساحة
            const buttonsContainer = document.getElementById('buttonsContainer');
            if(buttonsContainer){
              if(showBtn){
                buttonsContainer.classList.remove('quotation-hidden');
              }else{
                buttonsContainer.classList.add('quotation-hidden');
              }
            }
          }
        }catch(_){ }
      }
      // التقط تحديث وضع الوزن فوراً
      if(e && e.key === 'pos_settings_weight_mode' && e.newValue){
        try{
          const wm = JSON.parse(e.newValue||'{}');
          if(typeof wm.weight_mode_enabled !== 'undefined') settings.weight_mode_enabled = !!wm.weight_mode_enabled;
          renderCart(); // أعد رسم الحقول لتتحول بين كمية/مبلغ
        }catch(_){ }
      }
    });
  }catch(_){ }
})();
window.addEventListener('beforeunload', ()=>{ if(__currentRoomId){ __saveRoomCart(__currentRoomId, cart); } });

// Modal elements
const acmBackdrop = document.getElementById('addCustomerModal');
const acmClose = document.getElementById('acmClose');
const acmCancel = document.getElementById('acmCancel');
const acmSave = document.getElementById('acmSave');
const acmName = document.getElementById('acmName');
const acmPhone = document.getElementById('acmPhone');
const acmEmail = document.getElementById('acmEmail');
const acmAddress = document.getElementById('acmAddress');
const acmVat = document.getElementById('acmVat');
const acmCr = document.getElementById('acmCr');
const acmNatAddr = document.getElementById('acmNatAddr');
const acmNotes = document.getElementById('acmNotes');

// منع إدخال الأحرف في حقول الأرقام فقط
function allowOnlyNumbersSales(inputElement) {
  if(!inputElement) return;
  inputElement.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^\d]/g, '');
  });
  inputElement.addEventListener('keypress', (e) => {
    if (!/^\d$/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Tab') {
      e.preventDefault();
    }
  });
  inputElement.addEventListener('paste', (e) => {
    e.preventDefault();
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    const numbersOnly = pastedText.replace(/[^\d]/g, '');
    document.execCommand('insertText', false, numbersOnly);
  });
}

// تطبيق التحقق على الحقول الرقمية في نموذج إضافة العميل
allowOnlyNumbersSales(acmPhone);
allowOnlyNumbersSales(acmVat);
allowOnlyNumbersSales(acmCr);

let settings = { vat_percent: 15, prices_include_vat: 1, currency_code: 'SAR', currency_symbol:'\ue900', currency_symbol_position:'after', payment_methods: ['cash','card','mixed'], op_price_manual: 0, tobacco_fee_percent: 100, tobacco_min_invoice_sub: 25, tobacco_min_fee_amount: 25, low_stock_threshold: 5, show_low_stock_alerts: false, weight_mode_enabled: 0, show_employee_selector: 1, require_phone_min_10: false };
let cart = []; // {id, name, price, qty, image_path}
let activeTypes = new Set(); // أسماء الأنواع الرئيسية النشطة فقط
let __noMainTypes = false; // عند عدم وجود أي نوع رئيسي فعّال، أخفِ بطاقات الكتالوج تماماً
let __isProcessingOld = false; // قفل الشاشة أثناء معالجة فاتورة سابقة

function setError(msg){ errorDiv.textContent = msg || ''; }

// نظام إشعارات احترافي مع auto-dismiss
let __notificationTimeout = null;
let __errorNotificationTimeout = null;

function showSuccessNotification(msg, duration = 4000){
  const notifEl = document.getElementById('successNotification');
  const textEl = document.getElementById('notificationText');
  const closeBtn = notifEl.querySelector('.notification-close');
  
  if(__notificationTimeout){ clearTimeout(__notificationTimeout); }
  notifEl.classList.remove('hide');
  textEl.textContent = msg;
  notifEl.classList.add('show');
  
  const hideNotification = () => {
    notifEl.classList.add('hide');
    __notificationTimeout = setTimeout(() => {
      notifEl.classList.remove('show', 'hide');
    }, 400);
  };
  
  closeBtn.onclick = hideNotification;
  __notificationTimeout = setTimeout(hideNotification, duration);
}

function showErrorNotification(msg, duration = 5000){
  const notifEl = document.getElementById('errorNotification');
  const textEl = document.getElementById('errorNotificationText');
  const closeBtn = notifEl.querySelector('.notification-close');
  
  if(__errorNotificationTimeout){ clearTimeout(__errorNotificationTimeout); }
  notifEl.classList.remove('hide');
  textEl.textContent = msg;
  notifEl.classList.add('show');
  
  const hideNotification = () => {
    notifEl.classList.add('hide');
    __errorNotificationTimeout = setTimeout(() => {
      notifEl.classList.remove('show', 'hide');
    }, 400);
  };
  
  closeBtn.onclick = hideNotification;
  __errorNotificationTimeout = setTimeout(hideNotification, duration);
}

// Small warning toast in top-right (same area as low-stock)
let __salesToastTimer = null;
function __showSalesToast(message, opts){
  try{
    if(!salesToast) return;
    const icon = (opts && opts.icon) || '⚠️';
    const danger = !!(opts && opts.danger);
    const box = document.createElement('div');
    box.className = 'toast-box' + (danger ? ' danger' : '');
    box.innerHTML = `<span class="icon">${icon}</span><span class="text">${String(message||'')}</span>`;
    salesToast.innerHTML = '';
    salesToast.appendChild(box);
    salesToast.style.display = 'block';
    if(__salesToastTimer){ clearTimeout(__salesToastTimer); }
    const ms = Math.max(1000, Number(opts && opts.ms || 5000));
    __salesToastTimer = setTimeout(()=>{ try{ salesToast.style.display='none'; salesToast.innerHTML=''; }catch(_){ } }, ms);
  }catch(_){ }
}

// تفعيل/تعطيل عناصر الواجهة عند المعالجة
function setProcessingMode(on){
  __isProcessingOld = !!on;
  const all = Array.from(document.querySelectorAll('input, select, textarea, button'));
  if(on){
    // قفل كل العناصر
    all.forEach(el => { el.disabled = true; });
    // اسمح فقط بحقل رقم الفاتورة وأزرار المعالجة + إبقاء زر الرئيسية مفعلًا
    if(processInvoiceNoEl) processInvoiceNoEl.disabled = false;
    if(btnProcessInvoice) btnProcessInvoice.disabled = false;
    
    // التحقق من وجود خصم أو إضافي قبل إظهار زر المعالجة الجزئية
    const hasDiscount = __processedSaleData && __processedSaleData.discount_type && __processedSaleData.discount_type !== 'none' && Number(__processedSaleData.discount_amount||0) > 0;
    const hasExtra = __processedSaleData && Number(__processedSaleData.extra_value||0) > 0;
    
    if(btnProcessPartial){ 
      if(hasDiscount || hasExtra){
        btnProcessPartial.style.display = 'none'; // إخفاء زر المعالجة الجزئية
      } else {
        btnProcessPartial.disabled = false; 
        btnProcessPartial.style.display = ''; 
      }
    }
    if(btnProcessFull){ btnProcessFull.disabled = false; btnProcessFull.style.display = ''; }
    const btnHome = document.getElementById('btnBackHome'); if(btnHome) btnHome.disabled = false;
  } else {
    // فك القفل عن كل العناصر
    all.forEach(el => { el.disabled = false; });
    // أخفِ أزرار المعالجة لأنها خاصة بوضع المعالجة
    if(btnProcessPartial){ btnProcessPartial.style.display = 'none'; }
    if(btnProcessFull){ btnProcessFull.style.display = 'none'; }
  }
}

async function showPartialRefundModal(saleId){
  try{
    const modal = document.getElementById('partialRefundModal');
    const itemsContainer = document.getElementById('partialRefundItems');
    const invoiceInfo = document.getElementById('partialRefundInvoiceInfo');
    const subtotalEl = document.getElementById('partialRefundSubtotal');
    const vatEl = document.getElementById('partialRefundVat');
    const totalEl = document.getElementById('partialRefundTotal');
    const confirmBtn = document.getElementById('partialRefundConfirm');
    const cancelBtn = document.getElementById('partialRefundCancel');
    const closeBtn = document.getElementById('partialRefundClose');
    
    if(!modal || !itemsContainer) return;
    
    const det = await window.api.sales_get(saleId);
    if(!det || !det.ok){ showErrorNotification('❌ تعذر جلب تفاصيل الفاتورة'); return; }
    
    const sale = det.sale;
    const saleItems = det.items || [];
    
    // جلب الكميات المرتجعة سابقاً
    const refundedRes = await window.api.sales_get_refunded_quantities(saleId);
    const refundedQty = (refundedRes && refundedRes.ok) ? refundedRes.refunded : {};
    const keyOf = (item) => {
      const pid = Number(item.product_id||0);
      const op = (item.operation_id==null) ? 'null' : String(item.operation_id);
      const mult = Number(item.unit_multiplier ?? 1);
      const price = Number(item.price||0);
      return `${pid}|${op}|${mult}|${price}`;
    };
    
    if(invoiceInfo) invoiceInfo.textContent = `الفاتورة: ${sale.invoice_no || saleId} | العميل: ${sale.customer_name || 'غير محدد'}`;
    
    itemsContainer.innerHTML = '';
    
    const selectedItems = [];
    let hasAvailableItems = false;
    
    // نسخ الكميات المرتجعة للتعامل معها محلياً (لاستهلاك الكميات في حالة وجود أكثر من سطر لنفس المنتج)
    const remainingRefunds = { ...refundedQty };
    
    saleItems.forEach((item, idx) => {
      const key = keyOf(item);
      const originalQty = Math.abs(Number(item.qty||0));
      
      // كم تم إرجاعه من هذا النوع (المتبقي في المخزن المؤقت)
      const refundedTotal = Number(remainingRefunds[key]||0);
      
      // الكمية التي نعتبرها مرتجعة من هذا السطر تحديداً (لا تزيد عن كمية السطر ولا عن المتبقي من المرتجعات)
      const refundedFromThisLine = Math.min(originalQty, refundedTotal);
      
      // الكمية المتبقية القابلة للإرجاع في هذا السطر
      const remainingQty = originalQty - refundedFromThisLine;
      
      // خصم الكمية المستهلكة من المخزن المؤقت
      remainingRefunds[key] = Math.max(0, refundedTotal - refundedFromThisLine);
      
      // إخفاء الأصناف التي تم إرجاعها بالكامل
      if(remainingQty <= 0) return;
      
      hasAvailableItems = true;
      const itemDiv = document.createElement('div');
      itemDiv.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 10px; background: #fff; border-radius: 8px; border: 2px solid #e2e8f0;';
      
      const checkboxId = `refund_item_${idx}`;
      const qtyId = `refund_qty_${idx}`;
      
      const qtyDisplay = `الكمية المتبقية: ${remainingQty.toFixed(2)}`;
      
      itemDiv.innerHTML = `
        <input type="checkbox" id="${checkboxId}" style="width: 18px; height: 18px; cursor: pointer;" />
        <div style="flex: 1; display: flex; flex-direction: column;">
          <div style="font-weight: 700; color: #1e293b; font-size: 14px;">${item.name || 'منتج'}</div>
          <div style="font-size: 12px; color: #64748b;">${qtyDisplay} | السعر: ${Number(item.price||0).toFixed(2)} ريال</div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <label for="${qtyId}" style="font-size: 13px; color: #475569; font-weight: 600;">الكمية:</label>
          <input type="number" id="${qtyId}" min="0" max="${remainingQty}" step="0.01" value="0" style="width: 80px; padding: 6px 8px; border: 2px solid #cbd5e1; border-radius: 6px; text-align: center; font-size: 13px;" disabled />
        </div>
      `;
      
      itemsContainer.appendChild(itemDiv);
      
      const checkbox = document.getElementById(checkboxId);
      const qtyInput = document.getElementById(qtyId);
      
      checkbox.addEventListener('change', () => {
        if(checkbox.checked){
          qtyInput.disabled = false;
          qtyInput.value = remainingQty.toFixed(2);
        } else {
          qtyInput.disabled = true;
          qtyInput.value = '0';
        }
        updateTotals();
      });
      
      qtyInput.addEventListener('input', updateTotals);
    });
    
    // في حالة عدم وجود أصناف متاحة للإرجاع
    if(!hasAvailableItems){
      itemsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b; font-size: 14px;">✓ تم إرجاع جميع الأصناف من هذه الفاتورة</div>';
      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.5';
      confirmBtn.style.cursor = 'not-allowed';
    }
    
    function updateTotals(){
      let subtotal = 0;
      saleItems.forEach((item, idx) => {
        const checkbox = document.getElementById(`refund_item_${idx}`);
        const qtyInput = document.getElementById(`refund_qty_${idx}`);
        
        if(checkbox && checkbox.checked && qtyInput){
          const qty = Number(qtyInput.value||0);
          const price = Number(item.price||0);
          subtotal += qty * price;
        }
      });
      
      const vatPercent = Number(sale.vat_total||0) / (Number(sale.sub_total||0) || 1) * 100;
      const vat = Number((subtotal * (vatPercent/100)).toFixed(2));
      const total = Number((subtotal + vat).toFixed(2));
      
      if(subtotalEl) subtotalEl.textContent = subtotal.toFixed(2) + ' ريال';
      if(vatEl) vatEl.textContent = vat.toFixed(2) + ' ريال';
      if(totalEl) totalEl.textContent = total.toFixed(2) + ' ريال';
    }
    
    const closeModal = () => {
      modal.style.display = 'none';
    };
    
    cancelBtn.onclick = closeModal;
    closeBtn.onclick = closeModal;
    
    confirmBtn.onclick = async () => {
      const refundItems = [];
      saleItems.forEach((item, idx) => {
        const checkbox = document.getElementById(`refund_item_${idx}`);
        const qtyInput = document.getElementById(`refund_qty_${idx}`);
        
        if(checkbox && checkbox.checked && qtyInput){
          const qty = Number(qtyInput.value||0);
          if(qty > 0){
            refundItems.push({
              product_id: item.product_id,
              qty: qty,
              price: Number(item.price||0),
              operation_id: item.operation_id ?? null,
              unit_multiplier: item.unit_multiplier ?? 1
            });
          }
        }
      });
      
      if(!refundItems.length){ showErrorNotification('⚠️ يرجى اختيار صنف واحد على الأقل للإرجاع'); return; }
      
      confirmBtn.disabled = true;
      confirmBtn.textContent = '⏳ جاري الإصدار...';
      
      try{
        const r = await window.api.sales_refund_partial({
          sale_id: saleId,
          items: refundItems,
          reason: 'إرجاع جزئي',
          notes: null
        });
        
        if(!r || !r.ok){ 
          showErrorNotification('❌ ' + (r?.error||'تعذر إنشاء إشعار دائن جزئي')); 
          return; 
        }
        
        showSuccessNotification('✓ تم إنشاء إشعار دائن جزئي وإرجاع المخزون بنجاح', 5000);
        
        try{
          const fmt = (settings && settings.default_print_format === 'a4') ? 'a4' : 'thermal';
          const page = fmt === 'a4' ? 'print-a4.html' : 'print.html';
          const params = new URLSearchParams({ 
            id: String(r.credit_sale_id), 
            pay: String(r.base_payment_method||''), 
            base: String(r.base_sale_id||''), 
            base_no: String(r.base_invoice_no||'') 
          });
          const w = fmt==='a4' ? 800 : 500;
          const h = fmt==='a4' ? 900 : 700;
          window.open(`../sales/${page}?${params.toString()}`, 'PRINT_VIEW', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
        }catch(_){ }
        
        closeModal();
        
        try{
          cart = []; renderCart();
          setProcessingMode(false);
          try{ if(processInvoiceNoEl){ processInvoiceNoEl.value=''; } }catch(_){ }
          __processedSaleId = null;
          __processedSaleData = null;
          try{
            const methods = Array.isArray(settings.payment_methods) && settings.payment_methods.length ? settings.payment_methods : ['cash'];
            if(settings.default_payment_method && methods.includes(settings.default_payment_method)){
              paymentMethod.value = settings.default_payment_method;
            } else { paymentMethod.value = methods[0]; }
          }catch(_){ }
          if(cashReceived){ cashReceived.value=''; cashReceived.placeholder='المبلغ المدفوع'; cashReceived.disabled=false; }
          if(discountTypeEl){ discountTypeEl.value='none'; }
          if(discountValueEl){ discountValueEl.value=''; }
          if(extraValueEl){ extraValueEl.value=''; }
          if(notes){ notes.value=''; }
          __selectedCustomerId = '';
          __selectedDriverId = '';
          try{ customerSearch.value=''; customerList.style.display='none'; if(driverSelect){ driverSelect.value=''; } }catch(_){ }
          if(__currentRoomId){ await __saveRoomCart(__currentRoomId, cart); try{ await window.api.rooms_set_status(__currentRoomId, 'vacant'); }catch(_){ } }
        }catch(_){ }
        
      }catch(e){ 
        console.error(e); 
        showErrorNotification('❌ تعذر إنشاء إشعار دائن جزئي'); 
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = '✓ إصدار إشعار دائن';
      }
    };
    
    modal.style.display = 'flex';
    updateTotals();
    
    // تفعيل عناصر الـ modal يدوياً لأن setProcessingMode عطّلها
    confirmBtn.disabled = false;
    cancelBtn.disabled = false;
    closeBtn.disabled = false;
    
    // تفعيل checkboxes و quantity inputs
    saleItems.forEach((item, idx) => {
      const checkbox = document.getElementById(`refund_item_${idx}`);
      const qtyInput = document.getElementById(`refund_qty_${idx}`);
      if(checkbox) checkbox.disabled = false;
      if(qtyInput && !checkbox?.checked) qtyInput.disabled = true; // الـ qty يبقى معطّل حتى يتم تحديد الـ checkbox
      else if(qtyInput) qtyInput.disabled = false;
    });
    
  }catch(e){
    console.error(e);
    showErrorNotification('❌ تعذر فتح نافذة الإرجاع الجزئي');
  }
}

async function loadInvoiceIntoCartByNumber(invNo){
  setError(''); __processedSaleId = null; __processedSaleData = null;
  try{
    const q = String(invNo||'').trim(); if(!q){ showErrorNotification('⚠️ أدخل رقم فاتورة صحيح'); return; }
    // ابحث عن الفاتورة برقمها بدقة
    const res = await window.api.sales_list({ invoice_no: q });
    if(!res || !res.ok || !Array.isArray(res.items) || !res.items.length){ showErrorNotification('❌ لم يتم العثور على الفاتورة'); return; }
    // اختر أول نتيجة مطابقة تمامًا إن وجدت
    const exact = res.items.find(x => String(x.invoice_no) === q) || res.items[0];
    const gid = exact.id;
    const det = await window.api.sales_get(gid);
    if(!det || !det.ok){ showErrorNotification('❌ تعذر جلب تفاصيل الفاتورة'); return; }
    
    // منع معالجة الفواتير الدائنة (credit notes)
    if(det.sale && String(det.sale.doc_type) === 'credit_note'){
      showErrorNotification('❌ لا يمكن معالجة إشعار دائن (CN). يمكن فقط معالجة الفواتير العادية');
      return;
    }
    
    const items = det.items||[];
    // املأ السلة من عناصل الفاتورة
    cart = items.map(it => ({
      id: Number(it.product_id),
      name: it.name,
      name_en: it.name_en || null,
      description: it.description || '',
      price: Number(it.price||0),
      qty: Number(it.qty||1),
      operation_id: (it.operation_id || null),
      operation_name: (it.operation_name || null),
      variant_id: (it.operation_id || null),  // استعادة variant_id من operation_id
      variant_name: (it.operation_name || null),  // استعادة variant_name من operation_name
      unit_name: (it.unit_name || null),
      unit_multiplier: (it.unit_multiplier || 1),
      category: (it.category || null),
      // Preserve tobacco flag so totals can compute tobacco fee during processing
      is_tobacco: (Number(it.is_tobacco||0) === 1)
    }));
    __processedSaleId = Number(det.sale?.id || gid);
    
    // حفظ بيانات الفاتورة
    __processedSaleData = det.sale || {};

    // عيّن الخصم والإضافى من الفاتورة الأصلية ليظهر في الملخص أثناء وضع المعالجة
    try{
      const s = det.sale || {};
      // اضبط طريقة الدفع لتطابق الفاتورة الأصلية
      try{
        if(paymentMethod && s.payment_method){
          const exists = Array.from(paymentMethod.options||[]).some(o => o.value === s.payment_method);
          if(!exists){
            const opt = document.createElement('option');
            opt.value = s.payment_method;
            opt.textContent = getPaymentMethodLabel(s.payment_method, document.documentElement.lang === 'ar');
            paymentMethod.appendChild(opt);
          }
          paymentMethod.value = s.payment_method;
        }
      }catch(_){ }
      // extra (قبل الضريبة)
      if(extraValueEl){ extraValueEl.value = String(Number(s.extra_value||0)); }
      // لا تستخدم الكوبون في الوضع المقيد؛ طبّق الخصم كقيمة مباشرة أو نسبة
      let dt = String(s.discount_type||'none');
      let dv = Number(s.discount_value||0);
      const da = Number(s.discount_amount||0);
      if(dt === 'coupon'){
        dt = 'amount'; dv = da; // طبّق قيمة الكوبون كخصم نقدي مباشر
        try{ __coupon = null; if(couponInfoEl){ couponInfoEl.textContent=''; } }catch(_){ }
      }
      if(discountTypeEl){ discountTypeEl.value = (dt==='percent' || dt==='amount') ? dt : 'amount'; }
      if(discountValueEl){ discountValueEl.value = String((dt==='percent') ? dv : (dt==='amount' ? (dv||da) : 0)); }
    }catch(_){ }

    renderCart();
    // اقفل الشاشة
    setProcessingMode(true);
  }catch(e){ console.error(e); showErrorNotification('❌ حدث خطأ أثناء المعالجة'); }
}

function fmt(amount){
  const a = Number(amount||0);
  const s = a.toFixed(2);
  let sym = String(settings.currency_symbol || '').trim();
  if(!sym) sym = '﷼';
  // Fix double symbols: if it looks like Saudi Riyal (including the symbol itself), force single symbol
  if(/﷼|SAR|SR|ريال|ر\.س|\uE900/i.test(sym)){ sym = '\ue900'; }
  const symHtml = `<span class="currency-symbol">${sym}</span>`;
  return settings.currency_symbol_position === 'before'
    ? `${symHtml} ${s}`
    : `${s} ${symHtml}`;
}

function computeTotals(){
  let sub = 0, vat = 0, grand = 0;
  const vatPct = (Number(settings.vat_percent) || 0) / 100;

  // إجمالي قبل الضريبة (sub) من عناصر السلة
  let subEligibleForOffer = 0;
  cart.forEach(item => {
    const price = Number(item.price || 0);
    const qty = Number(item.qty || 1);
    let itemBase = 0;
    if(settings.prices_include_vat){
      const base = price / (1 + vatPct);
      itemBase = base * qty;
      sub += itemBase;
    } else {
      itemBase = price * qty;
      sub += itemBase;
    }

    // Check eligibility for global offer
    let isExcluded = false;
    if (__globalOffer && __globalOffer.excluded) {
        const pid = Number(item.id||item.product_id||0);
        const opid = (item.operation_id!=null && item.operation_id!=='') ? String(item.operation_id) : 'null';
        if (__globalOffer.excluded.has(`${pid}|${opid}`) || __globalOffer.excluded.has(`${pid}|null`)) {
            isExcluded = true;
        }
    }
    if (!isExcluded) {
        subEligibleForOffer += itemBase;
    }
  });

  // الإضافى (قبل الضريبة) — يخضع للضريبة ويُدمج مع الأساس مثل السابق
  const extra = extraValueEl ? Math.max(0, Number(extraValueEl.value||0)) : 0;
  const itemsSub = sub; // احتفظ بمجموع الأصناف فقط لاستخدامه في حد التبغ
  sub += extra; // أعد دمج الإضافى في المجموع قبل الخصم كما كان سابقًا
  subEligibleForOffer += extra;

  // حساب خصم عروض الكمية لكل صنف قبل تطبيق الخصم العام/الكوبون/اليدوي
  let qtyOffersDiscount = 0;
  try{
    if(Array.isArray(cart) && cart.length){
      // جهّز تجميعًا حسب (product_id, operation_id) لتطبيق قواعد العرض الكمي لكل مجموعة
      const groups = new Map(); // key: pid|opid|null -> { items: [ {price, qty} ], rule }
      cart.forEach(it => {
        const pid = Number(it.id||it.product_id||0); if(!pid) return;
        const opid = (it.operation_id!=null && it.operation_id!=='') ? Number(it.operation_id) : null;
        const key = pid + '|' + (opid==null ? 'null' : String(opid));
        if(!groups.has(key)) groups.set(key, { pid, opid, items: [], rule: null });
        groups.get(key).items.push({ price: Number(it.price||0), qty: Number(it.qty||0) });
      });
      // ملاحظة: نتوقع أن القواعد محملة مسبقًا أو سنجلبها عند الحاجة في on-add؛ هنا نستخدم مخزنًا مؤقتًا إن توفر
      const rulesCache = window.__qtyRulesCache || new Map();
      // احسب خصم كل مجموعة
      groups.forEach((g, _key) => {
        const rule = rulesCache.get(g.pid + '|' + (g.opid==null?'null':String(g.opid))) || null;
        if(!rule) return;
        const buyQty = Math.max(1, Number(rule.buy_qty||0));
        const nth = Math.max(1, Number(rule.nth||1));
        const perGroup = Number(rule.per_group||0) ? 1 : 0;
        // حوّل العناصر المتعددة إلى قائمة قطع فردية للحساب بدقة حسب nth داخل كل مجموعة شراء
        const units = [];
        g.items.forEach(x => { const q = Math.floor(Number(x.qty||0)); for(let i=0;i<q;i++){ units.push(Number(x.price||0)); } });
        if(units.length === 0) return;
        const discountMode = (rule.product_mode && rule.product_value && Number(rule.product_value) > 0) 
          ? rule.product_mode 
          : rule.mode;
        const discountValue = (rule.product_mode && rule.product_value && Number(rule.product_value) > 0) 
          ? Number(rule.product_value) 
          : Number(rule.value||0);
        
        if(!discountValue || discountValue <= 0) return;
        
        let discounts = 0;
        if(perGroup){
          // لكل مجموعة حجمها buyQty، طبّق خصم على العنصر رقم nth داخل المجموعة (إن وُجد)
          for(let i=0;i+buyQty-1<units.length; i+=buyQty){
            const idx = i + (nth-1);
            if(idx < units.length){
              const price = units[idx];
              if(String(discountMode)==='percent') discounts += price * (discountValue/100);
              else discounts += Math.min(price, discountValue);
            }
          }
        } else {
          // بدون تكرار داخل المجموعة: طبّق الخصم مرة واحدة لكل buyQty (أي على nth من كل buyQty متتالية)
          let remaining = units.length;
          let start = 0;
          while(remaining >= buyQty){
            const idx = start + (nth-1);
            if(idx < units.length){
              const price = units[idx];
              if(String(discountMode)==='percent') discounts += price * (discountValue/100);
              else discounts += Math.min(price, discountValue);
            }
            start += buyQty;
            remaining -= buyQty;
          }
        }
        qtyOffersDiscount += discounts;
      });
    }
  }catch(_){ /* ignore */ }

  // حساب الخصم قبل الضريبة مع ضبط الحدود حتى لا يتجاوز الإجمالي 100%
  const dtype = discountTypeEl ? discountTypeEl.value : 'none';
  const dval = discountValueEl ? Number(discountValueEl.value || 0) : 0;

  // نسب الخصم
  const manualPct = (dtype === 'percent') ? Math.min(100, Math.max(0, dval)) : 0;
  const couponPct = (__coupon && String(__coupon.mode)==='percent') ? Math.max(0, Number(__coupon.value||0)) : 0;
  const offerPct  = (__globalOffer && String(__globalOffer.mode)==='percent') ? Math.max(0, Number(__globalOffer.value||0)) : 0;
  
  // Calculate percent discount respecting exclusions
  let percentDiscountAmount = 0;
  if (!__globalOffer?.excluded || __globalOffer.excluded.size === 0) {
      const combinedPct = Math.min(100, manualPct + couponPct + offerPct);
      percentDiscountAmount = sub * (combinedPct/100);
  } else {
      const subIneligible = Math.max(0, sub - subEligibleForOffer);
      const eligiblePct = Math.min(100, manualPct + couponPct + offerPct);
      const ineligiblePct = Math.min(100, manualPct + couponPct);
      percentDiscountAmount = (subEligibleForOffer * (eligiblePct/100)) + (subIneligible * (ineligiblePct/100));
  }

  // خصومات بمبالغ ثابتة
  const manualAmt = (dtype === 'amount') ? Math.max(0, Math.min(sub, Number(dval||0))) : 0;
  const couponAmt = (__coupon && String(__coupon.mode)!=='percent') ? Math.max(0, Math.min(sub, Number(__coupon.value||0))) : 0;
  // Offer amount capped at eligible sub if exclusions exist
  let offerAmt = 0;
  if (__globalOffer && String(__globalOffer.mode)!=='percent') {
      const val = Number(__globalOffer.value||0);
      const limit = (__globalOffer.excluded && __globalOffer.excluded.size > 0) ? subEligibleForOffer : sub;
      offerAmt = Math.max(0, Math.min(limit, val));
  }

  // إجمالي الخصم لا يتجاوز قيمة المجموع الفرعي — يشمل خصم عروض الكمية الآن
  const totalDiscount = Math.min(sub, Number((qtyOffersDiscount + percentDiscountAmount + manualAmt + couponAmt + offerAmt).toFixed(2)));
  const itemsSubAfterDiscount = Math.max(0, itemsSub - (totalDiscount * (itemsSub>0 ? (itemsSub/sub) : 0))); // خصم جزء من الإضافى لا يؤثر على شرط 25
  let subAfterDiscount = Math.max(0, sub - totalDiscount); // بعد الخصم على الأصناف + الإضافى

  // قيم إرشادية للتسمية (لا تؤثر على الإجمالي بعد التقيد بنسبة 100%)
  let couponAmount = 0; let couponLabel = '';
  if(__coupon){
    if(String(__coupon.mode) === 'percent'){
      couponAmount = sub * (Math.max(0, Number(__coupon.value||0))/100);
      couponLabel = `${Math.round(Number(__coupon.value||0))}%`;
    } else {
      couponAmount = Math.min(sub, Number(__coupon.value||0));
      const v = Number(__coupon.value||0);
      couponLabel = `${Number.isInteger(v) ? v : v.toFixed(2)}`;
    }
  }
  let offerAmount = 0; let offerLabel = '';
  if(__globalOffer){
    const limit = (__globalOffer.excluded && __globalOffer.excluded.size > 0) ? subEligibleForOffer : sub;
    if(String(__globalOffer.mode) === 'percent'){
      offerAmount = limit * (Math.max(0, Number(__globalOffer.value||0))/100);
      offerLabel = `${Math.round(Number(__globalOffer.value||0))}%`;
    } else {
      offerAmount = Math.min(limit, Number(__globalOffer.value||0));
      const v = Number(__globalOffer.value||0);
      offerLabel = `${Number.isInteger(v) ? v : v.toFixed(2)}`;
    }
  }

  // حساب رسوم التبغ وفق الشرط الجديد
  let tobaccoFee = 0;
  try{
    // حدد مجموع أصناف التبغ كأساس قبل الضريبة (يتوافق مع sub)
    let tobaccoSub = 0;
    cart.forEach(item => {
      if(item && (item.is_tobacco===1 || item.is_tobacco===true)){
        const price = Number(item.price||0);
        const qty = Number(item.qty||1);
        if(settings.prices_include_vat){
          const base = price / (1 + vatPct);
          tobaccoSub += base * qty;
        } else {
          tobaccoSub += price * qty;
        }
      }
    });
    const hasTobacco = tobaccoSub > 0.000001;
    if(hasTobacco){
      // وزّع الخصم على التبغ بنسبة مساهمته
      const discountOnTobacco = sub > 0 ? totalDiscount * (tobaccoSub / sub) : 0;
      const discountedTobaccoBase = Math.max(0, tobaccoSub - discountOnTobacco);
      const feeByPercent = discountedTobaccoBase * (Number(settings.tobacco_fee_percent||100)/100);
      if(itemsSubAfterDiscount < 25){
        tobaccoFee = Number(settings.tobacco_min_fee_amount||25);
      } else {
        tobaccoFee = feeByPercent;
      }
      // أضف الرسوم إلى الأساس الخاضع للضريبة بعد extra
      subAfterDiscount += tobaccoFee;
    }
  }catch(_){ /* ignore */ }

  // الضريبة تُحسب على المبلغ بعد الخصم: إذا كانت الأسعار شاملة الضريبة، نحسب VAT على الفرق فقط
  if(settings.prices_include_vat){
    // grand قبل كانت تساوي sum(prices) + extra - discount + tobaccoFee (شاملة الضريبة)،
    // لكن هنا subAfterDiscount يمثل الأساس بعد الخصم مضافًا له رسوم التبغ.
    // VAT = الأساس بعد الخصم × نسبة الضريبة
    vat = subAfterDiscount * vatPct;
    grand = subAfterDiscount + vat;
  } else {
    // في حالة الأسعار غير شاملة الضريبة: VAT دائمًا على الأساس بعد الخصم
    vat = subAfterDiscount * vatPct;
    grand = subAfterDiscount + vat;
  }

  // تحديث الواجهة
  // 0) سطر الإضافى قبل الإجمالي قبل الضريبة
  if(extraSummaryRowEl && extraAmountEl){
    if(extra > 0){
      extraSummaryRowEl.classList.remove('hidden');
      extraSummaryRowEl.style.display = '';
      extraAmountEl.innerHTML = fmt(extra);
    } else {
      extraSummaryRowEl.classList.add('hidden');
      extraSummaryRowEl.style.display = 'none';
      extraAmountEl.textContent = '';
    }
  }
  // 1) الإجمالي قبل الضريبة
  subTotalEl.innerHTML = fmt(sub);
  // إظهار سطر ملخص الخصم بشكل منفصل
  if(discountSummaryRowEl && discountAmountEl){
    if(totalDiscount > 0){
      // أولوية التسمية: كوبون ثم عرض عام ثم نوع الخصم اليدوي
      const isAr = document.documentElement.lang === 'ar';
      let label = getDiscountLabel('default', '', isAr);
      if(couponAmount > 0){ label = getDiscountLabel('coupon', couponLabel, isAr); }
      else if(offerAmount > 0){ 
        if(String(__globalOffer?.mode)==='percent'){
          label = isAr ? `${Math.round(Number(__globalOffer?.value||0))}%` : `${Math.round(Number(__globalOffer?.value||0))}% off`;
        } else {
          label = getDiscountLabel('offer', '', isAr);
        }
      }
      else if(dtype === 'percent'){ label = getDiscountLabel('percent', dval, isAr); }
      else if(dtype === 'amount'){ label = getDiscountLabel('amount', '', isAr); }
      if(discountLabelEl) discountLabelEl.textContent = label;
      discountAmountEl.innerHTML = '-' + fmt(totalDiscount);
      discountSummaryRowEl.classList.remove('hidden');
      discountSummaryRowEl.style.display = '';
    } else {
      const isAr = document.documentElement.lang === 'ar';
      if(discountLabelEl) discountLabelEl.textContent = getDiscountLabel('default', '', isAr);
      discountAmountEl.textContent = '';
      discountSummaryRowEl.classList.add('hidden');
      discountSummaryRowEl.style.display = 'none';
    }
  }
  if(afterDiscountEl){ afterDiscountEl.innerHTML = fmt(itemsSubAfterDiscount); }
  if(afterDiscountRowEl){ 
    if(totalDiscount > 0){
      afterDiscountRowEl.classList.remove('hidden');
      afterDiscountRowEl.style.display = '';
    } else {
      afterDiscountRowEl.classList.add('hidden');
      afterDiscountRowEl.style.display = 'none';
    }
  }
  // إظهار رسوم التبغ إن وُجدت
  try{
    const feeRow = document.getElementById('tobaccoFeeRow');
    const feeVal = document.getElementById('tobaccoFee');
    if(feeRow && feeVal){
      if(tobaccoFee > 0){
        feeRow.classList.remove('hidden');
        feeRow.style.display='';
        feeVal.innerHTML = fmt(tobaccoFee);
      } else {
        feeRow.classList.add('hidden');
        feeRow.style.display='none'; 
        feeVal.textContent='';
      }
    }
  }catch(_){ }
  vatTotalEl.innerHTML = fmt(vat);
  grandTotalEl.innerHTML = fmt(grand);
  // عند عدم وجود ضريبة: إخفِ صف الضريبة وعدّل التسميات لعرض "المجموع" و"الإجمالي"
  try{
    const noVat = Number(settings.vat_percent||0) === 0;
    const isAr = document.documentElement.lang === 'ar';
    // إظهار/إخفاء صف الضريبة (السطر الذي يحتوي قيمة VAT)
    const vatRowEl = document.getElementById('vatTotal')?.closest('.row');
    if(vatRowEl){ vatRowEl.style.display = noVat ? 'none' : ''; }
    // تعديل تسمية "الإجمالي قبل الضريبة" إلى "المجموع" عند عدم وجود ضريبة
    const subLabelEl = document.getElementById('subtotalLabel');
    if(subLabelEl){ 
      subLabelEl.textContent = noVat 
        ? (isAr ? 'المجموع' : 'Total') 
        : (isAr ? 'قبل الضريبة' : 'Subtotal (before VAT)'); 
    }
    // تعديل تسمية "الإجمالي شامل الضريبة" إلى "الإجمالي" عند عدم وجود ضريبة
    const grandLabelEl = document.getElementById('grandTotalLabel');
    if(grandLabelEl){ 
      grandLabelEl.textContent = noVat 
        ? (isAr ? 'الإجمالي' : 'Grand total') 
        : (isAr ? 'الإجمالي' : 'Grand total (incl. VAT)'); 
    }
  }catch(_){ /* ignore */ }
  // save cart state per-room on every totals recompute (safe point)
  if(__currentRoomId){ __saveRoomCart(__currentRoomId, cart); }
  // تحديث شريط معلومات الكوبون
  if(couponInfoEl){
    if(__coupon){
      if(__coupon.mode==='percent'){
        couponInfoEl.textContent = `- ${Math.round(Number(__coupon.value||0))}%`;
      } else {
        const v = Number(__coupon.value||0);
        couponInfoEl.textContent = `- ${Number.isInteger(v) ? v : v.toFixed(2)}`; // بدون عملة
      }
      couponInfoEl.style.color = '#0b3daa';
    } else {
      couponInfoEl.textContent = '';
    }
  }

  // ضبط حدود إدخال "المبلغ المدفوع"
  if(cashReceived){
    try{
      // الحقل دائمًا ظاهر الآن؛ فقط نضبط الحدود
      cashReceived.min = 0;
      if(paymentMethod && paymentMethod.value === 'mixed'){
        cashReceived.max = Number(grand.toFixed(2));
      } else {
        cashReceived.removeAttribute('max');
      }
    }catch(_){ /* ignore */ }
  }

  // حفظ قيم للحفظ/الطباعة
  window.__sale_calcs = {
    sub_total: Number(sub.toFixed(2)),
    extra_value: Number(extra.toFixed(2)),
    discount_type: couponAmount>0 ? 'coupon' : dtype,
    discount_value: couponAmount>0 ? Number(__coupon?.value||0) : Number(dval.toFixed(2)),
    discount_amount: Number(totalDiscount.toFixed(2)),
    sub_after_discount: Number(subAfterDiscount.toFixed(2)),
    vat_total: Number(vat.toFixed(2)),
    grand_total: Number(grand.toFixed(2)),
    tobacco_fee: Number((tobaccoFee||0).toFixed(2)),
    coupon: __coupon || null,
  };
}

function renderCart(){
  tbody.innerHTML = '';
  // أخفِ عناصر التحكم اليمنى أثناء وضع المعالجة
  try{
    if(__isProcessingOld){
      if(document.getElementById('couponCode')) document.getElementById('couponCode').disabled = true;
      if(document.getElementById('extraValue')) document.getElementById('extraValue').disabled = true;
      if(document.getElementById('discountType')) document.getElementById('discountType').disabled = true;
      if(document.getElementById('discountValue')) document.getElementById('discountValue').disabled = true;
      if(document.getElementById('paymentMethod')) document.getElementById('paymentMethod').disabled = true;
      if(document.getElementById('cashReceived')) document.getElementById('cashReceived').disabled = true;
      if(document.getElementById('customerSearch')) document.getElementById('customerSearch').disabled = true;
      if(document.getElementById('driverSelect')) document.getElementById('driverSelect').disabled = true;
      if(document.getElementById('notes')) document.getElementById('notes').disabled = true;
      const btnPay = document.getElementById('btnPay'); if(btnPay) btnPay.disabled = true;
      const btnClear = document.getElementById('btnClear'); if(btnClear) btnClear.disabled = true;
      const btnKitchen = document.getElementById('btnKitchen'); if(btnKitchen) btnKitchen.disabled = true;
    }
  }catch(_){ }
  cart.forEach((it, idx) => {
    // افحص مخزون هذا الصنف مقابل العتبة دون تكرار مكالمات كثيرة
    try{ checkLowStockForItems([it]); }catch(_){ }
    // في وضع الوزن: لا تُحوّل إلى كمية إلا إذا كان المصدر هو "المبلغ"
    try{
      if(settings.weight_mode_enabled && it.__wm_source === 'amount'){
        const price = Number(it.price||0);
        const amt = Number(it.__amount||NaN);
        if(isFinite(amt) && price>0){ it.qty = Math.max(0, Number((amt/price).toFixed(3))); }
      }
    }catch(_){ }
    // الصف الرئيسي: الاسم، العملية، السعر، الكمية، الإجمالي، حذف
    const tr = document.createElement('tr');
    // كسر اسم المنتج إلى أسطر كل سطر يحتوي كلمتين
    const nameHtml = (() => {
      const raw = String(it.name||'');
      const words = raw.split(/\s+/).filter(Boolean);
      if(words.length === 0) return '';
      const out = [];
      for(let i=0;i<words.length;i++){
        out.push(escapeHtml(words[i]));
        if(i < words.length - 1){
          if(i % 2 === 1) out.push('<br/>'); else out.push(' ');
        }
      }
      return out.join('');
    })();
    // Build qty and amount inputs based on weight mode
    const __isWM = !!settings.weight_mode_enabled;
    const __amountVal = Number((it.__amount ?? ((Number(it.price||0)) * (Number(it.qty||0)))));
    // Check if this item has decimal quantity (from electronic scale)
    const hasDecimalQty = !Number.isInteger(Number(it.qty||0));
    // Qty field: in weight mode make it editable (weight), linked with amount; otherwise normal editable qty
    // Allow decimal quantities if electronic scale is enabled or item already has decimal qty
    const __qtyAttrs = (__isWM || hasDecimalQty)
      ? 'min="0" step="0.001" placeholder="الكمية" value="'+String(Number(it.qty||0).toFixed(3))+'"'
      : 'min="1" step="1" value="'+String(it.qty)+'"';
    const selectedEmp = it.employee_id ? __allEmployees.find(e => String(e.id) === String(it.employee_id)) : null;
    const empTitle = selectedEmp ? escapeHtml(selectedEmp.name) : 'اختر الموظف';
    tr.innerHTML = `
      <td>
        <div style="display:block; margin-bottom:3px;">
          <span class="p-name" title="${escapeHtml(it.name)}" style="display:block; white-space:normal; word-break:break-word; overflow-wrap:anywhere; color:#0b3daa; font-weight:700; font-size:12px; line-height:1.25;">${nameHtml}${it.name_en ? `<div style='font-size:11px; color:#64748b; font-weight:500; line-height:1.2; word-break:break-word; overflow-wrap:anywhere;'>${escapeHtml(it.name_en)}</div>`:''}</span>
        </div>
        ${settings.show_employee_selector ? `<div style="display:block; margin-top:3px;"><select data-idx="${idx}" class="employee-select" title="${empTitle}" ${__isProcessingOld?'disabled':''}>
          <option value="">اختر</option>
          ${__allEmployees.map(emp => `<option value="${emp.id}" ${String(it.employee_id)===String(emp.id)?'selected':''}>${escapeHtml(emp.name)}</option>`).join('')}
        </select></div>` : ''}
      </td>
      <td>
        <select data-idx="${idx}" class="op-select w-full text-[10px] font-semibold text-slate-800 bg-white border border-slate-300 rounded px-1.5 py-1 leading-tight focus:outline-none focus:border-blue-500"></select>
        <span data-idx="${idx}" class="op-name-label hidden w-full text-[10px] font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 leading-tight"></span>
      </td>
      <td class="td-price">
        ${settings.op_price_manual
          ? `<input data-idx=\"${idx}\" class=\"op-price\" type=\"number\" step=\"0.01\" min=\"0\" style=\"width:${String(Number(it.price).toFixed(2)).length}ch; min-width:4ch; display:inline-block; box-sizing:content-box; max-width:100%; height:28px; padding:4px 6px; direction:ltr; text-align:left\" oninput=\"this.style.width = Math.max(4, this.value.length) + 'ch';\" placeholder=\"السعر\" value=\"${Number(it.price).toFixed(2)}\" ${__isProcessingOld?'disabled':''}/>`
          : `<span class=\"price-val\">${Number(it.price||0).toFixed(2)}</span>`}
      </td>
      <td class="td-qty">
        <div class="qty-wrap" style="display:flex; gap:3px; align-items:center;">
          <button class="btn qty-btn" data-act="dec" data-idx="${idx}" aria-label="نقصان" ${__isProcessingOld?'disabled':''}>−</button>
          <input data-idx="${idx}" class="qty" type="number" ${__qtyAttrs} style="width:${String((__isWM || hasDecimalQty) ? Number(it.qty||0).toFixed(3) : String(it.qty)).length}ch; min-width:3ch; display:inline-block; box-sizing:content-box; height:28px; padding:4px 4px; direction:ltr; text-align:center; border:2px solid #cbd5e1; border-radius:4px; font-weight:700; font-size:12px; background:linear-gradient(to bottom,#f8fafc,#f1f5fb);" oninput="this.style.width = Math.max(3, this.value.length) + 'ch';" ${__isProcessingOld?'disabled':''}/>
          <button class="btn qty-btn" data-act="inc" data-idx="${idx}" aria-label="زيادة" ${__isProcessingOld?'disabled':''}>+</button>
        </div>
      </td>
      <td class="td-total">
        ${__isWM
          ? `<input data-idx="${idx}" class="amount-paid" type="number" min="0" step="0.01" style="width:${String((isFinite(__amountVal) ? __amountVal.toFixed(2) : '0.00')).length}ch; min-width:4ch; display:inline-block; box-sizing:content-box; height:28px; padding:4px 4px; direction:ltr; text-align:left; border:2px solid #10b981; border-radius:4px; font-weight:700; font-size:12px; color:#059669; background:linear-gradient(to bottom,#ecfdf5,#e0fdf4);" placeholder="الإجمالي" value="${isFinite(__amountVal) ? __amountVal.toFixed(2) : '0.00'}" oninput="this.style.width = Math.max(4, this.value.length) + 'ch';" ${__isProcessingOld?'disabled':''}/>`
          : `<span class="total-val" style="display:inline-block; min-width:0; width:${String((Number(it.price||0) * Number(it.qty||0)).toFixed(2)).length}ch;">${(Number(it.price||0) * Number(it.qty||0)).toFixed(2)}</span>`}
      </td>
      <td style="text-align:center">
        ${__perms.includes('sales.remove_item') ? `<button class="btn danger" data-act="remove" data-idx="${idx}" style="min-width:44px; height:28px; padding:2px 4px; font-size:12px;" ${__isProcessingOld?'disabled':''}>حذف</button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);

    // صف ثانٍ للوصف فقط
    const trDesc = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6; // امتداد بعد إضافة عمود العملية
    const descVal = escapeHtml(it.description||'');
    td.innerHTML = `
      <textarea data-idx="${idx}" class="desc" placeholder="وصف الصنف (اختياري)" rows="1"
        style="width:100%; font-size:12px; line-height:1.3; padding:4px 6px; min-height:32px; resize:vertical; white-space:pre-wrap; overflow-wrap:anywhere;" ${__isProcessingOld?'disabled':''}>${descVal}</textarea>
    `;
    trDesc.appendChild(td);
    // أظهر صف ملاحظات الصنف دائمًا
    tbody.appendChild(trDesc);

    // تعبئة العمليات للعنصر ووضع الاختيار في الصف الرئيسي
    (async () => {
      try{
        if(!it.__opsLoaded){ it.__ops = await fetchProductOps(it.id); it.__opsLoaded = true; }
        const select = tr.querySelector('select.op-select');
        const opLabel = tr.querySelector('span.op-name-label');
        const priceInp = tr.querySelector('input.op-price');
        // إذا لا توجد عمليات، أخفِ عنصر الاختيار واترك السعر الافتراضي
        if(!it.__ops || it.__ops.length === 0){
          if(select) select.style.display = 'none';
          // احفظ operation_name إذا كانت من وحدات أو أصناف أو موجودة بالفعل
          const shouldPreserveOpName = it.unit_name || it.variant_id || it.operation_name;
          if(!shouldPreserveOpName){ delete it.operation_name; }
          // عرض اسم العملية كـ label فقط إن وجد (من وحدات أو أصناف)
          if(opLabel){
            if(it.operation_name){
              opLabel.textContent = it.operation_name;
              opLabel.classList.remove('hidden');
              opLabel.style.display = '';
            } else {
              opLabel.classList.add('hidden');
              opLabel.style.display = 'none';
            }
          }
          if(priceInp){ priceInp.value = String(Number(it.price||0).toFixed(2)); try{ priceInp.style.width = Math.max(4, priceInp.value.length) + 'ch'; }catch(_){ } }
        } else {
          if(select) select.style.display = '';
          if(opLabel) opLabel.style.display = 'none';
        }
        // املأ قائمة العمليات
        if(select){
          select.innerHTML = '';
          it.__ops.forEach(o => { const opt = document.createElement('option'); opt.value=String(o.operation_id||o.id); opt.textContent=o.name; select.appendChild(opt); });
          if(__isProcessingOld){ try{ select.disabled = true; }catch(_){ } }
        }
        // تطبيق العملية الأولى تلقائياً إذا لم يكن محدداً — لكن ليس إذا كان operation_name من الوحدات أو أصناف
        if(!it.operation_id && it.__ops.length && !it.unit_name && !it.operation_name){
          const first = it.__ops[0];
          const opId = (first.operation_id||first.id);
          it.operation_id = opId;
          it.operation_name = first.name;
          it.price = Number(first.price||it.price||0);
          try{ if(select) select.value = String(opId); }catch(_){ /* ignore */ }
        } else if(it.operation_id){
          try{ if(select) select.value = String(it.operation_id); }catch(_){ /* ignore */ }
        }
        if(priceInp){ priceInp.value = String(Number(it.price||0).toFixed(2)); try{ priceInp.style.width = Math.max(4, priceInp.value.length) + 'ch'; }catch(_){ } }
        computeTotals();

        // لم نعد نعرض المخزون داخل السلة بناءً على طلبك
      }catch(_){ /* ignore */ }
    })();
  });

  // بعد كل إعادة رسم للسلة، افحص المخزون للأصناف المضافة/المعدّلة مؤخرًا إذا لزم
  try{ if(cart && cart.length){ /* optional: could batch check recent item only */ } }catch(_){ }
  
  // ضبط عرض جميع select الموظفين ديناميكيًا
  try {
    const allEmpSelects = tbody.querySelectorAll('select.employee-select');
    allEmpSelects.forEach(empSelect => {
      // استخدام Canvas لقياس النص بدقة
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      const style = window.getComputedStyle(empSelect);
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const text = empSelect.options[empSelect.selectedIndex]?.text || 'اختر';
      const metrics = context.measureText(text);
      const textWidth = metrics.width;
      const calculatedWidth = Math.ceil(textWidth + 35);
      empSelect.style.width = `${Math.min(calculatedWidth, 250)}px`;
    });
  } catch(_) {}
  
  scheduleComputeTotals();
}

function attrEscape(s){ return String(s).replace(/"/g,'&quot;'); }
function escapeHtml(s){ return String(s).replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }



async function loadSettings(){
  const r = await window.api.settings_get();
  if(r.ok){ 
    settings = { ...settings, ...(r.item||{}) };
    customerDisplayEnabled = !!settings.customer_display_enabled;
    currencyCodeForDisplay = settings.currency_code || 'SAR';
    console.log('Customer display settings loaded:', {
      enabled: customerDisplayEnabled,
      currency: currencyCodeForDisplay
    });
  }
  // payment methods into select
  paymentMethod.innerHTML = '';
  const methods = Array.isArray(settings.payment_methods) && settings.payment_methods.length ? settings.payment_methods : ['cash'];
  const labels = { cash:'كاش', card:'شبكة', credit:'آجل', mixed:'مختلط', tamara:'تمارا', tabby:'تابي' };
  methods.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m; opt.textContent = labels[m] || m;
    paymentMethod.appendChild(opt);
  });
  // set default payment if configured, but don't override restored value for room sessions
  if(!__currentRoomId || !paymentMethod.value){
    if(settings.default_payment_method && methods.includes(settings.default_payment_method)){
      paymentMethod.value = settings.default_payment_method;
    }
  }
  // ضبط نص الحقل وفق طريقة الدفع الحالية
  try{
    if(cashReceived){
      // Initialize paid input based on default/current payment method
      if(paymentMethod.value === 'mixed'){
        cashReceived.disabled = false;
        cashReceived.placeholder = 'المبلغ النقدي (مختلط)';
      } else if(paymentMethod.value === 'credit' || paymentMethod.value === 'card' || paymentMethod.value === 'tamara' || paymentMethod.value === 'tabby'){
        cashReceived.value = '';
        cashReceived.disabled = true;
        cashReceived.placeholder = (paymentMethod.value === 'credit') ? 'المبلغ المدفوع (آجل)' : 'غير قابل للإدخال لهذه الطريقة';
      } else {
        cashReceived.disabled = false;
        cashReceived.placeholder = 'المبلغ المدفوع';
      }
    }
  }catch(_){ }
  // إظهار/إخفاء زر عرض السعر حسب الإعداد، وتكبير زر الطباعة عند الإخفاء
  try{
    const showQuotationBtn = (typeof settings.show_quotation_button === 'undefined') ? true : !!settings.show_quotation_button;
    if(btnQuotation){ btnQuotation.style.display = showQuotationBtn ? '' : 'none'; }
    // عند إخفاء زر عرض السعر: تكبير زر الطباعة ليأخذ المساحة
    const buttonsContainer = document.getElementById('buttonsContainer');
    if(buttonsContainer){
      if(showQuotationBtn){
        buttonsContainer.classList.remove('quotation-hidden');
      }else{
        buttonsContainer.classList.add('quotation-hidden');
      }
    }
  }catch(_){ }


  // تطبيق الكوبون تلقائياً عند الكتابة أو اللصق، وإلغاءه عند التفريغ
  if(couponCodeEl){
    const applyOrClearCoupon = async () => {
      const code = (couponCodeEl.value||'').trim();
      if(!code){
        __coupon = null;
        if(couponInfoEl){ couponInfoEl.textContent = ''; }
        computeTotals();
        return;
      }
      const sub = Number(window.__sale_calcs?.sub_total||0);
      const r = await window.api.coupons_validate({ code, sub_total: sub });
      if(!r || !r.ok){
        __coupon = null;
        if(couponInfoEl){ couponInfoEl.textContent = (r?.error||'كوبون غير صالح'); }
        computeTotals();
        return;
      }
      __coupon = { code: r.code, mode: r.mode, value: r.value, amount: r.amount };
      computeTotals();
    };
    couponCodeEl.addEventListener('input', applyOrClearCoupon);
    couponCodeEl.addEventListener('change', applyOrClearCoupon);
    couponCodeEl.addEventListener('blur', applyOrClearCoupon);
  }

  // 🚀 load customers, drivers, and employees in parallel
  try{
    const [lc, ld, le] = await Promise.all([
      window.api.customers_list({ active: '1', sort: 'name_asc' }),
      window.api.drivers_list({ only_active: 1 }),
      window.api.employees_list({})
    ]);
    
    // process customers
    __allCustomers = lc.ok ? (lc.items||[]) : [];
    customerList.innerHTML = '';
    customerList.style.display = 'none';
    if(__selectedCustomerId){
      const c = __allCustomers.find(x => String(x.id)===String(__selectedCustomerId));
      if(c){ customerSearch.value = (c.name||'') + (c.phone ? (' - ' + c.phone) : ''); }
    }
    
    // process drivers
    __allDrivers = ld.ok ? (ld.items||[]) : [];
    if(driverSelect){
      driverSelect.innerHTML = '<option value="">بدون سائق</option>' + (__allDrivers.map(d => `<option value="${d.id}">${(d.name||'')}${d.phone?(' - '+d.phone):''}</option>`).join(''));
      if(__selectedDriverId){ driverSelect.value = String(__selectedDriverId); }
      driverMeta.textContent = '';
      driverMeta.style.display = 'none';
      driverSelect.addEventListener('change', () => {
        __selectedDriverId = driverSelect.value || '';
        if(__currentRoomId){ __saveRoomCart(__currentRoomId, cart); }
      });
    }
    
    // process employees
    __allEmployees = le.ok ? (le.items||[]) : [];
  }catch(_){ /* ignore */ }
  
  // إضافة/إزالة class لإخفاء صور المنتجات
  try{
    if(settings.hide_product_images){
      document.body.classList.add('hide-product-images');
    } else {
      document.body.classList.remove('hide-product-images');
    }
  }catch(_){ /* ignore */ }
}

function renderCustomerList(q, list){
  const query = String(q||'').trim().toLowerCase();
  const base = Array.isArray(list) ? list : __allCustomers;
  const items = base.filter(c => {
    if(!query) return true;
    const n = String(c.name||'').toLowerCase();
    const p = String(c.phone||'').toLowerCase();
    return n.includes(query) || p.includes(query);
  });
  customerList.innerHTML = '';
  items.forEach(c => {
    const row = document.createElement('div');
    row.tabIndex = 0;
    row.style.padding = '8px 10px';
    row.style.cursor = 'pointer';
    row.style.borderBottom = '1px solid #f3f4f6';
    row.textContent = (c.name||'') + (c.phone ? (' - ' + c.phone) : '');
    row.addEventListener('click', () => selectCustomer(c));
    row.addEventListener('keydown', (e) => { if(e.key==='Enter'){ selectCustomer(c); } });
    customerList.appendChild(row);
  });
  customerList.style.display = items.length ? 'block' : 'none';
}

async function selectCustomer(c){
  __selectedCustomerId = c && c.id ? String(c.id) : '';
  customerSearch.value = c ? ((c.name||'') + (c.phone ? (' - ' + c.phone) : '')) : '';
  customerList.style.display = 'none';
  if(__currentRoomId){ __saveRoomCart(__currentRoomId, cart); }
  // بعد اختيار العميل، طبّق التسعير المخصص على أصناف السلة الحالية
  await updatePricesForCustomer();
  // حدّث أسعار بطاقات الكتالوج لتناسب العميل
  await loadCatalog();
}

function debounce(fn, delay=200){
  let t;
  return (...args)=>{
    clearTimeout(t);
    t = setTimeout(()=>fn(...args), delay);
  };
}

async function fetchCustomerSearch(q){
  const query = String(q||'').trim();
  if(!query){
    __customerSearchResults = [];
    customerList.innerHTML='';
    customerList.style.display='none';
    return;
  }
  const res = await window.api.customers_list({ q: query, active: '1', sort: 'name_asc', page: 1, pageSize: 50 });
  __customerSearchResults = res && res.ok ? (res.items||[]) : [];
  renderCustomerList(query, __customerSearchResults);
}

const triggerCustomerSearch = debounce(fetchCustomerSearch, 200);

if(customerSearch){
  customerSearch.addEventListener('input', async () => {
    const q = customerSearch.value||'';
    if(q.trim().length){
      __selectedCustomerId = '';
      triggerCustomerSearch(q);
    } else {
      __selectedCustomerId = '';
      __customerSearchResults = [];
      customerList.innerHTML='';
      customerList.style.display='none';
      await revertPricesToBase();
      await loadCatalog();
    }
    if(__currentRoomId){ __saveRoomCart(__currentRoomId, cart); }
  });
  customerSearch.addEventListener('focus', () => {
    const q = customerSearch.value||'';
    if(q.trim().length){ triggerCustomerSearch(q); }
  });
}

// remove legacy searchable driver UI (replaced by select)

if(paymentMethod){ paymentMethod.addEventListener('change', () => { if(__currentRoomId){ __saveRoomCart(__currentRoomId, cart); } }); }
if(notes){ notes.addEventListener('input', () => { if(__currentRoomId){ __saveRoomCart(__currentRoomId, cart); } }); }

async function loadCatalog(){
  // عرض سريع ثم تفاصيل لاحقاً + دعم التمرير اللامحدود
  const activeTab = typeTabs ? typeTabs.querySelector('.tab.active') : null;
  const cat = (typeTabs && activeTab) ? activeTab.dataset.cat : '';

  // إذا لا توجد أنواع رئيسية: لا تُظهر أي بطاقات
  if(__noMainTypes){
    try{ catalog.innerHTML=''; }catch(_){ }
    return;
  }

  // حالة وترتيب وتحكم التحميل المجزأ
  const pageSize = 50;
  if(!loadCatalog.__state){ loadCatalog.__state = { cat:'', q:'', offset:0, done:false, busy:false }; }
  const st = loadCatalog.__state;
  // إذا تغيّر التبويب أو تغيّر نص البحث، أعد الضبط
  const qNow = '';
  if(st.cat !== cat || st.q !== qNow){ 
    st.cat = cat; st.q = qNow; st.offset = 0; st.done = false; 
    catalog.innerHTML='<div style="text-align:center;padding:40px;color:#64748b;font-size:14px;">⏳ جاري التحميل...</div>';
    catalog.style.opacity = '1';
    if(loadCatalog.__productsCache){ loadCatalog.__productsCache.clear(); }
  }
  if(st.busy || st.done) {
    console.log('[loadCatalog] Skipped - busy:', st.busy, 'done:', st.done);
    return;
  }
  st.busy = true;

  const query = { active: '1', hide_from_sales: '0', sort: 'custom', limit: pageSize, offset: st.offset, skip_count: true };
  if(cat) query.category = cat;
  if(qNow) query.q = qNow;

  console.log('[loadCatalog] Loading batch - offset:', st.offset, 'pageSize:', pageSize, 'category:', cat);
  
  const r = await window.api.products_list(query);
  if(!r.ok){ setError(r.error || 'تعذر تحميل الكتالوج'); st.busy=false; return; }
  
  const receivedItems = (r.items||[]);
  const totalCount = r.total || 0;
  
  console.log('[loadCatalog] Received:', receivedItems.length, 'items. Total:', totalCount);
  
  // إظهار الأصناف تحت الصنف الرئيسي المحدد فقط
  let list = receivedItems;
  if(!cat && !__noMainTypes){
    // بدون تبويب محدد، وُجِدَت أنواع رئيسية: لا نعرض شيئاً لضمان الالتزام بالتصنيف
    list = [];
  }
  
  // تحقق من النهاية: إذا استلمنا عناصر أقل من pageSize، فقد وصلنا للنهاية
  if(receivedItems.length < pageSize){ 
    console.log('[loadCatalog] Reached end - receivedItems:', receivedItems.length, '<', pageSize);
    st.done = true; 
  }
  st.offset += pageSize;
  console.log('[loadCatalog] Updated offset to:', st.offset, 'done:', st.done);

  // إنشاء IntersectionObserver للـ lazy loading وcache للمنتجات المحملة
  if(!loadCatalog.__observer){
    loadCatalog.__productsCache = new Map();
    loadCatalog.__observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          const card = entry.target;
          if(card.dataset.loaded === 'true') return;
          card.dataset.loaded = 'true';
          loadCatalog.__observer.unobserve(card);
          
          const pid = Number(card.dataset.pid);
          const p = loadCatalog.__productsCache.get(pid);
          if(p){
            loadCardData(card, p).catch(() => {});
          }
        }
      });
    }, { root: null, rootMargin: '400px', threshold: 0.01 });
  }

  // إزالة رسالة التحميل عند البداية
  if(st.offset === pageSize){
    catalog.innerHTML = '';
  }
  
  const frag = document.createDocumentFragment();
  // 🚀 عرض البطاقات بدفعات صغيرة لتحسين الأداء
  const batchSize = 10;
  for(let i = 0; i < list.length; i += batchSize){
    const batch = list.slice(i, i + batchSize);
    batch.forEach(p => {
      loadCatalog.__productsCache.set(p.id, p);
      
      const card = document.createElement('div');
      card.className = 'p-card';
      card.dataset.pid = String(p.id);
      card.dataset.loaded = 'false';

      let imgTag = '<img style="opacity:0.3;" alt=""/>';
      if(!settings.hide_product_images){
        imgTag = `<img loading="lazy" data-pid="${p.id}" src="" style="opacity:0.3;" alt=""/>`;
      }

      card.innerHTML = `
        ${imgTag}
        <div class="meta">
          <div class="pname" title="${escapeHtml(p.name)}">
            <span style="font-weight:700; font-size:12px; color:#1f2937;">${escapeHtml(p.name)}</span>
            ${p.name_en? `<span style='font-size:10px; color:#6b7280; font-weight:400;'>${escapeHtml(p.name_en)}</span>`:''}
          </div>
          <div class="price-under">${Number(p.price||0).toFixed(2)}</div>
          <div class="bom-under" style="display:none;"></div>
        </div>
      `;
      card.addEventListener('click', () => addToCart(p));
      frag.appendChild(card);
      
      loadCatalog.__observer.observe(card);
    });
  }
  catalog.appendChild(frag);
  catalog.style.opacity = '1';
  
  st.busy = false;
  console.log('[loadCatalog] Batch complete - added', list.length, 'cards. Ready for next batch.');

  async function loadCardData(card, p){
    try{
      // تأجيل حتى بعد الـ paint frame الحالي ثم تحميل البيانات بشكل async سليم
      await new Promise(r => requestAnimationFrame(r));
      try {
        const img = card.querySelector('img');
        
        if(!settings.hide_product_images && img){
          try {
            const ir = await batchLoader.add('images', `img_${p.id}`, p.id);
            if(ir && ir.ok){
              img.src = `data:${ir.mime||'image/png'};base64,${ir.base64}`;
              img.style.opacity = '1';
            } else {
              if(!loadCatalog.__defaultImg){
                const dr = await window.api.settings_default_product_image_get();
                loadCatalog.__defaultImg = (dr && dr.ok) ? { data:`data:${dr.mime||'image/png'};base64,${dr.base64}` } : { data:null };
              }
              if(loadCatalog.__defaultImg.data){ 
                img.src = loadCatalog.__defaultImg.data;
                img.style.opacity = '1';
              }
            }
          } catch(error) {
            const ir = await cachedRequest(`img_${p.id}`, () => window.api.products_image_get(p.id), 30000);
            if(ir && ir.ok){
              img.src = `data:${ir.mime||'image/png'};base64,${ir.base64}`;
              img.style.opacity = '1';
            }
          }
        }
        
        // تحميل التفاصيل الإضافية
        await updateCardDetails(card, p);
      } catch(_) {}
    }catch(_){ }
  }

  async function updateCardDetails(cardOrProduct, maybeProduct){
    let card, p;
    if(maybeProduct){
      card = cardOrProduct;
      p = maybeProduct;
    } else {
      p = cardOrProduct;
      card = catalog.querySelector(`.p-card[data-pid="${p.id}"]`);
    }
    if(!card) return;
    const priceEl = card.querySelector('.price-under');
    let displayPrice = Number(p.price||0);
    let defaultOpId = null;
    let offerPercent = null;

    // العمليات - استخدام batch loader
    try {
      let ops = await batchLoader.add('operations', `ops_${p.id}`, p.id);
      ops = (ops && ops.ok) ? ops.items : [];
      const activeOps = (ops||[]).filter(x => x.is_active);
      if(activeOps.length){
        displayPrice = Number(activeOps[0].price||0);
        defaultOpId = (activeOps[0].operation_id||activeOps[0].id);
      }
    } catch(error) {
      // Fallback to original method
      let ops = await fetchProductOps(p.id);
      const activeOps = (ops||[]).filter(x => x.is_active);
      if(activeOps.length){
        displayPrice = Number(activeOps[0].price||0);
        defaultOpId = (activeOps[0].operation_id||activeOps[0].id);
      }
    }

    // سعر العميل - استخدام batch loader
    if(__selectedCustomerId){
      try{
        const cacheKey = `cprice_${__selectedCustomerId}_${p.id}_${defaultOpId||''}`;
        const cr = await batchLoader.add('customerPrices', cacheKey, p.id, {
          customerId: __selectedCustomerId,
          operationId: defaultOpId
        });
        if(cr && cr.ok && typeof cr.price !== 'undefined'){
          displayPrice = Number(cr.price||0);
          offerPercent = null;
        }
      }catch(_){ 
        // Fallback
        try {
          const payload = { customer_id: Number(__selectedCustomerId), product_id: p.id };
          if(defaultOpId != null){ payload.operation_id = Number(defaultOpId); }
          const cacheKey = `cprice_${__selectedCustomerId}_${p.id}_${defaultOpId||''}`;
          const cr = await cachedRequest(cacheKey, () => window.api.cust_price_find(payload), 30000);
          if(cr && cr.ok && typeof cr.price !== 'undefined'){
            displayPrice = Number(cr.price||0);
            offerPercent = null;
          }
        } catch(_2) { /* ignore */ }
      }
    } else {
      // عرض المنتج (غير العام) - استخدام batch loader
      try{
        const cacheKey = `offer_${p.id}_${defaultOpId||''}`;
        const or = await batchLoader.add('offers', cacheKey, p.id, { operationId: defaultOpId });
        if(or && or.ok && or.item && !Number(or.item.is_global)){
          if(or.item.mode === 'percent'){
            offerPercent = Number(or.item.value||0);
            displayPrice = Number((displayPrice * (1 - offerPercent/100)).toFixed(2));
          } else {
            const cashVal = Number(or.item.value||0);
            offerPercent = displayPrice > 0 ? Number((cashVal/displayPrice*100).toFixed(0)) : null;
            displayPrice = Math.max(0, Number(displayPrice) - cashVal);
          }
        }
      }catch(_){ 
        // Fallback
        try {
          const cacheKey = `offer_${p.id}_${defaultOpId||''}`;
          const or = await cachedRequest(cacheKey, () => window.api.offers_find_for_product({ product_id: p.id, operation_id: defaultOpId!=null ? Number(defaultOpId) : null }), 30000);
          if(or && or.ok && or.item && !Number(or.item.is_global)){
            if(or.item.mode === 'percent'){
              offerPercent = Number(or.item.value||0);
              displayPrice = Number((displayPrice * (1 - offerPercent/100)).toFixed(2));
            } else {
              const cashVal = Number(or.item.value||0);
              offerPercent = displayPrice > 0 ? Number((cashVal/displayPrice*100).toFixed(0)) : null;
              displayPrice = Math.max(0, Number(displayPrice) - cashVal);
            }
          }
        } catch(_2) { /* ignore */ }
      }
    }

    if(priceEl){
      priceEl.textContent = Number(displayPrice).toFixed(2);
      if(offerPercent != null){
        const badge = document.createElement('span');
        badge.className = 'offer-badge';
        badge.textContent = `-${offerPercent}%`;
        priceEl.parentElement?.insertBefore(badge, priceEl);
      }
    }

    // المكونات: عند التحويم أو بعد تأخير
    const bomEl = card.querySelector('.bom-under');
    if(!bomEl) return;
    // BOM removed — keep element hidden and skip loading
    const loadBom = () => { bomEl.dataset.loaded = '1'; };
    // No event listeners; element remains hidden
  }
}

// تمرير لا نهائي: حمّل المزيد عند نهاية الشبكة
(function(){
  const catalogContainer = document.querySelector('.layout > div:first-child');
  if(!catalogContainer){
    console.error('[Scroll] Catalog container not found!');
    return;
  }
  
  let ticking = false;
  catalogContainer.addEventListener('scroll', () => {
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const scrollTop = catalogContainer.scrollTop;
      const containerHeight = catalogContainer.clientHeight;
      const scrollHeight = catalogContainer.scrollHeight;
      const bottom = scrollTop + containerHeight >= scrollHeight - 200;
      if(bottom){ 
        console.log('[Scroll] Bottom reached - loading more...', { scrollTop, containerHeight, scrollHeight });
        loadCatalog(); 
      }
    });
  });
  console.log('[Scroll] Infinite scroll initialized on catalog container');
})();

// بحث بالاسم: تحديث الكتالوج مع إرجاع الحالة عند تغيير النص (مع تهدئة)
if(searchByName){
  const triggerSearch = () => {
    try{
      // لم نعد نؤثر على بطاقات الكتالوج أثناء البحث
    }catch(_){ }
  };
  searchByName.addEventListener('input', async () => {
    clearTimeout(__searchTimer);
    __searchTimer = setTimeout(async () => {
      await renderNameSuggestions();
    }, 200);
  });

  searchByName.addEventListener('focus', async () => {
    await renderNameSuggestions();
  });

  searchByName.addEventListener('keydown', async (e) => {
    const items = nameSuggest ? Array.from(nameSuggest.querySelectorAll('.item')) : [];
    const activeIdx = items.findIndex(x => x.classList.contains('active'));
    if(e.key === 'ArrowDown'){
      e.preventDefault();
      const next = Math.min(items.length-1, activeIdx+1);
      items.forEach(el => el.classList.remove('active'));
      if(items[next]){ items[next].classList.add('active'); items[next].scrollIntoView({ block:'nearest' }); }
      return;
    }
    if(e.key === 'ArrowUp'){
      e.preventDefault();
      const prev = Math.max(0, (activeIdx<0?0:activeIdx-1));
      items.forEach(el => el.classList.remove('active'));
      if(items[prev]){ items[prev].classList.add('active'); items[prev].scrollIntoView({ block:'nearest' }); }
      return;
    }
    if(e.key === 'Escape'){
      nameSuggest && (nameSuggest.style.display='none');
      return;
    }
    if(e.key === 'Enter'){
      e.preventDefault();
      const q = (searchByName.value||'').trim();
      if(activeIdx >= 0 && items[activeIdx]){
        items[activeIdx].click();
        return;
      }
      if(!q){ return; }
      try{
        const r = await window.api.products_list({ q, active:'1', limit: 10, offset: 0, starts_with: 1 });
        if(r && r.ok){
          let list = (r.items||[]);

          if(list.length === 1){ await handlePickProduct(list[0]); }
          else { await renderNameSuggestions(list); }
        }
      }catch(_){ }
    }
  });
  
  // Hide suggestions on scroll or resize (since we use fixed positioning now)
  let scrollHideTimer;
  const hideSuggestOnScroll = (e) => {
    // Don't hide if scrolling inside the suggestions list itself
    if(nameSuggest && (e.target === nameSuggest || nameSuggest.contains(e.target))){
      return;
    }
    
    clearTimeout(scrollHideTimer);
    scrollHideTimer = setTimeout(() => {
      if(nameSuggest && nameSuggest.style.display !== 'none'){
        nameSuggest.style.display = 'none';
      }
    }, 100);
  };
  
  window.addEventListener('scroll', hideSuggestOnScroll, true);
  window.addEventListener('resize', () => {
    if(nameSuggest && nameSuggest.style.display !== 'none'){
      // Reposition on resize
      if(searchByName){
        const rect = searchByName.getBoundingClientRect();
        nameSuggest.style.top = (rect.bottom + 4) + 'px';
        if(document.documentElement.dir === 'rtl'){
          nameSuggest.style.right = (window.innerWidth - rect.right) + 'px';
          nameSuggest.style.left = 'auto';
        } else {
          nameSuggest.style.left = rect.left + 'px';
          nameSuggest.style.right = 'auto';
        }
      }
    }
  });
  
  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if(nameSuggest && nameSuggest.style.display !== 'none'){
      if(!searchByName.contains(e.target) && !nameSuggest.contains(e.target)){
        nameSuggest.style.display = 'none';
      }
    }
  });
}

async function renderNameSuggestions(prefetched){
  try{
    if(!nameSuggest || !searchByName) return;
    const q = (searchByName.value||'').trim();
    if(!q){ nameSuggest.style.display='none'; nameSuggest.innerHTML=''; return; }
    let list;
    if(prefetched){ list = prefetched; }
    else {
      const r = await window.api.products_list({ q, active:'1', limit: 30, offset: 0, starts_with: 1 });
      list = (r && r.ok) ? (r.items||[]) : [];
      // لا نقيّد الاقتراحات بتبويب محدد عند البحث بالاسم
    }
    if(!list.length){ nameSuggest.style.display='none'; nameSuggest.innerHTML=''; return; }
    nameSuggest.innerHTML='';
    const frag = document.createDocumentFragment();
    
    const isAr = document.documentElement.lang === 'ar';
    const header = document.createElement('div');
    header.className = 'suggest-header';
    header.innerHTML = `<div>${isAr ? 'الصنف' : 'Item'}</div>
      <div>${isAr ? 'السعر' : 'Price'}</div>
      <div>${isAr ? 'المخزون' : 'Stock'}</div>
      <div>${isAr ? 'الحد الأدنى' : 'Min Price'}</div>`;
    frag.appendChild(header);
    
    list.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'item' + (idx===0?' active':'');
      row.tabIndex = 0;
      row.dataset.pid = String(p.id);
      const stockNum = Number(p.stock || 0);
      const stock = stockNum % 1 === 0 ? stockNum.toFixed(0) : stockNum.toFixed(2);
      const minPrice = p.min_price != null ? Number(p.min_price).toFixed(2) : '-';
      row.innerHTML = `<div>
        <div class="name">${escapeHtml(p.name||'')}</div>
        ${p.name_en? `<div class='name-en'>${escapeHtml(p.name_en||'')}</div>`:''}
      </div>
      <div class="price">${Number(p.price||0).toFixed(2)}</div>
      <div class="stock">${stock}</div>
      <div class="min-price">${minPrice}</div>`;
      row.addEventListener('click', async () => { await handlePickProduct(p); });
      row.addEventListener('mouseenter', () => {
        nameSuggest.querySelectorAll('.item').forEach(el=>el.classList.remove('active'));
        row.classList.add('active');
      });
      frag.appendChild(row);
    });
    nameSuggest.appendChild(frag);
    nameSuggest.style.display = 'block';
    
    // Position the suggest dropdown relative to the input field (now using fixed positioning)
    if(searchByName){
      const rect = searchByName.getBoundingClientRect();
      nameSuggest.style.top = (rect.bottom + 4) + 'px';
      // RTL: align to the right of the input
      if(document.documentElement.dir === 'rtl'){
        nameSuggest.style.right = (window.innerWidth - rect.right) + 'px';
        nameSuggest.style.left = 'auto';
      } else {
        nameSuggest.style.left = rect.left + 'px';
        nameSuggest.style.right = 'auto';
      }
    }
  }catch(_){ }
}

async function handlePickProduct(p){
  try{
    await addToCart(p);
    if(searchByName){ searchByName.value=''; }
    __nameQuery='';
    if(nameSuggest){ nameSuggest.innerHTML=''; nameSuggest.style.display='none'; }

  }catch(_){ }
}

async function fetchProductOps(productId){
  try{
    const r = await cachedRequest(`ops_${productId}`, () => window.api.prod_ops_list(productId), 30000);
    return (r && r.ok) ? (r.items||[]) : [];
  }catch(_){ return []; }
}

// Units per product
async function fetchProductUnits(productId){
  try{
    const r = await window.api.product_units_list(productId);
    return (r && r.ok) ? (r.items||[]) : [];
  }catch(_){ return []; }
}

// Get effective price for an item given current selected customer (if any)
async function applyCustomerPricingForItem(it){
  try{
    if(it.manualPriceEdit){ return; }
    const cid = __selectedCustomerId ? Number(__selectedCustomerId) : null;
    if(!cid){ return; }
    const payload = { customer_id: cid, product_id: it.id };
    if(typeof it.operation_id !== 'undefined' && it.operation_id !== null){ payload.operation_id = Number(it.operation_id); }
    const cacheKey = `cprice_${cid}_${it.id}_${it.operation_id||''}`;
    const r = await cachedRequest(cacheKey, () => window.api.cust_price_find(payload), 30000);
    if(r && r.ok && typeof r.price !== 'undefined'){
      it.price = Number(r.price||0);
    }
  }catch(_){ /* ignore */ }
}

async function updatePricesForCustomer(){
  if(!__selectedCustomerId){ return; }
  for(const it of cart){ await applyCustomerPricingForItem(it); }
  renderCart();
}

// Restore base pricing (no customer-specific pricing)
async function applyBasePricingForItem(it){
  if(it.manualPriceEdit){ return; }
  // If operation is selected, use its price; otherwise use product base price
  let base = null;
  try{
    if(typeof it.operation_id !== 'undefined' && it.operation_id !== null){
      // ensure ops
      if(!it.__opsLoaded){ it.__ops = await fetchProductOps(it.id); it.__opsLoaded = true; }
      const op = (it.__ops||[]).find(o => (o.operation_id||o.id) === Number(it.operation_id));
      if(op){ base = Number(op.price||0); }
    }
    if(base === null){
      // fetch product base price
      const r = await window.api.products_get(it.id);
      if(r && r.ok && r.item){ base = Number(r.item.price||0); }
    }
    // Apply active offer if exists (offer overrides base)
    try{
      const opId = (typeof it.operation_id!== 'undefined' && it.operation_id!=null) ? Number(it.operation_id) : null;
      const cacheKey = `offer_${it.id}_${opId||''}`;
      const or = await cachedRequest(cacheKey, () => window.api.offers_find_for_product({ product_id: it.id, operation_id: opId }), 30000);
      if(or && or.ok && or.item){
        const off = or.item;
        if(off.mode === 'percent') base = Number((base * (1 - Number(off.value||0)/100)).toFixed(2));
        else base = Math.max(0, Number(base) - Number(off.value||0));
      }
    }catch(_){ }
  }catch(_){ }
  if(base !== null){ it.price = base; }
}

async function revertPricesToBase(){
  for(const it of cart){ await applyBasePricingForItem(it); }
  renderCart();
}

// Remember last selected unit per product during session
const __lastUnitByProduct = new Map(); // product_id -> { unit_name, multiplier }

// Quick unit picker modal with big buttons
async function __pickUnitForProduct(productId, basePrice){
  const units = await fetchProductUnits(productId);
  if(!Array.isArray(units) || units.length===0){ return null; }
  const overlayId = 'unit-picker-overlay';
  let ov = document.getElementById(overlayId);
  if(ov){ ov.remove(); }
  ov = document.createElement('div');
  ov.id = overlayId;
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:99999;';
  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;min-width:380px;max-width:90vw;padding:16px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.25);direction:rtl;text-align:center;';
  box.innerHTML = '<div style="font-size:18px;font-weight:700;margin-bottom:8px;">اختر الوحدة</div>';
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;';
  const last = __lastUnitByProduct.get(productId);
  let resolvePick;
  const picked = new Promise(res => { resolvePick = res; });
  units.forEach(u => {
    const mult = Number(u.multiplier||1);
    const price = (u.price_mode==='manual' && u.price!=null) ? Number(u.price) : Number((Number(basePrice||0) * mult).toFixed(2));
    const btn = document.createElement('button');
    btn.type='button';
    btn.style.cssText = 'padding:14px 10px;border-radius:8px;border:2px solid #0ea5e9;background:#e0f2fe;color:#0c4a6e;font-weight:700;font-size:16px;cursor:pointer;';
    btn.innerHTML = `${escapeHtml(String(u.unit_name||''))}<div style="font-size:13px;color:#0369a1;margin-top:6px;">${price.toFixed(2)}</div>`;
    btn.addEventListener('click', () => { resolvePick({ unit_name: String(u.unit_name||'').trim(), multiplier: mult, price, mode: (u.price_mode==='manual'?'manual':'auto') }); });
    grid.appendChild(btn);
  });
  box.appendChild(grid);
  const cancel = document.createElement('div');
  cancel.style.cssText = 'margin-top:12px;display:flex;justify-content:center;gap:10px;';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'إلغاء';
  cancelBtn.type='button';
  cancelBtn.style.cssText = 'padding:10px 18px;border-radius:8px;border:1px solid #e11d48;background:#fff;color:#e11d48;font-weight:700;';
  cancelBtn.addEventListener('click', () => { resolvePick(null); });
  cancel.appendChild(cancelBtn);
  box.appendChild(cancel);
  ov.appendChild(box);
  document.body.appendChild(ov);
  const onKey = (e) => { if(e.key==='Escape'){ try{ resolvePick(null); }catch(_){ } } };
  window.addEventListener('keydown', onKey, { once:true });
  const sel = await picked;
  try{ ov.remove(); }catch(_){ }
  return sel || last || null;
}

async function pickUnitAndApply(it, productMeta){
  try{
    // فقط معالجة الوحدات إذا كانت موجودة في system — تجاهل base_unit/base_qty_step البسيطة
    // والتركيز على product_units المحددة للمنتج
    let units = [];
    try{
      const r = await window.api.product_units_list(it.id);
      units = (r && r.ok && Array.isArray(r.items)) ? r.items : [];
    }catch(_){ units = []; }
    
    // إذا لم توجد وحدات محددة (product_units)، لا تعدّل operation_name — احتفظ بالعملية الموجودة
    if(!Array.isArray(units) || units.length === 0){ return false; }
    
    // توجد وحدات: استخدم الأولى تلقائياً دون عرض modal
    if(units.length === 1){
      // unit واحد فقط: تطبيقه مباشرة
      const u = units[0];
      const mult = Number(u.multiplier||1);
      const price = (u.price_mode==='manual' && u.price!=null) ? Number(u.price) : Number((Number(it.price||0) * mult).toFixed(2));
      it.unit_name = String(u.unit_name||'').trim();
      it.unit_multiplier = mult;
      it.price = price;
      it.operation_name = it.unit_name;
      if(typeof it.description !== 'string'){ it.description = ''; }
      __lastUnitByProduct.set(it.id, { unit_name: it.unit_name, multiplier: it.unit_multiplier });
      return true;
    }
    
    // أكثر من unit: اعرض المختار
    const sel = await __pickUnitForProduct(it.id, Number(it.price||0));
    if(!sel){
      // User cancelled: use first unit as fallback
      const u = units[0];
      const mult = Number(u.multiplier||1);
      const price = (u.price_mode==='manual' && u.price!=null) ? Number(u.price) : Number((Number(it.price||0) * mult).toFixed(2));
      it.unit_name = String(u.unit_name||'').trim();
      it.unit_multiplier = mult;
      it.price = price;
      it.operation_name = it.unit_name;
      if(typeof it.description !== 'string'){ it.description = ''; }
      return false;
    }
    
    // User selected a unit: apply it
    it.unit_name = sel.unit_name;
    it.unit_multiplier = Number(sel.multiplier||1);
    it.price = Number(sel.price||it.price||0);
    it.operation_name = it.unit_name;
    // keep existing description unchanged
    if(typeof it.description !== 'string'){ it.description = ''; }
    __lastUnitByProduct.set(it.id, { unit_name: it.unit_name, multiplier: it.unit_multiplier });
    return true;
  }catch(_){ return false; }
}

async function addToCart(p){
  // منع إضافة صنف أثناء وضع معالجة الفاتورة
  if(__isProcessingOld){ setError('لا يمكن إضافة أصناف أثناء معالجة الفاتورة'); return; }
  // امنع إضافة منتجات من نوع رئيسي موقوف
  if(p && p.category && !activeTypes.has(p.category)){
    setError('هذا النوع الرئيسي موقوف، لا يمكن البيع من تحته');
    return;
  }
  const idx = cart.findIndex(x => x.id === p.id);
  // إذا كان خيار فصل تكرار نفس الصنف مفعلًا، لا تدمج: أنشئ سطرًا جديدًا دائمًا
  const forceSeparate = !!settings.cart_separate_duplicate_lines;
  if(idx >= 0 && !forceSeparate){
    cart[idx].qty += 1;
    renderCart();
    try{ await checkLowStockForItems([cart[idx]]); }catch(_){ }
    return;
  }

  // Helpers
  const applyOffer = async (it) => {
    try{
      const opId = (typeof it.operation_id !== 'undefined' && it.operation_id != null) ? Number(it.operation_id) : null;
      const cacheKey = `offer_${it.id}_${opId||''}`;
      const or = await cachedRequest(cacheKey, () => window.api.offers_find_for_product({ product_id: it.id, operation_id: opId }), 30000);
      if(or && or.ok && or.item && !Number(or.item.is_global)){
        if(or.item.mode === 'percent') it.price = Number((it.price * (1 - Number(or.item.value||0)/100)).toFixed(2));
        else it.price = Math.max(0, Number(it.price) - Number(or.item.value||0));
      }
    }catch(_){ }
  };

  const checkMin = (it) => {
    const mp = (p.min_price!=null && p.min_price!=='') ? Number(p.min_price) : null;
    if(mp!=null && !isNaN(mp) && Number(it.price||0) < mp){
      __showSalesToast(`السعر أقل من الحد الأدنى لهذا الصنف وهو (${mp})`, { icon:'⚠️', danger:true, ms:4000 });
      return false;
    }
    return true;
  };

  // اجلب عمليات المنتج لتحديد السعر الصحيح
  let ops = [];
  try{ ops = await fetchProductOps(p.id); }catch(_){ ops = []; }
  
  let it;
  
  if(Array.isArray(ops) && ops.length){
    // اختر أول عملية حسب الترتيب القادم من السيرفر (sort_order ASC)
    const first = ops[0];
    it = {
      id: p.id,
      name: p.name,
      name_en: p.name_en || null,
      barcode: p.barcode || null,
      price: Number(first.price||0), // استخدم سعر العملية الأولى
      qty: 1,
      image_path: p.image_path,
      category: p.category || null,
      is_tobacco: Number(p.is_tobacco||0) ? 1 : 0,
      unit_name: null,
      unit_multiplier: 1,
      operation_id: (first.operation_id||first.id),
      operation_name: first.name,
      __opsLoaded:true,
      __ops: ops,
      product_min_price: (p.min_price!=null && p.min_price!=='') ? Number(p.min_price) : null
    };
  } else {
    // لا توجد عمليات: استخدم السعر الأساسي للمنتج
    it = { 
      id: p.id, 
      name: p.name, 
      name_en: p.name_en || null, 
      barcode: p.barcode || null, 
      price: Number(p.price||0), 
      qty: 1, 
      image_path: p.image_path, 
      category: p.category || null, 
      is_tobacco: Number(p.is_tobacco||0) ? 1 : 0, 
      unit_name: null, 
      unit_multiplier: 1, 
      operation_name: null, 
      __opsLoaded:true, 
      __ops: [], 
      product_min_price: (p.min_price!=null && p.min_price!=='') ? Number(p.min_price) : null 
    };
  }

  // 1. Apply customer pricing first (sets base for customer)
  await applyCustomerPricingForItem(it);

  // 2. Apply Unit selection (may change price via multiplier or manual override)
  try{ const pr = await window.api.products_get(p.id); const meta = (pr && pr.ok) ? pr.item : null; await pickUnitAndApply(it, meta||{}); }catch(_){ }

  // 3. Apply Offer (Specific Product Offer) - AFTER unit application to ensure it applies to manual unit prices too
  await applyOffer(it);

  // 4. Check Min Price
  if(!checkMin(it)) return;

  // Add to cart
  cart.unshift(it);

  // Cache Qty Rules
  try{
    if(!window.__qtyRulesCache) window.__qtyRulesCache = new Map();
    const key = it.id + '|' + (it.operation_id==null?'null':String(it.operation_id));
    const rr = await window.api.offers_qty_find_for_product({ product_id: it.id, operation_id: it.operation_id });
    if(rr && rr.ok && rr.item){ window.__qtyRulesCache.set(key, rr.item); }
  }catch(_){ }

  renderCart();
  try{ await checkLowStockForItems([cart.find(x=>x.id===p.id)]); }catch(_){ }
  // إذا كانت التنبيهات معطلة، تأكد من الإخفاء الفوري عند إضافة الصنف عبر الكتالوج
  try{ if(settings && settings.show_low_stock_alerts === false){ __lowStockEpoch++; if(__lowStockTimer){ clearTimeout(__lowStockTimer); __lowStockTimer=null; } if(lowStockBanner){ lowStockBanner.style.display='none'; lowStockBanner.classList.remove('show'); } if(lowStockList){ lowStockList.innerHTML=''; } } }catch(_){ }
}

// Helper: parse electronic scale barcode (13-digit EAN format)
// Format: PP IIIII VVVVV C
// - PP (positions 0-1): Prefix (20, 21, or 22)
// - IIIII (positions 2-6): Item code (5 digits)
// - VVVVV (positions 7-11): Value - weight or price (5 digits)
// - C (position 12): Checksum (optional, ignored)
function parseScaleBarcode(code, scaleType){
  try{
    const s = String(code||'').trim();
    if(!/^[0-9]{13}$/.test(s)) return null;
    
    // Check prefix (20, 21, or 22)
    const prefix = s.slice(0,2);
    if(prefix !== '20' && prefix !== '21' && prefix !== '22') return null;
    
    // Extract item code (positions 2-6, which is index 2 to 7 exclusive)
    const plu = s.slice(2, 7);
    
    // Extract value (positions 7-11, which is index 7 to 12 exclusive)
    const valueRaw = s.slice(7, 12);
    const valueNum = Number(valueRaw);
    if(!Number.isFinite(valueNum) || valueNum < 0) return null;
    
    // Determine scale type (weight or price)
    const isWeightScale = scaleType !== 'price';
    
    if(isWeightScale){
      // Weight scale: value in grams, convert to kg
      // Example: 01250 = 1250 grams = 1.250 kg
      return { type: 'weight', plu, value: valueNum / 1000 };
    } else {
      // Price scale: value in riyals and halalas
      // First 3 digits = riyals, last 2 digits = halalas
      // Example: 15750 = 157 riyals + 50 halalas = 157.50 SAR
      const riyals = Math.floor(valueNum / 100);
      const halalas = valueNum % 100;
      const totalPrice = riyals + (halalas / 100);
      return { type: 'price', plu, value: totalPrice };
    }
  }catch(_){ return null; }
}

// مسح الباركود من أعلى الشاشة: عند الضغط Enter يتم محاولة جلب الصنف وإضافته للسلة
if(barcode){
  barcode.addEventListener('keydown', async (e) => {
    if(e.key !== 'Enter') return;
    e.preventDefault();
    const code = normalizeDigits((barcode.value||'').trim());
    if(!code) return;
    try{
      // Try scale barcode first (EAN-13 with embedded weight/price) if enabled
      const scaleEnabled = settings && settings.electronic_scale_enabled;
      const scaleType = settings && settings.electronic_scale_type || 'weight';
      const scale = scaleEnabled ? parseScaleBarcode(code, scaleType) : null;
      if(scale){
        // Lookup by PLU (we store PLU in barcode field for scale items)
        const sr = await window.api.products_get_by_barcode(scale.plu);
        if(sr && sr.ok && sr.item){
          const p = sr.item;
          if(Number(p.is_active||0) === 0){ __showSalesToast('الصنف غير مفعل', { icon:'⚠️', danger:true, ms:4000 }); barcode.select(); return; }
          // Add with quantity from barcode when type=weight; if type=price, derive qty = price / unit price
          const itBase = {
            id: p.id,
            name: p.name,
            name_en: p.name_en || null,
            barcode: p.barcode || null,
            price: Number(p.price||0),
            qty: 1,
            image_path: p.image_path,
            category: p.category || null,
            is_tobacco: Number(p.is_tobacco||0) ? 1 : 0,
            unit_name: null,
            unit_multiplier: 1,
            operation_name: null,
            product_min_price: (p.min_price!=null && p.min_price!=='') ? Number(p.min_price) : null
          };
          // If variant scanned earlier, products_get_by_barcode on PLU won't return variant; scale PLUs typically map to base product
          const it = itBase;
          await applyCustomerPricingForItem(it);
          // Compute qty
          if(scale.type === 'weight'){
            it.qty = Number(scale.value.toFixed(3));
          } else {
            const unitPrice = Number(it.price||0);
            if(unitPrice > 0){ it.qty = Number((scale.value / unitPrice).toFixed(3)); }
          }
          cart.push(it);
          renderCart();
          try{ await checkLowStockForItems([it]); }catch(_){ }
          barcode.value = '';
          setTimeout(()=>{ try{ barcode.focus(); }catch(_){ } }, 0);
          return;
        }
        // If PLU lookup fails, fallback to normal lookup on full code
      }
      const r = await window.api.products_get_by_barcode(code);
      if(!r || !r.ok || !r.item){ 
        // الصنف غير موجود - اسأل المستخدم إذا كان يريد إضافته
        const userWantsToAdd = await showAddProductConfirmation();
        if(userWantsToAdd){
          await openAddProductModal(code);
        }
        barcode.select(); 
        return; 
      }
      const p = r.item;
      if(Number(p.is_active||0) === 0){ __showSalesToast('الصنف غير مفعل', { icon:'⚠️', danger:true, ms:4000 }); barcode.select(); return; }
      
      // إذا كان هناك variant_id (صنف)، أضفه مع variant_name كـ operation_name
      if(p.variant_id){
        // البحث عن نفس المنتج + الصنف معاً في السلة
        const idx = cart.findIndex(x => x.id === p.id && x.variant_id === p.variant_id);
        const forceSeparate = !!settings.cart_separate_duplicate_lines;
        if(idx >= 0 && !forceSeparate){
          cart[idx].qty += 1;
          renderCart();
          try{ await checkLowStockForItems([cart[idx]]); }catch(_){ }
        } else {
          // إضافة منتج جديد مع الصنف
          const it = {
            id: p.id,
            name: p.name,
            name_en: p.name_en || null,
            barcode: p.barcode || null,
            price: Number(p.price||0),
            qty: 1,
            image_path: p.image_path,
            category: p.category || null,
            is_tobacco: Number(p.is_tobacco||0) ? 1 : 0,
            unit_name: null,
            unit_multiplier: 1,
            variant_id: p.variant_id,
            variant_name: p.variant_name,
            operation_id: p.variant_id,  // استخدم variant_id كـ operation_id
            operation_name: p.variant_name,  // استخدم variant_name كـ operation_name
            product_min_price: (p.min_price!=null && p.min_price!=='') ? Number(p.min_price) : null
          };
          await applyCustomerPricingForItem(it);
          cart.push(it);
        }
        renderCart();
        try{ await checkLowStockForItems([cart.find(x=>x.id===p.id && x.variant_id===p.variant_id)]); }catch(_){ }
      } else {
        // المنتج العادي بدون variant
        const idx = cart.findIndex(x => x.id === p.id);
        const forceSeparate = !!settings.cart_separate_duplicate_lines;
        if(idx >= 0 && !forceSeparate){
          cart[idx].qty += 1;
          renderCart();
          try{ await checkLowStockForItems([cart[idx]]); }catch(_){ }
        } else {
          await addToCart(p);
        }
      }
      // نظّف وأعد التركيز
      barcode.value = '';
      setTimeout(()=>{ try{ barcode.focus(); }catch(_){ } }, 0);
    }catch(err){ __showSalesToast('تعذر جلب الصنف بالباركود', { icon:'⚠️', danger:true, ms:4000 }); }
  });
}


// Low-stock: cache to reduce IPC calls in session
const __productStockCache = new Map(); // product_id -> { stock, name }
let __lowStockTimer = null;
let __lowStockEpoch = 0;
let __lowStockPref = null; // until settings load; null/false => suppress alerts

// After a successful sale, adjust cached stocks immediately so alerts reflect the new levels
function __adjustStockCacheAfterSale(items){
  try{
    if(!Array.isArray(items) || !items.length) return;
    for(const it of items){
      const pid = Number(it.product_id || it.id || 0);
      const qty = Number(it.qty || 0);
      const mult = (it && it.unit_multiplier!=null) ? Number(it.unit_multiplier||1) : 1;
      const soldBase = Number((qty * mult).toFixed(3));
      if(!pid || !soldBase) continue;
      const cached = __productStockCache.get(pid);
      if(cached){
        // allow negative values to show red alert state
        cached.stock = Number(cached.stock||0) - soldBase;
        __productStockCache.set(pid, cached);
      } else {
        // no cache yet: do nothing; next lookup will fetch from DB
      }
    }
  }catch(_){ }
}

function showLowStockBanner(items){
  try{
    if(!lowStockBanner || !lowStockList) return;
    // respect setting: show/hide low stock alerts
    if(!(settings && settings.show_low_stock_alerts === true)){ return; }
    const myEpoch = ++__lowStockEpoch; // snapshot to invalidate delayed hides/shows
    lowStockList.innerHTML='';
    const hasZero = items.some(x => Number(x.stock||0) <= 0);
    // Title + color based on zero-stock
    if(lowStockTitle){
      const textSpan = lowStockTitle.querySelector('.text');
      if(textSpan){ textSpan.textContent = hasZero ? 'تم نفاد المخزون' : 'تحذير: أصناف قرب نفاد المخزون'; }
    }
    lowStockBanner.classList.toggle('danger', !!hasZero);
    items.forEach(it => {
      const li = document.createElement('li');
      li.textContent = `${it.name} — المتبقي: ${it.stock}`;
      lowStockList.appendChild(li);
    });
    lowStockBanner.style.display='block';
    lowStockBanner.classList.add('show');
    if(__lowStockTimer){ clearTimeout(__lowStockTimer); }
    __lowStockTimer = setTimeout(()=>{ try{ if(myEpoch===__lowStockEpoch){ lowStockBanner.style.display='none'; lowStockBanner.classList.remove('show'); lowStockList.innerHTML=''; } }catch(_){ } }, 3000);
  }catch(_){ }
}
async function checkLowStockForItems(items){
  try{
    // respect global toggle: only run when explicitly enabled
    if(!(settings && settings.show_low_stock_alerts === true)){ return; }
    const threshold = Math.max(0, Number(settings.low_stock_threshold ?? 5));
    if(!(Array.isArray(items) && items.length)) return;
    const lows = [];
    for(const it of items){
      const pid = Number(it?.id||it?.product_id||0);
      if(!pid) continue;
      let cached = __productStockCache.get(pid);
      if(!cached){
        try{ const pr = await window.api.products_get(pid); if(pr && pr.ok && pr.item){ cached = { stock: Number(pr.item.stock||0), name: pr.item.name||it.name||'' }; __productStockCache.set(pid, cached); } }catch(_){ }
      }
      if(cached){
        if(Number(cached.stock||0) <= threshold){ lows.push({ name: cached.name || it.name || `#${pid}`, stock: Number(cached.stock||0) }); }
      }
    }
    if(lows.length){ showLowStockBanner(lows); }
  }catch(_){ }
}

// زر طباعة المطبخ: إرسال تفاضلي دائمًا (داخل الغرف وخارجها)
try{
  const btnKitchen = document.getElementById('btnKitchen');
  if(btnKitchen){
    btnKitchen.addEventListener('click', async () => {
      if(cart.length === 0){ __showSalesToast('أضف منتجات أولاً', { icon:'⚠️', danger:true, ms:5000 }); return; }
      setError('');
      const roomMeta = __currentRoomId ? await (async()=>{ try{ const rmeta = await window.api.rooms_list(); if(rmeta.ok){ return (rmeta.items||[]).find(x => String(x.id)===String(__currentRoomId)) || null; } }catch(_){ } return null; })() : null;
      let waiter = null; try{ waiter = JSON.parse(localStorage.getItem('pos_user')||'{}'); }catch(_){ waiter = null; }
      const waiterName = waiter ? (waiter.full_name || waiter.username || '') : '';

      // إرسال الأصناف الجديدة فقط: delta = qty - kitchen_sent_qty
      const itemsToSend = [];
      for(const it of cart){
        const total = Math.max(0, Number(it.qty||0));
        const sent = Math.max(0, Number(it.kitchen_sent_qty||0));
        const delta = total - sent;
        if(delta > 0){ itemsToSend.push({ ...it, qty: delta }); }
      }
      if(itemsToSend.length === 0){ setError('لا توجد أصناف جديدة لإرسالها للمطبخ'); return; }

      const r = await window.api.kitchen_print_order({ items: itemsToSend, room_name: (roomMeta?roomMeta.name:null), sale_id: null, waiter_name: waiterName, copies_per_section: 1, order_no: null });

      // عند النجاح وعدم التخطي (لا توجد طابعات)، قم بوسم العناصر على أنها مُرسلة
      if(r && r.ok && !r.skipped){
        for(const it of cart){
          const total = Math.max(0, Number(it.qty||0));
          const sent = Math.max(0, Number(it.kitchen_sent_qty||0));
          const delta = total - sent;
          if(delta > 0){ it.kitchen_sent_qty = sent + delta; }
        }
        if(__currentRoomId){ try{ await __saveRoomCart(__currentRoomId, cart); }catch(_){ } }
      }
    });
  }
}catch(_){ }

// إعادة الحساب عند تغيير الخصم/الإضافى مع ضبط حدود الخصم
function calcSubBeforeVAT(){
  let sub = 0;
  const vatPct = (Number(settings.vat_percent) || 0) / 100;
  cart.forEach(item => {
    const price = Number(item.price || 0);
    const qty = Number(item.qty || 1);
    if(settings.prices_include_vat){
      const base = price / (1 + vatPct);
      sub += base * qty;
    } else {
      sub += price * qty;
    }
  });
  const extra = extraValueEl ? Math.max(0, Number(extraValueEl.value||0)) : 0;
  sub += extra;
  return sub;
}
function updateDiscountFieldUI(){
  if(!discountValueEl || !discountTypeEl) return;
  const dtype = discountTypeEl.value;
  if(dtype === 'percent'){
    discountValueEl.placeholder = 'نسبة الخصم %';
    discountValueEl.min = '0';
    discountValueEl.max = '100';
  } else if(dtype === 'amount'){
    discountValueEl.placeholder = 'قيمة الخصم';
    discountValueEl.min = '0';
    const sub = calcSubBeforeVAT();
    try{ discountValueEl.max = String(Number(sub.toFixed(2))); }catch(_){ discountValueEl.max = String(sub); }
  } else {
    discountValueEl.placeholder = 'قيمة الخصم';
    discountValueEl.min = '0';
    discountValueEl.removeAttribute('max');
  }
}
function enforceDiscountLimits(){
  if(!discountValueEl || !discountTypeEl) return;
  const s = (discountValueEl.value||'').trim();
  if(s==='') return;
  const dtype = discountTypeEl.value;
  let val = Number(s);
  if(isNaN(val)){ val = 0; }
  if(dtype === 'percent'){
    val = Math.max(0, Math.min(100, val));
  } else if(dtype === 'amount'){
    const sub = calcSubBeforeVAT();
    val = Math.max(0, Math.min(sub, val));
  }
  try{ discountValueEl.value = String(Number(val.toFixed(2))); }catch(_){ discountValueEl.value = String(val); }
}
if(discountTypeEl){
  discountTypeEl.addEventListener('change', () => { updateDiscountFieldUI(); enforceDiscountLimits(); scheduleComputeTotals(); if(__currentRoomId){ __saveRoomCart(__currentRoomId, cart); } });
  // initialize on load
  updateDiscountFieldUI();
}
if(discountValueEl){
  discountValueEl.addEventListener('input', () => { enforceDiscountLimits(); scheduleComputeTotals(); if(__currentRoomId){ __saveRoomCart(__currentRoomId, cart); } });
}
if(extraValueEl){
  extraValueEl.addEventListener('input', () => { updateDiscountFieldUI(); enforceDiscountLimits(); scheduleComputeTotals(); if(__currentRoomId){ __saveRoomCart(__currentRoomId, cart); } });
}

tbody.addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if(!b) return;
  const idx = Number(b.dataset.idx);
  const act = b.dataset.act;
  if(act==='inc'){
    const it = cart[idx];
    if(settings.weight_mode_enabled){
      const step = 1; // increment by 1 in weight mode per request
      it.qty = Number((Number(it.qty||0) + step).toFixed(3));
      const price = Number(it.price||0);
      it.__amount = Math.max(0, Number((it.qty * price).toFixed(2)));
      it.__wm_source = 'qty';
      renderCart();
      try{ await checkLowStockForItems([it]); }catch(_){ }
    } else {
      cart[idx].qty += 1;
      renderCart();
      try{ await checkLowStockForItems([cart[idx]]); }catch(_){ }
    }
  }
  if(act==='dec'){
    const it = cart[idx];
    if(settings.weight_mode_enabled){
      const step = 1; // decrement by 1 in weight mode per request
      it.qty = Math.max(0, Number((Number(it.qty||0) - step).toFixed(3)));
      const price = Number(it.price||0);
      it.__amount = Math.max(0, Number((it.qty * price).toFixed(2)));
      it.__wm_source = 'qty';
      renderCart();
      try{ await checkLowStockForItems([it]); }catch(_){ }
    } else {
      cart[idx].qty = Math.max(1, cart[idx].qty - 1);
      renderCart();
      try{ await checkLowStockForItems([cart[idx]]); }catch(_){ }
    }
  }
  if(act==='remove'){ cart.splice(idx,1); renderCart(); }

});

// معالج input لتحديث البيانات فوراً أثناء الكتابة (خاصة لاسم الصنف)
tbody.addEventListener('input', async (e) => {
  const opNameInp = e.target.closest('input.op-name-input');
  if(opNameInp){
    const idx = Number(opNameInp.dataset.idx);
    cart[idx].operation_name = opNameInp.value || '';
    if(__currentRoomId){ __saveRoomCart(__currentRoomId, cart); }
    return;
  }
});

tbody.addEventListener('change', async (e) => {
  const inpQty = e.target.closest('input.qty');
  if(inpQty){
    const idx = Number(inpQty.dataset.idx);
    const it = cart[idx];
    if(settings.weight_mode_enabled){
      // User edited quantity (weight): recompute amount = qty * price
      it.qty = Math.max(0, Number(inpQty.value||0));
      const price = Number(it.price||0);
      it.__amount = Math.max(0, Number((it.qty * price).toFixed(2)));
      it.__wm_source = 'qty';
    } else {
      it.qty = Math.max(1, Number(inpQty.value||1));
    }
    renderCart();
    try{ await checkLowStockForItems([cart[idx]]); }catch(_){ }
    return;
  }
  // Handle amount-paid input to derive qty in weight mode
  const amtInp = e.target.closest('input.amount-paid');
  if(amtInp){
    const idx = Number(amtInp.dataset.idx);
    const it = cart[idx];
    const amount = Math.max(0, Number(amtInp.value||0));
    it.__amount = amount; // persist typed amount for re-render
    const price = Number(it.price||0);
    it.qty = price>0 ? Math.max(0, Number((amount/price).toFixed(3))) : 0;
    it.__wm_source = 'amount';
    renderCart();
    try{ await checkLowStockForItems([cart[idx]]); }catch(_){ }
    return;
  }
  const empSelect = e.target.closest('select.employee-select');
  if(empSelect){
    const idx = Number(empSelect.dataset.idx);
    const it = cart[idx];
    if(it){
      it.employee_id = empSelect.value ? Number(empSelect.value) : null;
      // تحديث title attribute لعرض اسم الموظف الكامل
      const selectedEmp = it.employee_id ? __allEmployees.find(e => String(e.id) === String(it.employee_id)) : null;
      empSelect.title = selectedEmp ? selectedEmp.name : 'اختر';
      // ضبط عرض select ديناميكيًا بناءً على النص المحدد
      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const style = window.getComputedStyle(empSelect);
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const text = empSelect.options[empSelect.selectedIndex]?.text || 'اختر';
        const metrics = context.measureText(text);
        const textWidth = metrics.width;
        const calculatedWidth = Math.ceil(textWidth + 35);
        empSelect.style.width = `${Math.min(calculatedWidth, 250)}px`;
      } catch(_) {}
      if(__currentRoomId){ __saveRoomCart(__currentRoomId, cart); }
    }
    return;
  }
  const opSelect = e.target.closest('select.op-select');
  if(opSelect){
    const idx = Number(opSelect.dataset.idx);
    const it = cart[idx];
    if(it && it.__ops && it.__ops.length){
      const opId = Number(opSelect.value||0);
      const op = it.__ops.find(o => (o.operation_id||o.id)===opId);
      if(op){
        it.operation_id = (op.operation_id||op.id);
        it.operation_name = op.name;
        it.price = Number(op.price||it.price||0);
        delete it.manualPriceEdit;
        // طبّق عرض مرتبط بالصنف/العملية فقط بعد تغيير العملية — تجاهل العرض العام
        try{
          const cacheKey = `offer_${it.id}_${it.operation_id||''}`;
          const or = await cachedRequest(cacheKey, () => window.api.offers_find_for_product({ product_id: it.id, operation_id: it.operation_id }), 30000);
          if(or && or.ok && or.item && !Number(or.item.is_global)){
            if(or.item.mode === 'percent') it.price = Number((it.price * (1 - Number(or.item.value||0)/100)).toFixed(2));
            else it.price = Math.max(0, Number(it.price) - Number(or.item.value||0));
          }
        }catch(_){ }
        // طبّق تسعير العميل إن وجد (يتجاوز العرض)
        await applyCustomerPricingForItem(it);
        // enforce min_price after applying offers and customer pricing
        {
          const mp = (typeof it.min_price === 'number') ? Number(it.min_price) : (typeof it.product_min_price === 'number' ? Number(it.product_min_price) : (typeof it.min_price === 'string' ? Number(it.min_price) : null));
          const pNow0 = Number(it.price||0);
          if(mp!=null && !isNaN(mp) && pNow0 < mp){
            it.price = Number(mp);
            __showSalesToast('تم تعديل السعر إلى الحد الأدنى المسموح', { icon:'⚠️', danger:true, ms:3500 });
          }
        }
        try{
          if(!window.__qtyRulesCache) window.__qtyRulesCache = new Map();
          const key = it.id + '|' + (it.operation_id==null?'null':String(it.operation_id));
          const rr = await window.api.offers_qty_find_for_product({ product_id: it.id, operation_id: it.operation_id });
          if(rr && rr.ok && rr.item){ window.__qtyRulesCache.set(key, rr.item); }
        }catch(_){ }
        // If in weight mode, recompute based on last edited source
        if(settings.weight_mode_enabled){
          const pNow = Number(it.price||0);
          if(it.__wm_source === 'amount' && typeof it.__amount !== 'undefined'){
            const amount = Number(it.__amount||0);
            it.qty = pNow>0 ? Math.max(0, Number((amount/pNow).toFixed(3))) : 0;
          } else if(it.__wm_source === 'qty'){
            // User last edited qty -> update amount
            it.__amount = Math.max(0, Number((Number(it.qty||0) * pNow).toFixed(2)));
          }
        }
        // بعد تغيير العملية قد يتغير السعر → اضبط عرض حقل السعر والإجمالي
        try{
          const priceEl = document.querySelector(`input.op-price[data-idx="${idx}"]`);
          if(priceEl){ priceEl.style.width = Math.max(4, priceEl.value.length) + 'ch'; }
          const totalEl = document.querySelector(`.td-total .total-val`);
          if(totalEl){ totalEl.style.width = Math.max(4, (totalEl.textContent||'').length) + 'ch'; }
        }catch(_){ }
        renderCart();
        return;
      }
    }
  }
  const priceInp = e.target.closest('input.op-price');
  if(priceInp){
    if(!settings.op_price_manual){ return; }
    const idx = Number(priceInp.dataset.idx);
    const it = cart[idx];
    const p = Number(priceInp.value||0);
    if(!isNaN(p) && p >= 0){
      // تطبيق حد أدنى للسعر إن وُجد على المنتج
      const mp = (typeof it.min_price === 'number') ? Number(it.min_price) : (typeof it.product_min_price === 'number' ? Number(it.product_min_price) : (typeof it.min_price === 'string' ? Number(it.min_price) : null));
      if(mp!=null && !isNaN(mp) && p < mp){
        const minVal = Number(mp);
        it.price = minVal;
        it.manualPriceEdit = true;
        priceInp.value = String(minVal.toFixed(2));
        // مزامنة الحقول في وضع الوزن
        if(settings.weight_mode_enabled){
          if(it.__wm_source === 'amount' && typeof it.__amount !== 'undefined'){
            const amount = Number(it.__amount||0);
            it.qty = minVal>0 ? Math.max(0, Number((amount/minVal).toFixed(3))) : 0;
          } else if(it.__wm_source === 'qty'){
            it.__amount = Math.max(0, Number((Number(it.qty||0) * minVal).toFixed(2)));
          }
        }
        __showSalesToast(`السعر أقل من الحد الأدنى لهذا الصنف وهو (${mp})`, { icon:'⚠️', danger:true, ms:4000 });
        renderCart();
        return; // لا تعتمد القيمة الأقل المدخلة؛ اعتمد الحد الأدنى
      }
      it.price = p;
      it.manualPriceEdit = true;
      // If in weight mode, recompute based on last edited source
      if(settings.weight_mode_enabled){
        if(it.__wm_source === 'amount' && typeof it.__amount !== 'undefined'){
          const amount = Number(it.__amount||0);
          it.qty = p>0 ? Math.max(0, Number((amount/p).toFixed(3))) : 0;
        } else if(it.__wm_source === 'qty'){
          it.__amount = Math.max(0, Number((Number(it.qty||0) * p).toFixed(2)));
        }
      }
      // أعِد الرسم لضمان تحديث إجمالي السطر فورًا مع تحديث المجاميع
      renderCart();
    }
    return;
  }
  const descEl = e.target.closest('textarea.desc');
  if(descEl){
    const idx = Number(descEl.dataset.idx);
    cart[idx].description = descEl.value || '';
    if(__currentRoomId){ __saveRoomCart(__currentRoomId, cart); }
  }
});

btnClear.addEventListener('click', async () => {
  // فتح نافذة تأكيد صغيرة
  const backdrop = document.getElementById('confirmClear');
  const yesBtn = document.getElementById('confirmYes');
  const noBtn = document.getElementById('confirmNo');
  if(!backdrop || !yesBtn || !noBtn){ return; }
  backdrop.style.display = 'flex';

  const doClose = () => { backdrop.style.display = 'none'; };
  const onYes = async () => {
    doClose();
    cart = [];
    if(__currentRoomId){
      await __saveRoomCart(__currentRoomId, cart);
      try{ await window.api.rooms_set_status(__currentRoomId, 'vacant'); }catch(_){ }
    }
    renderCart();
    // إعادة طريقة الدفع إلى الافتراضية عند مسح السلة
    try{
      const methods = Array.isArray(settings.payment_methods) && settings.payment_methods.length ? settings.payment_methods : ['cash'];
      if(settings.default_payment_method && methods.includes(settings.default_payment_method)){
        paymentMethod.value = settings.default_payment_method;
      } else {
        paymentMethod.value = methods[0];
      }
    }catch(_){ /* ignore */ }
    setTimeout(() => { const barcodeInput = document.getElementById('scanBarcode'); if(barcodeInput) barcodeInput.focus(); }, 300);
  };
  const onNo = () => { doClose(); };

  const onBackdrop = (e) => { if(e.target === backdrop) doClose(); };
  backdrop.addEventListener('click', onBackdrop, { once: true });
  yesBtn.addEventListener('click', onYes, { once: true });
  noBtn.addEventListener('click', onNo, { once: true });
});

function openAddCustomer(){
  acmBackdrop.style.display = 'flex';
  acmName.value=''; acmPhone.value=''; acmEmail.value=''; acmAddress.value=''; acmVat.value=''; acmCr.value=''; acmNatAddr.value=''; acmNotes.value='';
  setTimeout(() => acmName.focus(), 50);
}
function closeAddCustomer(){ acmBackdrop.style.display = 'none'; }

btnAddCustomer.addEventListener('click', openAddCustomer);
acmClose.addEventListener('click', closeAddCustomer);
acmCancel.addEventListener('click', closeAddCustomer);
acmBackdrop.addEventListener('click', (e) => { if(e.target === acmBackdrop) closeAddCustomer(); });

acmSave.addEventListener('click', async () => {
  const name = (acmName.value||'').trim();
  const phone = (acmPhone.value||'').trim();
  const vat = (acmVat.value||'').trim();
  const cr = (acmCr.value||'').trim();
  
  if(!phone){ __showSalesToast('رقم الجوال مطلوب', { icon:'⚠️', danger:true, ms:4000 }); acmPhone.focus(); return; }
  if(phone && !/^\d+$/.test(phone)){ __showSalesToast('رقم الجوال يجب أن يحتوي على أرقام فقط', { icon:'⚠️', danger:true, ms:4000 }); acmPhone.focus(); return; }
  if(phone && settings.require_phone_min_10 && phone.length < 10){ __showSalesToast('رقم الجوال يجب أن يكون 10 أرقام على الأقل', { icon:'⚠️', danger:true, ms:4000 }); acmPhone.focus(); return; }
  if(vat && !/^\d{15}$/.test(vat)){ __showSalesToast('الرقم الضريبي يجب أن يكون 15 رقماً بالضبط', { icon:'⚠️', danger:true, ms:4000 }); acmVat.focus(); return; }
  if(cr && !/^\d+$/.test(cr)){ __showSalesToast('رقم السجل التجاري يجب أن يحتوي على أرقام فقط', { icon:'⚠️', danger:true, ms:4000 }); acmCr.focus(); return; }
  
  const payload = {
    name: name || null,
    phone,
    email: (acmEmail.value||'').trim() || null,
    address: (acmAddress.value||'').trim() || null,
    vat_number: vat || null,
    cr_number: cr || null,
    national_address: (acmNatAddr.value||'').trim() || null,
    notes: (acmNotes.value||'').trim() || null,
  };
  const res = await window.api.customers_add(payload);
  if(res && res.ok){
    await loadSettings();
    if(res.id){ __selectedCustomerId = String(res.id); const c = __allCustomers.find(x=>String(x.id)===String(res.id)); if(c){ selectCustomer(c); } }
    __showSalesToast('تم إضافة العميل بنجاح', { icon:'✓', ms:3000 });
    closeAddCustomer();
  }else{
    __showSalesToast(res && res.error ? res.error : 'تعذر إضافة العميل', { icon:'❌', danger:true, ms:4000 });
  }
});

btnPay.addEventListener('click', async () => {
  if(cart.length === 0){ __showSalesToast('أضف منتجات أولاً', { icon:'⚠️', danger:true, ms:5000 }); return; }

  // التحقق من وجود شفت مفتوح
  __currentShiftId = null;
  if (!(settings && (settings.show_shifts === 0 || settings.show_shifts === false))) {
    try {
      const currentUser = JSON.parse(localStorage.getItem('pos_user') || 'null');
      if (currentUser && currentUser.id) {
        const shiftRes = await window.api.shift_get_current(currentUser.id);
        if (!shiftRes || !shiftRes.ok || !shiftRes.shift) {
          const shouldContinue = await showNoShiftModal();
          if (!shouldContinue) {
            return;
          }
        } else {
          __currentShiftId = shiftRes.shift.id;
        }
      }
    } catch (e) {
      console.error('Error checking shift:', e);
    }
  }

  if(settings && settings.require_customer_before_print && !__selectedCustomerId){
    __showSalesToast('يرجى اختيار العميل قبل طباعة الفاتورة', { icon:'⚠️', danger:true, ms:5000 });
    if(customerSearch){ customerSearch.focus(); }
    return;
  }
  
  // إذا كانت خاصية اختيار طريقة الدفع قبل الطباعة مفعّلة، اعرض Modal أولاً
  if(settings && settings.require_payment_before_print){
    await showPaymentMethodModal();
    return;
  }
  
  setError('');
  // حساب المبالغ النهائية
  let sub=0, vat=0, grand=0; const vatPct = (Number(settings.vat_percent)||0)/100;
  cart.forEach(it => {
    const price = Number(it.price||0), qty = Number(it.qty||1);
    if(settings.prices_include_vat){
      const base = price / (1 + vatPct); sub += base*qty; vat += (price-base)*qty;
    }else{ sub += price*qty; vat += (price*vatPct)*qty; }
  }); grand = sub + vat;

  // الدفع النقدي: إدخال المبلغ اختياري. إن لم يُدخل شيء يعتبر 0؛ المدفوع الجزئي مسموح.
  const cashStr = (cashReceived.value||'').trim();
  let cash = cashStr === '' ? 0 : Number(cashStr);
  if(paymentMethod.value === 'cash'){
    if(cashStr !== '' && (isNaN(cash) || cash < 0)){ setError('قيمة غير صحيحة للمبلغ المدفوع'); return; }
    const minNeeded = Number((window.__sale_calcs?.grand_total ?? grand).toFixed(2));
    // اسمح بالطباعة إذا كان الحقل فارغاً، امنع فقط إذا تم إدخال قيمة أقل من الإجمالي
    if(cashStr !== '' && cash < minNeeded){ setError('المبلغ المدفوع أقل من الإجمالي شامل الضريبة'); cashReceived.focus(); return; }
    // إذا كان cash > 0 سيظهر في الطباعة، وإن كان 0 لن يظهر صف "المبلغ المدفوع"
  } else if(paymentMethod.value === 'mixed'){
    // مختلط: يجب إدخال مبلغ نقدي، والباقي شبكة تلقائيًا
    if(cashStr === ''){ setError('أدخل مبلغ الكاش لطريقة الدفع المختلط'); cashReceived.focus(); return; }
    if(isNaN(cash) || cash < 0){ setError('قيمة غير صحيحة للمبلغ النقدي'); return; }
    const total = Number((window.__sale_calcs?.grand_total ?? grand).toFixed(2));
    if(cash > total){ setError('المبلغ النقدي لا يجب أن يتجاوز الإجمالي'); cashReceived.focus(); return; }
    // الباقي شبكة = الإجمالي - نقدي
    const restCard = Number((total - cash).toFixed(2));
    window.__mixed_payment = { cash, card: restCard };
  } else if(paymentMethod.value === 'card' || paymentMethod.value === 'tamara' || paymentMethod.value === 'tabby'){
    // للشبكة/تمارا/تابي: إن تم إدخال مبلغ، يجب ألا يقل عن الإجمالي
    if(cashStr !== '' && (isNaN(cash) || cash < 0)){ setError('قيمة غير صحيحة للمبلغ المدفوع'); return; }
    const total = Number((window.__sale_calcs?.grand_total ?? grand).toFixed(2));
    if(cashStr !== '' && cash < total){ setError('المبلغ المدفوع أقل من الإجمالي شامل الضريبة'); cashReceived.focus(); return; }
    window.__mixed_payment = null;
  } else {
    // لطرق الدفع الأخرى، لا حاجة لاختبارات خاصة
    window.__mixed_payment = null;
  }

  // build payload
  const itemsPayload = cart.map(it => {
    const productId = it.id || it.product_id;
    if(!productId){
      console.error('Item missing product_id:', it);
      setError('خطأ: أحد المنتجات لا يحتوي على معرف صحيح');
    }
    return {
      product_id: productId,
      name: it.name,
      description: (it.description || null),
      operation_id: (typeof it.operation_id!=='undefined' && it.operation_id!=null) ? Number(it.operation_id) : null,
      operation_name: it.operation_name || null,
      variant_id: (typeof it.variant_id!=='undefined' && it.variant_id!=null) ? Number(it.variant_id) : null,
      price: Number(it.price||0),
      qty: Number(it.qty||1),
      unit_name: (it.unit_name || null),
      unit_multiplier: (it.unit_multiplier != null ? Number(it.unit_multiplier) : 1),
      line_total: Number(it.price||0) * Number(it.qty||1),
      category: (it.category || null),
      employee_id: (typeof it.employee_id!=='undefined' && it.employee_id!=null) ? Number(it.employee_id) : null
    };
  });

  // استخدم القيم المحسوبة مع الخصم
  const calcs = window.__sale_calcs || {};
  const payload = {
    items: itemsPayload,
    payment_method: paymentMethod.value,
    sub_total: Number((calcs.sub_total ?? sub).toFixed(2)),
    extra_value: Number((calcs.extra_value ?? Number(extraValueEl?.value||0)).toFixed(2)),
    discount_type: (calcs.discount_type || (discountTypeEl?.value||'none')),
    discount_value: Number((calcs.discount_value ?? Number(discountValueEl?.value||0)).toFixed(2)),
    discount_amount: Number((calcs.discount_amount ?? 0).toFixed(2)),
    sub_after_discount: Number((calcs.sub_after_discount ?? sub).toFixed(2)),
    vat_total: Number((calcs.vat_total ?? vat).toFixed(2)),
    grand_total: Number((calcs.grand_total ?? grand).toFixed(2)),
    tobacco_fee: Number((calcs.tobacco_fee ?? 0).toFixed(2)),
    notes: (notes.value||'').trim(),
    coupon: (__coupon ? { code: __coupon.code, mode: __coupon.mode, value: __coupon.value } : null),
    global_offer: (__globalOffer ? { mode: __globalOffer.mode, value: __globalOffer.value } : null),
    // pass split amounts for mixed
    pay_cash_amount: (paymentMethod.value==='mixed' && window.__mixed_payment) ? Number(window.__mixed_payment.cash||0) : (paymentMethod.value==='cash' ? (cashStr===''?0:Number(cashStr)) : null),
    pay_card_amount: (paymentMethod.value==='mixed' && window.__mixed_payment) ? Number(window.__mixed_payment.card||0) : (paymentMethod.value==='card' ? Number((window.__sale_calcs?.grand_total ?? grand).toFixed(2)) : null),
  };
  if(__selectedCustomerId){ payload.customer_id = Number(__selectedCustomerId); }
  if(__selectedDriverId){ payload.driver_id = Number(__selectedDriverId); }
  if(__currentShiftId){ payload.shift_id = Number(__currentShiftId); }
  // أزلنا خيار إدخال اسم العميل مباشرة

  try{ const u = JSON.parse(localStorage.getItem('pos_user')||'null'); if(u){ payload.created_by_user_id = u.id||null; payload.created_by_username = u.username||null; } }catch(_){ }
  // منع البيع إن وُجدت أسطر تحت الحد الأدنى للسعر
  for(let i=0;i<cart.length;i++){
    const it = cart[i];
    const mp = (typeof it.min_price === 'number') ? Number(it.min_price) : (typeof it.product_min_price === 'number' ? Number(it.product_min_price) : (typeof it.min_price === 'string' ? Number(it.min_price) : null));
    if(mp!=null && !isNaN(mp) && Number(it.price||0) < mp){
      __showSalesToast(`سطر ${i+1}: السعر أقل من الحد الأدنى (${mp.toFixed(2)})`, { icon:'⚠️', danger:true, ms:5000 });
      try{
        // ركّز على حقل السعر للسطر المخالف إن وُجد
        const row = tbody.querySelectorAll('tr')[i*2]; // الصف الرئيسي للسطر i
        const priceInp = row ? row.querySelector('input.op-price') : null;
        if(priceInp){ priceInp.focus(); priceInp.select(); }
      }catch(_){ }
      return; // لا تكمل الحفظ
    }
  }

  const r = await window.api.sales_create(payload);
  if(!r.ok){
    // إظهار توست علوي صغير يختفي خلال 5 ثوانٍ (أعلى يمين)
    __showSalesToast(r.error || 'فشل حفظ الفاتورة', { icon:'⚠️', danger:true, ms:5000 });
    setError('');
    return;
  }
  
  try{ __adjustStockCacheAfterSale(itemsPayload); }catch(_){ }
  try{ window.api.emit_sales_changed({ action: 'created', sale_id: r.sale_id, invoice_no: r.invoice_no }); }catch(_){ }

  // 🚀 فتح نافذة الطباعة فوراً
  const query = '&pay=' + encodeURIComponent(paymentMethod.value) + '&cash=' + encodeURIComponent(String(cash));
  const roomParam = __currentRoomId ? ('&room=' + encodeURIComponent(__currentRoomId)) : '';
  const orderParam = (typeof r.order_no !== 'undefined' && r.order_no !== null) ? ('&order=' + encodeURIComponent(String(r.order_no))) : '';
  let cashierName = '';
  try{ const u = JSON.parse(localStorage.getItem('pos_user')||'null'); if(u){ cashierName = (u.full_name || u.username || ''); } }catch(_){ cashierName=''; }
  const cashierParam = cashierName ? ('&cashier=' + encodeURIComponent(cashierName)) : '';
  const fmt = (settings && settings.default_print_format === 'a4') ? 'a4' : 'thermal';
  const basePath = fmt === 'a4' ? './print-a4.html' : './print.html';
  const printUrl = basePath + '?id=' + encodeURIComponent(r.sale_id) + query + roomParam + orderParam + cashierParam + '&copy=1';

  const w = (fmt==='a4' ? 800 : 420); const h = (fmt==='a4' ? 900 : 680);
  const win = window.open(printUrl, 'PRINT', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);

  // تحضير kitchen payload بعد فتح النافذة
  let __kitchenPayload = null;
  try{
    const roomMeta = __currentRoomId ? await (async()=>{ try{ const rmeta = await window.api.rooms_list(); if(rmeta.ok){ return (rmeta.items||[]).find(x => String(x.id)===String(__currentRoomId)) || null; } }catch(_){ } return null; })() : null;
    let waiter = null; try{ waiter = JSON.parse(localStorage.getItem('pos_user')||'{}'); }catch(_){ waiter = null; }
    const waiterName = waiter ? (waiter.full_name || waiter.username || '') : '';

    const itemsToSend = [];
    for(const it of cart){
      const total = Math.max(0, Number(it.qty||0));
      const sent = Math.max(0, Number(it.kitchen_sent_qty||0));
      const delta = total - sent;
      if(delta > 0){ itemsToSend.push({ ...it, qty: delta }); }
    }

    if(itemsToSend.length){
      __kitchenPayload = { items: itemsToSend, room_name: (roomMeta?roomMeta.name:null), sale_id: r.sale_id, waiter_name: waiterName, copies_per_section: 1, order_no: r.order_no };
    }
  }catch(_){ }
  const copies = Math.max(1, Number(settings.print_copies || (settings.print_two_copies ? 2 : 1)));
  if(!settings.silent_print && copies > 1){
    setTimeout(()=>{
      for(let i=2;i<=copies;i++){
        const printUrlN = basePath + '?id=' + encodeURIComponent(r.sale_id) + query + roomParam + orderParam + cashierParam + '&copy=' + i;
        window.open(printUrlN, 'PRINT_COPY_'+i, `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
      }
    }, 0);
  }
  const cartSnapshot = cart.map(it => ({...it}));
  if(settings.silent_print){
    (async()=>{
      try{
        const copiesSilent = Math.max(1, Number(settings.print_copies || (settings.print_two_copies ? 2 : 1)));
        const ps = [];
        for(let i=1;i<=copiesSilent;i++){
          let cashier = '';
          try{ const u = JSON.parse(localStorage.getItem('pos_user')||'null'); if(u && (u.full_name || u.username)){ cashier = u.full_name || u.username; } }catch(_){ }
          ps.push(window.api.print_invoice_silent({ id: r.sale_id, pay: paymentMethod.value, cash: String(cash), room: (__currentRoomId||''), format: fmt, cashier, copyNumber: i }));
        }
        await Promise.allSettled(ps);
      }catch(_){ }
      if(__kitchenPayload){
        try{
          const rKitchen = await window.api.kitchen_print_order(__kitchenPayload);
          if(rKitchen && rKitchen.ok && !rKitchen.skipped){
            for(const it of cartSnapshot){
              const total = Math.max(0, Number(it.qty||0));
              const sent = Math.max(0, Number(it.kitchen_sent_qty||0));
              const delta = total - sent;
              if(delta > 0){ it.kitchen_sent_qty = sent + delta; }
            }
            if(__currentRoomId){ try{ await __saveRoomCart(__currentRoomId, cartSnapshot); }catch(_){ } }
          }
        }catch(_){ }
      }
    })();
  } else {
    let __kitchenDone = false;
    async function __sendKitchenIfNeeded(){
      if(__kitchenDone) return; __kitchenDone = true;
      if(__kitchenPayload){
        try{
          const rKitchen = await window.api.kitchen_print_order(__kitchenPayload);
          if(rKitchen && rKitchen.ok && !rKitchen.skipped){
            for(const it of cartSnapshot){
              const total = Math.max(0, Number(it.qty||0));
              const sent = Math.max(0, Number(it.kitchen_sent_qty||0));
              const delta = total - sent;
              if(delta > 0){ it.kitchen_sent_qty = sent + delta; }
            }
            if(__currentRoomId){ try{ await __saveRoomCart(__currentRoomId, cartSnapshot); }catch(_){ } }
          }
        }catch(_){ }
      }
    }
    try{ window.addEventListener('message', (ev)=>{ try{ if(ev && ev.data && ev.data.type==='invoice-after-print'){ __sendKitchenIfNeeded(); } }catch(_){ } }); }catch(_){ }
    const checkClosed = setInterval(()=>{ try{ if(!win || win.closed){ clearInterval(checkClosed); __sendKitchenIfNeeded(); } }catch(_){ clearInterval(checkClosed); __sendKitchenIfNeeded(); } }, 250);
  }
  
  cart = []; if(__currentRoomId){ __saveRoomCart(__currentRoomId, cart); try{ await window.api.rooms_set_status(__currentRoomId, 'vacant'); }catch(_){ } } renderCart();
  // إعادة خانة المبلغ إلى وضعها الطبيعي
  if(cashReceived){ cashReceived.value=''; cashReceived.placeholder='المبلغ المدفوع'; cashReceived.disabled=false; }
  if(notes){ notes.value=''; }
  // تفريغ الخصم ليكون الافتراضي بدون خصم
  if(discountTypeEl){ discountTypeEl.value = 'none'; }
  if(discountValueEl){ discountValueEl.value = ''; }
  // تفريغ الإضافى والكوبون بعد طباعة الفاتورة
  if(extraValueEl){ extraValueEl.value = ''; }
  if(couponCodeEl){ couponCodeEl.value = ''; }
  __coupon = null; if(couponInfoEl){ couponInfoEl.textContent = ''; }
  // إعادة الحساب لإخفاء صفوف الخصم والإجمالي بعد الخصم
  computeTotals();
  // تفريغ اختيار العميل لبدء فاتورة جديدة بعميل جديد
  __selectedCustomerId = '';
  customerSearch.value = '';
  customerList.style.display = 'none';
  // تفريغ اختيار السائق بعد الطباعة
  __selectedDriverId = '';
  if(driverSelect){ driverSelect.value = ''; }
  // يمكن أيضاً مسح شريط البحث والكتالوج عند الحاجة
  barcode.value = '';
  // إعادة طريقة الدفع إلى الافتراضية المحددة في الإعدادات
  try{
    const methods = Array.isArray(settings.payment_methods) && settings.payment_methods.length ? settings.payment_methods : ['cash'];
    if(settings.default_payment_method && methods.includes(settings.default_payment_method)){
      paymentMethod.value = settings.default_payment_method;
    } else {
      paymentMethod.value = methods[0];
    }
    // اضبط خانة المبلغ وفق الطريقة الافتراضية
    if(cashReceived){
      if(paymentMethod.value === 'mixed'){
        cashReceived.disabled = false;
        cashReceived.placeholder = 'المبلغ النقدي (مختلط)';
      } else if(paymentMethod.value === 'credit' || paymentMethod.value === 'card' || paymentMethod.value === 'tamara' || paymentMethod.value === 'tabby'){
        cashReceived.value = '';
        cashReceived.disabled = true;
        cashReceived.placeholder = (paymentMethod.value === 'credit') ? 'المبلغ المدفوع (آجل)' : 'غير قابل للإدخال لهذه الطريقة';
      } else {
        cashReceived.disabled = false;
        cashReceived.placeholder = 'المبلغ المدفوع';
      }
    }
  }catch(_){ /* ignore */ }
  await loadCatalog();
  // نقل التركيز إلى حقل البحث بالباركود بعد الطباعة مباشرة
  setTimeout(() => {
    try { barcode.focus(); barcode.select(); }catch(_){ }
  }, 100);
});

// دالة عرض Modal اختيار طريقة الدفع
async function showPaymentMethodModal(){
  return new Promise((resolve) => {
    const modal = document.getElementById('paymentMethodModal');
    const optionsContainer = document.getElementById('paymentMethodOptions');
    const closeBtn = document.getElementById('paymentMethodModalClose');
    const cancelBtn = document.getElementById('paymentMethodCancel');
    const confirmBtn = document.getElementById('paymentMethodConfirm');
    
    let selectedMethod = paymentMethod.value || 'cash';
    
    // بناء خيارات طرق الدفع بناءً على الإعدادات
    const availableMethods = Array.isArray(settings.payment_methods) && settings.payment_methods.length ? settings.payment_methods : ['cash'];
    const methodLabels = {
      'cash': '💵 نقدي',
      'card': '💳 شبكة',
      'credit': '📝 آجل',
      'mixed': '💰 مختلط',
      'tamara': '🛍️ تمارا',
      'tabby': '🛒 تابي'
    };
    
    const methodIcons = {
      'cash': '💵',
      'card': '💳',
      'credit': '📝',
      'mixed': '💰',
      'tamara': '🛍️',
      'tabby': '🛒'
    };
    
    const methodNames = {
      'cash': 'كاش',
      'card': 'شبكة',
      'credit': 'آجل',
      'mixed': 'مختلط',
      'tamara': 'تمارا',
      'tabby': 'تابي'
    };
    
    optionsContainer.innerHTML = '';
    availableMethods.forEach(method => {
      const option = document.createElement('div');
      option.style.cssText = 'padding: 24px 16px; border: 3px solid #cbd5e1; border-radius: 16px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 12px; background: #fff; min-height: 140px; position: relative;';
      option.innerHTML = `
        <div style="font-size: 56px; line-height: 1;">${methodIcons[method] || '💳'}</div>
        <label style="font-size: 18px; font-weight: 800; color: #1e293b; cursor: pointer; text-align: center;">${methodNames[method] || method}</label>
        <input type="radio" name="payment_method_modal" value="${method}" ${method === selectedMethod ? 'checked' : ''} style="position: absolute; opacity: 0; pointer-events: none;">
      `;
      
      option.addEventListener('click', () => {
        const radio = option.querySelector('input[type="radio"]');
        radio.checked = true;
        selectedMethod = method;
        optionsContainer.querySelectorAll('div').forEach(o => {
          o.style.borderColor = '#cbd5e1';
          o.style.background = '#fff';
        });
        option.style.borderColor = '#2563eb';
        option.style.background = '#dbeafe';
      });
      
      if(method === selectedMethod){
        option.style.borderColor = '#2563eb';
        option.style.background = '#dbeafe';
      }
      
      optionsContainer.appendChild(option);
    });
    
    const closeModal = () => {
      modal.style.display = 'none';
      resolve(false);
    };
    
    const confirmModal = async () => {
      paymentMethod.value = selectedMethod;
      // اضبط خانة المبلغ حسب الطريقة المختارة
      if(cashReceived){
        if(selectedMethod === 'mixed'){
          cashReceived.disabled = false;
          cashReceived.placeholder = 'المبلغ النقدي (مختلط)';
        } else if(selectedMethod === 'credit' || selectedMethod === 'card' || selectedMethod === 'tamara' || selectedMethod === 'tabby'){
          cashReceived.value = '';
          cashReceived.disabled = true;
          cashReceived.placeholder = (selectedMethod === 'credit') ? 'المبلغ المدفوع (آجل)' : 'غير قابل للإدخال لهذه الطريقة';
        } else {
          cashReceived.disabled = false;
          cashReceived.placeholder = 'المبلغ المدفوع';
        }
      }
      modal.style.display = 'none';
      // استدعاء دالة الطباعة الفعلية
      await processPrint();
      resolve(true);
    };
    
    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    confirmBtn.onclick = confirmModal;
    
    modal.style.display = 'flex';
  });
}

// دالة الطباعة الفعلية (نفس محتوى btnPay الأصلي)
async function processPrint(){
  // التحقق من وجود شفت مفتوح
  __currentShiftId = null;
  if (!(settings && (settings.show_shifts === 0 || settings.show_shifts === false))) {
    try {
      const currentUser = JSON.parse(localStorage.getItem('pos_user') || 'null');
      if (currentUser && currentUser.id) {
        const shiftRes = await window.api.shift_get_current(currentUser.id);
        if (!shiftRes || !shiftRes.ok || !shiftRes.shift) {
          const shouldContinue = await showNoShiftModal();
          if (!shouldContinue) {
            return;
          }
        } else {
          __currentShiftId = shiftRes.shift.id;
        }
      }
    } catch (e) {
      console.error('Error checking shift:', e);
    }
  }
  
  setError('');
  // حساب المبالغ النهائية
  let sub=0, vat=0, grand=0; const vatPct = (Number(settings.vat_percent)||0)/100;
  cart.forEach(it => {
    const price = Number(it.price||0), qty = Number(it.qty||1);
    if(settings.prices_include_vat){
      const base = price / (1 + vatPct); sub += base*qty; vat += (price-base)*qty;
    }else{ sub += price*qty; vat += (price*vatPct)*qty; }
  }); grand = sub + vat;

  // الدفع النقدي: إدخال المبلغ اختياري. إن لم يُدخل شيء يعتبر 0؛ المدفوع الجزئي مسموح.
  const cashStr = (cashReceived.value||'').trim();
  let cash = cashStr === '' ? 0 : Number(cashStr);
  if(paymentMethod.value === 'cash'){
    if(cashStr !== '' && (isNaN(cash) || cash < 0)){ setError('قيمة غير صحيحة للمبلغ المدفوع'); return; }
    const minNeeded = Number((window.__sale_calcs?.grand_total ?? grand).toFixed(2));
    // اسمح بالطباعة إذا كان الحقل فارغاً، امنع فقط إذا تم إدخال قيمة أقل من الإجمالي
    if(cashStr !== '' && cash < minNeeded){ setError('المبلغ المدفوع أقل من الإجمالي شامل الضريبة'); cashReceived.focus(); return; }
    // إذا كان cash > 0 سيظهر في الطباعة، وإن كان 0 لن يظهر صف "المبلغ المدفوع"
  } else if(paymentMethod.value === 'mixed'){
    // مختلط: يجب إدخال مبلغ نقدي، والباقي شبكة تلقائيًا
    if(cashStr === ''){ setError('أدخل مبلغ الكاش لطريقة الدفع المختلط'); cashReceived.focus(); return; }
    if(isNaN(cash) || cash < 0){ setError('قيمة غير صحيحة للمبلغ النقدي'); return; }
    const total = Number((window.__sale_calcs?.grand_total ?? grand).toFixed(2));
    if(cash > total){ setError('المبلغ النقدي لا يجب أن يتجاوز الإجمالي'); cashReceived.focus(); return; }
    // الباقي شبكة = الإجمالي - نقدي
    const restCard = Number((total - cash).toFixed(2));
    window.__mixed_payment = { cash, card: restCard };
  } else if(paymentMethod.value === 'card' || paymentMethod.value === 'tamara' || paymentMethod.value === 'tabby'){
    // للشبكة/تمارا/تابي: إن تم إدخال مبلغ، يجب ألا يقل عن الإجمالي
    if(cashStr !== '' && (isNaN(cash) || cash < 0)){ setError('قيمة غير صحيحة للمبلغ المدفوع'); return; }
    const total = Number((window.__sale_calcs?.grand_total ?? grand).toFixed(2));
    if(cashStr !== '' && cash < total){ setError('المبلغ المدفوع أقل من الإجمالي شامل الضريبة'); cashReceived.focus(); return; }
    window.__mixed_payment = null;
  } else {
    // لطرق الدفع الأخرى، لا حاجة لاختبارات خاصة
    window.__mixed_payment = null;
  }

  // build payload
  const itemsPayload = cart.map(it => {
    const productId = it.id || it.product_id;
    if(!productId){
      console.error('Item missing product_id:', it);
      setError('خطأ: أحد المنتجات لا يحتوي على معرف صحيح');
    }
    return {
      product_id: productId,
      name: it.name,
      description: (it.description || null),
      operation_id: (typeof it.operation_id!=='undefined' && it.operation_id!=null) ? Number(it.operation_id) : null,
      operation_name: it.operation_name || null,
      variant_id: (typeof it.variant_id!=='undefined' && it.variant_id!=null) ? Number(it.variant_id) : null,
      price: Number(it.price||0),
      qty: Number(it.qty||1),
      unit_name: (it.unit_name || null),
      unit_multiplier: (it.unit_multiplier != null ? Number(it.unit_multiplier) : 1),
      line_total: Number(it.price||0) * Number(it.qty||1),
      category: (it.category || null),
      employee_id: (typeof it.employee_id!=='undefined' && it.employee_id!=null) ? Number(it.employee_id) : null
    };
  });

  // استخدم القيم المحسوبة مع الخصم
  const calcs = window.__sale_calcs || {};
  const payload = {
    items: itemsPayload,
    payment_method: paymentMethod.value,
    sub_total: Number((calcs.sub_total ?? sub).toFixed(2)),
    extra_value: Number((calcs.extra_value ?? Number(extraValueEl?.value||0)).toFixed(2)),
    discount_type: (calcs.discount_type || (discountTypeEl?.value||'none')),
    discount_value: Number((calcs.discount_value ?? Number(discountValueEl?.value||0)).toFixed(2)),
    discount_amount: Number((calcs.discount_amount ?? 0).toFixed(2)),
    sub_after_discount: Number((calcs.sub_after_discount ?? sub).toFixed(2)),
    vat_total: Number((calcs.vat_total ?? vat).toFixed(2)),
    grand_total: Number((calcs.grand_total ?? grand).toFixed(2)),
    tobacco_fee: Number((calcs.tobacco_fee ?? 0).toFixed(2)),
    notes: (notes.value||'').trim(),
    coupon: (__coupon ? { code: __coupon.code, mode: __coupon.mode, value: __coupon.value } : null),
    global_offer: (__globalOffer ? { mode: __globalOffer.mode, value: __globalOffer.value } : null),
    // pass split amounts for mixed
    pay_cash_amount: (paymentMethod.value==='mixed' && window.__mixed_payment) ? Number(window.__mixed_payment.cash||0) : (paymentMethod.value==='cash' ? (cashStr===''?0:Number(cashStr)) : null),
    pay_card_amount: (paymentMethod.value==='mixed' && window.__mixed_payment) ? Number(window.__mixed_payment.card||0) : (paymentMethod.value==='card' ? Number((window.__sale_calcs?.grand_total ?? grand).toFixed(2)) : null),
  };
  if(__selectedCustomerId){ payload.customer_id = Number(__selectedCustomerId); }
  if(__selectedDriverId){ payload.driver_id = Number(__selectedDriverId); }
  if(__currentShiftId){ payload.shift_id = Number(__currentShiftId); }
  // أزلنا خيار إدخال اسم العميل مباشرة

  try{ const u = JSON.parse(localStorage.getItem('pos_user')||'null'); if(u){ payload.created_by_user_id = u.id||null; payload.created_by_username = u.username||null; } }catch(_){ }
  // منع البيع إن وُجدت أسطر تحت الحد الأدنى للسعر
  for(let i=0;i<cart.length;i++){
    const it = cart[i];
    const mp = (typeof it.min_price === 'number') ? Number(it.min_price) : (typeof it.product_min_price === 'number' ? Number(it.product_min_price) : (typeof it.min_price === 'string' ? Number(it.min_price) : null));
    if(mp!=null && !isNaN(mp) && Number(it.price||0) < mp){
      __showSalesToast(`سطر ${i+1}: السعر أقل من الحد الأدنى (${mp.toFixed(2)})`, { icon:'⚠️', danger:true, ms:5000 });
      try{
        // ركّز على حقل السعر للسطر المخالف إن وُجد
        const row = tbody.querySelectorAll('tr')[i*2]; // الصف الرئيسي للسطر i
        const priceInp = row ? row.querySelector('input.op-price') : null;
        if(priceInp){ priceInp.focus(); priceInp.select(); }
      }catch(_){ }
      return; // لا تكمل الحفظ
    }
  }

  const r = await window.api.sales_create(payload);
  if(!r.ok){
    // إظهار توست علوي صغير يختفي خلال 5 ثوانٍ (أعلى يمين)
    __showSalesToast(r.error || 'فشل حفظ الفاتورة', { icon:'⚠️', danger:true, ms:5000 });
    setError('');
    return;
  }
  
  try{ __adjustStockCacheAfterSale(itemsPayload); }catch(_){ }
  try{ window.api.emit_sales_changed({ action: 'created', sale_id: r.sale_id, invoice_no: r.invoice_no }); }catch(_){ }

  // 🚀 فتح نافذة الطباعة فوراً
  const query = '&pay=' + encodeURIComponent(paymentMethod.value) + '&cash=' + encodeURIComponent(String(cash));
  const roomParam = __currentRoomId ? ('&room=' + encodeURIComponent(__currentRoomId)) : '';
  const orderParam = (typeof r.order_no !== 'undefined' && r.order_no !== null) ? ('&order=' + encodeURIComponent(String(r.order_no))) : '';
  let cashierName = '';
  try{ const u = JSON.parse(localStorage.getItem('pos_user')||'null'); if(u){ cashierName = (u.full_name || u.username || ''); } }catch(_){ cashierName=''; }
  const cashierParam = cashierName ? ('&cashier=' + encodeURIComponent(cashierName)) : '';
  const fmt = (settings && settings.default_print_format === 'a4') ? 'a4' : 'thermal';
  const basePath = fmt === 'a4' ? './print-a4.html' : './print.html';
  const printUrl = basePath + '?id=' + encodeURIComponent(r.sale_id) + query + roomParam + orderParam + cashierParam + '&copy=1';

  const w = (fmt==='a4' ? 800 : 420); const h = (fmt==='a4' ? 900 : 680);
  const win = window.open(printUrl, 'PRINT', `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);

  // تحضير kitchen payload بعد فتح النافذة
  let __kitchenPayload = null;
  try{
    const roomMeta = __currentRoomId ? await (async()=>{ try{ const rmeta = await window.api.rooms_list(); if(rmeta.ok){ return (rmeta.items||[]).find(x => String(x.id)===String(__currentRoomId)) || null; } }catch(_){ } return null; })() : null;
    let waiter = null; try{ waiter = JSON.parse(localStorage.getItem('pos_user')||'{}'); }catch(_){ waiter = null; }
    const waiterName = waiter ? (waiter.full_name || waiter.username || '') : '';

    const itemsToSend = [];
    for(const it of cart){
      const total = Math.max(0, Number(it.qty||0));
      const sent = Math.max(0, Number(it.kitchen_sent_qty||0));
      const delta = total - sent;
      if(delta > 0){ itemsToSend.push({ ...it, qty: delta }); }
    }

    if(itemsToSend.length){
      __kitchenPayload = { items: itemsToSend, room_name: (roomMeta?roomMeta.name:null), sale_id: r.sale_id, waiter_name: waiterName, copies_per_section: 1, order_no: r.order_no };
    }
  }catch(_){ }
  const copies = Math.max(1, Number(settings.print_copies || (settings.print_two_copies ? 2 : 1)));
  if(!settings.silent_print && copies > 1){
    setTimeout(()=>{
      for(let i=2;i<=copies;i++){
        const printUrlN = basePath + '?id=' + encodeURIComponent(r.sale_id) + query + roomParam + orderParam + cashierParam + '&copy=' + i;
        window.open(printUrlN, 'PRINT_COPY_'+i, `width=${w},height=${h},menubar=no,toolbar=no,location=no,status=no`);
      }
    }, 0);
  }
  const cartSnapshot = cart.map(it => ({...it}));
  if(settings.silent_print){
    (async()=>{
      try{
        const copiesSilent = Math.max(1, Number(settings.print_copies || (settings.print_two_copies ? 2 : 1)));
        const ps = [];
        for(let i=1;i<=copiesSilent;i++){
          let cashier = '';
          try{ const u = JSON.parse(localStorage.getItem('pos_user')||'null'); if(u && (u.full_name || u.username)){ cashier = u.full_name || u.username; } }catch(_){ }
          ps.push(window.api.print_invoice_silent({ id: r.sale_id, pay: paymentMethod.value, cash: String(cash), room: (__currentRoomId||''), format: fmt, cashier, copyNumber: i }));
        }
        await Promise.allSettled(ps);
      }catch(_){ }
      if(__kitchenPayload){
        try{
          const rKitchen = await window.api.kitchen_print_order(__kitchenPayload);
          if(rKitchen && rKitchen.ok && !rKitchen.skipped){
            for(const it of cartSnapshot){
              const total = Math.max(0, Number(it.qty||0));
              const sent = Math.max(0, Number(it.kitchen_sent_qty||0));
              const delta = total - sent;
              if(delta > 0){ it.kitchen_sent_qty = sent + delta; }
            }
            if(__currentRoomId){ try{ await __saveRoomCart(__currentRoomId, cartSnapshot); }catch(_){ } }
          }
        }catch(_){ }
      }
    })();
  } else {
    let __kitchenDone = false;
    async function __sendKitchenIfNeeded(){
      if(__kitchenDone) return; __kitchenDone = true;
      if(__kitchenPayload){
        try{
          const rKitchen = await window.api.kitchen_print_order(__kitchenPayload);
          if(rKitchen && rKitchen.ok && !rKitchen.skipped){
            for(const it of cartSnapshot){
              const total = Math.max(0, Number(it.qty||0));
              const sent = Math.max(0, Number(it.kitchen_sent_qty||0));
              const delta = total - sent;
              if(delta > 0){ it.kitchen_sent_qty = sent + delta; }
            }
            if(__currentRoomId){ try{ await __saveRoomCart(__currentRoomId, cartSnapshot); }catch(_){ } }
          }
        }catch(_){ }
      }
    }
    try{ window.addEventListener('message', (ev)=>{ try{ if(ev && ev.data && ev.data.type==='invoice-after-print'){ __sendKitchenIfNeeded(); } }catch(_){ } }); }catch(_){ }
    const checkClosed = setInterval(()=>{ try{ if(!win || win.closed){ clearInterval(checkClosed); __sendKitchenIfNeeded(); } }catch(_){ clearInterval(checkClosed); __sendKitchenIfNeeded(); } }, 250);
  }
  
  cart = []; if(__currentRoomId){ __saveRoomCart(__currentRoomId, cart); try{ await window.api.rooms_set_status(__currentRoomId, 'vacant'); }catch(_){ } } renderCart();
  // إعادة خانة المبلغ إلى وضعها الطبيعي
  if(cashReceived){ cashReceived.value=''; cashReceived.placeholder='المبلغ المدفوع'; cashReceived.disabled=false; }
  if(notes){ notes.value=''; }
  // تفريغ الخصم ليكون الافتراضي بدون خصم
  if(discountTypeEl){ discountTypeEl.value = 'none'; }
  if(discountValueEl){ discountValueEl.value = ''; }
  // تفريغ الإضافى والكوبون بعد طباعة الفاتورة
  if(extraValueEl){ extraValueEl.value = ''; }
  if(couponCodeEl){ couponCodeEl.value = ''; }
  __coupon = null; if(couponInfoEl){ couponInfoEl.textContent = ''; }
  // إعادة الحساب لإخفاء صفوف الخصم والإجمالي بعد الخصم
  computeTotals();
  // تفريغ اختيار العميل لبدء فاتورة جديدة بعميل جديد
  __selectedCustomerId = '';
  customerSearch.value = '';
  customerList.style.display = 'none';
  // تفريغ اختيار السائق بعد الطباعة
  __selectedDriverId = '';
  if(driverSelect){ driverSelect.value = ''; }
  // يمكن أيضاً مسح شريط البحث والكتالوج عند الحاجة
  barcode.value = '';
  // إعادة طريقة الدفع إلى الافتراضية المحددة في الإعدادات
  try{
    const methods = Array.isArray(settings.payment_methods) && settings.payment_methods.length ? settings.payment_methods : ['cash'];
    if(settings.default_payment_method && methods.includes(settings.default_payment_method)){
      paymentMethod.value = settings.default_payment_method;
    } else {
      paymentMethod.value = methods[0];
    }
    // اضبط خانة المبلغ وفق الطريقة الافتراضية
    if(cashReceived){
      if(paymentMethod.value === 'mixed'){
        cashReceived.disabled = false;
        cashReceived.placeholder = 'المبلغ النقدي (مختلط)';
      } else if(paymentMethod.value === 'credit' || paymentMethod.value === 'card' || paymentMethod.value === 'tamara' || paymentMethod.value === 'tabby'){
        cashReceived.value = '';
        cashReceived.disabled = true;
        cashReceived.placeholder = (paymentMethod.value === 'credit') ? 'المبلغ المدفوع (آجل)' : 'غير قابل للإدخال لهذه الطريقة';
      } else {
        cashReceived.disabled = false;
        cashReceived.placeholder = 'المبلغ المدفوع';
      }
    }
  }catch(_){ /* ignore */ }
  await loadCatalog();
  // نقل التركيز إلى حقل البحث بالباركود بعد الطباعة مباشرة
  setTimeout(() => {
    try { barcode.focus(); barcode.select(); }catch(_){ }
  }, 100);
}

async function populateCategories(){
  try{
    // 🚀 نجلب الأنواع النشطة والمرئية بشكل متوازي
    const [resAll, res] = await Promise.all([
      window.api.types_list(),
      window.api.types_list_for_display()
    ]);
    
    activeTypes = new Set();
    const allItems = (resAll && resAll.ok) ? (resAll.items||[]) : [];
    allItems.forEach(t => activeTypes.add(t.name));

    typeTabs.innerHTML = '';
    const items = (res && res.ok) ? (res.items||[]) : [];

    // إذا لا توجد أنواع: أخفِ شريط التبويبات وأخفِ الكتالوج بالكامل
    if(items.length === 0){
      __noMainTypes = true;
      try{ typeTabs.style.display = 'none'; }catch(_){ }
      try{ catalog.innerHTML=''; }catch(_){ }
      return;
    } else {
      __noMainTypes = false;
      try{ typeTabs.style.display = ''; }catch(_){ }
    }

    // إزالة الكلاسات القديمة للتحجيم
    typeTabs.classList.remove('many-tabs', 'very-many-tabs');
    
    // إضافة كلاس التحجيم بناءً على عدد التبويبات
    if(items.length > 15){
      typeTabs.classList.add('very-many-tabs');
    } else if(items.length > 12){
      typeTabs.classList.add('many-tabs');
    }

    items.forEach((t, idx) => {
      // create tab فقط للأنواع المرئية
      const tab = document.createElement('button');
      tab.className = 'tab' + (idx===0 ? ' active' : '');
      tab.textContent = t.name;
      tab.dataset.cat = t.name;
      tab.addEventListener('click', () => {
        // toggle active
        typeTabs.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
        tab.classList.add('active');
        loadCatalog();
      });
      typeTabs.appendChild(tab);
    });
  }catch(_){ /* ignore */ }
}

(async function init(){
  // 🚀 تحميل الإعدادات والعروض العامة بشكل متوازي
  let globalOfferRes;
  try{
    [, globalOfferRes] = await Promise.all([
      loadSettings(),
      window.api.offers_find_global_active()
    ]);
    
    if(globalOfferRes && globalOfferRes.ok && globalOfferRes.item){
      // ضبط العرض فوراً بـ Set فارغ لعدم تعطيل بقية التهيئة
      __globalOffer = {
        mode: globalOfferRes.item.mode,
        value: globalOfferRes.item.value,
        excluded: new Set()
      };
      // تحميل المنتجات المستثناة في الخلفية بدون تعطيل مسار التهيئة الرئيسي
      window.api.offers_get_excluded_products(globalOfferRes.item.id)
        .then(exclRes => {
          if(exclRes && exclRes.ok && Array.isArray(exclRes.items)){
            const excludedSet = new Set();
            exclRes.items.forEach(it => {
              const op = (it.operation_id != null) ? String(it.operation_id) : 'null';
              excludedSet.add(`${it.product_id}|${op}`);
            });
            __globalOffer.excluded = excludedSet;
          }
        })
        .catch(exErr => console.warn('Error loading excluded products:', exErr));
    }
  }catch(e){
    console.error('Error loading settings or global offer:', e);
  }
  
  // استعادة عرض السعر من sessionStorage إذا كان موجوداً
  try{
    const restoreCart = sessionStorage.getItem('restore_cart');
    const restoreTotals = sessionStorage.getItem('restore_totals');
    const restoreCustomerId = sessionStorage.getItem('restore_customer_id');
    const restoreNotes = sessionStorage.getItem('restore_notes');
    
    if(restoreCart){
      const rawItems = JSON.parse(restoreCart);
      
      cart = rawItems.map((it, idx) => {
        const productId = it.id || it.product_id;
        
        if(!productId){
          console.warn(`[Restore] Item ${idx} missing product_id:`, it.name);
          return null;
        }
        
        return {
          id: productId,
          name: it.name,
          name_en: it.name_en || null,
          price: Number(it.price || 0),
          qty: Number(it.qty || 1),
          image_path: it.image_path || null,
          category: it.category || null,
          is_tobacco: it.is_tobacco || 0,
          unit_name: it.unit_name || null,
          unit_multiplier: it.unit_multiplier || 1,
          operation_id: it.operation_id || null,
          operation_name: it.operation_name || null,
          description: it.description || null,
          employee_id: it.employee_id || null,
          product_min_price: it.product_min_price || null,
          manualPriceEdit: it.manualPriceEdit || false,
          __opsLoaded: false,
          __ops: []
        };
      }).filter(it => it !== null);
      
      sessionStorage.removeItem('restore_cart');
    }
    
    if(restoreTotals){
      const totals = JSON.parse(restoreTotals);
      if(discountTypeEl) discountTypeEl.value = totals.discount_type || 'none';
      if(discountValueEl) discountValueEl.value = totals.discount_value || 0;
      if(extraValueEl) extraValueEl.value = totals.extra_value || 0;
      sessionStorage.removeItem('restore_totals');
    }
    
    if(restoreCustomerId){
      __selectedCustomerId = restoreCustomerId;
      
      // تحميل قائمة العملاء للعثور على بيانات العميل الكاملة
      try{
        const lc = await window.api.customers_list({ active: '1', sort: 'name_asc' });
        __allCustomers = lc.ok ? (lc.items||[]) : [];
        
        // البحث عن العميل وعرض بياناته
        const customer = __allCustomers.find(c => String(c.id) === String(restoreCustomerId));
        if(customer && customerSearch){
          customerSearch.value = (customer.name || '') + (customer.phone ? (' - ' + customer.phone) : '');
        }
      }catch(e){
        console.error('Error loading customer data:', e);
      }
      
      await updatePricesForCustomer();
      sessionStorage.removeItem('restore_customer_id');
    }
    
    if(restoreNotes){
      const notesEl = document.getElementById('invoiceNotes');
      if(notesEl) notesEl.value = restoreNotes;
      sessionStorage.removeItem('restore_notes');
    }
    
    if(restoreCart){
      renderCart();
      computeTotals();
      showSuccessNotification('✓ تم استعادة عرض السعر بنجاح');
    }
  }catch(e){
    console.error('Error restoring quotation:', e);
  }
  
  // تحميل التبويبات والمنتجات بالتوازي لتسريع البداية
  try{ 
    populateCategories().then(() => {
      // بعد تحميل التبويبات، ابدأ تحميل المنتجات فوراً بعد إعطاء الـ event loop فرصة للرسم
      setTimeout(() => {
        loadCatalog().catch(() => {});
      }, 0);
    }).catch(() => {});
  }catch(_){ }
  // عند تغيير طريقة الدفع: إعادة الحساب وتنظيف حالة المختلط فقط
  try{
    if(paymentMethod){
      paymentMethod.addEventListener('change', ()=>{
        setError('');
        if(cashReceived){
          // Toggle input behavior based on payment method
          if(paymentMethod.value === 'mixed'){
            cashReceived.disabled = false;
            cashReceived.placeholder = 'المبلغ النقدي (مختلط)';
          } else if(paymentMethod.value === 'credit' || paymentMethod.value === 'card' || paymentMethod.value === 'tamara' || paymentMethod.value === 'tabby'){
            // For credit/network/Tamara/Tabby: lock the field
            cashReceived.value = '';
            cashReceived.disabled = true;
            cashReceived.placeholder = 'غير متاح لهذه الطريقة';
          } else {
            // For cash
            cashReceived.disabled = false;
            cashReceived.placeholder = 'المبلغ المستلم';
          }
        }
        computeTotals();
      });
    }
  }catch(_){ }
  // Load saved invoices
  try{
    if(btnProcessInvoice && processInvoiceNoEl){
      btnProcessInvoice.addEventListener('click', async ()=>{
        const inv = String(processInvoiceNoEl.value||'').trim();
        if(!inv){ setError('أدخل رقم فاتورة'); return; }
        await loadInvoiceIntoCartByNumber(inv);
      });
    }
  }catch(_){ }
  
  setupHeldInvoices();
})();

function setupHeldInvoices(){
  const btnHoldInvoice = document.getElementById('btnHoldInvoice');
  const btnShowHeldInvoices = document.getElementById('btnShowHeldInvoices');
  const himClose = document.getElementById('himClose');
  const himCloseBtn = document.getElementById('himCloseBtn');
  
  window.heldInvoicesModal = document.getElementById('heldInvoicesModal');
  window.heldInvoicesList = document.getElementById('heldInvoicesList');
  const heldInvoicesSearch = document.getElementById('heldInvoicesSearch');
  let heldInvoicesCache = [];

  if(btnHoldInvoice){
    btnHoldInvoice.addEventListener('click', async ()=>{
      if(!cart || cart.length === 0){
        showErrorNotification('⚠️ السلة فارغة - لا يمكن تعليق فاتورة فارغة', 3000);
        return;
      }
      
      const heldInvoice = {
        timestamp: new Date().toISOString(),
        cart: JSON.parse(JSON.stringify(cart)),
        customer: __selectedCustomerId || '',
        driver: __selectedDriverId || '',
        paymentMethod: paymentMethod ? paymentMethod.value : 'cash',
        cashReceived: cashReceived ? cashReceived.value : '',
        discountType: discountTypeEl ? discountTypeEl.value : 'none',
        discountValue: discountValueEl ? discountValueEl.value : '',
        extraValue: extraValueEl ? extraValueEl.value : '',
        coupon: __coupon ? JSON.parse(JSON.stringify(__coupon)) : null,
        notes: notes ? notes.value : '',
        couponCode: couponCodeEl ? couponCodeEl.value : ''
      };
      
      const result = await window.api.held_invoices_add(heldInvoice);
      if(!result.ok){
        showErrorNotification('⚠️ فشل حفظ الفاتورة: ' + (result.error || 'خطأ غير معروف'), 3000);
        return;
      }
      
      cart = [];
      renderCart();
      __selectedCustomerId = '';
      __selectedDriverId = '';
      
      if(customerSearch) customerSearch.value = '';
      if(customerList) customerList.style.display = 'none';
      if(driverSelect) driverSelect.value = '';
      if(paymentMethod) paymentMethod.value = 'cash';
      if(cashReceived) { cashReceived.value = ''; cashReceived.disabled = false; cashReceived.placeholder = 'المبلغ المستلم'; }
      if(discountTypeEl) discountTypeEl.value = 'none';
      if(discountValueEl) discountValueEl.value = '';
      if(extraValueEl) extraValueEl.value = '';
      if(notes) notes.value = '';
      if(couponCodeEl) couponCodeEl.value = '';
      if(couponInfoEl) couponInfoEl.textContent = '';
      __coupon = null;
      
      setError('');
      computeTotals();
      
      try{ await loadCatalog(); }catch(_){}
      
      showSuccessNotification('✓ تم تعليق الفاتورة بنجاح');
    });
  }

  if(heldInvoicesSearch){
    heldInvoicesSearch.addEventListener('input', ()=>{
      const term = normalizeDigits(heldInvoicesSearch.value || '').toLowerCase().trim();
      renderHeldInvoicesList(heldInvoicesCache, term);
    });
  }

  if(btnShowHeldInvoices){
    btnShowHeldInvoices.addEventListener('click', async ()=>{
      await loadHeldInvoicesList();
      window.heldInvoicesModal.style.display = 'flex';
    });
  }

  if(himClose){
    himClose.addEventListener('click', ()=>{
      window.heldInvoicesModal.style.display = 'none';
    });
  }

  if(himCloseBtn){
    himCloseBtn.addEventListener('click', ()=>{
      window.heldInvoicesModal.style.display = 'none';
    });
  }

  if(window.heldInvoicesModal){
    window.heldInvoicesModal.addEventListener('click', (e)=>{
      if(e.target === window.heldInvoicesModal){
        window.heldInvoicesModal.style.display = 'none';
      }
    });
  }

  function getHeldCustomerLabel(invoice){
    if(!invoice || !invoice.customer) return '';
    const customer = __allCustomers.find(c => String(c.id) === String(invoice.customer));
    if(!customer) return String(invoice.customer || '');
    const name = customer.name || '';
    const phone = customer.phone ? (' - ' + customer.phone) : '';
    const idText = customer.id ? (' #' + customer.id) : '';
    return `${name}${phone}${idText}`.trim();
  }

  function renderHeldInvoicesList(items, term){
    const normalizedTerm = normalizeDigits(term || '').toLowerCase().trim();
    const filtered = normalizedTerm
      ? items.filter(invoice => {
          const customer = __allCustomers.find(c => String(c.id) === String(invoice.customer));
          const blob = [invoice.customer, customer?.name, customer?.phone, customer?.id]
            .filter(Boolean)
            .join(' ');
          const normalizedBlob = normalizeDigits(blob || '').toLowerCase();
          return normalizedBlob.includes(normalizedTerm);
        })
      : items;

    if(!filtered || filtered.length === 0){
      window.heldInvoicesList.innerHTML = '<div style="text-align:center; padding:40px; color:#64748b; font-weight:600;">لا توجد فواتير مطابقة</div>';
      return;
    }

    window.heldInvoicesList.innerHTML = '';
    filtered.forEach((invoice, index)=>{
      const date = new Date(invoice.timestamp);
      const dateStr = date.toLocaleDateString('en-GB', {year:'numeric', month:'2-digit', day:'2-digit'});
      const timeStr = date.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit', hour12: false});
      const itemsCount = invoice.cart ? invoice.cart.length : 0;
      const total = invoice.cart ? invoice.cart.reduce((sum, item) => sum + (item.price * item.qty), 0) : 0;
      const customerLabel = getHeldCustomerLabel(invoice);
      const customerText = customerLabel ? ` | العميل: ${customerLabel}` : '';

      const div = document.createElement('div');
      div.className = 'held-invoice-item';
      div.innerHTML = `
        <div class="held-invoice-info">
          <div class="title">فاتورة #${invoice.id}</div>
          <div class="details">${dateStr} - ${timeStr} | ${itemsCount} منتج | الإجمالي: ${total.toFixed(2)}${customerText}</div>
        </div>
        <div class="held-invoice-actions">
          <button class="btn primary btn-restore" data-index="${invoice.__index ?? index}" data-db-id="${invoice.db_id}">📥 استرجاع</button>
          <button class="btn danger btn-delete" data-index="${invoice.__index ?? index}" data-db-id="${invoice.db_id}">🗑️ حذف</button>
        </div>
      `;
      
      window.heldInvoicesList.appendChild(div);
    });

    window.heldInvoicesList.querySelectorAll('.btn-restore').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const index = parseInt(btn.dataset.index);
        const dbId = parseInt(btn.dataset.dbId);
        await restoreHeldInvoice(index, dbId);
      });
    });

    window.heldInvoicesList.querySelectorAll('.btn-delete').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const index = parseInt(btn.dataset.index);
        const dbId = parseInt(btn.dataset.dbId);
        await deleteHeldInvoice(index, dbId);
      });
    });
  }

  async function loadHeldInvoicesList(){
    const result = await window.api.held_invoices_list();
    if(!result.ok){
      window.heldInvoicesList.innerHTML = '<div style="text-align:center; padding:40px; color:#ef4444; font-weight:600;">خطأ في تحميل الفواتير</div>';
      return;
    }

    const heldInvoices = result.items || [];
    if(!heldInvoices || heldInvoices.length === 0){
      window.heldInvoicesList.innerHTML = '<div style="text-align:center; padding:40px; color:#64748b; font-weight:600;">لا توجد فواتير معلقة</div>';
      return;
    }

    heldInvoicesCache = heldInvoices.map((invoice, index)=>({ ...invoice, __index: index }));
    const term = heldInvoicesSearch ? normalizeDigits(heldInvoicesSearch.value || '').toLowerCase().trim() : '';
    renderHeldInvoicesList(heldInvoicesCache, term);
  }

  async function restoreHeldInvoice(index, dbId){
    const result = await window.api.held_invoices_list();
    if(!result.ok) return;
    
    const heldInvoices = result.items || [];
    if(!heldInvoices[index]) return;

    const invoice = heldInvoices[index];
    
    cart = invoice.cart || [];
    __selectedCustomerId = invoice.customer || '';
    __selectedDriverId = invoice.driver || '';
    
    if(customerSearch && __selectedCustomerId){
      const c = __allCustomers.find(x => String(x.id)===String(__selectedCustomerId));
      if(c){
        customerSearch.value = (c.name||'') + (c.phone ? (' - ' + c.phone) : '');
      }
    } else if(customerSearch){
      customerSearch.value = '';
    }
    
    if(driverSelect) driverSelect.value = invoice.driver || '';
    if(paymentMethod) {
      paymentMethod.value = invoice.paymentMethod || 'cash';
      if(cashReceived){
        if(invoice.paymentMethod === 'mixed'){
          cashReceived.disabled = false;
          cashReceived.placeholder = 'المبلغ النقدي (مختلط)';
        } else if(invoice.paymentMethod === 'credit' || invoice.paymentMethod === 'card' || invoice.paymentMethod === 'tamara' || invoice.paymentMethod === 'tabby'){
          cashReceived.disabled = true;
          cashReceived.placeholder = 'غير متاح لهذه الطريقة';
        } else {
          cashReceived.disabled = false;
          cashReceived.placeholder = 'المبلغ المستلم';
        }
      }
    }
    if(cashReceived) cashReceived.value = invoice.cashReceived || '';
    if(discountTypeEl) discountTypeEl.value = invoice.discountType || 'none';
    if(discountValueEl) discountValueEl.value = invoice.discountValue || '';
    if(extraValueEl) extraValueEl.value = invoice.extraValue || '';
    if(notes) notes.value = invoice.notes || '';
    if(couponCodeEl) couponCodeEl.value = invoice.couponCode || '';
    
    __coupon = invoice.coupon || null;
    if(__coupon && couponInfoEl){
      const t = __coupon.mode==='percent' ? `خصم ${__coupon.value}%` : `خصم ${__coupon.value} `;
      couponInfoEl.textContent = `✓ ${t}`;
    } else if(couponInfoEl){
      couponInfoEl.textContent = '';
    }
    
    renderCart();
    
    setError('');
    computeTotals();
    
    if(__selectedCustomerId){
      await updatePricesForCustomer();
      await loadCatalog();
    } else {
      try{ await loadCatalog(); }catch(_){}
    }
    
    await window.api.held_invoices_delete(dbId);
    
    await loadHeldInvoicesList();
    
    setTimeout(() => {
      window.heldInvoicesModal.style.display = 'none';
    }, 500);
    
    showSuccessNotification('✓ تم استرجاع الفاتورة بنجاح');
  }

  function confirmDeleteHeldInvoice(){
    const backdrop = document.getElementById('confirmDeleteHeld');
    const yesBtn = document.getElementById('confirmDeleteYes');
    const noBtn = document.getElementById('confirmDeleteNo');
    return new Promise(resolve => {
      if(!backdrop || !yesBtn || !noBtn){
        resolve(true);
        return;
      }
      backdrop.style.display = 'flex';
      const doClose = (value) => {
        backdrop.style.display = 'none';
        resolve(value);
      };
      const onYes = () => doClose(true);
      const onNo = () => doClose(false);
      const onBackdrop = (e) => { if(e.target === backdrop) doClose(false); };
      backdrop.addEventListener('click', onBackdrop, { once: true });
      yesBtn.addEventListener('click', onYes, { once: true });
      noBtn.addEventListener('click', onNo, { once: true });
    });
  }

  async function deleteHeldInvoice(index, dbId){
    const confirmed = await confirmDeleteHeldInvoice();
    if(!confirmed){
      return;
    }
    const result = await window.api.held_invoices_delete(dbId);
    if(!result.ok){
      showErrorNotification('⚠️ فشل حذف الفاتورة: ' + (result.error || 'خطأ غير معروف'), 3000);
      return;
    }
    
    await loadHeldInvoicesList();
    
    showSuccessNotification('✓ تم حذف الفاتورة المعلقة');
  }
}

// ===== تهيئة التحسينات عند تحميل الصفحة =====
(function initPerformanceOptimizations() {
  try {
    // تهيئة Web Worker للحسابات
    initCalculationsWorker();
    
    // تفعيل requestIdleCallback للعمليات غير الحرجة
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        // تحميل مسبق للبيانات المخزنة
        if (requestCache.size > 0) {
          console.log('Performance: Cache initialized with', requestCache.size, 'entries');
        }
      });
    }
    
    // تحسين أداء الـ scroll events
    let scrollTicking = false;
    const optimizedScrollHandler = (callback) => {
      return function(...args) {
        if (!scrollTicking) {
          scrollTicking = true;
          requestAnimationFrame(() => {
            callback.apply(this, args);
            scrollTicking = false;
          });
        }
      };
    };
    
    // تطبيق على scroll الجدول
    const cartScrollEl = document.querySelector('.cart-scroll');
    if (cartScrollEl) {
      cartScrollEl.addEventListener('scroll', optimizedScrollHandler(() => {
        // يمكن إضافة منطق إضافي هنا مستقبلاً
      }));
    }
    
    console.log('Performance optimizations initialized successfully');
  } catch(error) {
    console.warn('Some performance optimizations failed to initialize:', error);
  }
})();

// ===== Add Product Modal for Unknown Barcode =====
// Function to play warning beep sound
function playWarningBeep(){
  try{
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // Frequency in Hz
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  }catch(err){
    console.warn('Failed to play warning sound:', err);
  }
}

// Function to show confirmation dialog when barcode is not found
function showAddProductConfirmation(){
  return new Promise((resolve) => {
    const confirmDialog = document.getElementById('confirmAddProduct');
    const yesBtn = document.getElementById('confirmAddProductYes');
    const noBtn = document.getElementById('confirmAddProductNo');
    
    if(!confirmDialog || !yesBtn || !noBtn){
      resolve(false);
      return;
    }
    
    // Play warning beep
    playWarningBeep();
    
    confirmDialog.style.display = 'flex';
    
    const handleYes = () => {
      confirmDialog.style.display = 'none';
      cleanup();
      resolve(true);
    };
    
    const handleNo = () => {
      confirmDialog.style.display = 'none';
      cleanup();
      resolve(false);
    };
    
    const handleBackdrop = (e) => {
      if(e.target === confirmDialog){
        confirmDialog.style.display = 'none';
        cleanup();
        resolve(false);
      }
    };
    
    const cleanup = () => {
      yesBtn.removeEventListener('click', handleYes);
      noBtn.removeEventListener('click', handleNo);
      confirmDialog.removeEventListener('click', handleBackdrop);
    };
    
    yesBtn.addEventListener('click', handleYes);
    noBtn.addEventListener('click', handleNo);
    confirmDialog.addEventListener('click', handleBackdrop);
  });
}

// Function to open the Add Product modal
async function openAddProductModal(barcode){
  const modal = document.getElementById('addProductModal');
  const closeBtn = document.getElementById('apmClose');
  const cancelBtn = document.getElementById('apmCancel');
  const saveBtn = document.getElementById('apmSave');
  const barcodeInput = document.getElementById('apmBarcode');
  const nameInput = document.getElementById('apmName');
  const nameEnInput = document.getElementById('apmNameEn');
  const categorySelect = document.getElementById('apmCategory');
  const costInput = document.getElementById('apmCost');
  const priceInput = document.getElementById('apmPrice');
  const minPriceInput = document.getElementById('apmMinPrice');
  const stockInput = document.getElementById('apmStock');
  const expiryDateInput = document.getElementById('apmExpiryDate');

  const descriptionInput = document.getElementById('apmDescription');
  const thumbImg = document.getElementById('apmThumb');
  const pickImageBtn = document.getElementById('apmPickImage');
  const removeImageBtn = document.getElementById('apmRemoveImage');
  const hideFromSalesCheckbox = document.getElementById('apmHideFromSales');
  
  let pickedImagePath = null;
  
  if(!modal) return;
  
  // Reset form
  if(nameInput) nameInput.value = '';
  if(nameEnInput) nameEnInput.value = '';
  if(barcodeInput) barcodeInput.value = barcode || '';
  if(costInput) costInput.value = '';
  if(priceInput) priceInput.value = '';
  if(minPriceInput) minPriceInput.value = '';
  if(stockInput) stockInput.value = '0';
  if(expiryDateInput) expiryDateInput.value = '';

  if(descriptionInput) descriptionInput.value = '';
  if(thumbImg) thumbImg.src = '';
  if(hideFromSalesCheckbox) hideFromSalesCheckbox.checked = false;
  pickedImagePath = null;
  
  // Load categories
  try{
    const categoriesResult = await window.api.types_list();
    if(categorySelect && categoriesResult && categoriesResult.ok){
      categorySelect.innerHTML = '<option value="">اختر الفئة...</option>';
      (categoriesResult.items || []).forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.name;
        opt.textContent = cat.name;
        categorySelect.appendChild(opt);
      });
    }
  }catch(_){}
  
  // Show modal
  modal.style.display = 'flex';
  
  // Focus on name input
  setTimeout(() => { if(nameInput) nameInput.focus(); }, 100);
  
  // Handle image picking
  if(pickImageBtn){
    pickImageBtn.onclick = async () => {
      try{
        const result = await window.api.pick_image();
        if(result && result.ok && result.path){
          pickedImagePath = result.path;
          if(thumbImg){
            if(pickedImagePath.startsWith('assets/')){
              thumbImg.src = '../../../' + pickedImagePath;
            } else {
              thumbImg.src = 'file:///' + pickedImagePath.replace(/\\/g, '/');
            }
          }
        }
      }catch(err){
        console.error('Failed to pick image:', err);
      }
    };
  }
  
  // Handle image removal
  if(removeImageBtn){
    removeImageBtn.onclick = () => {
      pickedImagePath = null;
      if(thumbImg) thumbImg.src = '';
    };
  }
  
  // Handle close
  const handleClose = () => {
    modal.style.display = 'none';
  };
  
  const handleBackdrop = (e) => {
    if(e.target === modal){
      modal.style.display = 'none';
    }
  };
  
  const handleSave = async () => {
    try{
      const name = (nameInput ? nameInput.value : '').trim();
      const nameEn = (nameEnInput ? nameEnInput.value : '').trim();
      const barcodeVal = (barcodeInput ? barcodeInput.value : '').trim();
      const category = (categorySelect ? categorySelect.value : '').trim();
      const cost = costInput ? Number(costInput.value || 0) : 0;
      const price = priceInput ? Number(priceInput.value || 0) : 0;
      const minPrice = minPriceInput ? Number(minPriceInput.value || 0) : null;
      const stock = stockInput ? Number(stockInput.value || 0) : 0;
      const expiryDate = (expiryDateInput ? expiryDateInput.value : '').trim();

      const description = (descriptionInput ? descriptionInput.value : '').trim();
      const hideFromSales = hideFromSalesCheckbox ? (hideFromSalesCheckbox.checked ? 1 : 0) : 0;
      
      // Validation
      if(!name){
        showErrorNotification('❌ يرجى إدخال اسم المنتج (عربي)');
        if(nameInput) nameInput.focus();
        return;
      }
      
      if(price <= 0){
        showErrorNotification('❌ يرجى إدخال سعر البيع');
        if(priceInput) priceInput.focus();
        return;
      }
      
      // Save product
      const productData = {
        name,
        name_en: nameEn || null,
        barcode: barcodeVal || null,
        category: category || null,
        cost,
        price,
        min_price: minPrice,
        stock,
        expiry_date: expiryDate || null,
        is_tobacco: 0,
        description: description || null,
        image_path: pickedImagePath || null,
        hide_from_sales: hideFromSales,
        is_active: 1
      };
      
      const result = await window.api.products_add(productData);
      
      if(!result || !result.ok){
        showErrorNotification('❌ فشل حفظ المنتج: ' + (result?.error || 'خطأ غير معروف'));
        return;
      }
      
      // Success
      showSuccessNotification('✓ تم إضافة المنتج بنجاح');
      modal.style.display = 'none';
      
      // Reload catalog to show new product
      try{
        await loadCatalog();
      }catch(_){}
      
    }catch(err){
      showErrorNotification('❌ حدث خطأ أثناء حفظ المنتج: ' + (err?.message || String(err)));
    }
  };
  
  if(closeBtn){
    closeBtn.onclick = handleClose;
  }
  
  if(cancelBtn){
    cancelBtn.onclick = handleClose;
  }
  
  if(saveBtn){
    saveBtn.onclick = handleSave;
  }
  
  modal.onclick = handleBackdrop;
}

// Quick add product button handler
const btnQuickAddProduct = document.getElementById('btnQuickAddProduct');
if(btnQuickAddProduct){
  btnQuickAddProduct.addEventListener('click', async () => {
    await openAddProductModal('');
  });
}

// WhatsApp connection status monitoring
(async function monitorWhatsAppStatus() {
  // Check if WhatsApp auto-send is enabled in settings
  let whatsappEnabled = false;
  try {
    const settingsResult = await window.api.settings_get();
    if (settingsResult && settingsResult.ok && settingsResult.item) {
      whatsappEnabled = settingsResult.item.whatsapp_on_print === 1 || settingsResult.item.whatsapp_on_print === true;
    }
  } catch (err) {
    // Ignore
  }
  
  // Don't monitor if WhatsApp feature is not enabled
  if (!whatsappEnabled) {
    return;
  }
  
  let lastInternetStatus = navigator.onLine;
  let lastWhatsAppStatus = null;
  let hasShownInternetError = false;
  let hasShownWhatsAppError = false;

  async function checkAndNotify(isInitialCheck = false) {
    try {
      const currentInternetStatus = navigator.onLine;
      
      // Check on initial load or when status changes to offline
      if (!currentInternetStatus && (isInitialCheck || (lastInternetStatus && !hasShownInternetError))) {
        if (typeof window.showWhatsAppErrorNotification === 'function') {
          window.showWhatsAppErrorNotification('no-internet', 'إرسال الفواتير عبر واتساب معطل مؤقتاً');
        }
        hasShownInternetError = true;
        hasShownWhatsAppError = false;
        lastWhatsAppStatus = null;
      }
      
      // Internet came back online
      if (currentInternetStatus && !lastInternetStatus) {
        hasShownInternetError = false;
        // Check WhatsApp status when internet comes back
        setTimeout(() => checkAndNotify(), 1000);
      }
      
      lastInternetStatus = currentInternetStatus;
      
      // Only check WhatsApp if internet is available
      if (currentInternetStatus) {
        try {
          const statusCheck = await window.api.whatsapp_status();
          const isConnected = statusCheck && statusCheck.success && statusCheck.connected;
          
          // WhatsApp disconnected or not connected on initial check
          if (!isConnected && (isInitialCheck || (lastWhatsAppStatus === true && !hasShownWhatsAppError))) {
            if (typeof window.showWhatsAppErrorNotification === 'function') {
              window.showWhatsAppErrorNotification('not-connected', 'إرسال الفواتير عبر واتساب معطل');
            }
            hasShownWhatsAppError = true;
          }
          
          // WhatsApp reconnected
          if (isConnected && lastWhatsAppStatus === false) {
            if (typeof window.showWhatsAppNotification === 'function') {
              window.showWhatsAppNotification('✅ WhatsApp متصل الآن - يمكن إرسال الفواتير', '');
            }
            hasShownWhatsAppError = false;
          }
          
          lastWhatsAppStatus = isConnected;
        } catch (err) {
          // Ignore errors in status check
        }
      }
    } catch (err) {
      // Ignore any errors
    }
  }

  // Check on page load (initial check)
  setTimeout(() => checkAndNotify(true), 2000);
  
  // Monitor internet connection changes
  window.addEventListener('online', () => {
    checkAndNotify();
  });
  
  window.addEventListener('offline', () => {
    checkAndNotify();
  });
  
  // Periodic check every 30 seconds
  setInterval(checkAndNotify, 30000);
})();

// Auto-focus on barcode input when page loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const barcodeInput = document.getElementById('scanBarcode');
    if (barcodeInput) {
      barcodeInput.focus();
    }
  }, 50);
});