// Settings screen: read/save settings via IPC

const errorDiv = document.getElementById('error');
const okDiv = document.getElementById('ok');

let __isAr = true;
function __t(ar, en){ return __isAr ? ar : en; }
function __lbl(inputId, text){
  const el = document.getElementById(inputId); if(!el) return;
  const p = el.parentElement; if(!p) return;
  const lb = p.querySelector('label'); if(lb) lb.textContent = text;
}
function __lblFor(forId, text){
  const lb = document.querySelector('label[for="' + forId + '"]'); if(lb) lb.textContent = text;
}
function __txt(id, text){
  const el = document.getElementById(id); if(el) el.textContent = text;
}
function __btn(id, text){
  const el = document.getElementById(id); if(el) el.textContent = text;
}
function __opt(selectId, value, text){
  const el = document.querySelector('#' + selectId + ' option[value="' + value + '"]'); if(el) el.textContent = text;
}

function translateUI(isAr){
  __isAr = isAr;
  document.documentElement.lang = isAr ? 'ar' : 'en';
  document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  try{ document.title = isAr ? 'الإعدادات - POS SA' : 'Settings - POS SA'; }catch(_){}

  __txt('headerBrandTitle', isAr ? 'إعدادات النظام' : 'System Settings');
  __txt('headerBrandDesc', isAr ? 'تحكم كامل في هوية المتجر، الضرائب، الطباعة والمدفوعات' : 'Full control over store identity, taxes, printing and payments');
  __btn('btnBack', isAr ? '⬅ العودة' : '⬅ Back');

  const tabLabels = document.querySelectorAll('.tab-button span:last-child');
  const tabTexts = isAr
    ? ['عام', 'الضرائب', 'الطباعة', 'المدفوعات', 'العمليات', 'الواجهة', 'متقدم']
    : ['General', 'Taxes', 'Printing', 'Payments', 'Operations', 'Interface', 'Advanced'];
  tabLabels.forEach((el, i) => { if(tabTexts[i] !== undefined) el.textContent = tabTexts[i]; });

  __txt('sTitle-general', isAr ? 'البيانات العامة' : 'General Data');
  __txt('sDesc-general', isAr ? 'معلومات المتجر للتعاملات والفواتير' : 'Store info for transactions and invoices');
  __txt('ssTitle-storeName', isAr ? 'اسم المتجر' : 'Store Name');
  __lbl('f_seller_legal', isAr ? 'اسم المبيعات (عربي)' : 'Sales Name (Arabic)');
  __lbl('f_seller_legal_en', isAr ? 'اسم المبيعات (English)' : 'Sales Name (English)');
  __txt('ssTitle-address', isAr ? 'العنوان والموقع' : 'Address & Location');
  __lbl('f_company_location', isAr ? 'موقع الشركة (العنوان)' : 'Company Location (Address)');
  __lbl('f_company_location_en', isAr ? 'العنوان (English)' : 'Address (English)');
  __txt('ssTitle-contact', isAr ? 'معلومات الاتصال' : 'Contact Information');
  __lbl('f_mobile', isAr ? 'الجوال' : 'Mobile');
  __lbl('f_company_site', isAr ? 'الموقع الإلكتروني' : 'Website');
  __lbl('f_email', isAr ? 'البريد الإلكتروني' : 'Email');
  __lblFor('f_show_email_in_invoice', isAr ? 'إظهار البريد الإلكتروني في الفواتير (الحرارية و A4)' : 'Show email in invoices (thermal & A4)');
  __txt('ssTitle-invoiceNotes', isAr ? 'ملاحظات الفاتورة' : 'Invoice Notes');
  __lbl('f_invoice_footer_note', isAr ? 'ملاحظات أسفل الفاتورة' : 'Notes at the bottom of the invoice');

  __txt('sTitle-branding', isAr ? 'الهوية البصرية' : 'Visual Identity');
  __txt('sDesc-branding', isAr ? 'شعار المتجر والصور الافتراضية' : 'Store logo and default images');
  __txt('ssTitle-logo', isAr ? 'شعار المتجر' : 'Store Logo');
  __btn('pickLogo', isAr ? 'اختيار الشعار' : 'Choose Logo');
  __btn('removeLogo', isAr ? 'إزالة الشعار' : 'Remove Logo');
  __txt('logoHelp', isAr ? 'يفضل صورة مربعة .png أو .jpg بحجم لا يقل عن 256×256 لنتيجة أوضح' : 'Prefer a square .png or .jpg of at least 256×256 for a clearer result');
  __lbl('f_logo_w', isAr ? 'عرض الشعار (px)' : 'Logo Width (px)');
  __lbl('f_logo_h', isAr ? 'طول الشعار (px)' : 'Logo Height (px)');
  __txt('ssTitle-defProdImg', isAr ? 'الصورة الافتراضية للمنتجات' : 'Default Product Image');
  __btn('pickDefProdImg', isAr ? 'اختيار الصورة الافتراضية' : 'Choose Default Image');
  __btn('removeDefProdImg', isAr ? 'إزالة الصورة الافتراضية' : 'Remove Default Image');
  __txt('defProdImgHelp', isAr ? 'الحد الأقصى للحجم 1 ميجابايت. يفضل .png' : 'Max size 1MB. .png preferred');

  __txt('sTitle-tax', isAr ? 'إعدادات الضرائب' : 'Tax Settings');
  __txt('sDesc-tax', isAr ? 'نسبة الضريبة وطريقة احتسابها والبيانات الرسمية' : 'Tax rate, calculation method and official data');
  __txt('ssTitle-vatRate', isAr ? 'نسبة الضريبة المضافة' : 'VAT Rate');
  __lbl('f_vat', isAr ? 'نسبة الضريبة VAT %' : 'Tax Rate VAT %');
  __txt('ssTitle-taxMethod', isAr ? 'طريقة احتساب الضريبة' : 'Tax Calculation Method');
  __lblFor('f_prices_inc', isAr ? 'أسعار البيع شاملة الضريبة (حسب السعودية)' : 'Selling prices include VAT (Saudi Arabia)');
  __lblFor('f_cost_inc_vat', isAr ? 'سعر التكلفة (الشراء) شامل الضريبة' : 'Cost price (purchase) includes VAT');
  __txt('ssTitle-taxData', isAr ? 'البيانات الضريبية والرسمية' : 'Tax & Official Data');
  __lbl('f_seller_vat', isAr ? 'الرقم الضريبي (ZATCA)' : 'VAT Number (ZATCA)');
  __lbl('f_commercial_register', isAr ? 'رقم السجل التجاري' : 'Commercial Register No.');
  __lbl('f_national_number', isAr ? 'الرقم الوطني' : 'National Number');
  __txt('ssTitle-zatca', isAr ? 'الربط الإلكتروني مع الهيئة' : 'Electronic Integration');
  __lblFor('f_zatca_enabled', isAr ? 'تفعيل الربط الإلكتروني مع هيئة الزكاة والضريبة والجمارك (ZATCA)' : 'Enable electronic integration with ZATCA');

  __txt('sTitle-print', isAr ? 'الطباعة' : 'Printing');
  __txt('sDesc-print', isAr ? 'نوع الطابعة وخيارات الإخراج' : 'Printer type and output options');
  __lbl('f_print_format', isAr ? 'تنسيق الفاتورة الافتراضي' : 'Default Invoice Format');
  __opt('f_print_format', 'thermal', isAr ? 'حراري' : 'Thermal');
  __opt('f_print_format', 'a4', 'A4');
  __lbl('f_print_copies', isAr ? 'عدد النسخ' : 'No. of Copies');
  __lbl('f_print_margin_right_mm', isAr ? 'هامش يمين (مم)' : 'Right Margin (mm)');
  __lbl('f_print_margin_left_mm', isAr ? 'هامش يسار (مم)' : 'Left Margin (mm)');
  __lblFor('f_silent_print', isAr ? 'طباعة صامتة' : 'Silent Print');
  __lblFor('f_show_change', isAr ? 'إظهار الباقي' : 'Show Change');
  __lblFor('f_show_barcode_a4', isAr ? 'إظهار باركود الصنف في فاتورة A4' : 'Show product barcode in A4 invoice');
  __lbl('f_unit_price_label', isAr ? 'مسمى سعر القطعة في فاتورة A4' : 'Unit Price Label in A4 Invoice');
  __lbl('f_quantity_label', isAr ? 'مسمى العدد في فاتورة A4' : 'Quantity Label in A4 Invoice');

  __txt('sTitle-barcode', isAr ? 'إعدادات باركود المنتجات' : 'Product Barcode Settings');
  __txt('sDesc-barcode', isAr ? 'تهيئة طباعة استيكر الباركود لجميع الطابعات والمقاسات' : 'Configure barcode sticker printing for all printers and sizes');
  __lbl('f_barcode_printer_device_name', isAr ? 'طابعة الباركود' : 'Barcode Printer');
  __txt('barcodePrinterHelp', isAr ? 'يمكن اختيار أي طابعة باركود أو طابعة عادية من طابعات النظام.' : 'You can choose any barcode printer or regular printer from system printers.');
  __lbl('f_barcode_paper_width_mm', isAr ? 'عرض الاستيكر (مم)' : 'Label Width (mm)');
  __lbl('f_barcode_paper_height_mm', isAr ? 'ارتفاع الاستيكر (مم)' : 'Label Height (mm)');
  __txt('ssTitle-barcodeElements', isAr ? 'العناصر الظاهرة في الاستيكر' : 'Elements shown on label');
  __lblFor('f_barcode_show_shop_name', isAr ? 'إظهار اسم المتجر' : 'Show store name');
  __lblFor('f_barcode_show_product_name', isAr ? 'إظهار اسم المنتج' : 'Show product name');
  __lblFor('f_barcode_show_price', isAr ? 'إظهار السعر' : 'Show price');
  __lblFor('f_barcode_show_barcode_text', isAr ? 'إظهار رقم الباركود كنص أسفل الرسمة' : 'Show barcode number as text below');
  __txt('ssTitle-barcodeFont', isAr ? 'حجم الخط في الاستيكر' : 'Font Size on Label');
  __lbl('f_barcode_font_size_shop', isAr ? 'حجم خط اسم المتجر (px)' : 'Store Name Font Size (px)');
  __lbl('f_barcode_font_size_product', isAr ? 'حجم خط اسم المنتج (px)' : 'Product Name Font Size (px)');
  __lbl('f_barcode_font_size_price', isAr ? 'حجم خط السعر (px)' : 'Price Font Size (px)');
  __lbl('f_barcode_font_size_barcode_text', isAr ? 'حجم خط رقم الباركود (px)' : 'Barcode Text Font Size (px)');
  __txt('ssTitle-barcodeSettings', isAr ? 'إعدادات الباركود والإزاحة' : 'Barcode & Offset Settings');
  __lbl('f_barcode_height_px', isAr ? 'ارتفاع الباركود (px)' : 'Barcode Height (px)');
  __txt('barcodeHeightDesc', isAr ? 'ارتفاع رسم الباركود بالبكسل' : 'Barcode drawing height in pixels');
  __txt('ssTitle-barcodeOffset', isAr ? 'إزاحة الاستيكر (مم)' : 'Label Offset (mm)');
  __lbl('f_barcode_label_offset_right_mm', isAr ? 'إزاحة من اليمين (مم)' : 'Offset from Right (mm)');
  __lbl('f_barcode_label_offset_left_mm', isAr ? 'إزاحة من اليسار (مم)' : 'Offset from Left (mm)');
  __lbl('f_barcode_label_offset_top_mm', isAr ? 'إزاحة من الأعلى (مم)' : 'Offset from Top (mm)');
  __lbl('f_barcode_label_offset_bottom_mm', isAr ? 'إزاحة من الأسفل (مم)' : 'Offset from Bottom (mm)');
  __txt('barcodeOffsetTip', isAr ? '💡 استخدم هذه الإعدادات لضبط موضع الاستيكر على الورقة. القيم الموجبة تحرك الاستيكر في الاتجاه المحدد.' : '💡 Use these settings to adjust the label position on the paper. Positive values move the label in the specified direction.');

  __txt('sTitle-whatsapp', isAr ? 'واتساب' : 'WhatsApp');
  __txt('sDesc-whatsapp', isAr ? 'إرسال الفواتير تلقائياً عبر واتساب' : 'Automatically send invoices via WhatsApp');
  __lblFor('f_whatsapp_auto', isAr ? 'إرسال الفاتورة عبر واتساب تلقائياً بعد الطباعة' : 'Automatically send invoice via WhatsApp after printing');
  __lblFor('f_whatsapp_auto_connect', isAr ? 'الاتصال بواتساب تلقائياً عند فتح البرنامج (إذا كانت هناك جلسة محفوظة)' : 'Auto-connect to WhatsApp on startup (if a session is saved)');

  __txt('sTitle-printRestrict', isAr ? 'قيود الطباعة' : 'Print Restrictions');
  __txt('sDesc-printRestrict', isAr ? 'شروط يجب تحقيقها قبل الطباعة' : 'Conditions that must be met before printing');
  __lblFor('f_require_payment_before_print', isAr ? 'طلب اختيار طريقة الدفع قبل الطباعة' : 'Require payment method selection before printing');
  __lblFor('f_require_customer_before_print', isAr ? 'إلزام اختيار العميل قبل طباعة الفاتورة' : 'Require customer selection before printing');
  __lblFor('f_require_phone_min_10', isAr ? 'منع إدخال رقم جوال أقل من 10 أرقام' : 'Require phone number of at least 10 digits');

  __txt('sTitle-payment', isAr ? 'طرق الدفع' : 'Payment Methods');
  __txt('sDesc-payment', isAr ? 'تفعيل طرق الدفع والطريقة الافتراضية' : 'Enable payment methods and set the default');
  __txt('pmLabel', isAr ? 'طرق الدفع المفعّلة' : 'Enabled Payment Methods');
  __lblFor('pm_cash', isAr ? 'كاش' : 'Cash');
  __lblFor('pm_card', isAr ? 'شبكة (مدى)' : 'Card (Mada)');
  __lblFor('pm_credit', isAr ? 'آجل' : 'Credit');
  __lblFor('pm_mixed', isAr ? 'مختلط' : 'Mixed');
  __lblFor('pm_tamara', isAr ? 'تمارا' : 'Tamara');
  __lblFor('pm_tabby', isAr ? 'تابي' : 'Tabby');
  __lblFor('pm_bank_transfer', isAr ? 'تحويل بنكي' : 'Bank Transfer');
  __lbl('f_default_payment', isAr ? 'طريقة الدفع الافتراضية' : 'Default Payment Method');
  __opt('f_default_payment', '', isAr ? 'بدون افتراضي' : 'No default');
  __opt('f_default_payment', 'cash', isAr ? 'كاش' : 'Cash');
  __opt('f_default_payment', 'card', isAr ? 'شبكة (مدى)' : 'Card (Mada)');
  __opt('f_default_payment', 'credit', isAr ? 'آجل' : 'Credit');
  __opt('f_default_payment', 'mixed', isAr ? 'مختلط' : 'Mixed');
  __opt('f_default_payment', 'tamara', isAr ? 'تمارا' : 'Tamara');
  __opt('f_default_payment', 'tabby', isAr ? 'تابي' : 'Tabby');
  __opt('f_default_payment', 'bank_transfer', isAr ? 'تحويل بنكي' : 'Bank Transfer');

  __txt('sTitle-currency', isAr ? 'إعدادات العملة' : 'Currency Settings');
  __txt('sDesc-currency', isAr ? 'رمز العملة وموقعه في المبالغ' : 'Currency symbol and its position in amounts');
  __lbl('f_currency_code', isAr ? 'رمز العملة' : 'Currency Code');
  __lbl('f_currency_symbol', isAr ? 'رمز العملة (نصي)' : 'Currency Symbol (text)');
  __lbl('f_currency_pos', isAr ? 'موضع الرمز' : 'Symbol Position');
  __opt('f_currency_pos', 'after', isAr ? 'الرمز بعد المبلغ (مثال: 100 ﷼)' : 'Symbol after amount (e.g. 100 SAR)');
  __opt('f_currency_pos', 'before', isAr ? 'الرمز قبل المبلغ (مثال: ﷼ 100)' : 'Symbol before amount (e.g. SAR 100)');

  __txt('sTitle-ops', isAr ? 'عمليات النظام' : 'System Operations');
  __txt('sDesc-ops', isAr ? 'سلوك الأسعار والمخزون' : 'Pricing and inventory behavior');
  __lblFor('f_op_price_manual', isAr ? 'السماح بتعديل سعر العملية يدوياً' : 'Allow manual price editing for operations');
  __lblFor('f_allow_zero_stock', isAr ? 'السماح ببيع الصنف عندما المخزون = 0' : 'Allow selling items when stock = 0');
  __lblFor('f_cart_separate_duplicate_lines', isAr ? 'إضافة نفس الصنف كسطر جديد في السلة' : 'Add same item as new line in cart');
  __lblFor('f_weight_mode_enabled', isAr ? 'وضع الوزن من المبلغ المدفوع (يُحسب الوزن = المبلغ ÷ سعر الوحدة)' : 'Weight mode from paid amount (weight = amount ÷ unit price)');
  __lblFor('f_electronic_scale_enabled', isAr ? '⚖️ تفعيل الميزان الإلكتروني' : '⚖️ Enable Electronic Scale');
  __lblFor('f_electronic_scale_type', isAr ? 'نوع الميزان الإلكتروني' : 'Electronic Scale Type');
  __opt('f_electronic_scale_type', 'weight', isAr ? 'ميزان الوزن (Weight Scale)' : 'Weight Scale');
  __opt('f_electronic_scale_type', 'price', isAr ? 'ميزان السعر (Price Scale)' : 'Price Scale');
  __txt('scaleTypeDesc', isAr ? 'اختر نوع الميزان: ميزان الوزن يُخرج الوزن، ميزان السعر يُخرج السعر المحسوب.' : 'Choose scale type: weight scale outputs weight, price scale outputs calculated price.');
  __lblFor('f_low_stock_threshold', isAr ? 'حد تنبيه انخفاض المخزون' : 'Low Stock Alert Threshold');
  __txt('lowStockDesc', isAr ? 'سيظهر تحذير عند طباعة الفاتورة إذا كان مخزون أي صنف أقل من أو يساوي هذا الرقم.' : 'A warning will appear when printing if any item stock is at or below this number.');
  __lblFor('f_low_stock_email_enabled', isAr ? 'تفعيل إرسال تنبيه المخزون بالبريد' : 'Enable low stock email alerts');
  __lblFor('f_show_low_stock_alerts', isAr ? 'إظهار تنبيهات المخزون في شاشة البيع' : 'Show low stock alerts on sales screen');
  __lbl('f_closing_hour', isAr ? 'ساعة الإقفال اليومية' : 'Daily Closing Hour');
  __txt('closingHourDesc', isAr ? 'ستُستخدم لتحديد بداية ونهاية اليوم التقاريري.' : 'Used to define the start and end of the reporting day.');

  __txt('sTitle-ui', isAr ? 'إعدادات الواجهة' : 'Interface Settings');
  __txt('sDesc-ui', isAr ? 'إظهار أو إخفاء عناصر الواجهة' : 'Show or hide interface elements');
  __lbl('f_app_theme', isAr ? 'ثيم التطبيق' : 'App Theme');
  __opt('f_app_theme', 'light', isAr ? 'فاتح' : 'Light');
  __opt('f_app_theme', 'gray', isAr ? 'رصاصي' : 'Gray');
  __opt('f_app_theme', 'dark', isAr ? 'داكن' : 'Dark');
  __opt('f_app_theme', 'auto', isAr ? 'تلقائي (حسب النظام)' : 'Auto (system)');
  __lblFor('f_hide_product_images', isAr ? 'إخفاء صور المنتجات في شاشة فاتورة جديدة' : 'Hide product images on new invoice screen');
  __lblFor('f_show_quotation_button', isAr ? 'إظهار زر عرض السعر في شاشة المبيعات' : 'Show quotation button on sales screen');
  __lblFor('f_show_selling_units', isAr ? 'إظهار وحدات البيع في شاشة المنتجات (كرتون، علبة، إلخ)' : 'Show selling units on products screen (carton, box, etc.)');
  __lblFor('f_show_employee_selector', isAr ? 'إظهار قائمة اختيار الموظف لكل منتج في الفاتورة' : 'Show employee selector for each product in invoice');

  __txt('sTitle-advanced', isAr ? 'التقارير والنسخ الاحتياطي' : 'Reports & Backup');
  __txt('sDesc-advanced', isAr ? 'إعداد التقارير اليومية والنسخ الاحتياطية' : 'Configure daily reports and backups');
  __btn('btnDailyEmail', isAr ? '📧 إعداد التقرير اليومي' : '📧 Daily Report Setup');
  __btn('btn_backup_local', isAr ? '💾 حفظ نسخة احتياطية' : '💾 Save Backup');

  __txt('sTitle-recovery', isAr ? 'استعادة النظام' : 'System Recovery');
  __txt('sDesc-recovery', isAr ? 'عمليات خطرة: لا يمكن التراجع عنها' : 'Dangerous operations: cannot be undone');
  __btn('btnResetSales', isAr ? 'حذف البيانات وإعادة الترقيم' : 'Delete Data & Reset Numbering');

  __btn('checkUpdateBtn', isAr ? '🔄 تحديث البرنامج' : '🔄 Update App');
  __btn('saveBtn', isAr ? '💾 حفظ جميع الإعدادات' : '💾 Save All Settings');

  const okEl = document.getElementById('ok');
  if(okEl && okEl.style.display === 'none') okEl.textContent = isAr ? 'تم الحفظ بنجاح' : 'Saved successfully';

  __txt('emModalTitle', isAr ? 'إعداد إرسال التقرير اليومي' : 'Daily Report Email Setup');
  __txt('emModalDesc', isAr ? 'تكوين البريد الإلكتروني للحصول على تقارير مبيعات يومية تلقائية' : 'Configure email to receive automatic daily sales reports');
  __lblFor('em_enabled', isAr ? 'تفعيل إرسال التقرير اليومي تلقائياً' : 'Enable automatic daily report sending');
  __lbl('em_time', isAr ? '⏰ وقت الإرسال اليومي' : '⏰ Daily Send Time');
  __btn('em_send_daily', isAr ? '📧 إرسال التقرير الآن' : '📧 Send Report Now');
  __txt('emDailyTip', isAr ? '💡 سيتم إرسال تقرير المبيعات اليومي في التوقيت المحدد كل يوم' : '💡 The daily sales report will be sent at the specified time every day');
  __lblFor('bk_enabled', isAr ? 'تفعيل إرسال نسخة قاعدة البيانات يومياً' : 'Enable daily database backup sending');
  __lbl('bk_time', isAr ? '⏰ وقت إرسال النسخة اليومية' : '⏰ Daily Backup Send Time');
  __btn('em_send_backup', isAr ? '📦 إرسال نسخة الآن' : '📦 Send Backup Now');
  __txt('emBackupTip', isAr ? '💡 سيتم إرسال ملف النسخة الاحتياطية المضغوط (.zip) يوميًا في التوقيت المحدد.' : '💡 The compressed backup file (.zip) will be sent daily at the specified time.');
  __lbl('em_user', isAr ? '📧 البريد الإلكتروني المرسل' : '📧 Sender Email');
  __lbl('em_pass', isAr ? '🔑 كلمة مرور التطبيق' : '🔑 App Password');
  try{
    const advSum = document.getElementById('emAdvancedSummary');
    if(advSum) advSum.textContent = isAr ? '⚙️ إعدادات الخادم المتقدمة (اختيارية)' : '⚙️ Advanced Server Settings (optional)';
  }catch(_){}
  __lbl('em_host', isAr ? '🌐 خادم البريد' : '🌐 Mail Server');
  __lbl('em_port', isAr ? '🔌 رقم المنفذ' : '🔌 Port');
  __lblFor('em_secure', isAr ? '🔒 استخدام اتصال آمن (TLS/SSL)' : '🔒 Use secure connection (TLS/SSL)');
  __txt('emNotesTitle', isAr ? '📋 ملاحظات مهمة:' : '📋 Important Notes:');
  __txt('emNote1', isAr ? 'للاستخدام مع Gmail، ينصح باستخدام المنفذ 587 بدون اتصال آمن' : 'For Gmail, use port 587 without a secure connection');
  __txt('emNote2', isAr ? 'يجب إنشاء كلمة مرور تطبيق من إعدادات حساب Google' : 'You must create an App Password from your Google account settings');
  __txt('emNote3', isAr ? 'التقرير سيحتوي على ملخص المبيعات اليومية والمنتجات الأكثر مبيعاً' : 'The report will contain a daily sales summary and best-selling products');
  __btn('em_cancel', isAr ? '❌ إلغاء' : '❌ Cancel');
  __btn('em_save', isAr ? '💾 حفظ الإعدادات' : '💾 Save Settings');

  __txt('bkModalTitle', isAr ? 'إرسال نسخة قاعدة البيانات' : 'Send Database Backup');
  __txt('bkModalDesc', isAr ? 'سيتم إنشاء نسخة SQL مضغوطة (.gz) وإرسالها بالبريد' : 'A compressed SQL backup (.gz) will be created and sent by email');
  __lbl('bk_to', isAr ? 'البريد المستلم' : 'Recipient Email');
  __txt('bkSmtpNote', isAr ? 'يجب ضبط إعدادات SMTP في نافذة "إعداد التقرير اليومي" أولاً (البريد المرسل وكلمة المرور والخادم).' : 'SMTP settings must be configured first in the "Daily Report Setup" window (sender email, password, and server).');
  __btn('bk_cancel', isAr ? 'إلغاء' : 'Cancel');

  __txt('lbModalTitle', isAr ? 'إعداد الحفظ المحلي للنسخة الاحتياطية' : 'Local Backup Setup');
  __txt('lbModalDesc', isAr ? 'حدد مجلد الحفظ والوقت اليومي لإنشاء نسخة قاعدة البيانات تلقائياً' : 'Set the save folder and daily time for automatic database backup');
  __lblFor('lb_enabled', isAr ? 'تفعيل الحفظ اليومي تلقائياً' : 'Enable automatic daily save');
  __lbl('lb_time', isAr ? '⏰ وقت الحفظ اليومي' : '⏰ Daily Save Time');
  __txt('lbDailyTip', isAr ? 'يتم إنشاء ملف .dump باسم يحتوي على التاريخ والوقت داخل المجلد المحدد في التوقيت اليومي.' : 'A .dump file with date/time name is created in the selected folder at the specified daily time.');
  __lbl('lb_folder', isAr ? '📁 مجلد حفظ قاعدة البيانات' : '📁 Database Save Folder');
  __btn('lb_pick_dir', isAr ? 'اختيار المجلد' : 'Choose Folder');
  __btn('lb_cancel', isAr ? 'إلغاء' : 'Cancel');
  __btn('lb_save', isAr ? 'حفظ الإعدادات' : 'Save Settings');
  __btn('lb_backup_now', isAr ? '💾 حفظ الآن' : '💾 Save Now');

  __txt('confirmTitle', isAr ? 'تأكيد عملية الحذف' : 'Confirm Delete Operation');
  __txt('confirmDesc', isAr ? 'هل أنت متأكد من حذف البيانات المحددة؟' : 'Are you sure you want to delete the selected data?');
  __txt('confirmStrong', isAr ? 'لا يمكن التراجع عن هذه العملية!' : 'This operation cannot be undone!');
  __btn('cancelConfirmBtn', isAr ? 'إلغاء' : 'Cancel');
  __btn('proceedDeleteBtn', isAr ? 'نعم، احذف' : 'Yes, Delete');

  __txt('successToastTitle', isAr ? 'تمت العملية بنجاح' : 'Operation Completed');

  __txt('resetModalTitle', isAr ? '🗑️ حذف البيانات وإعادة الترقيم' : '🗑️ Delete Data & Reset Numbering');
  __txt('resetModalWarning', isAr ? '⚠️ تحذير: لا يمكن التراجع عن هذه العملية. اختر ما تريد حذفه:' : '⚠️ Warning: This operation cannot be undone. Choose what to delete:');
  __txt('rmSalesTitle', isAr ? 'حذف فواتير البيع' : 'Delete Sales Invoices');
  __txt('rmSalesDesc', isAr ? 'حذف جميع فواتير المبيعات وإعادة الترقيم من 1' : 'Delete all sales invoices and reset numbering from 1');
  __txt('rmPurchInvTitle', isAr ? 'حذف فواتير الشراء' : 'Delete Purchase Invoices');
  __txt('rmPurchInvDesc', isAr ? 'حذف جميع فواتير الشراء وتفاصيلها' : 'Delete all purchase invoices and their details');
  __txt('rmPurchTitle', isAr ? 'حذف المصروفات البسيطة' : 'Delete Simple Expenses');
  __txt('rmPurchDesc', isAr ? 'حذف جميع عمليات الشراء البسيطة' : 'Delete all simple purchase operations');
  __txt('rmSupBalTitle', isAr ? 'تصفير أرصدة الموردين' : 'Reset Supplier Balances');
  __txt('rmSupBalDesc', isAr ? 'إعادة رصيد جميع الموردين إلى صفر' : 'Reset all supplier balances to zero');
  __txt('rmProdTitle', isAr ? 'حذف كل المنتجات' : 'Delete All Products');
  __txt('rmProdDesc', isAr ? 'حذف جميع المنتجات والأنواع الرئيسية والعمليات' : 'Delete all products, main types and operations');
  __txt('rmCustTitle', isAr ? 'حذف كل العملاء' : 'Delete All Customers');
  __txt('rmCustDesc', isAr ? 'حذف جميع بيانات العملاء من النظام' : 'Delete all customer data from the system');
  __txt('rmQuotTitle', isAr ? 'حذف عروض الأسعار' : 'Delete Quotations');
  __txt('rmQuotDesc', isAr ? 'حذف جميع عروض الأسعار المحفوظة' : 'Delete all saved quotations');
  __txt('rmShiftsTitle', isAr ? 'حذف الشفتات' : 'Delete Shifts');
  __txt('rmShiftsDesc', isAr ? 'حذف جميع الشفتات وسجلات الفتح والإغلاق' : 'Delete all shifts and open/close records');
  __btn('cancelResetBtn', isAr ? 'إلغاء' : 'Cancel');
  __btn('confirmResetBtn', isAr ? 'تنفيذ الحذف' : 'Execute Delete');

  __txt('updateModalTitle', isAr ? 'تحديث البرنامج' : 'App Update');
  __txt('updateModalDesc', isAr ? 'البحث عن آخر إصدار متاح' : 'Check for the latest available version');
  __txt('updateSearchText', isAr ? 'جاري البحث عن التحديثات...' : 'Checking for updates...');
  __btn('updateCancelBtn', isAr ? 'إغلاق' : 'Close');
  __btn('updateDownloadBtn', isAr ? 'تحميل التحديث' : 'Download Update');
  __btn('updateInstallBtn', isAr ? 'تثبيت الآن' : 'Install Now');

  try{ updatePmDropdownText(); }catch(_){}
}

// دالة مقارنة الإصدارات (semantic versioning)
function compareVersions(v1, v2) {
  const v1Parts = String(v1).split('.').map(Number);
  const v2Parts = String(v2).split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;
    
    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }
  
  return 0;
}

// Payment methods dropdown controls
const pmDropdownTrigger = document.getElementById('pmDropdownTrigger');
const pmDropdownMenu = document.getElementById('pmDropdownMenu');
const pmDropdownText = document.getElementById('pmDropdownText');

// const fCompanyName = document.getElementById('f_company_name'); // removed from UI
const fCompanySite = document.getElementById('f_company_site');
const fMobile = document.getElementById('f_mobile');
const fEmail = document.getElementById('f_email');
const fShowEmailInInvoice = document.getElementById('f_show_email_in_invoice');
const fCommercialRegister = document.getElementById('f_commercial_register');
const fNationalNumber = document.getElementById('f_national_number');
const fVat = document.getElementById('f_vat');
const fPricesInc = document.getElementById('f_prices_inc');
const fCostIncVat = document.getElementById('f_cost_inc_vat');
const fOpPriceManual = document.getElementById('f_op_price_manual');
const fUpdateProductPriceOnEdit = document.getElementById('f_update_product_price_on_edit');
const fAllowZeroStock = document.getElementById('f_allow_zero_stock');


const fCompanyLocation = document.getElementById('f_company_location');
const fCompanyLocationEn = document.getElementById('f_company_location_en');
const fCurrencyCode = document.getElementById('f_currency_code');
const fCurrencySymbol = document.getElementById('f_currency_symbol');
const fCurrencyPos = document.getElementById('f_currency_pos');
const fPrintFormat = document.getElementById('f_print_format');
const fPrintCopies = document.getElementById('f_print_copies');
const fShowChange = document.getElementById('f_show_change');
const fSilentPrint = document.getElementById('f_silent_print');
const fDefaultPayment = document.getElementById('f_default_payment');
const fSellerLegal = document.getElementById('f_seller_legal');
const fSellerLegalEn = document.getElementById('f_seller_legal_en');
const fSellerVat = document.getElementById('f_seller_vat');
const fPrintMarginRight = document.getElementById('f_print_margin_right_mm');
const fPrintMarginLeft = document.getElementById('f_print_margin_left_mm');
const fShowBarcodeA4 = document.getElementById('f_show_barcode_a4');
const fUnitPriceLabel = document.getElementById('f_unit_price_label');
const fQuantityLabel = document.getElementById('f_quantity_label');
const fHideProductImages = document.getElementById('f_hide_product_images');
const fShowQuotationButton = document.getElementById('f_show_quotation_button');
const fShowSellingUnits = document.getElementById('f_show_selling_units');
const fShowEmployeeSelector = document.getElementById('f_show_employee_selector');
const fCartSeparateDup = document.getElementById('f_cart_separate_duplicate_lines');
const fClosingHour = document.getElementById('f_closing_hour');
// WhatsApp auto-send checkbox
const fWhatsAuto = document.getElementById('f_whatsapp_auto');
const fWhatsAutoConnect = document.getElementById('f_whatsapp_auto_connect');
const fZatcaEnabled = document.getElementById('f_zatca_enabled');
// Weight mode toggle
const fWeightModeEnabled = document.getElementById('f_weight_mode_enabled');
// Electronic scale settings
const fElectronicScaleEnabled = document.getElementById('f_electronic_scale_enabled');
const fElectronicScaleType = document.getElementById('f_electronic_scale_type');
// Low stock email control
const fLowStockEmailEnabled = document.getElementById('f_low_stock_email_enabled');
// Show/hide low-stock alerts on sales screen
const fShowLowStockAlerts = document.getElementById('f_show_low_stock_alerts');
// Require payment method before print
const fRequirePaymentBeforePrint = document.getElementById('f_require_payment_before_print');
const fRequireCustomerBeforePrint = document.getElementById('f_require_customer_before_print');
const fRequirePhoneMin10 = document.getElementById('f_require_phone_min_10');
const fAppointmentReminderMinutes = document.getElementById('f_appointment_reminder_minutes');
const fAppTheme = document.getElementById('f_app_theme');
// Barcode label settings
const fBarcodePrinterDeviceName = document.getElementById('f_barcode_printer_device_name');
const fBarcodePaperWidthMm = document.getElementById('f_barcode_paper_width_mm');
const fBarcodePaperHeightMm = document.getElementById('f_barcode_paper_height_mm');
const fBarcodeShowShopName = document.getElementById('f_barcode_show_shop_name');
const fBarcodeShowProductName = document.getElementById('f_barcode_show_product_name');
const fBarcodeShowPrice = document.getElementById('f_barcode_show_price');
const fBarcodeShowBarcodeText = document.getElementById('f_barcode_show_barcode_text');
const fBarcodeFontSizeShop = document.getElementById('f_barcode_font_size_shop');
const fBarcodeFontSizeProduct = document.getElementById('f_barcode_font_size_product');
const fBarcodeFontSizePrice = document.getElementById('f_barcode_font_size_price');
const fBarcodeFontSizeBarcodeText = document.getElementById('f_barcode_font_size_barcode_text');
const fBarcodeHeightPx = document.getElementById('f_barcode_height_px');
const fBarcodeLabelOffsetRightMm = document.getElementById('f_barcode_label_offset_right_mm');
const fBarcodeLabelOffsetLeftMm = document.getElementById('f_barcode_label_offset_left_mm');
const fBarcodeLabelOffsetTopMm = document.getElementById('f_barcode_label_offset_top_mm');
const fBarcodeLabelOffsetBottomMm = document.getElementById('f_barcode_label_offset_bottom_mm');

const pickLogo = document.getElementById('pickLogo');
const removeLogo = document.getElementById('removeLogo');
const logoPreview = document.getElementById('logoPreview');
const fLogoW = document.getElementById('f_logo_w');
const fLogoH = document.getElementById('f_logo_h');
// Default product image controls
const pickDefProdImg = document.getElementById('pickDefProdImg');
const removeDefProdImg = document.getElementById('removeDefProdImg');
const defProdImgPreview = document.getElementById('defProdImgPreview');

const saveBtn = document.getElementById('saveBtn');
const reloadBtn = document.getElementById('reloadBtn'); // removed from UI
// Daily email modal controls
const btnDailyEmail = document.getElementById('btnDailyEmail');
const dailyEmailDlg = document.getElementById('dailyEmailDlg');
const emEnabled = document.getElementById('em_enabled');
const emTime = document.getElementById('em_time');
const emHost = document.getElementById('em_host');
const emPort = document.getElementById('em_port');
const emSecure = document.getElementById('em_secure');
const emUser = document.getElementById('em_user');
const emPass = document.getElementById('em_pass');
const emCancel = document.getElementById('em_cancel');
const emSave = document.getElementById('em_save');

// Backup DB modal controls
const btnBackupEmail = document.getElementById('btnBackupEmail');
const backupEmailDlg = document.getElementById('backupEmailDlg');
const bkTo = document.getElementById('bk_to');
const bkCancel = document.getElementById('bk_cancel');
const bkSend = document.getElementById('bk_send');
// DB backup schedule controls
const bkEnabled = document.getElementById('bk_enabled');
const bkTime = document.getElementById('bk_time');
// Local backup modal controls
const localBackupDlg = document.getElementById('localBackupDlg');
const lbEnabled = document.getElementById('lb_enabled');
const lbTime = document.getElementById('lb_time');
const lbFolder = document.getElementById('lb_folder');
const lbPickDir = document.getElementById('lb_pick_dir');
const lbCancel = document.getElementById('lb_cancel');
const lbSave = document.getElementById('lb_save');
const lbBackupNow = document.getElementById('lb_backup_now');

// Permissions
let __perms = null; // null until loaded

function canSet(k){
  // While permissions are loading, allow showing controls by default
  return (__perms ? __perms.has(k) : true);
}

function applyPerms(){
  try{
    const sb = document.getElementById('saveBtn');
    const rb = document.getElementById('reloadBtn');
    const rs = document.getElementById('btnResetSales');
    if(sb) sb.style.display = canSet('settings.update') ? '' : 'none';
    if(rb) rb.style.display = canSet('settings.reload') ? '' : 'none';
    if(rs) rs.style.display = canSet('settings.reset_sales') ? '' : 'none';
  }catch(_){ }
}

// Load permissions then apply
(async()=>{
  try{
    const u=JSON.parse(localStorage.getItem('pos_user')||'null');
    if(u&&u.id){
      const r=await window.api.perms_get_for_user(u.id);
      if(r&&r.ok){ __perms=new Set(r.keys||[]); }
    }
  }catch(_){ __perms=null; }
  finally{ applyPerms(); }
})();

// Apply initial state (visible by default)
applyPerms();
const fInvoiceFooterNote = document.getElementById('f_invoice_footer_note');

// Recovery controls (hidden by query)
const recoverySection = document.getElementById('recoverySection');
const btnResetSales = document.getElementById('btnResetSales');

function isSuperAdminUser(){
  try{ const u=JSON.parse(localStorage.getItem('pos_user')||'null'); return u && u.username === 'superAdmin'; }catch(_){ return false; }
}

function applySuperAdminView(){
  if(!isSuperAdminUser()) return;
  if(recoverySection){ recoverySection.style.display = 'block'; }
  const cards = Array.from(document.querySelectorAll('.wrap .card'));
  const actionsCard = cards.find(card => card.querySelector('#checkUpdateBtn') || card.querySelector('#saveBtn'));
  cards.forEach(card => {
    if(recoverySection && card.contains(recoverySection)){
      const sections = Array.from(card.querySelectorAll('.section'));
      sections.forEach(section => { if(section !== recoverySection) section.style.display = 'none'; });
      return;
    }
    if(actionsCard && card === actionsCard){
      card.style.display = '';
      return;
    }
    card.style.display = 'none';
  });
}

// Toggle visibility via URL query: ?unlock=restore2025
(function(){
  const params = new URLSearchParams(location.search);
  if(params.get('unlock') === 'restore2025'){
    if(recoverySection){ recoverySection.style.display = 'block'; }
  }
})();

let logoPath = null; // legacy relative path stored in DB (fallback)
let logoBlobBase64 = null; // in-memory base64 selected by user (<=1MB)
let logoMime = null;

// Payment methods dropdown functionality
function updatePmDropdownText() {
  const checkedPm = Array.from(document.querySelectorAll('.pm:checked'));
  if (checkedPm.length === 0) {
    pmDropdownText.textContent = __t('اختر طرق الدفع', 'Select payment methods');
  } else if (checkedPm.length === 1) {
    const labels = __isAr
      ? { 'cash': 'كاش', 'card': 'شبكة (مدى)', 'credit': 'آجل', 'mixed': 'مختلط', 'tamara': 'تمارا', 'tabby': 'تابي', 'bank_transfer': 'تحويل بنكي' }
      : { 'cash': 'Cash', 'card': 'Card (Mada)', 'credit': 'Credit', 'mixed': 'Mixed', 'tamara': 'Tamara', 'tabby': 'Tabby', 'bank_transfer': 'Bank Transfer' };
    pmDropdownText.textContent = labels[checkedPm[0].value] || checkedPm[0].value;
  } else {
    pmDropdownText.textContent = __isAr ? `${checkedPm.length} طرق محددة` : `${checkedPm.length} methods selected`;
  }
}
let logoRemoved = false; // explicit user intent to remove logo
// Default product image (in-memory) state
let defProdImgBase64 = null;
let defProdImgMime = null;
let defProdImgRemoved = false;

function setError(msg){ errorDiv.textContent = msg || ''; }
function setOk(show){
  okDiv.style.display = show ? 'block' : 'none';
  if(show){ setTimeout(()=>{ okDiv.style.display='none'; }, 4000); }
}

async function loadSettings(){
  setError(''); setOk(false);
  const r = await window.api.settings_get();
  if(!r.ok){ setError(r.error || __t('تعذر تحميل الإعدادات', 'Failed to load settings')); return; }
  const s = r.item || {};
  // fCompanyName removed: show legal name at the top instead
  fCompanySite.value = s.company_site || '';
  fCompanyLocation.value = s.company_location || '';
  if(fCompanyLocationEn) fCompanyLocationEn.value = s.company_location_en || '';
  fMobile.value = s.mobile || '';
  fEmail.value = s.email || '';
  if(fShowEmailInInvoice) fShowEmailInInvoice.checked = (typeof s.show_email_in_invoice === 'undefined') ? true : !!s.show_email_in_invoice;
  fVat.value = (s.vat_percent ?? 15);
  fPricesInc.checked = !!s.prices_include_vat;
  if(fCostIncVat) fCostIncVat.checked = Boolean(Number(s.cost_includes_vat ?? 1));
  // New fields
  if(fCommercialRegister) fCommercialRegister.value = s.commercial_register || '';
  if(fNationalNumber) fNationalNumber.value = s.national_number || '';

  fCurrencyCode.value = s.currency_code || 'SAR';
  fCurrencySymbol.value = s.currency_symbol || '﷼';
  fCurrencyPos.value = s.currency_symbol_position || 'after';
  if(fPrintFormat) fPrintFormat.value = (s.default_print_format === 'a4' ? 'a4' : 'thermal');
  fPrintCopies.value = String(s.print_copies != null ? Number(s.print_copies) : (s.print_two_copies ? 2 : 1));
  fShowChange.checked = s.print_show_change !== 0;
  if(fShowBarcodeA4) fShowBarcodeA4.checked = (typeof s.show_barcode_in_a4 === 'undefined') ? false : !!s.show_barcode_in_a4;
  if(fUnitPriceLabel) fUnitPriceLabel.value = s.unit_price_label || 'سعر القطعة';
  if(fQuantityLabel) fQuantityLabel.value = s.quantity_label || 'عدد';
  fSilentPrint.checked = !!s.silent_print;
  fDefaultPayment.value = s.default_payment_method || '';
  fSellerLegal.value = s.seller_legal_name || '';
  if(fSellerLegalEn) fSellerLegalEn.value = s.seller_legal_name_en || '';
  fSellerVat.value = s.seller_vat_number || '';
  if(fPrintMarginRight) fPrintMarginRight.value = (s.print_margin_right_mm ?? '');
  if(fPrintMarginLeft) fPrintMarginLeft.value = (s.print_margin_left_mm ?? '');
  fOpPriceManual.checked = !!s.op_price_manual;
  if (fUpdateProductPriceOnEdit) fUpdateProductPriceOnEdit.checked = !!s.update_product_price_on_edit;
  fAllowZeroStock.checked = !!s.allow_sell_zero_stock;
  if (fHideProductImages) fHideProductImages.checked = !!s.hide_product_images;
  if (fShowQuotationButton) fShowQuotationButton.checked = (typeof s.show_quotation_button === 'undefined') ? true : !!s.show_quotation_button;
  if (fShowSellingUnits) fShowSellingUnits.checked = (typeof s.show_selling_units === 'undefined') ? true : !!s.show_selling_units;
  if (fShowEmployeeSelector) fShowEmployeeSelector.checked = (typeof s.show_employee_selector === 'undefined') ? true : !!s.show_employee_selector;
  if (fClosingHour) fClosingHour.value = s.closing_hour || '';
  // Low stock threshold
  try{
    const fLow = document.getElementById('f_low_stock_threshold');
    if(fLow){ fLow.value = String(Number(s.low_stock_threshold ?? 5)); }
  }catch(_){ }
  // Low stock email control
  try{
    if(fLowStockEmailEnabled) fLowStockEmailEnabled.checked = !!s.low_stock_email_enabled;
  }catch(_){ }
  // Show/hide low-stock alerts on sales screen (default true)
  try{
    if(fShowLowStockAlerts) fShowLowStockAlerts.checked = (typeof s.show_low_stock_alerts === 'undefined') ? true : !!s.show_low_stock_alerts;
  }catch(_){ }
  // WhatsApp auto-send
  if (fWhatsAuto) fWhatsAuto.checked = !!s.whatsapp_on_print;
  if (fWhatsAutoConnect) fWhatsAutoConnect.checked = !!s.whatsapp_auto_connect;
  if (fZatcaEnabled) fZatcaEnabled.checked = !!s.zatca_enabled;
  if (fCartSeparateDup) fCartSeparateDup.checked = !!s.cart_separate_duplicate_lines;
  if (fWeightModeEnabled) fWeightModeEnabled.checked = !!s.weight_mode_enabled;
  if (fElectronicScaleEnabled) fElectronicScaleEnabled.checked = !!s.electronic_scale_enabled;
  if (fElectronicScaleType) fElectronicScaleType.value = s.electronic_scale_type || 'weight';
  if (fRequirePaymentBeforePrint) fRequirePaymentBeforePrint.checked = !!s.require_payment_before_print;
  if (fRequireCustomerBeforePrint) fRequireCustomerBeforePrint.checked = !!s.require_customer_before_print;
  if (fRequirePhoneMin10) fRequirePhoneMin10.checked = !!s.require_phone_min_10;
  if (fAppointmentReminderMinutes) fAppointmentReminderMinutes.value = String(Number(s.appointment_reminder_minutes ?? 15));
  if (fAppTheme) fAppTheme.value = s.app_theme || 'light';

  // Barcode label settings
  try{
    if (fBarcodePrinterDeviceName) {
      // will be set after loading printers list; keep raw value here
      fBarcodePrinterDeviceName.dataset.savedDeviceName = s.barcode_printer_device_name || '';
    }
    if (fBarcodePaperWidthMm) fBarcodePaperWidthMm.value = s.barcode_paper_width_mm != null ? String(s.barcode_paper_width_mm) : '';
    if (fBarcodePaperHeightMm) fBarcodePaperHeightMm.value = s.barcode_paper_height_mm != null ? String(s.barcode_paper_height_mm) : '';
    if (fBarcodeShowShopName) fBarcodeShowShopName.checked = (s.barcode_show_shop_name === undefined || s.barcode_show_shop_name === null) ? true : !!s.barcode_show_shop_name;
    if (fBarcodeShowProductName) fBarcodeShowProductName.checked = (s.barcode_show_product_name === undefined || s.barcode_show_product_name === null) ? true : !!s.barcode_show_product_name;
    if (fBarcodeShowPrice) fBarcodeShowPrice.checked = (s.barcode_show_price === undefined || s.barcode_show_price === null) ? true : !!s.barcode_show_price;
    if (fBarcodeShowBarcodeText) fBarcodeShowBarcodeText.checked = (s.barcode_show_barcode_text === undefined || s.barcode_show_barcode_text === null) ? true : !!s.barcode_show_barcode_text;
    if (fBarcodeFontSizeShop) fBarcodeFontSizeShop.value = String(Number(s.barcode_font_size_shop ?? 12));
    if (fBarcodeFontSizeProduct) fBarcodeFontSizeProduct.value = String(Number(s.barcode_font_size_product ?? 12));
    if (fBarcodeFontSizePrice) fBarcodeFontSizePrice.value = String(Number(s.barcode_font_size_price ?? 12));
    if (fBarcodeFontSizeBarcodeText) fBarcodeFontSizeBarcodeText.value = String(Number(s.barcode_font_size_barcode_text ?? 10));
    if (fBarcodeHeightPx) fBarcodeHeightPx.value = String(Number(s.barcode_height_px ?? 40));
    if (fBarcodeLabelOffsetRightMm) fBarcodeLabelOffsetRightMm.value = String(Number(s.barcode_label_offset_right_mm ?? 0));
    if (fBarcodeLabelOffsetLeftMm) fBarcodeLabelOffsetLeftMm.value = String(Number(s.barcode_label_offset_left_mm ?? 0));
    if (fBarcodeLabelOffsetTopMm) fBarcodeLabelOffsetTopMm.value = String(Number(s.barcode_label_offset_top_mm ?? 0));
    if (fBarcodeLabelOffsetBottomMm) fBarcodeLabelOffsetBottomMm.value = String(Number(s.barcode_label_offset_bottom_mm ?? 0));
  }catch(_){}

  // Footer note
  if (fInvoiceFooterNote) fInvoiceFooterNote.value = s.invoice_footer_note || '';

  // Logo size (optional)
  if (fLogoW) fLogoW.value = String(Number(s.logo_width_px || 120));
  if (fLogoH) fLogoH.value = String(Number(s.logo_height_px || 120));

  // payment methods checkboxes
  const methods = Array.isArray(s.payment_methods) ? s.payment_methods : [];
  document.querySelectorAll('.pm').forEach(cb => {
    cb.checked = methods.includes(cb.value);
  });
  updatePmDropdownText();

  // Prefill daily email modal fields
  if(emEnabled) emEnabled.checked = !!s.daily_email_enabled;
  if(emTime) emTime.value = s.daily_email_time || '';
  if(emHost) emHost.value = s.smtp_host || 'smtp.gmail.com';
  if(emPort) emPort.value = String(Number(s.smtp_port || 587));
  if(emSecure) emSecure.checked = !!s.smtp_secure;
  if(emUser) emUser.value = s.smtp_user || '';
  if(emPass) emPass.value = s.smtp_pass || '';

  // Prefill DB backup scheduler controls
  if(bkEnabled) bkEnabled.checked = !!s.db_backup_enabled;
  if(bkTime) bkTime.value = s.db_backup_time || '';
  if(lbEnabled) lbEnabled.checked = !!s.db_backup_local_enabled;
  if(lbTime) lbTime.value = s.db_backup_local_time || '';
  if(lbFolder) lbFolder.value = s.db_backup_local_path || '';

  // Customer Display settings
  try {
    const fCdEnabled = document.getElementById('f_customer_display_enabled');
    const fCdPort    = document.getElementById('f_customer_display_port');
    if (fCdEnabled) fCdEnabled.checked = !!s.customer_display_enabled;
    if (fCdPort) {
      await loadCustomerDisplayPorts(s.customer_display_port || '');
    }
  } catch (_) {}

  // Show recovery section if enabled in DB
  if(recoverySection){ recoverySection.style.display = (s.recovery_unlocked ? 'block' : 'none'); }
  if(isSuperAdminUser() && recoverySection){ recoverySection.style.display = 'block'; }

  logoPath = s.logo_path || null;
  logoBlobBase64 = null; // fresh load: not holding a picked image
  logoMime = null;
  logoRemoved = false; // reset removal flag on load
  updateLogoPreview();
  // Refresh default product image preview as well
  try{ await updateDefProdPreview(); }catch(_){ }

  // تعطيل الحقول المحمية عند تفعيل وضع النسخة التجريبية
  const trialLocked = s.show_trial_notice == 1;
  const trialLockedFields = [fSellerLegal, fSellerLegalEn, fSellerVat];
  trialLockedFields.forEach(el => {
    if (!el) return;
    el.readOnly = trialLocked;
    el.style.opacity = trialLocked ? '0.5' : '';
    el.style.cursor = trialLocked ? 'not-allowed' : '';
    el.title = trialLocked ? 'هذا الحقل محمي في النسخة التجريبية' : '';
  });
}

async function loadCustomerDisplayPorts(selectedPort) {
  const sel = document.getElementById('f_customer_display_port');
  if (!sel) return;
  try {
    const result = await window.api.customer_display_list_ports();
    const ports = (result && result.ports) ? result.ports : [];
    sel.innerHTML = '<option value="">-- اختر المنفذ --</option>';
    ports.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.path;
      opt.textContent = p.path + (p.manufacturer ? ' (' + p.manufacturer + ')' : '');
      if (p.path === selectedPort) opt.selected = true;
      sel.appendChild(opt);
    });
    if (selectedPort && !ports.find(p => p.path === selectedPort)) {
      const opt = document.createElement('option');
      opt.value = selectedPort;
      opt.textContent = selectedPort;
      opt.selected = true;
      sel.appendChild(opt);
    }
  } catch (_) {
    sel.innerHTML = '<option value="">-- تعذر تحميل المنافذ --</option>';
  }
}

async function loadBarcodePrintersIntoSelect(){
  if(!fBarcodePrinterDeviceName) return;
  try{
    const r = await window.api.kitchen_list_system_printers();
    const items = r && r.ok ? (r.items||[]) : [];
    const saved = fBarcodePrinterDeviceName.dataset.savedDeviceName || '';
    // Reset options, keep first "default" option
    fBarcodePrinterDeviceName.innerHTML = '';
    const defOpt = document.createElement('option');
    defOpt.value = '';
    defOpt.textContent = __t('الطابعة الافتراضية للنظام', 'System Default Printer');
    fBarcodePrinterDeviceName.appendChild(defOpt);
    items.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.name;
      opt.textContent = p.name + (p.isDefault ? __t(' (افتراضي)', ' (default)') : '');
      fBarcodePrinterDeviceName.appendChild(opt);
    });
    if(saved){
      fBarcodePrinterDeviceName.value = saved;
    }
  }catch(_){
    // leave only default option
    fBarcodePrinterDeviceName.innerHTML = '';
    const defOpt = document.createElement('option');
    defOpt.value = '';
    defOpt.textContent = __t('الطابعة الافتراضية للنظام', 'System Default Printer');
    fBarcodePrinterDeviceName.appendChild(defOpt);
  }
}

async function updateLogoPreview(){
  // Prefer freshly picked base64 (not yet saved)
  if(logoBlobBase64 && logoMime){
    logoPreview.src = `data:${logoMime};base64,${logoBlobBase64}`;
    logoPreview.style.visibility='visible';
    return;
  }
  // Fallback: try fetching from DB (stored logo)
  if(!logoPath){
    try{
      const lg = await window.api.settings_image_get();
      if(lg && lg.ok && lg.base64){
        logoPreview.src = `data:${lg.mime||'image/png'};base64,${lg.base64}`;
        logoPreview.style.visibility='visible';
        return;
      }
    }catch(_){ }
    logoPreview.src = ''; logoPreview.style.visibility='hidden'; return;
  }
  // Legacy path
  window.api.resolve_path(logoPath).then(res => {
    if(res.ok){ logoPreview.src = 'file:///' + res.abs.replace(/\\/g,'/'); logoPreview.style.visibility='visible'; }
  });
}

pickLogo.addEventListener('click', async () => {
  const r = await window.api.pick_image();
  if(!r.ok || r.canceled) return;
  const read = await window.api.read_file_base64(r.path);
  if(!read.ok){
    setError(read.error || __t('فشل قراءة الصورة', 'Failed to read image'));
    return;
  }
  // Enforce 1MB limit via central validator
  if(read.tooLarge){
    setError(__t('حجم الصورة أكبر من 1 ميجابايت. يرجى اختيار صورة أصغر.', 'Image size exceeds 1MB. Please choose a smaller image.'));
    return;
  }
  logoBlobBase64 = read.base64;
  logoMime = read.mime;
  // Clear legacy path so preview uses base64
  logoPath = null;
  logoRemoved = false; // selecting a new logo cancels removal intent
  updateLogoPreview();
});

removeLogo.addEventListener('click', () => {
  logoPath = null; logoBlobBase64 = null; logoMime = null; logoRemoved = true; updateLogoPreview();
});

// Default product image: preview loader from DB (lazily)
async function updateDefProdPreview(){
  // If user requested removal, hide immediately and don't fetch from DB
  if(defProdImgRemoved){
    defProdImgPreview.src='';
    defProdImgPreview.style.visibility='hidden';
    return;
  }
  // Prefer freshly picked base64
  if(defProdImgBase64 && defProdImgMime){
    defProdImgPreview.src = `data:${defProdImgMime};base64,${defProdImgBase64}`;
    defProdImgPreview.style.visibility='visible';
    return;
  }
  try{
    const r = await window.api.settings_default_product_image_get();
    if(r && r.ok && r.base64){
      defProdImgPreview.src = `data:${r.mime||'image/png'};base64,${r.base64}`;
      defProdImgPreview.style.visibility='visible';
      return;
    }
  }catch(_){ }
  defProdImgPreview.src=''; defProdImgPreview.style.visibility='hidden';
}

pickDefProdImg?.addEventListener('click', async () => {
  const r = await window.api.pick_image();
  if(!r.ok || r.canceled) return;
  const read = await window.api.read_file_base64(r.path);
  if(!read.ok){ setError(read.error || __t('فشل قراءة الصورة', 'Failed to read image')); return; }
  if(read.tooLarge){ setError(__t('حجم الصورة أكبر من 1 ميجابايت. يرجى اختيار صورة أصغر.', 'Image size exceeds 1MB. Please choose a smaller image.')); return; }
  defProdImgBase64 = read.base64;
  defProdImgMime = read.mime || 'image/png';
  defProdImgRemoved = false;
  updateDefProdPreview();
});

removeDefProdImg?.addEventListener('click', () => {
  defProdImgBase64 = null;
  defProdImgMime = null;
  defProdImgRemoved = true;
  updateDefProdPreview();
});

// Open/close daily email dialog
btnDailyEmail?.addEventListener('click', ()=>{ try{ dailyEmailDlg?.showModal(); }catch(_){ } });
emCancel?.addEventListener('click', ()=>{ try{ dailyEmailDlg?.close(); }catch(_){ } });
emSave?.addEventListener('click', async ()=>{
  // Save immediately by reusing settings_save with only email/scheduler fields merged
  saveBtn?.click(); // rely on main save to persist everything including modal fields
  try{ dailyEmailDlg?.close(); }catch(_){ }
});

// Send DB backup directly from daily settings area (beside time)
const emSendBackup = document.getElementById('em_send_backup');
emSendBackup?.addEventListener('click', async ()=>{
  try{
    setError('');
    // transient success message (show inside dialog if open, else global toast)
    const showOk = (msg)=>{
      const text = msg || __t('تم الإرسال بنجاح', 'Sent successfully');
      if (dailyEmailDlg && dailyEmailDlg.open) {
        const toast = document.createElement('div');
        toast.className = 'success';
        toast.textContent = text;
        dailyEmailDlg.appendChild(toast);
        setTimeout(()=>{ try{ toast.remove(); }catch(_){} }, 3000);
      } else {
        okDiv.textContent = text;
        okDiv.style.display = 'block';
        setTimeout(()=>{ okDiv.style.display = 'none'; okDiv.textContent=''; }, 3000);
      }
    };
    // Use the email field as target; if empty, main will fall back to settings
    const to = (fEmail?.value||'').trim();
    const r = await window.api.backup_email_db(to||undefined);
    if(!r || !r.ok){ setError((r && r.error) || __t('فشل إرسال النسخة الاحتياطية', 'Failed to send backup')); }
    else { showOk(__t('تم إرسال نسخة قاعدة البيانات بنجاح', 'Database backup sent successfully')); }
  }catch(e){ setError(String(e&&e.message||e)); }
});

// Backup database locally
const btnBackupLocal = document.getElementById('btn_backup_local');
btnBackupLocal?.addEventListener('click', ()=>{
  try{ localBackupDlg?.showModal(); }catch(_){ }
});

lbPickDir?.addEventListener('click', async ()=>{
  try{
    const r = await window.api.backup_pick_dir();
    if(r && r.ok && r.path && lbFolder){ lbFolder.value = r.path; }
  }catch(e){ setError(String(e&&e.message||e)); }
});

lbCancel?.addEventListener('click', ()=>{ try{ localBackupDlg?.close(); }catch(_){ } });
lbSave?.addEventListener('click', ()=>{
  try{ saveBtn?.click(); localBackupDlg?.close(); }catch(_){ }
});

lbBackupNow?.addEventListener('click', async ()=>{
  try{
    setError('');
    const showOk = (msg)=>{
      const text = msg || __t('تم الحفظ بنجاح', 'Saved successfully');
      if(localBackupDlg && localBackupDlg.open){
        const toast = document.createElement('div');
        toast.className = 'success';
        toast.textContent = text;
        localBackupDlg.appendChild(toast);
        setTimeout(()=>{ try{ toast.remove(); }catch(_){ } }, 3000);
      } else {
        okDiv.textContent = text;
        okDiv.style.display = 'block';
        setTimeout(()=>{ okDiv.style.display = 'none'; okDiv.textContent=''; }, 3000);
      }
    };
    const pick = await window.api.backup_pick_dir();
    const targetDir = (pick && pick.ok && pick.path) ? pick.path : '';
    if(!targetDir){ setError(__t('يرجى اختيار مجلد الحفظ', 'Please choose a save folder')); return; }
    const r = await window.api.backup_db_local(targetDir);
    if(!r || !r.ok){ setError((r && r.error) || __t('فشل حفظ النسخة الاحتياطية', 'Failed to save backup')); }
    else { showOk(__t('تم حفظ نسخة قاعدة البيانات بنجاح في: ', 'Database backup saved successfully at: ') + (r.path || '')); }
  }catch(e){ setError(String(e&&e.message||e)); }
});

// Send daily report now (manual trigger)
const emSendDaily = document.getElementById('em_send_daily');
emSendDaily?.addEventListener('click', async ()=>{
  try{
    setError('');
    const showOk = (msg)=>{
      const text = msg || __t('تم الإرسال بنجاح', 'Sent successfully');
      if (dailyEmailDlg && dailyEmailDlg.open) {
        const toast = document.createElement('div');
        toast.className = 'success';
        toast.textContent = text;
        dailyEmailDlg.appendChild(toast);
        setTimeout(()=>{ try{ toast.remove(); }catch(_){} }, 3000);
      } else {
        okDiv.textContent = text;
        okDiv.style.display = 'block';
        setTimeout(()=>{ okDiv.style.display = 'none'; okDiv.textContent=''; }, 3000);
      }
    };
    const r = await window.api.scheduler_send_daily_now();
    if(!r || !r.ok){ setError((r && r.error) || __t('فشل إرسال التقرير اليومي', 'Failed to send daily report')); }
    else { showOk(__t('تم إرسال التقرير اليومي بنجاح', 'Daily report sent successfully')); }
  }catch(e){ setError(String(e&&e.message||e)); }
});

// Open/close backup email dialog
btnBackupEmail?.addEventListener('click', ()=>{
  try{
    if(bkTo){ bkTo.value = (fEmail?.value||'').trim(); }
    backupEmailDlg?.showModal();
  }catch(_){ }
});
bkCancel?.addEventListener('click', ()=>{ try{ backupEmailDlg?.close(); }catch(_){ } });
bkSend?.addEventListener('click', async ()=>{
  try{
    const to = (bkTo?.value||'').trim();
    const r = await window.api.backup_email_db(to||undefined);
    if(!r || !r.ok){ setError((r && r.error) || __t('فشل إرسال النسخة الاحتياطية', 'Failed to send backup')); }
    else { setOk(true); }
  }catch(e){ setError(String(e&&e.message||e)); }
  try{ backupEmailDlg?.close(); }catch(_){ }
});

saveBtn.addEventListener('click', async () => {
  setError(''); setOk(false);
  // gather checked payment methods
  const methods = Array.from(document.querySelectorAll('.pm'))
    .filter(cb => cb.checked)
    .map(cb => cb.value);

  const payload = {
    // استخدم الاسم القانوني كقيمة لحقل company_name للتوافق الخلفي
    company_name: (fSellerLegal.value||'').trim(),
    company_site: (fCompanySite.value||'').trim(),
    company_location: (fCompanyLocation.value||'').trim(),
    mobile: (fMobile.value||'').trim(),
    email: (fEmail.value||'').trim(),
    show_email_in_invoice: !!(fShowEmailInInvoice?.checked),
    // Logo fields: prefer DB BLOB like products
    logo_path: logoPath, // kept for backward compat if not re-picked
    logo_blob_base64: logoBlobBase64 || null,
    logo_mime: logoMime || null,
    // Default product image fields
    default_product_img_blob_base64: defProdImgBase64 || null,
    default_product_img_mime: defProdImgMime || null,
    vat_percent: Number(fVat.value || 15),
    prices_include_vat: !!fPricesInc.checked,
    cost_includes_vat: fCostIncVat ? (!!fCostIncVat.checked ? 1 : 0) : 1,
    payment_methods: methods,
    currency_code: (fCurrencyCode.value||'SAR').trim() || 'SAR',
    currency_symbol: (fCurrencySymbol.value||'﷼').trim() || '﷼',
    currency_symbol_position: (fCurrencyPos.value === 'before' ? 'before' : 'after'),
    default_print_format: (fPrintFormat?.value === 'a4' ? 'a4' : 'thermal'),
    print_copies: Math.max(0, Number(fPrintCopies.value)),
    silent_print: !!fSilentPrint.checked,
    print_show_change: !!fShowChange.checked ? 1 : 0,
    show_barcode_in_a4: !!(fShowBarcodeA4?.checked),
    unit_price_label: (fUnitPriceLabel?.value || '').trim() || 'سعر القطعة',
    quantity_label: (fQuantityLabel?.value || '').trim() || 'عدد',
    default_payment_method: (fDefaultPayment.value||'') || null,
    seller_legal_name: (fSellerLegal.value||'').trim(),
    seller_vat_number: (fSellerVat.value||'').trim(),
    // English fields for A4
    seller_legal_name_en: (fSellerLegalEn?.value || '').trim() || null,
    company_location_en: (fCompanyLocationEn?.value || '').trim() || null,
    // Logo target size in invoice (px)
    logo_width_px: Math.max(24, Math.min(512, Number((fLogoW?.value)||120))) || 120,
    logo_height_px: Math.max(24, Math.min(512, Number((fLogoH?.value)||120))) || 120,
    op_price_manual: !!fOpPriceManual.checked,
    update_product_price_on_edit: !!(fUpdateProductPriceOnEdit?.checked),
    allow_sell_zero_stock: !!fAllowZeroStock.checked,
    invoice_footer_note: (fInvoiceFooterNote?.value || '').trim(),
    hide_product_images: !!(fHideProductImages?.checked),
    show_quotation_button: !!(fShowQuotationButton?.checked),
    show_selling_units: !!(fShowSellingUnits?.checked),
    show_employee_selector: !!(fShowEmployeeSelector?.checked),
    closing_hour: (fClosingHour?.value || '').trim() || null,
    // Print margins (mm)
    print_margin_right_mm: (fPrintMarginRight?.value==='' ? null : Number(fPrintMarginRight?.value)),
    print_margin_left_mm: (fPrintMarginLeft?.value==='' ? null : Number(fPrintMarginLeft?.value)),
    // WhatsApp auto-send
    whatsapp_on_print: !!(fWhatsAuto?.checked),
    whatsapp_auto_connect: !!(fWhatsAutoConnect?.checked),
    whatsapp_message: null,
    // Daily email scheduler fields (from modal)
    daily_email_enabled: !!(emEnabled?.checked),
    daily_email_time: (emTime?.value || '').trim() || null,
    smtp_host: (emHost?.value || '').trim() || null,
    smtp_port: emPort?.value ? Number(emPort.value) : null,
    smtp_secure: !!(emSecure?.checked),
    smtp_user: (emUser?.value || '').trim() || null,
    smtp_pass: (emPass?.value || '').trim() || null,
    // New fields
    commercial_register: (fCommercialRegister?.value || '').trim() || null,
    national_number: (fNationalNumber?.value || '').trim() || null,
    // ZATCA toggle
    zatca_enabled: !!(fZatcaEnabled?.checked),
    // DB backup scheduler
    db_backup_enabled: !!(bkEnabled?.checked),
    db_backup_time: (bkTime?.value || '').trim() || null,
    db_backup_local_enabled: !!(lbEnabled?.checked),
    db_backup_local_time: (lbTime?.value || '').trim() || null,
    db_backup_local_path: (lbFolder?.value || '').trim() || null,
    // Cart behavior
    cart_separate_duplicate_lines: !!(fCartSeparateDup?.checked),
    // Low stock alert threshold
    low_stock_threshold: (function(){
      const el = document.getElementById('f_low_stock_threshold');
      const v = el ? Number(el.value||5) : 5;
      return Math.max(0, isFinite(v) ? Math.floor(v) : 5);
    })(),
    // Low stock email control
    low_stock_email_enabled: !!(fLowStockEmailEnabled?.checked),
    // Show/hide low-stock alerts on sales screen
    show_low_stock_alerts: !!(fShowLowStockAlerts?.checked),
    // Weight mode
    weight_mode_enabled: !!(fWeightModeEnabled?.checked),
    // Electronic scale settings
    electronic_scale_enabled: !!(fElectronicScaleEnabled?.checked),
    electronic_scale_type: fElectronicScaleType ? (fElectronicScaleType.value || 'weight') : 'weight',
    // Require payment before print
    require_payment_before_print: !!(fRequirePaymentBeforePrint?.checked),
    require_customer_before_print: !!(fRequireCustomerBeforePrint?.checked),
    // Require phone minimum 10 digits
    require_phone_min_10: !!(fRequirePhoneMin10?.checked),
    // Appointment reminder minutes
    appointment_reminder_minutes: fAppointmentReminderMinutes ? Number(fAppointmentReminderMinutes.value) : 15,
    // App theme
    app_theme: fAppTheme ? (fAppTheme.value || 'light') : 'light',
    // Barcode label settings
    barcode_printer_device_name: (fBarcodePrinterDeviceName?.value || '').trim() || null,
    barcode_paper_width_mm: (fBarcodePaperWidthMm && fBarcodePaperWidthMm.value !== '') ? Number(fBarcodePaperWidthMm.value) : null,
    barcode_paper_height_mm: (fBarcodePaperHeightMm && fBarcodePaperHeightMm.value !== '') ? Number(fBarcodePaperHeightMm.value) : null,
    barcode_show_shop_name: !!(fBarcodeShowShopName?.checked),
    barcode_show_product_name: !!(fBarcodeShowProductName?.checked),
    barcode_show_price: !!(fBarcodeShowPrice?.checked),
    barcode_show_barcode_text: !!(fBarcodeShowBarcodeText?.checked),
    barcode_font_size_shop: fBarcodeFontSizeShop ? Number(fBarcodeFontSizeShop.value || 12) : 12,
    barcode_font_size_product: fBarcodeFontSizeProduct ? Number(fBarcodeFontSizeProduct.value || 12) : 12,
    barcode_font_size_price: fBarcodeFontSizePrice ? Number(fBarcodeFontSizePrice.value || 12) : 12,
    barcode_font_size_barcode_text: fBarcodeFontSizeBarcodeText ? Number(fBarcodeFontSizeBarcodeText.value || 10) : 10,
    barcode_height_px: fBarcodeHeightPx ? Number(fBarcodeHeightPx.value || 40) : 40,
    barcode_label_offset_right_mm: fBarcodeLabelOffsetRightMm ? Number(fBarcodeLabelOffsetRightMm.value || 0) : 0,
    barcode_label_offset_left_mm: fBarcodeLabelOffsetLeftMm ? Number(fBarcodeLabelOffsetLeftMm.value || 0) : 0,
    barcode_label_offset_top_mm: fBarcodeLabelOffsetTopMm ? Number(fBarcodeLabelOffsetTopMm.value || 0) : 0,
    barcode_label_offset_bottom_mm: fBarcodeLabelOffsetBottomMm ? Number(fBarcodeLabelOffsetBottomMm.value || 0) : 0,
    // Customer Display
    customer_display_enabled:   !!(document.getElementById('f_customer_display_enabled')?.checked),
    customer_display_port:      (document.getElementById('f_customer_display_port')?.value || null),
    customer_display_baud_rate: 2400,
    customer_display_columns:   8,
    customer_display_rows:      1,
    customer_display_protocol:  'ecopos',
    customer_display_encoding:  'ascii',
    customer_display_brightness: 100
  };
  // Clear logo ONLY if user explicitly removed it
  if(logoRemoved){ payload.logo_clear = true; }
  // Clear default product image ONLY if user explicitly removed it
  if(defProdImgRemoved){ payload.default_product_img_clear = true; }
  const r = await window.api.settings_save(payload);
  if(!r.ok){ setError(r.error || __t('فشل حفظ الإعدادات', 'Failed to save settings')); return; }
  try{
    // rearm schedulers to pick latest settings immediately
    await window.api.scheduler_trigger_daily_email();
    await window.api.scheduler_trigger_backup();
  }catch(_){ }
  try{
    if (payload.customer_display_enabled) {
      await window.api.customer_display_reinit();
    }
  }catch(_){ }
  try{
    // بث إعدادات تنبيهات المخزون لالتقاطها في شاشة البيع دون إعادة تشغيل
    // بث إعدادات تنبيهات المخزون لالتقاطها في شاشة البيع دون إعادة تشغيل
    const lowstock = { show_low_stock_alerts: !!payload.show_low_stock_alerts, low_stock_threshold: Number(payload.low_stock_threshold ?? 5) };
    localStorage.setItem('pos_settings_lowstock', JSON.stringify(lowstock));
    window.dispatchEvent(new StorageEvent('storage', { key: 'pos_settings_lowstock', newValue: JSON.stringify(lowstock) }));
    // بث إعداد وضع الوزن
    const weightMode = { weight_mode_enabled: !!payload.weight_mode_enabled };
    localStorage.setItem('pos_settings_weight_mode', JSON.stringify(weightMode));
    window.dispatchEvent(new StorageEvent('storage', { key: 'pos_settings_weight_mode', newValue: JSON.stringify(weightMode) }));
    // بث إعداد زر عرض السعر
    const quotationBtn = { show_quotation_button: !!payload.show_quotation_button };
    localStorage.setItem('pos_settings_quotation', JSON.stringify(quotationBtn));
    window.dispatchEvent(new StorageEvent('storage', { key: 'pos_settings_quotation', newValue: JSON.stringify(quotationBtn) }));
    // بث إعداد تحديث سعر المنتج عند تعديله في السلة
    const updatePriceOnEdit = { update_product_price_on_edit: !!payload.update_product_price_on_edit };
    localStorage.setItem('pos_settings_update_price_on_edit', JSON.stringify(updatePriceOnEdit));
    window.dispatchEvent(new StorageEvent('storage', { key: 'pos_settings_update_price_on_edit', newValue: JSON.stringify(updatePriceOnEdit) }));
    // بث إعداد الثيم
    const themeSettings = { app_theme: payload.app_theme || 'light' };
    localStorage.setItem('pos_settings_theme', JSON.stringify(themeSettings));
    window.dispatchEvent(new StorageEvent('storage', { key: 'pos_settings_theme', newValue: JSON.stringify(themeSettings) }));
    // تطبيق الثيم فوراً
    if(window.applyTheme) window.applyTheme(payload.app_theme || 'light');
  }catch(_){ }
  // إعادة التحميل فوراً بدون تأخير
  try{ await loadSettings(); applySuperAdminView(); }catch(_){ }
  // عرض رسالة النجاح بعد إعادة التحميل
  setOk(true);
});

if(reloadBtn){ reloadBtn.addEventListener('click', async () => { await loadSettings(); applySuperAdminView(); }); }

// Reset Modal Controls
const resetModal = document.getElementById('resetModal');
const closeModalBtn = document.getElementById('closeModal');
const cancelResetBtn = document.getElementById('cancelResetBtn');
const confirmResetBtn = document.getElementById('confirmResetBtn');
const confirmationModal = document.getElementById('confirmationModal');
const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
const proceedDeleteBtn = document.getElementById('proceedDeleteBtn');
const successToast = document.getElementById('successToast');
const successToastContent = document.getElementById('successToastContent');

function openResetModal(){
  if(resetModal){ resetModal.classList.add('active'); }
}

function closeResetModal(){
  if(resetModal){ resetModal.classList.remove('active'); }
}

function openConfirmationModal(){
  if(confirmationModal){ confirmationModal.classList.add('active'); }
}

function closeConfirmationModal(){
  if(confirmationModal){ confirmationModal.classList.remove('active'); }
}

function showSuccessToast(message){
  if(successToast && successToastContent){
    successToastContent.innerHTML = message;
    successToast.style.display = 'block';
    successToast.style.animation = 'slideDown 0.4s ease';
    setTimeout(() => {
      successToast.style.animation = 'slideUp 0.4s ease';
      setTimeout(() => {
        successToast.style.display = 'none';
      }, 400);
    }, 4000);
  }
}

if(closeModalBtn){ closeModalBtn.addEventListener('click', closeResetModal); }
if(cancelResetBtn){ cancelResetBtn.addEventListener('click', closeResetModal); }
if(cancelConfirmBtn){ cancelConfirmBtn.addEventListener('click', closeConfirmationModal); }

if(resetModal){
  resetModal.addEventListener('click', (e)=>{
    if(e.target === resetModal){ closeResetModal(); }
  });
}

if(confirmationModal){
  confirmationModal.addEventListener('click', (e)=>{
    if(e.target === confirmationModal){ closeConfirmationModal(); }
  });
}

// Dangerous actions with confirmations
if(btnResetSales){
  btnResetSales.addEventListener('click', ()=>{
    openResetModal();
  });
}

if(confirmResetBtn){
  confirmResetBtn.addEventListener('click', ()=>{
    const options = {
      resetSales: document.getElementById('chkResetSales')?.checked || false,
      resetPurchaseInvoices: document.getElementById('chkResetPurchaseInvoices')?.checked || false,
      resetPurchases: document.getElementById('chkResetPurchases')?.checked || false,
      resetSupplierBalance: document.getElementById('chkResetSupplierBalance')?.checked || false,
      resetProducts: document.getElementById('chkResetProducts')?.checked || false,
      resetCustomers: document.getElementById('chkResetCustomers')?.checked || false,
      resetQuotations: document.getElementById('chkResetQuotations')?.checked || false,
      resetShifts: document.getElementById('chkResetShifts')?.checked || false
    };
    
    if(!options.resetSales && !options.resetPurchaseInvoices && !options.resetPurchases && !options.resetSupplierBalance && !options.resetProducts && !options.resetCustomers && !options.resetQuotations && !options.resetShifts){
      alert(__t('الرجاء اختيار عنصر واحد على الأقل للحذف', 'Please select at least one item to delete'));
      return;
    }
    
    closeResetModal();
    openConfirmationModal();
  });
}

if(proceedDeleteBtn){
  proceedDeleteBtn.addEventListener('click', async ()=>{
    const options = {
      resetSales: document.getElementById('chkResetSales')?.checked || false,
      resetPurchaseInvoices: document.getElementById('chkResetPurchaseInvoices')?.checked || false,
      resetPurchases: document.getElementById('chkResetPurchases')?.checked || false,
      resetSupplierBalance: document.getElementById('chkResetSupplierBalance')?.checked || false,
      resetProducts: document.getElementById('chkResetProducts')?.checked || false,
      resetCustomers: document.getElementById('chkResetCustomers')?.checked || false,
      resetQuotations: document.getElementById('chkResetQuotations')?.checked || false,
      resetShifts: document.getElementById('chkResetShifts')?.checked || false
    };
    
    closeConfirmationModal();
    
    const r = await window.api.sales_reset_all(options);
    if(!r.ok){ 
      setError(r.error || __t('فشل العملية', 'Operation failed')); 
      return; 
    }
    
    let msg = '';
    if(options.resetSales) msg += `✓ ${__t('حذف فواتير البيع', 'Sales invoices deleted')}<br>`;
    if(options.resetPurchaseInvoices) msg += `✓ ${__t('حذف فواتير الشراء', 'Purchase invoices deleted')}<br>`;
    if(options.resetPurchases) msg += `✓ ${__t('حذف المصروفات البسيطة', 'Simple expenses deleted')}<br>`;
    if(options.resetSupplierBalance) msg += `✓ ${__t('تصفير أرصدة الموردين', 'Supplier balances reset')}<br>`;
    if(options.resetProducts) msg += `✓ ${__t('حذف كل المنتجات', 'All products deleted')}<br>`;
    if(options.resetCustomers) msg += `✓ ${__t('حذف كل العملاء', 'All customers deleted')}<br>`;
    if(options.resetQuotations) msg += `✓ ${__t('حذف عروض الأسعار', 'Quotations deleted')}<br>`;
    if(options.resetShifts) msg += `✓ ${__t('حذف الشفتات', 'Shifts deleted')}<br>`;
    
    showSuccessToast(msg);
    
    if(options.resetProducts){
      try{
        const payload = JSON.stringify({ at: Date.now() });
        localStorage.setItem('pos_reset_products', payload);
        window.dispatchEvent(new StorageEvent('storage', { key: 'pos_reset_products', newValue: payload }));
      }catch(_){}
    }
  });
}

// Setup payment methods dropdown event listeners
pmDropdownTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  pmDropdownMenu.classList.toggle('show');
});

document.addEventListener('click', (e) => {
  if (!pmDropdownMenu.contains(e.target) && !pmDropdownTrigger.contains(e.target)) {
    pmDropdownMenu.classList.remove('show');
  }
});

document.querySelectorAll('.pm').forEach(checkbox => {
  checkbox.addEventListener('change', updatePmDropdownText);
});

pmDropdownMenu.addEventListener('click', (e) => {
  e.stopPropagation();
});

const updateModal = document.getElementById('updateModal');
const checkUpdateBtn = document.getElementById('checkUpdateBtn');
const updateCancelBtn = document.getElementById('updateCancelBtn');
const updateDownloadBtn = document.getElementById('updateDownloadBtn');
const updateInstallBtn = document.getElementById('updateInstallBtn');
const updateStatus = document.getElementById('updateStatus');
const updateMessage = document.getElementById('updateMessage');
const updateProgress = document.getElementById('updateProgress');
const updateProgressBar = document.getElementById('updateProgressBar');
const updateProgressText = document.getElementById('updateProgressText');

function showUpdateModal() {
  if (updateModal) {
    updateModal.showModal();
    resetUpdateModal();
  }
}

function closeUpdateModal() {
  if (updateModal) {
    updateModal.close();
  }
}

function resetUpdateModal() {
  updateStatus.querySelector('div:first-child').textContent = '🔍';
  updateStatus.querySelector('div:nth-child(2)').textContent = __t('جاري البحث عن التحديثات...', 'Checking for updates...');
  updateMessage.textContent = '';
  updateProgress.style.display = 'none';
  updateDownloadBtn.style.display = 'none';
  updateInstallBtn.style.display = 'none';
  updateProgressBar.style.width = '0%';
}

function updateUIStatus(icon, title, message, showDownload = false, showInstall = false) {
  updateStatus.querySelector('div:first-child').textContent = icon;
  updateStatus.querySelector('div:nth-child(2)').textContent = title;
  updateMessage.textContent = message;
  updateDownloadBtn.style.display = showDownload ? 'block' : 'none';
  updateInstallBtn.style.display = showInstall ? 'block' : 'none';
}

checkUpdateBtn?.addEventListener('click', async () => {
  showUpdateModal();
  
  try {
    const appVersion = await window.api.invoke('get-app-version');
    updateMessage.textContent = __t(`الإصدار الحالي: ${appVersion}`, `Current version: ${appVersion}`);
    
    const result = await window.api.invoke('check-for-updates');
    
    if (!result.success) {
      updateUIStatus('❌', __t('فشل البحث عن التحديثات', 'Update check failed'), result.error || __t('حدث خطأ أثناء البحث عن التحديثات', 'An error occurred while checking for updates'));
      return;
    }
    
    // معالجة النتيجة مباشرة إذا كانت موجودة
    if (result.success && result.result) {
      const updateResult = result.result;
      
      // التحقق من وجود تحديث متاح والتأكد أنه إصدار أعلى
      if (updateResult.updateInfo && updateResult.updateInfo.version) {
        const newVersion = updateResult.updateInfo.version;
        
        // مقارنة الإصدارات
        if (compareVersions(appVersion, newVersion) < 0) {
          console.log('Settings: Update available -', newVersion, '(current:', appVersion + ')');
          updateUIStatus(
            '🎉',
            __t('يوجد تحديث جديد متاح!', 'New update available!'),
            __t(`الإصدار الجديد: ${newVersion}`, `New version: ${newVersion}`),
            true,
            false
          );
        } else {
          // لا يوجد تحديث - عرض رسالة داخل النافذة
          console.log('Settings: No update available - running latest version', appVersion);
          updateUIStatus(
            '✅',
            __t('أنت تستخدم أحدث إصدار من البرنامج', 'You are using the latest version'),
            __t(`الإصدار الحالي: ${appVersion}`, `Current version: ${appVersion}`),
            false,
            false
          );
        }
      } else {
        // لا يوجد تحديث - عرض رسالة داخل النافذة
        console.log('Settings: No update available - running latest version', appVersion);
        updateUIStatus(
          '✅',
          __t('أنت تستخدم أحدث إصدار من البرنامج', 'You are using the latest version'),
          __t(`الإصدار الحالي: ${appVersion}`, `Current version: ${appVersion}`),
          false,
          false
        );
      }
    }
  } catch (error) {
    updateUIStatus('❌', __t('فشل البحث عن التحديثات', 'Update check failed'), error.message || __t('حدث خطأ غير متوقع', 'An unexpected error occurred'));
  }
});

updateDownloadBtn?.addEventListener('click', async () => {
  updateDownloadBtn.disabled = true;
  updateUIStatus('⬇️', __t('جاري تحميل التحديث...', 'Downloading update...'), __t('يرجى الانتظار حتى اكتمال التحميل', 'Please wait until the download is complete'));
  updateProgress.style.display = 'block';
  
  // إظهار شريط التقدم في 0%
  if (updateProgressBar) updateProgressBar.style.width = '0%';
  if (updateProgressText) updateProgressText.textContent = __t('بدء التحميل...', 'Starting download...');
  
  try {
    const result = await window.api.invoke('download-update');
    
    // التحقق من حالة انتهاء الدعم الفني
    if (result && result.supportExpired) {
      updateUIStatus(
        '⚠️',
        __t('انتهت فترة الدعم الفني', 'Support period expired'),
        __t('يرجى تجديد الدعم الفني للحصول على التحديثات', 'Please renew your support to get updates')
      );
      updateProgress.style.display = 'none';
      updateDownloadBtn.disabled = false;
      return;
    }
    
    if (!result.success) {
      console.error('Settings: Download failed:', result.error);
      updateUIStatus('❌', __t('فشل تحميل التحديث', 'Download failed'), result.error || __t('حدث خطأ أثناء التحميل', 'An error occurred during download'));
      updateProgress.style.display = 'none';
      updateDownloadBtn.disabled = false;
      return;
    }
  } catch (error) {
    console.error('Settings: Download error:', error);
    updateUIStatus('❌', __t('فشل تحميل التحديث', 'Download failed'), error.message || __t('حدث خطأ أثناء التحميل', 'An error occurred during download'));
    updateProgress.style.display = 'none';
    updateDownloadBtn.disabled = false;
  }
});

updateInstallBtn?.addEventListener('click', async () => {
  try {
    console.log('Settings: Requesting install-update...');
    const result = await window.api.invoke('install-update');
    console.log('Settings: Install result:', result);
    
    // التحقق من حالة انتهاء الدعم الفني
    if (result && result.supportExpired) {
      console.log('Settings: Support expired detected during install, showing message');
      updateUIStatus(
        '⚠️',
        __t('انتهت فترة الدعم الفني', 'Support period expired'),
        result.error || __t('يرجى تجديد الدعم الفني للحصول على التحديثات', 'Please renew your support to get updates')
      );
      return;
    }
    
    if (result && !result.success) {
      console.log('Settings: Install failed:', result.error);
      updateUIStatus('❌', __t('فشل تثبيت التحديث', 'Install failed'), result.error || __t('حدث خطأ أثناء التثبيت', 'An error occurred during installation'));
    } else {
      console.log('Settings: Install completed successfully');
    }
  } catch (error) {
    console.error('Settings: Install error:', error);
    updateUIStatus('❌', __t('فشل تثبيت التحديث', 'Install failed'), error.message || __t('حدث خطأ أثناء التثبيت', 'An error occurred during installation'));
  }
});

updateCancelBtn?.addEventListener('click', () => {
  closeUpdateModal();
});

updateModal?.addEventListener('click', (e) => {
  if (e.target === updateModal) {
    closeUpdateModal();
  }
});

window.api?.on?.('update-status', (payload) => {
  // التحقق من وجود البيانات قبل معالجتها
  if (!payload || typeof payload !== 'object' || !payload.status) {
    return;
  }
  
  const { status, data: statusData } = payload;
  
  switch (status) {
    case 'checking-for-update':
      updateUIStatus(
        '🔍',
        __t('جاري البحث عن التحديثات...', 'Checking for updates...'),
        __t('يرجى الانتظار...', 'Please wait...')
      );
      break;
      
    case 'update-available':
      updateUIStatus(
        '🎉',
        __t('يوجد تحديث جديد متاح!', 'New update available!'),
        __t(`الإصدار الجديد: ${statusData.version}`, `New version: ${statusData.version}`),
        true,
        false
      );
      break;
      
    case 'update-not-available':
      // لا يوجد تحديث - لا نفعل شيء، ستغلق النافذة من معالجة check-for-updates
      break;
      
    case 'download-progress':
      if (statusData && typeof statusData.percent !== 'undefined') {
        const percent = Math.round(statusData.percent);
        updateProgressBar.style.width = `${percent}%`;
        updateProgressText.textContent = `${percent}% - ${(statusData.transferred / 1024 / 1024).toFixed(2)} ${__t('ميجا من', 'MB of')} ${(statusData.total / 1024 / 1024).toFixed(2)} ${__t('ميجا', 'MB')}`;
      }
      break;
      
    case 'update-downloaded':
      updateUIStatus(
        '✅',
        __t('اكتمل التحميل!', 'Download complete!'),
        __t('التحديث جاهز للتثبيت. سيتم إعادة تشغيل البرنامج.', 'Update ready to install. The app will restart.'),
        false,
        true
      );
      updateProgress.style.display = 'none';
      break;
      
    case 'update-error':
      updateUIStatus(
        '❌',
        __t('حدث خطأ', 'An error occurred'),
        statusData.message || __t('فشل التحديث', 'Update failed')
      );
      break;
      
    case 'support-expired':
      updateUIStatus(
        '⚠️',
        __t('انتهت فترة الدعم الفني', 'Support period expired'),
        __t('يرجى تجديد الدعم الفني للحصول على التحديثات. تاريخ الانتهاء: ', 'Please renew your support to get updates. Expiry date: ') + (statusData.endDate || __t('غير محدد', 'unknown'))
      );
      break;
  }
});

loadSettings().then(() => { applySuperAdminView(); loadBarcodePrintersIntoSelect(); });

(function initLocale(){
  (async ()=>{
    try{
      const res = await window.api.app_get_locale();
      const lang = (res && res.lang) || 'ar';
      const isAr = lang.split('-')[0].toLowerCase() !== 'en';
      translateUI(isAr);
    }catch(_){ translateUI(true); }
  })();
  try{
    window.api.app_on_locale_changed((L)=>{
      const isAr = (typeof L === 'string' ? L.split('-')[0].toLowerCase() : 'ar') !== 'en';
      translateUI(isAr);
      try{ window.__i18n_burst && window.__i18n_burst(L); }catch(_){}
    });
  }catch(_){}
})();