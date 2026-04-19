// Preload script to bridge secure APIs to renderer
const { contextBridge, ipcRenderer, webFrame } = require('electron');

// Inject global header language selector + auto dir/lang switch for all screens
(function () {
  try {
    const applyDir = (lang) => {
      const url = (location.pathname || '').toLowerCase();
      const isPrint = url.includes('/sales/print') || url.includes('/kitchen/print');
      const use = isPrint ? 'ar' : (lang === 'en' ? 'en' : 'ar');
      document.documentElement.lang = use;
      document.documentElement.dir = use === 'ar' ? 'rtl' : 'ltr';
    };
    // Lightweight global translation maps
    const TR = {
      ar_to_en: {
        'الرئيسية': 'Home', 'تسجيل الخروج': 'Logout', 'إدارة المستخدمين': 'Users Management', 'المستخدمون': 'Users', 'الصلاحيات': 'Permissions', 'التقارير': 'Reports', 'المبيعات': 'Sales', 'المنتجات': 'Products', 'العملاء': 'Customers', 'الإعدادات': 'Settings', 'الغرف': 'Rooms', 'المطبخ': 'Kitchen', 'الفواتير': 'Invoices', 'المصروفات': 'Purchases', 'المخزون': 'Inventory', 'تخصيص الأسعار': 'Customer Pricing', 'العروض': 'Offers', 'السائقون': 'Drivers',
        'إدارة الصلاحيات': 'Manage Permissions', 'إدارة المنتجات': 'Manage Products', 'إدارة المستخدمين والأدوار والحالة': 'Manage users, roles and status', 'تحديد صلاحيات المستخدمين': 'Define user permissions', 'كل الفواتير': 'All invoices', 'الفواتير غير مدفوعة': 'Unpaid invoices', 'الفواتير الدائنة': 'Credit invoices', 'تقرير يومي': 'Daily report', 'تقرير فترة': 'Period report', 'تقرير الأنواع': 'Types report', 'تقرير المصروفات': 'Purchases report', 'تقرير البلدية': 'Municipality report',
        'بحث': 'Search', 'حفظ': 'Save', 'إلغاء': 'Cancel', 'عودة': 'Back', 'الرجوع': 'Back', '⬅ العودة': '⬅ Back', 'الرئيسية': 'Home',
        'إضافة': 'Add', 'إضافة مستخدم': 'Add User', 'إضافة منتج': 'Add Product', 'إضافة غرفة': 'Add Room', 'إضافة عميل': 'Add Customer', 'إضافة عملية': 'Add Operation', 'طباعة الفاتورة': 'Print invoice', 'إرسال للمطبخ': 'Send to kitchen', 'تفريغ': 'Clear', 'معالجة الفاتورة': 'Process invoice', 'الخصم': 'Discount', 'الإضافى': 'Extra', 'الكوبون': 'Coupon', 'اختيار العميل': 'Select customer', 'اختيار السائق': 'Select driver', 'حذف': 'Delete', 'تعديل': 'Edit', 'تفعيل/إيقاف': 'Enable/Disable', 'عنصر مخزون جديد': 'New inventory item', 'تعديل مكونات المنتج': 'Edit BOM', 'تغيير الترتيب': 'Reorder',
        'تصدير PDF': 'Export PDF', 'تصدير CSV': 'Export CSV', 'عرض الفاتورة': 'View invoice', 'سداد كامل': 'Settle full', 'عرض الإشعار': 'View credit note', 'عرض الفاتورة': 'View invoice',
        // Sales screen specific
        'فاتورة جديدة': 'New Invoice', '⬅ العودة للغرف': '⬅ Back to Rooms', '🏠 الرئيسية': '🏠 Home', 'إضافة عميل جديد': 'Add new customer',
        'اسم العميل (اختياري)': 'Customer name (optional)', 'الجوال (إلزامي)': 'Mobile (required)', 'الإيميل': 'Email', 'العنوان': 'Address', 'الرقم الضريبي (إن وجد)': 'VAT number (if any)', 'ملاحظات': 'Notes',
        '🧾 طباعة الفاتورة': '🧾 Print invoice', '🖨️ إرسال للمطبخ': '🖨️ Send to kitchen', '🗑️ تفريغ': '🗑️ Clear',
        'رقم فاتورة للمعالجة': 'Invoice no. to process', 'معالجة الفاتورة': 'Process invoice', 'معالجة كامل الفاتورة': 'Process full invoice',
        'المنتج': 'Product', 'العملية': 'Operation', 'السعر': 'Price', 'الكمية': 'Qty', 'الإجمالي': 'Total',
        'ملخص الفاتورة': 'Invoice summary', 'الإجمالي قبل الضريبة': 'Subtotal (before VAT)', 'خصم': 'Discount', 'الإجمالي بعد الخصم (قبل الضريبة)': 'Total after discount (before VAT)', 'رسوم التبغ': 'Tobacco fee', 'ضريبة VAT': 'VAT', 'الإجمالي شامل الضريبة': 'Grand total (incl. VAT)',
        'كوبون': 'Coupon', 'أدخل رمز الكوبون': 'Enter coupon code', 'قيمة الإضافى (قبل الضريبة)': 'Extra amount (before VAT)', 'بدون خصم': 'No discount', 'خصم %': 'Percent discount', 'خصم نقدي': 'Amount discount', 'قيمة الخصم': 'Discount value',
        'المبلغ المدفوع': 'Amount paid', 'اختر عميلًا (اكتب الاسم أو الجوال)': 'Select customer (type name or phone)', '+ عميل جديد': '+ New customer', 'بدون سائق': 'No driver'
      }
    };
    // reverse map for en->ar
    TR.en_to_ar = Object.fromEntries(Object.entries(TR.ar_to_en).map(([a, e]) => [e, a]));

    // Extend translations for more screens/phrases without touching the base map above
    try {
      Object.assign(TR.ar_to_en, {
        'بحث (عميل، جوال، منتج، باركود)': 'Search (Customer, Phone, Product, Barcode)',
        'ابحث بالاسم أو الجوال': 'Search by name or phone',
        'ابحث بالاسم أو الباركود': 'Search by name or barcode',
        '🔍 بحث بالاسم أو الباركود': '🔍 Search by name or barcode',
        'العميل': 'Customer',
        'التخصيص': 'Customization',
        'لا توجد بيانات': 'No data',
        'يرجى إدخال اسم المنتج': 'Please enter product name',
        'لا يمكن أن يكون سعر الشراء أكبر من سعر البيع': 'Purchase price cannot be higher than sale price',
        'تأكيد حذف المنتج': 'Confirm product deletion',
        'تعذر تحميل المنتجات': 'Failed to load products',
        'فشل حفظ ترتيب المنتجات': 'Failed to save products order',
        'تعذر حفظ الترتيب': 'Failed to save order',
        'فشل الحفظ': 'Save failed',
        'تعذر جلب المنتج': 'Failed to fetch product',
        'فشل تحديث الحالة': 'Failed to update status',
        'فشل الحذف': 'Delete failed',
        'فشل قراءة الملف': 'Failed to read file',
        'تعذر إنشاء PDF: ': 'Failed to create PDF: ',
        'تعذر إنشاء CSV: ': 'Failed to create CSV: ',
        'إضافة/تعديل تخصيص': 'Add/Edit customization',
        'العملية (اختياري)': 'Operation (optional)',
        'نوع التخصيص': 'Customization type',
        'سعر نقدي': 'Cash price',
        'خصم نسبة %': 'Percent discount %',
        'القيمة': 'Value',
        'شاشة دفع الفاتورة': 'Invoice payment screen',
        'بحث برقم الفاتورة فقط': 'Search by invoice number only',
        'بحث بالعميل (جوال/اسم/رقم ضريبي)': 'Search by customer (Phone/Name/VAT)',
        'مسح': 'Clear',
        '# الفاتورة': '# Invoice',
        'الجوال': 'Mobile',
        'التاريخ': 'Date',
        'الحالة': 'Status',
        'إجراء': 'Action',
        'تم اختيار:': 'Selected:',
        'فشل التحميل': 'Load failed',
        'فشل الحفظ': 'Save failed',
        'فشل الحذف': 'Delete failed',
        'تعذر التحميل': 'Failed to load',
        'تعذر فتح التعديل': 'Failed to open edit',
        'اختر العميل': 'Select customer',
        'اختر المنتج': 'Select product',
        'أدخل قيمة صحيحة': 'Enter a valid value',
        'اختر العملية': 'Select operation',
        'بدون': 'None',
        'مدير': 'Admin',
        'كاشير': 'Cashier',
        'نشط': 'Active',
        'موقوف': 'Inactive',
        '✓ نشط': '✓ Active',
        '✕ موقوف': '✕ Inactive',
        '🔒 مخفي': '🔒 Hidden',
        'إيقاف': 'Disable',
        'تفعيل': 'Enable',
        'يرجى إدخال اسم المستخدم': 'Please enter username',
        'يرجى إدخال كلمة المرور': 'Please enter password',
        'تعذر تحميل الفواتير': 'Failed to load invoices',
        // Offers & coupons
        'العروض والكوبونات': 'Offers & Coupons',
        'إضافة عرض': 'Add Offer',
        'عرض عام': 'Global Offer',
        'إضافة كوبون': 'Add Coupon',
        'بحث (عرض/كوبون)': 'Search (Offer/Coupon)',
        'العروض على الأصناف': 'Offers on products',
        'الاسم': 'Name',
        'التطبيق': 'Scope',
        'الفترة': 'Period',
        'إجراءات': 'Actions',
        'الرمز': 'Code',
        'اسم/وصف': 'Name/Desc',
        'من تاريخ': 'From date',
        'إلى تاريخ': 'To date',
        'حد أدنى للفاتورة': 'Min invoice total',
        'حد الاستخدام': 'Usage limit',
        'اسم العرض': 'Offer name',
        'وصف اختياري': 'Optional description',
        'ابحث عن صنف لإضافته للعرض': 'Search product to add to offer',
        'لم يتم إضافة أصناف بعد': 'No items added yet',
        'تعديل عرض': 'Edit offer',
        'تعديل كوبون': 'Edit coupon',
        'فشل الإضافة': 'Add failed',
        'فشل التعديل': 'Update failed',
        'فشل ربط المنتجات': 'Failed to link products',
        'حذف العرض؟': 'Delete offer?',
        'يوجد عرض عام بالفعل — احذف العرض الحالي أولاً': 'A global offer already exists — delete the current one first',
        // Offers value labels
        'نسبة %': 'Percent %',
        'نقدي': 'Cash',
        'عام': 'Global',
        'أصناف محددة': 'Selected products',
        // Login page
        'تسجيل الدخول - POS SA': 'Login - POS SA',
        'نظام نقاط البيع - السعودية': 'POS System - Saudi Arabia',
        'سجّل الدخول للمتابعة': 'Sign in to continue',
        'اسم المستخدم': 'Username',
        'كلمة المرور': 'Password',
        'تذكرني': 'Remember me',
        'دخول': 'Login',
        'إعداد الاتصال بالجهاز الرئيسي…': 'Configure connection to primary device…',
        'إعداد الاتصال بالجهاز الرئيسي': 'Configure connection to primary device',
        'إغلاق': 'Close',
        'IP الجهاز الرئيسي': 'Primary device IP',
        'اختبار الاتصال': 'Test connection',
        'حفظ واستخدام': 'Save and use',
        'حسابات محفوظة': 'Saved accounts',
        'تم الاتصال بنجاح': 'Connected successfully',
        'فشل الاتصال': 'Connection failed',
        'يرجى إدخال IP': 'Please enter IP',
        'تعذر الاتصال بالجهاز الرئيسي': 'Failed to connect to primary device',
        'تم الحفظ. يمكنك تسجيل الدخول الآن.': 'Saved. You can log in now.',
        'تعذر الحفظ': 'Failed to save',
        'حدث خطأ أثناء الحفظ': 'An error occurred while saving',
        'تعبئة اسم المستخدم وكلمة المرور': 'Fill username and password',
        'حدث خطأ': 'An error occurred',
        'يرجى إدخال اسم المستخدم وكلمة المرور': 'Please enter username and password'
      }); TR.en_to_ar = Object.fromEntries(Object.entries(TR.ar_to_en).map(([a, e]) => [e, a]));
    } catch (_) { }

    // More UI translations collected from renderer screens
    try {
      Object.assign(TR.ar_to_en, {
        // Users
        'المستخدمون - POS SA': 'Users - POS SA', '👥 إدارة المستخدمين': '👥 Manage users', 'إدارة المستخدمين': 'Manage users', 'العودة': 'Back', 'إضافة مستخدم': 'Add user', '➕ إضافة مستخدم': '➕ Add user', 'تحديث': 'Refresh', '🔄 تحديث': '🔄 Refresh', 'اسم المستخدم': 'Username', 'الاسم الكامل': 'Full name', 'الدور': 'Role', 'عمليات': 'Actions', 'تعديل مستخدم': 'Edit user', 'اتركها فارغة لعدم التغيير': 'Leave empty to keep unchanged', 'حفظ': 'Save', 'إلغاء': 'Cancel', 'تعذر تحميل المستخدمين': 'Failed to load users', 'تعذر جلب المستخدم': 'Failed to fetch user', 'فشل تحديث الحالة': 'Failed to update status', 'تأكيد حذف المستخدم؟': 'Confirm user deletion?',
        // Products
        'المنتجات - POS SA': 'Products - POS SA', 'إدارة المنتجات': 'Manage products', 'تصدير PDF': 'Export PDF', 'تصدير CSV': 'Export CSV', 'كل الحالات': 'All statuses', 'الأحدث': 'Newest', 'ترتيبي المخصص': 'Custom order', 'ترتيبي': 'Custom', 'الاسم (أ-ي)': 'Name (A-Z)', 'السعر ↑': 'Price ↑', 'السعر ↓': 'Price ↓', 'المخزون ↑': 'Stock ↑', 'السعر (تصاعدي)': 'Price (Asc)', 'السعر (تنازلي)': 'Price (Desc)', 'المخزون (أعلى)': 'Stock (High)', 'عدد الصفوف في الصفحة:': 'Rows per page:', 'الكل': 'All', 'الصورة': 'Image', 'الاسم': 'Name', 'الباركود': 'Barcode', 'السعر': 'Price', 'سعر الشراء': 'Purchase price', 'سعر البيع': 'Sale price', 'العمليات وأسعارها': 'Operations & prices', 'المخزون': 'Stock', 'إجمالي الشراء': 'Total purchase', 'إجمالي البيع': 'Total sales', 'صافي الربح': 'Net profit', 'الفئة': 'Category', 'كل الفئات': 'All categories', 'تاريخ الصلاحية': 'Expiry date', 'حفظ ترتيب السطور': 'Save row order', 'اسحب الصفوف لأعلى/أسفل ثم اضغط حفظ': 'Drag rows up/down then click Save', 'إضافة منتج': 'Add product', 'تعديل منتج': 'Edit product', 'إزالة الصورة': 'Remove image', 'اختيار صورة': 'Pick image', 'صورة المنتج': 'Product image', 'الوصف': 'Description', 'اسم المنتج (عربي)': 'Product name (Arabic)', 'اسم المنتج (إنجليزي) - اختياري': 'Product name (English) - optional', 'التكلفة': 'Cost', 'الحد الأدنى لسعر البيع': 'Minimum sale price', 'عمليات المنتج وأسعارها': 'Product operations & prices', 'وحدات البيع': 'Selling units', 'الأصناف (مثال: علبة، كرتونة)': 'Variants (e.g., box, carton)', 'اسم الوحدة (مثال: كرتون)': 'Unit name (e.g., carton)', 'عدد القطع': 'Number of pieces', 'احتساب تلقائي': 'Auto calculate', 'سعر يدوي': 'Manual price', 'اسم الصنف (مثال: علبة)': 'Variant name (e.g., box)', 'التكلفة (اختياري)': 'Cost (optional)', 'خصم المخزون': 'Stock deduction', '➕ إضافة صنف': '➕ Add variant', 'تاريخ انتهاء الصلاحية (اختياري)': 'Expiry date (optional)', 'إخفاء المنتج من شاشة الفاتورة': 'Hide product from invoice screen', '✓ حفظ': '✓ Save', 'تأكيد': 'Confirm', 'موافق': 'OK', 'تطبيق رسوم التبغ؟': 'Apply tobacco fee?', 'لا': 'No', 'نعم': 'Yes',
        // Products page - missing translations
        '🏷️ باركود': '🏷️ Barcode', 'باركود': 'Barcode',
        '📥 استيراد من Excel': '📥 Import from Excel', 'استيراد من Excel': 'Import from Excel',
        '📋 نموذج Excel': '📋 Excel Template', 'نموذج Excel': 'Excel Template',
        '💾 حفظ ترتيب السطور': '💾 Save row order',
        '💡 اسحب الصفوف لأعلى/أسفل ثم اضغط حفظ': '💡 Drag rows up/down then click Save',
        '➕ إضافة': '➕ Add',
        '🧾 PDF': '🧾 PDF',
        '📄 CSV': '📄 CSV',
        '✏️ تعديل': '✏️ Edit',
        '❌ إيقاف': '❌ Disable',
        '✅ تفعيل': '✅ Enable',
        '🗑️ حذف': '🗑️ Delete',
        'طباعة الباركود': 'Print Barcode',
        '✕ إلغاء': '✕ Cancel',
        '🖨️ طباعة': '🖨️ Print',
        'جاري الطباعة...': 'Printing...',
        'إجمالي الشراء:': 'Total purchase:',
        'إجمالي البيع:': 'Total sales:',
        'جاري الاستيراد...': 'Importing...',
        'جاري قراءة الملف...': 'Reading file...',
        'جاري التحميل...': 'Loading...',
        'جاري الحفظ...': 'Saving...',
        // Products page header
        '📦 إدارة المنتجات': '📦 Manage Products',
        // Fullscreen button (injected by preload)
        'ملء الشاشة': 'Fullscreen',
        // Products dialog - add/edit
        'اختر عملية': 'Select operation',
        'اختر النوع الرئيسي': 'Select main type',
        'غير موجود في الأنواع': 'not found in types',
        'تلقائي': 'Auto',
        'يدوي': 'Manual',
        'التسعير': 'Pricing',
        'حفظ التعديل': 'Save edit',
        'شامل الضريبة': 'Incl. VAT',
        'تطبيق رسوم التبغ على هذا المنتج': 'Apply tobacco fee to this product',
        'استثناء هذا الصنف من الضريبة (VAT)': 'Exempt this item from VAT',
        'عدد النسخ': 'Number of copies',
        // Variant validation errors
        'اسم الصنف مطلوب': 'Variant name is required',
        'الباركود مطلوب': 'Barcode is required',
        'السعر يجب أن يكون أكبر من صفر': 'Price must be greater than zero',
        'قيمة خصم المخزون يجب أن تكون أكبر من صفر': 'Stock deduction must be greater than zero',
        'هذا الباركود موجود بالفعل': 'This barcode already exists',
        // Dialog validation errors
        'يرجى إدخال سعر صحيح': 'Please enter a valid price',
        'يرجى إدخال تكلفة صحيحة': 'Please enter a valid cost',
        'يرجى إدخال مخزون صحيح': 'Please enter a valid stock',
        // Confirm/alert dialogs
        'تنبيه': 'Notice',
        'تأكيد حذف المنتج': 'Confirm product deletion',
        'هل أنت متأكد من حذف هذا المنتج نهائياً؟': 'Are you sure you want to permanently delete this product?',
        // Category/operation save buttons
        'يرجى إدخال اسم النوع الرئيسي': 'Please enter main type name',
        'يرجى إدخال اسم العملية': 'Please enter operation name',
        'العمليات - POS SA': 'Operations - POS SA', 'إدارة العمليات': 'Manage operations', 'إضافة عملية': 'Add operation', 'إضافة عملية جديدة': 'Add new operation', 'اسم العملية': 'Operation name', 'أدخل اسم العملية': 'Enter operation name',
        // Categories/Types
        'إضافة نوع رئيسي جديد': 'Add new main type', 'اسم النوع الرئيسي': 'Main type name', 'أدخل اسم النوع الرئيسي': 'Enter main type name',
        // Payments
        'سداد كامل للفاتورة': 'Full invoice settlement', 'طريقة السداد': 'Payment method', 'المبلغ المستلم': 'Amount received', 'سداد وطباعة': 'Settle and print', 'شبكة': 'Network', 'كاش': 'Cash',
        // Purchases
        'المصروفات - POS SA': 'Purchases - POS SA', 'المصروفات': 'Purchases', 'إضافة مصروفات': 'Add purchase', 'آخر 200 عملية مصروفات': 'Last 200 purchase operations', 'تصفية': 'Filter', 'ضريبة؟': 'VAT?', 'الصافي': 'Subtotal', 'الإجمالي': 'Total', 'ملاحظات': 'Notes', 'إضافة/تعديل مصروفات': 'Add/Edit purchase', 'اسم المصروفات': 'Purchase name', 'التاريخ والوقت': 'Date & time', 'تطبيق الضريبة؟': 'Apply VAT?', 'تُطبّق (السعر شامل الضريبة)': 'Apply (price includes VAT)', 'لا تُطبّق': 'Do not apply', 'نسبة الضريبة %': 'VAT percent %', 'يُستخدم فقط عند تطبيق الضريبة': 'Used only when VAT applies', 'التكلفة (سعر الإدخال)': 'Cost (input price)', 'إذا كانت الضريبة مفعّلة فالقيمة المدخلة تُعتبر شاملة الضريبة': 'If VAT is enabled, the entered value is VAT-inclusive', 'طريقة الدفع': 'Payment method', 'تصدير Excel': 'Export Excel',
        // Rooms
        'الغرف - POS SA': 'Rooms - POS SA', 'الغرف': 'Rooms', '+ إضافة غرفة': 'Add room', 'إضافة غرفة': 'Add room', 'القسم (اختياري)': 'Section (optional)', 'السعة': 'Capacity', 'اسم الغرفة': 'Room name',

        // Settings screen
        'الإعدادات - POS SA': 'Settings - POS SA', 'إعدادات النظام': 'System settings', 'تحكم كامل في هوية المتجر، الضرائب، الطباعة والمدفوعات': 'Full control over branding, taxes, printing and payments', '⬅ العودة': '⬅ Back', 'تم الحفظ بنجاح': 'Saved successfully',
        // Company/general
        'البيانات العامة': 'General info', 'معلومات المتجر للتعاملات والفواتير': 'Store information for invoices', 'اسم المبيعات': 'Legal seller name', 'الاسم القانوني المسجل': 'Registered legal name', 'الموقع الإلكتروني': 'Website', 'موقع الشركة (العنوان)': 'Company location (address)', 'الجوال': 'Mobile', 'إرسال التقرير اليومي بالبريد': 'Send daily report by email', 'ملاحظات أسفل الفاتورة': 'Invoice footer note',
        // Daily email modal
        'إعداد إرسال التقرير اليومي': 'Setup daily report email', 'تفعيل الإرسال اليومي': 'Enable daily sending', 'ساعة الإرسال اليومية': 'Daily send time', 'خادم البريد (اختياري)': 'SMTP host (optional)', 'المنفذ': 'Port', 'اتصال آمن (TLS/SSL)': 'Secure connection (TLS/SSL)', 'البريد المرسل': 'Sender email', 'كلمة مرور التطبيقات': 'App password', 'للاستخدام مع Gmail ينصح بمنفذ 587 وبدون Secure، واستخدام كلمة مرور تطبيق.': 'For Gmail, use port 587 without Secure, and an App Password.',
        // Brand & logo
        'الهوية والشعار': 'Brand & logo', 'ارفع شعار المتجر ليظهر في الفواتير والتقارير': 'Upload the store logo to show on invoices and reports', 'اختيار الشعار': 'Pick logo', 'إزالة الشعار': 'Remove logo', 'يفضل صورة مربعة .png أو .jpg بحجم لا يقل عن 256×256 لنتيجة أوضح': 'Prefer a square .png or .jpg at least 256×256 for clearer results', 'عرض الشعار (px)': 'Logo width (px)', 'طول الشعار (px)': 'Logo height (px)',
        // Currency
        'إعدادات العملة': 'Currency settings', 'رمز العملة وموقعه في المبالغ': 'Currency symbol and its position', 'العملة': 'Currency', 'الرمز بعد المبلغ (مثال: 100 ﷼)': 'Symbol after amount (e.g., 100 SAR)', 'الرمز قبل المبلغ (مثال: ﷼ 100)': 'Symbol before amount (e.g., SAR 100)',
        // Tax
        'الضرائب': 'Taxes', 'نسبة الضريبة VAT %': 'VAT percent %', 'الأسعار شاملة الضريبة (حسب السعودية)': 'Prices include VAT (Saudi)', 'الرقم الضريبي (ZATCA)': 'VAT number (ZATCA)', 'نسبة رسوم التبغ %': 'Tobacco fee percent %', 'الحد الأدنى لقيمة رسوم التبغ': 'Minimum tobacco fee amount',
        // Payments
        'طرق الدفع': 'Payment methods', 'تفعيل طرق الدفع والطريقة الافتراضية': 'Enable payment methods and default', 'طرق الدفع المفعّلة': 'Enabled payment methods', 'شبكة (مدى)': 'Network (Mada)', 'مختلط': 'Mixed', 'طريقة الدفع الافتراضية': 'Default payment method', 'بدون افتراضي': 'No default',
        // Print
        'الطباعة': 'Printing', 'نوع الطابعة وخيارات الإخراج': 'Printer type and output options', 'خيارات الطباعة': 'Print options', 'عدد النسخ': 'Number of copies', 'طباعة صامتة': 'Silent print', 'إظهار الباقي': 'Show change',
        // Ops
        'عمليات النظام': 'System operations', 'سلوك الأسعار والمخزون': 'Pricing and inventory behavior', 'السماح بتعديل سعر العملية يدوياً': 'Allow manual operation price', 'السماح ببيع الصنف عندما المخزون = 0': 'Allow selling item when stock = 0', 'السماح بسالب مخزون المكونات (BOM)': 'Allow negative components stock (BOM)', 'إخفاء صور المنتجات في شاشة فاتورة جديدة': 'Hide product images on New Invoice screen', 'ساعة الإقفال اليومية': 'Daily closing hour', 'ستُستخدم لتحديد بداية ونهاية اليوم التقاريري. يتم تصفير التقرير اليومي بعد 24 ساعة من هذا الوقت.': 'Used to determine reporting day start/end. Daily report resets 24 hours after this time.',
        // Recovery
        'استعادة النظام': 'System recovery', 'عمليات خطرة: لا يمكن التراجع عنها': 'Dangerous operations: irreversible', 'حذف الفواتير وإعادة الترقيم': 'Delete invoices and reset numbering', 'حذف كل المنتجات': 'Delete all products', 'حذف كل العملاء': 'Delete all customers',
        // Reports index + shared report strings
        'التقارير': 'Reports', 'الرجوع': 'Back', 'التقرير اليومي': 'Daily report', 'عرض تقرير اليوم اعتمادًا على ساعة الإقفال': 'Show today\'s report based on closing hour', 'تقرير الفترة': 'Period report', 'اختر تاريخ ووقت من — إلى لعرض التقرير': 'Choose date-time from — to to show report', 'تقرير جميع الفواتير': 'All invoices report', 'جلب كل الفواتير لفترة من — إلى مع الإجماليات': 'Fetch all invoices for a period with totals', 'تقرير المصروفات': 'Purchases report', 'حدد الفترة من — إلى لعرض مصروفاتك مع الإجماليات': 'Select period to view purchases with totals', 'تقرير العملاء': 'Customers report', 'فواتير عميل محدد لفترة من — إلى مع الإجماليات': 'Invoices for a specific customer with totals', 'تقرير الفواتير الدائنة': 'Credit invoices report', 'يعرض فواتير الآجل غير المسددة للفترة المحددة': 'Shows unpaid credit invoices for the period', 'تقرير الفواتير غير مدفوعة': 'Unpaid invoices report', 'جلب الفواتير غير المدفوعة للفترة من — إلى': 'Fetch unpaid invoices for the period', 'تقرير الأنواع': 'Types report', 'تجميع المبيعات حسب الأنواع للفترة من — إلى': 'Aggregate sales by types for the period', 'تقرير البلدية': 'Municipality report', 'فواتير برسوم تبغ للفترة المحددة': 'Invoices with tobacco fees for the period',
        // Common report UI
        'من:': 'From:', 'إلى:': 'To:', 'تطبيق': 'Apply', 'نقدي': 'Cash', 'شبكة': 'Network', 'آجل': 'Credit', 'قسيمة': 'Voucher', 'حوالة': 'Transfer', 'الملخص التفصيلي': 'Detailed summary', 'البيان': 'Item', 'قبل الضريبة': 'Pre-VAT', 'رسوم التبغ': 'Tobacco fee', 'الضريبة': 'VAT', 'بعد الضريبة': 'After VAT', 'الصافي': 'Net', 'طرق الدفع': 'Payment methods', 'الطريقة': 'Method', 'الإجمالي': 'Total', 'الإجمالي الكلي': 'Grand total', 'المنتجات المباعة': 'Sold products', 'المنتج': 'Product', 'الكمية': 'Qty', 'المصروفات': 'Purchases', 'البيان': 'Description', 'التاريخ': 'Date', 'ملاحظات': 'Notes', 'الإجمالي:': 'Total:', 'الفواتير': 'Invoices', 'تشمل الفواتير غير الدائنة فقط ضمن الفترة.': 'Includes non-credit invoices only within the period.', 'رقم': 'No.', 'العميل': 'Customer', 'طريقة الدفع': 'Payment method', 'عرض': 'View', 'إشعارات الدائن (المرتجعات)': 'Credit notes (returns)', 'مرتجع/إشعارات دائنة': 'Returns/Credit notes', 'الخصومات': 'Discounts', 'طرق الدفع': 'Payment methods', 'رقم الإشعار': 'Credit note no.', 'القيمة': 'Amount', 'عدد:': 'Count:', 'المجموع:': 'Sum:',
        // Unpaid/All/Credit/Customer invoices report headings
        'تقرير الفواتير غير مدفوعة': 'Unpaid invoices report', 'الإجماليات': 'Totals', 'رقم الفاتورة': 'Invoice no.', 'تاريخ الإنشاء': 'Created at', 'المبلغ': 'Amount', 'تقرير جميع الفواتير': 'All invoices report', 'تقرير الفواتير الدائنة': 'Credit invoices report', 'تقرير العملاء': 'Customers report',
        // Main index
        'الرئيسية - POS SA': 'Home - POS SA', 'الرئيسية': 'Home', 'تسجيل الخروج': 'Log out', 'الصلاحيات': 'Permissions', 'إدارة العملاء': 'Manage customers', 'فاتورة جديدة': 'New Invoice', 'الفواتير': 'Invoices', 'الفواتير الدائنة': 'Credit Notes', 'دفع الفاتورة': 'Payments', 'المنتجات': 'Products', 'الأنواع الرئيسية': 'Main Types', 'العمليات': 'Operations', 'الإعدادات': 'Settings', 'طابعات المطبخ': 'Kitchen Printers', 'المخزون': 'Inventory', 'تخصيص أسعار': 'Customer Pricing', 'السائقون': 'Drivers', 'عرض تقارير المبيعات لاحقًا': 'View sales reports', 'إدارة مستخدمي النظام والأدوار والحالة': 'Manage users, roles and status', 'تحديد صلاحيات المستخدمين': 'Define user permissions', 'إضافة/إدارة العملاء': 'Add/Manage customers', 'بدء عملية بيع': 'Start a sale', 'عرض وإدارة الفواتير': 'View and manage invoices', 'عرض الإشعارات الدائنة منفصلة': 'View credit notes', 'سداد فواتير الآجل بالكامل': 'Settle credit invoices in full', 'إضافة منتج جديد': 'Add new product', 'غرف/طاولات المطعم': 'Restaurant rooms/tables', 'إدارة الأنواع الرئيسية': 'Manage main types', 'معلومات الشركة والضريبة': 'Company and tax info', 'تعريف العمليات وربطها بالمنتجات': 'Define operations and link to products', 'ربط الأقسام بطابعات': 'Link sections to printers', 'إضافة ومراجعة مصروفات': 'Add and review purchases', 'تعريف عناصر المخزون وربطها بالمنتجات': 'Define inventory items and link to products', 'تحديد أسعار/خصومات لعميل': 'Set prices/discounts for a customer', 'عروض على الأصناف وكوبونات خصم': 'Offers on products and coupons', 'تسجيل وإدارة السائقين': 'Register and manage drivers', 'عرض تقارير المبيعات لاحقًا': 'View sales reports',
        // Customers
        'العملاء - POS SA': 'Customers - POS SA', 'العملاء': 'Customers', 'العودة للرئيسية': 'Back to home', 'إضافة عميل': 'Add customer', 'البريد الإلكتروني': 'Email', 'العنوان': 'Address', 'الرقم الضريبي': 'VAT number'
      }); TR.en_to_ar = Object.fromEntries(Object.entries(TR.ar_to_en).map(([a, e]) => [e, a]));
    } catch (_) { }

    // Pattern translations for dynamic strings (Arabic -> English)
    TR.patterns_ar_en = [
      { re: /^صفحة\s+(\d+)\s+من\s+(\d+)\s+\((\d+)\s+منتج\)$/u, to: (_m, a, b, c) => `Page ${a} of ${b} (${c} products)` },
      { re: /^صفحة\s+(\d+)\s+من\s+(\d+)$/u, to: (_m, a, b) => `Page ${a} of ${b}` },
      { re: /^تم اختيار:\s*(.+)$/u, to: (_m, x) => `Selected: ${x}` },
      { re: /^(\d+)\s+\/\s+(\d+)\s+منتج$/u, to: (_m, a, b) => `${a} / ${b} products` }
    ];
    TR.patterns_en_ar = [
      { re: /^Page\s+(\d+)\s+of\s+(\d+)\s+\((\d+)\s+products\)$/u, to: (_m, a, b, c) => `صفحة ${a} من ${b} (${c} منتج)` },
      { re: /^Page\s+(\d+)\s+of\s+(\d+)$/u, to: (_m, a, b) => `صفحة ${a} من ${b}` },
      { re: /^Selected:\s*(.+)$/u, to: (_m, x) => `تم اختيار: ${x}` }
    ];

    let __APP_LANG = 'ar';
    let __translateTimer = null;
    function translateDom(lang) {
      try {
        __APP_LANG = (lang === 'en' ? 'en' : 'ar');
        const url = (location.pathname || '').toLowerCase();
        const isPrint = url.includes('/sales/print') || url.includes('/kitchen/print');
        if (isPrint) return; // always Arabic for print views
        const map = (lang === 'en') ? TR.ar_to_en : Object.fromEntries(Object.entries(TR.ar_to_en).map(([ar, en]) => [en, ar]));
        if (!map) return;
        // Translate document title as well
        try {
          const dt = (document.title || '').trim();
          if (map[dt]) { document.title = map[dt]; }
          else if (lang === 'en' && Array.isArray(TR.patterns_ar_en)) {
            for (const p of TR.patterns_ar_en) { const m = dt.match(p.re); if (m) { document.title = p.to(m, ...m.slice(1)); break; } }
          } else if (lang === 'ar' && Array.isArray(TR.patterns_en_ar)) {
            for (const p of TR.patterns_en_ar) { const m = dt.match(p.re); if (m) { document.title = p.to(m, ...m.slice(1)); break; } }
          }
        } catch (_) { }
        // Walk text nodes and replace exact matches after trim
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        const toChange = [];
        const missing = new Set();
        const isArabic = (s) => /[\u0600-\u06FF]/.test(s);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          // Skip nodes inside elements explicitly locked from auto-translation
          try { const el = node.parentElement || node.parentNode; if (el && el.closest && el.closest('[data-i18n-lock="true"]')) { continue; } } catch (_) { }
          const text = node.nodeValue;
          if (!text) continue;
          const trimmed = text.trim();
          if (!trimmed) continue;
          // Extract emoji/punctuation prefixes/suffixes to improve matching
          const mPrefix = trimmed.match(/^[^\p{L}\p{N}]+/u);
          const mSuffix = trimmed.match(/[^\p{L}\p{N}]+$/u);
          const prefix = mPrefix ? mPrefix[0] : '';
          const suffix = mSuffix ? mSuffix[0] : '';
          const core = trimmed.slice(prefix.length, trimmed.length - suffix.length);
          const tryPatterns = (dir, coreText) => {
            const arr = (dir === 'ar_en') ? TR.patterns_ar_en : TR.patterns_en_ar;
            if (!Array.isArray(arr)) return null;
            for (const p of arr) { const mm = coreText.match(p.re); if (mm) { return prefix + p.to(mm, ...mm.slice(1)) + suffix; } }
            return null;
          };
          if (map[trimmed]) {
            toChange.push({ node, to: map[trimmed] });
          } else if (core && map[core]) {
            toChange.push({ node, to: prefix + map[core] + suffix });
          } else if (lang === 'en') {
            const byPat = tryPatterns('ar_en', core || trimmed);
            if (byPat) { toChange.push({ node, to: byPat }); }
            else if (isArabic(trimmed)) {
              missing.add(trimmed);
            }
          } else if (lang === 'ar') {
            const byPat = tryPatterns('en_ar', core || trimmed);
            if (byPat) { toChange.push({ node, to: byPat }); }
          }
        }
        if (missing.size) {
          try {
            window.__I18N_MISSING = Array.from(new Set([...(window.__I18N_MISSING || []), ...Array.from(missing)]));
            clearTimeout(window.__I18N_LOG_T);
            window.__I18N_LOG_T = setTimeout(() => {
              console.warn('[i18n] Missing Arabic keys for translation:', window.__I18N_MISSING);
            }, 200);
          } catch (_) { }
        }
        for (const { node, to } of toChange) { node.nodeValue = node.nodeValue.replace(node.nodeValue.trim(), to); }
        // Update attributes commonly used on buttons and titles and placeholders
        document.querySelectorAll('[title]').forEach(el => {
          const t = (el.getAttribute('title') || '').trim();
          if (map[t]) el.setAttribute('title', map[t]);
          else if (lang === 'ar' && Array.isArray(TR.patterns_en_ar)) {
            for (const p of TR.patterns_en_ar) { const m = t.match(p.re); if (m) { el.setAttribute('title', p.to(m, ...m.slice(1))); break; } }
          }
        });
        document.querySelectorAll('input[placeholder], textarea[placeholder], select option').forEach(el => {
          const isOption = el.tagName.toLowerCase() === 'option';
          const val = isOption ? (el.textContent || '').trim() : (el.getAttribute('placeholder') || '').trim();
          if (map[val]) {
            if (isOption) { el.textContent = map[val]; }
            else { el.setAttribute('placeholder', map[val]); }
          } else if (lang === 'en' && Array.isArray(TR.patterns_ar_en)) {
            for (const p of TR.patterns_ar_en) {
              const m = val.match(p.re);
              if (m) {
                const newVal = p.to(m, ...m.slice(1));
                if (isOption) { el.textContent = newVal; } else { el.setAttribute('placeholder', newVal); }
                break;
              }
            }
          } else if (lang === 'ar' && Array.isArray(TR.patterns_en_ar)) {
            for (const p of TR.patterns_en_ar) {
              const m = val.match(p.re);
              if (m) {
                const newVal = p.to(m, ...m.slice(1));
                if (isOption) { el.textContent = newVal; } else { el.setAttribute('placeholder', newVal); }
                break;
              }
            }
          }
        });
      } catch (_) { }
    }
    const scheduleTranslate = () => { try { clearTimeout(__translateTimer); } catch (_) { } __translateTimer = setTimeout(() => translateDom(__APP_LANG), 10); };
    // Expose a safe refresh hook on window for renderer calls
    try { window.__i18n_refresh = () => { try { translateDom(__APP_LANG); } catch (_) { } }; } catch (_) { }
    // Small burst helper to catch late DOM injections
    try { window.__i18n_burst = (lang) => { try { translateDom(lang); setTimeout(() => translateDom(lang), 100); setTimeout(() => translateDom(lang), 300); setTimeout(() => translateDom(lang), 800); } catch (_) { } }; } catch (_) { }
    // Observe DOM changes to re-apply translations for dynamic content
    try {
      const obs = new MutationObserver(() => scheduleTranslate());
      obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    } catch (_) { }

    (function () {
      let _ctxMenu = null;
      let _ctxTarget = null;

      function _ctxGetLang() {
        try { return document.documentElement.lang === 'en' ? 'en' : 'ar'; } catch (_) { return 'ar'; }
      }

      function _ctxInit() {
        if (document.getElementById('__pos_ctx_menu')) return;
        const st = document.createElement('style');
        st.textContent = `
          #__pos_ctx_menu{position:fixed;z-index:999999;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.14),0 2px 6px rgba(0,0,0,.07);padding:4px;min-width:140px;display:none;font-family:'Cairo','Segoe UI',sans-serif;user-select:none;animation:__ctx_in .13s ease;}
          @keyframes __ctx_in{from{opacity:0;transform:scale(.95) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}
          #__pos_ctx_menu button{display:flex;align-items:center;gap:9px;width:100%;padding:9px 14px;border:none;background:none;border-radius:7px;cursor:pointer;font-family:inherit;font-size:14px;font-weight:600;color:#1e293b;text-align:start;transition:background .12s,color .12s;}
          #__pos_ctx_menu button:hover{background:#eff6ff;color:#2563eb;}
          #__pos_ctx_menu button svg{width:15px;height:15px;flex-shrink:0;stroke:currentColor;}
          #__pos_ctx_menu hr{border:none;border-top:1px solid #f1f5f9;margin:3px 8px;}
        `;
        document.head.appendChild(st);
        const m = document.createElement('div');
        m.id = '__pos_ctx_menu';
        m.addEventListener('mousedown', (ev) => ev.preventDefault(), true);
        document.body.appendChild(m);
        _ctxMenu = m;
      }

      function _ctxShow(e, el) {
        _ctxInit();
        if (!_ctxMenu) return;
        _ctxTarget = el;
        const ar = _ctxGetLang() === 'ar';
        const copyIco = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
        const pasteIco = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>`;
        _ctxMenu.dir = ar ? 'rtl' : 'ltr';
        _ctxMenu.innerHTML = `
          <button id="__ctx_copy">${copyIco}${ar ? 'نسخ' : 'Copy'}</button>
          <hr/>
          <button id="__ctx_paste">${pasteIco}${ar ? 'لصق' : 'Paste'}</button>`;
        _ctxMenu.style.cssText = `display:block;left:${e.clientX}px;top:${e.clientY}px;`;
        requestAnimationFrame(() => {
          try {
            const r = _ctxMenu.getBoundingClientRect();
            if (r.right > window.innerWidth) _ctxMenu.style.left = (e.clientX - r.width) + 'px';
            if (r.bottom > window.innerHeight) _ctxMenu.style.top = (e.clientY - r.height) + 'px';
          } catch (_) {}
        });
        document.getElementById('__ctx_copy').onclick = _ctxDoCopy;
        document.getElementById('__ctx_paste').onclick = _ctxDoPaste;
      }

      function _ctxHide() { try { if (_ctxMenu) _ctxMenu.style.display = 'none'; } catch (_) {} }

      function _ctxDoCopy() {
        try {
          const el = _ctxTarget;
          _ctxHide();
          let txt = '';
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) txt = el.value.substring(el.selectionStart, el.selectionEnd);
          else txt = (window.getSelection() || '').toString();
          if (txt) ipcRenderer.invoke('clipboard:write', txt).catch(() => {});
        } catch (_) {}
      }

      async function _ctxDoPaste() {
        try {
          const el = _ctxTarget;
          _ctxHide();
          if (!el) return;
          try { el.focus(); } catch (_) {}
          const txt = await ipcRenderer.invoke('clipboard:read');
          if (!txt) return;
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            const s = el.selectionStart || 0, end = el.selectionEnd || 0;
            el.value = el.value.substring(0, s) + txt + el.value.substring(end);
            el.selectionStart = el.selectionEnd = s + txt.length;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (el.isContentEditable) {
            document.execCommand('insertText', false, txt);
          }
        } catch (_) {}
      }

      window.addEventListener('DOMContentLoaded', () => {
        _ctxInit();
        document.addEventListener('contextmenu', (e) => {
          try {
            const el = e.target;
            if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && !el.isContentEditable) { _ctxHide(); return; }
            e.preventDefault();
            try { el.focus(); } catch (_) {}
            _ctxShow(e, el);
          } catch (_) {}
        });
        document.addEventListener('click', (e) => { try { if (_ctxMenu && !_ctxMenu.contains(e.target)) _ctxHide(); } catch (_) {} });
        document.addEventListener('keydown', (e) => { try { if (e.key === 'Escape') _ctxHide(); } catch (_) {} });
        document.addEventListener('scroll', () => _ctxHide(), true);
      });
    })();

    document.addEventListener('DOMContentLoaded', async () => {
      try {
        const url = (location.pathname || '').toLowerCase();
        const isPrint = url.includes('/sales/print') || url.includes('/kitchen/print');
        const isMain = url.includes('/renderer/main/') || url.endsWith('/main/index.html');
        const nav = document.querySelector('header nav, header .header-actions'); // where we inject controls
        // Ensure small beautiful style for global header buttons (same as login)
        try {
          if (nav && !document.getElementById('appGlobalControlsStyles')) {
            const st = document.createElement('style'); st.id = 'appGlobalControlsStyles';
            st.textContent = `
              #appFullscreenToggle, #appBackBtn{
                display:inline-flex; align-items:center; gap:6px;
                width:auto !important; min-width:unset; height:auto;
                padding:8px 12px; border-radius:10px; border:0;
                background: linear-gradient(135deg, #2563eb, #3b82f6); color:#fff;
                font-weight:800; font-size:13px; box-shadow: 0 10px 20px rgba(59,130,246,.24);
                cursor:pointer; user-select:none; transition: transform .08s ease, box-shadow .25s ease, filter .2s ease;
                position: relative; z-index: 2; /* stay above header layout but not fixed */
              }
              #appFullscreenToggle:hover, #appBackBtn:hover{ filter:brightness(1.06); }
              #appFullscreenToggle:active, #appBackBtn:active{ transform: translateY(1px); box-shadow: 0 8px 16px rgba(59,130,246,.22); }
              #appFullscreenToggle .ico, #appBackBtn .ico{ font-size:16px; line-height:1; }
            `;
            document.head.appendChild(st);
          }
        } catch (_) { }
        // Apply initial language from persistent storage
        let initial = 'ar';
        try { const r = await ipcRenderer.invoke('app:get_locale'); initial = (r && r.lang) || 'ar'; } catch (_) { initial = 'ar'; }
        applyDir(initial);
        try { window.__i18n_burst && window.__i18n_burst(initial); } catch (_) { translateDom(initial); }
        // If no header actions (e.g., login screen), inject a floating fullscreen button
        try {
          if (!nav && !isPrint) {
            if (!document.getElementById('loginFsStyles')) {
              const st = document.createElement('style'); st.id = 'loginFsStyles';
              st.textContent = `
                #loginFsBtn{
                  position: fixed; bottom:12px; inset-inline-end:12px; top:auto; z-index: 10000;
                  display:inline-flex; align-items:center; gap:6px;
                  width:auto !important; min-width:unset; height:auto; /* ensure small size */
                  padding:8px 12px; border-radius:10px; border:0;
                  background: linear-gradient(135deg, #2563eb, #3b82f6); color:#fff;
                  font-weight:800; font-size:13px; box-shadow: 0 10px 20px rgba(59,130,246,.24);
                  cursor:pointer; user-select:none; transition: transform .08s ease, box-shadow .25s ease, filter .2s ease;
                }
                #loginFsBtn:hover{ filter:brightness(1.06); }
                #loginFsBtn:active{ transform: translateY(1px); box-shadow: 0 8px 16px rgba(59,130,246,.22); }
                #loginFsBtn .ico{ font-size:16px; line-height:1; }
              `;
              document.head.appendChild(st);
            }
            if (!document.getElementById('loginFsBtn')) {
              const b = document.createElement('button'); b.id = 'loginFsBtn';
              b.type = 'button'; b.setAttribute('aria-label', 'ملء الشاشة');
              b.innerHTML = '<span class="ico">🖵</span><span>ملء الشاشة</span>';
              b.addEventListener('click', async (ev) => { ev.stopPropagation(); try { await ipcRenderer.invoke('window:toggle_fullscreen'); } catch (_) { } });
              document.body.appendChild(b);
              // Ensure hidden on print via CSS too
              const pr = document.createElement('style'); pr.id = 'loginFsPrintHide'; pr.textContent = '@media print{#loginFsBtn{display:none !important}}';
              document.head.appendChild(pr);
            }
          }
        } catch (_) { }
        // Function to ensure language selector exists and stays mounted
        const ensureLangSelector = (langVal) => {
          if (isPrint || !nav) return;
          // Fullscreen toggle button (not on print pages)
          if (!isPrint) {
            let fsBtn = nav.querySelector('#appFullscreenToggle');
            if (!fsBtn) {
              fsBtn = document.createElement('button'); fsBtn.id = 'appFullscreenToggle';
              fsBtn.title = 'ملء الشاشة';
              fsBtn.innerHTML = '<span class="ico">🖵</span><span>ملء الشاشة</span>';
              fsBtn.style.marginInlineStart = '6px';
              fsBtn.addEventListener('click', async () => { try { await ipcRenderer.invoke('window:toggle_fullscreen'); } catch (_) { } });
              try { nav.insertBefore(fsBtn, nav.firstChild); } catch (_) { nav.appendChild(fsBtn); }
            }
          }
          // Back button injection removed - each screen manages its own back button
          // Language selector
          let sel = nav.querySelector('#appLangSelect');
          if (!sel) {
            sel = document.createElement('select'); sel.id = 'appLangSelect';
            sel.style.cssText = 'padding:6px 8px; border:1px solid #e5e7eb; border-radius:8px; background:#fff; margin-inline-start:6px;';
            sel.innerHTML = '<option value="ar">العربية</option><option value="en">English</option>';
            sel.addEventListener('change', async (e) => {
              const v = e.target.value === 'en' ? 'en' : 'ar';
              try { await ipcRenderer.invoke('app:set_locale', { lang: v }); } catch (_) { }
            });
            try { nav.insertBefore(sel, nav.firstChild); } catch (_) { nav.appendChild(sel); }
          }
          if (langVal) { sel.value = (langVal === 'en' ? 'en' : 'ar'); }
        };
        // Inject/ensure selector
        ensureLangSelector(initial);
        // Re-ensure on DOM mutations (لو اختفى بسبب تحديث DOM سنعيد حقنه)
        try {
          const obs2 = new MutationObserver(() => ensureLangSelector(__APP_LANG));
          obs2.observe(document.querySelector('header') || document.body, { childList: true, subtree: true });
        } catch (_) { }
        // Listen for app-wide changes and re-apply dir/lang + translate
        try { ipcRenderer.removeAllListeners('app:locale_changed'); ipcRenderer.on('app:locale_changed', (_ev, L) => { applyDir(L); try { window.__i18n_burst && window.__i18n_burst(L); } catch (_) { translateDom(L); } const sel = document.getElementById('appLangSelect'); if (sel) sel.value = L; }); } catch (_) { }
        // Also ensure initial burst is mirrored to both directions by rebuilding reverse map right after extending
        try { TR.en_to_ar = Object.fromEntries(Object.entries(TR.ar_to_en).map(([ar, en]) => [en, ar])); } catch (_) { }
      } catch (_) { }
    });
  } catch (_) { }
})();

// Auto-apply saved zoom factor on every window load
(function () {
  try {
    const apply = (f) => { try { if (f >= 0.5 && f <= 2.0) webFrame.setZoomFactor(f); } catch (_) {} };
    ipcRenderer.invoke('zoom:get').then(f => apply(f)).catch(() => {});
    ipcRenderer.on('zoom:apply', (_, f) => apply(f));
  } catch (_) {}
})();

contextBridge.exposeInMainWorld('api', {
  login: (username, password) => ipcRenderer.invoke('auth:login', { username, password }),

  // DB config (link to primary)
  db_get_config: () => ipcRenderer.invoke('db:get_config'),
  db_test: (cfg) => ipcRenderer.invoke('db:test', cfg),
  db_apply: (cfg) => ipcRenderer.invoke('db:apply', cfg),

  // Device mode (Primary/Secondary)
  device_get_mode: () => ipcRenderer.invoke('device:get_mode'),
  device_set_mode: (payload) => ipcRenderer.invoke('device:set_mode', payload),

  // Users APIs
  users_list: () => ipcRenderer.invoke('users:list'),
  users_get: (id) => ipcRenderer.invoke('users:get', { id }),
  users_add: (payload) => ipcRenderer.invoke('users:add', payload),
  users_update: (username, payload) => ipcRenderer.invoke('users:update', { username, payload }),
  users_toggle: (id) => ipcRenderer.invoke('users:toggle', { id }),
  users_delete: (id) => ipcRenderer.invoke('users:delete', { id }),
  users_count_active_admins: () => ipcRenderer.invoke('users:count_active_admins'),

  // Permissions APIs
  perms_list_all: () => ipcRenderer.invoke('perms:list_all'),
  perms_get_for_user: (user_id) => ipcRenderer.invoke('perms:get_for_user', { user_id }),
  perms_set_for_user: (user_id, keys) => ipcRenderer.invoke('perms:set_for_user', { user_id, keys }),

  // App-level
  app_quit: () => ipcRenderer.invoke('app:quit'),
  app_relaunch: () => ipcRenderer.invoke('app:relaunch'),
  app_restart: () => ipcRenderer.invoke('app:restart'),
  app_get_locale: () => ipcRenderer.invoke('app:get_locale'),
  app_set_locale: (lang) => ipcRenderer.invoke('app:set_locale', { lang }),
  app_on_locale_changed: (cb) => { try { ipcRenderer.removeAllListeners('app:locale_changed'); } catch (_) { } ipcRenderer.on('app:locale_changed', (_ev, lang) => { try { cb && cb(lang); } catch (_) { } }); },
  show_context_menu: (payload) => ipcRenderer.invoke('context:show', payload),
  window_set_size: (opts) => ipcRenderer.invoke('window:set_size', opts),

  zoom_get: () => ipcRenderer.invoke('zoom:get'),
  zoom_set: (factor) => {
    try { webFrame.setZoomFactor(factor); } catch (_) {}
    return ipcRenderer.invoke('zoom:set', factor);
  },

  // License
  license_check: () => ipcRenderer.invoke('license:check'),
  license_activate: (code) => ipcRenderer.invoke('license:activate', { code }),
  license_reset: () => ipcRenderer.invoke('license:reset'),

  // Saved accounts fallback (userData JSON)
  saved_accounts_get: () => ipcRenderer.invoke('saved_accounts:get'),
  saved_accounts_set: (list) => ipcRenderer.invoke('saved_accounts:set', list),

  // Hardware identifiers (Windows)
  hw_get_baseboard_serial: () => ipcRenderer.invoke('hw:get_baseboard_serial'),
  hw_get_mac_ethernet: () => ipcRenderer.invoke('hw:get_mac_ethernet'),
  hw_get_disk_serial: () => ipcRenderer.invoke('hw:get_disk_serial'),

  // Products
  products_add: (payload) => ipcRenderer.invoke('products:add', payload),
  products_list: (query) => ipcRenderer.invoke('products:list', query),
  products_get: (id) => ipcRenderer.invoke('products:get', { id }),
  products_get_by_barcode: (barcode) => ipcRenderer.invoke('products:get_by_barcode', { barcode }),
  products_mark_barcode_used: (items) => ipcRenderer.invoke('products:mark_barcode_used', items),
  products_get_by_expiry: (params) => ipcRenderer.invoke('products:get_by_expiry', params),
  products_update: (id, payload) => ipcRenderer.invoke('products:update', { id }, payload),
  products_update_price: (id, price) => ipcRenderer.invoke('products:update_price', { id, price }),
  products_toggle: (id) => ipcRenderer.invoke('products:toggle', { id }),
  products_reorder: (ids) => ipcRenderer.invoke('products:reorder', ids),
  products_delete: (id) => ipcRenderer.invoke('products:delete', { id }),
  products_reset_all: () => ipcRenderer.invoke('products:reset_all'),
  products_image_get: (id) => ipcRenderer.invoke('products:image_get', { id }),
  products_images_batch: (ids) => ipcRenderer.invoke('products:images_batch', ids),
  products_read_excel_file: (filePath) => ipcRenderer.invoke('products:read_excel_file', filePath),
  products_import_excel: (excelData) => ipcRenderer.invoke('products:import_excel', excelData),
  products_download_template: () => ipcRenderer.invoke('products:download_template'),
  on_products_import_progress: (cb) => {
    try { ipcRenderer.removeAllListeners('products:import_progress'); } catch (_) { }
    ipcRenderer.on('products:import_progress', (_, data) => cb(data));
  },

  // Product Units
  product_units_list: (product_id) => ipcRenderer.invoke('product_units:list', { id: product_id }),
  product_units_set: (product_id, items) => ipcRenderer.invoke('product_units:set', { id: product_id }, items),

  // Product Variants
  product_variants_list: (product_id) => ipcRenderer.invoke('product_variants:list', product_id),
  product_variants_add: (payload) => ipcRenderer.invoke('product_variants:add', payload),
  product_variants_update: (payload) => ipcRenderer.invoke('product_variants:update', payload),
  product_variants_delete: (id) => ipcRenderer.invoke('product_variants:delete', id),

  // Operations
  ops_list: () => ipcRenderer.invoke('ops:list'),
  ops_add: (payload) => ipcRenderer.invoke('ops:add', payload),
  ops_update: (id, payload) => ipcRenderer.invoke('ops:update', { id }, payload),
  ops_toggle: (id) => ipcRenderer.invoke('ops:toggle', { id }),
  ops_delete: (id) => ipcRenderer.invoke('ops:delete', { id }),
  prod_ops_list: (product_id) => ipcRenderer.invoke('prod_ops:list', { id: product_id }),
  prod_ops_list_batch: (product_ids) => ipcRenderer.invoke('prod_ops:list_batch', product_ids),
  prod_ops_set: (product_id, items) => ipcRenderer.invoke('prod_ops:set', { id: product_id }, items),

  // File dialog + image helpers
  pick_image: () => ipcRenderer.invoke('fs:pick_image'),
  import_image: (srcPath) => ipcRenderer.invoke('fs:import_image', srcPath),
  read_file_base64: (srcPath) => ipcRenderer.invoke('fs:read_file_base64', srcPath),
  resolve_path: (rel) => ipcRenderer.invoke('fs:resolve_path', rel),

  // Settings logo/default product image helpers
  settings_image_get: () => ipcRenderer.invoke('settings:image_get'),
  settings_default_product_image_get: () => ipcRenderer.invoke('settings:default_product_image_get'),

  // System helpers
  open_external: (url) => ipcRenderer.invoke('app:open_external', { url }),
  reveal_file: (absPath) => ipcRenderer.invoke('app:reveal_file', { path: absPath }),

  // PDF export
  pdf_export: (html, options) => ipcRenderer.invoke('pdf:export', { html, options }),
  // File operations
  file_delete: (filePath) => ipcRenderer.invoke('file:delete', filePath),
  // CSV export
  csv_export: (csv, options) => ipcRenderer.invoke('csv:export', { csv, options }),
  // Silent print invoice
  print_invoice_silent: (args) => ipcRenderer.invoke('print:invoice_silent', args),
  // Preview print invoice (hidden BrowserWindow → resize → show)
  print_invoice_preview: (args) => ipcRenderer.invoke('print:invoice_preview', args),
  // Generic HTML print (used for daily report)
  print_html: (html, options) => ipcRenderer.invoke('print:html', { html, options }),
  // Get assets path for font URLs in print
  get_assets_path: () => ipcRenderer.invoke('app:get_assets_path'),

  // Events: subscribe to sales changes
  on_sales_changed: (cb) => {
    try { ipcRenderer.removeAllListeners('sales:changed'); } catch (_) { }
    ipcRenderer.on('sales:changed', (_ev, payload) => { try { cb && cb(payload); } catch (_) { } });
  },
  emit_sales_changed: (payload) => { try { ipcRenderer.send('ui:sales_changed', payload); } catch (_) { } },

  // Products change (refresh product list/stock in UIs)
  on_products_changed: (cb) => {
    try { ipcRenderer.removeAllListeners('products:changed'); } catch (_) { }
    ipcRenderer.on('products:changed', (_ev, payload) => { try { cb && cb(payload); } catch (_) { } });
  },
  emit_products_changed: (payload) => { try { ipcRenderer.send('ui:products_changed', payload); } catch (_) { } },

  // WhatsApp invoice sent notification
  emit_whatsapp_invoice_sent: (payload) => { 
    try { 
      ipcRenderer.send('ui:whatsapp_invoice_sent', payload); 
    } catch (_) { } 
  },

  // Local QR generation via main process
  qr_to_data_url: async (text, opts) => {
    const r = await ipcRenderer.invoke('qr:to_data_url', { text, opts });
    return (r && r.ok) ? r.dataUrl : null;
  },
  qr_to_svg: async (text, opts) => {
    const r = await ipcRenderer.invoke('qr:to_svg', { text, opts });
    return (r && r.ok) ? r.svg : null;
  },

  // Sales
  sales_create: (payload) => ipcRenderer.invoke('sales:create', payload),
  sales_list: (q) => ipcRenderer.invoke('sales:list', q),
  sales_get: (id) => ipcRenderer.invoke('sales:get', { id }),
  sales_has_credit_for_invoice: (q) => ipcRenderer.invoke('sales:has_credit_for_invoice', q),
  sales_list_credit: (q) => ipcRenderer.invoke('sales:list_credit', q),
  sales_list_credit_notes: (q) => ipcRenderer.invoke('sales:list_credit_notes', q),
  sales_settle_full: (payload) => ipcRenderer.invoke('sales:settle_full', payload),
  sales_settle_partial: (payload) => ipcRenderer.invoke('sales:settle_partial', payload),
  sales_get_payments: (saleId) => ipcRenderer.invoke('sales:get_payments', saleId),
  sales_list_payments: (q) => ipcRenderer.invoke('sales:list_payments', q),
  sales_refund_full: (payload) => ipcRenderer.invoke('sales:refund_full', payload),
  sales_refund_partial: (payload) => ipcRenderer.invoke('sales:refund_partial', payload),
  sales_get_refunded_quantities: (saleId) => ipcRenderer.invoke('sales:get_refunded_quantities', saleId),
  sales_reset_all: (options) => ipcRenderer.invoke('sales:reset_all', options),
  sales_items_summary: (q) => ipcRenderer.invoke('sales:items_summary', q),
  sales_items_detailed: (q) => ipcRenderer.invoke('sales:items_detailed', q),
  reports_inventory: (q) => ipcRenderer.invoke('reports:inventory', q),
  sales_list_by_user: (q) => ipcRenderer.invoke('sales:list_by_user', q),
  sales_employee_report: (q) => ipcRenderer.invoke('sales:employee_report', q),

  // Shifts
  shift_get_current: (userId) => ipcRenderer.invoke('shift:get-current', userId),
  shift_get_any_open: () => ipcRenderer.invoke('shift:get-any-open'),
  shift_open: (data) => ipcRenderer.invoke('shift:open', data),
  shift_close: (data) => ipcRenderer.invoke('shift:close', data),
  shift_list: (filters) => ipcRenderer.invoke('shift:list', filters),
  shift_get_by_id: (shiftId) => ipcRenderer.invoke('shift:get-by-id', shiftId),
  shift_get_statistics: (filters) => ipcRenderer.invoke('shift:get-statistics', filters),

  // Purchases
  purchases_add: (payload) => ipcRenderer.invoke('purchases:add', payload),
  purchases_list: (q) => ipcRenderer.invoke('purchases:list', q),
  purchases_update: (id, payload) => ipcRenderer.invoke('purchases:update', { id }, payload),
  purchases_delete: (id) => ipcRenderer.invoke('purchases:delete', { id }),

  // Purchase Invoices
  purchase_invoices_add: (payload) => ipcRenderer.invoke('purchase_invoices:add', payload),
  purchase_invoices_list: (q) => ipcRenderer.invoke('purchase_invoices:list', q),
  purchase_invoices_get: (id) => ipcRenderer.invoke('purchase_invoices:get', { id }),
  purchase_invoices_update: (id, payload) => ipcRenderer.invoke('purchase_invoices:update', { id }, payload),
  purchase_invoices_delete: (id) => ipcRenderer.invoke('purchase_invoices:delete', { id }),
  purchase_invoices_pay: (payload) => ipcRenderer.invoke('purchase_invoices:pay', payload),
  purchase_invoices_get_for_return: (invoiceNo) => ipcRenderer.invoke('purchase_invoices:get_for_return', invoiceNo),
  purchase_invoices_create_return: (payload) => ipcRenderer.invoke('purchase_invoices:create_return', payload),

  // Customers
  customers_add: (payload) => ipcRenderer.invoke('customers:add', payload),
  customers_list: (query) => ipcRenderer.invoke('customers:list', query),
  customers_get: (id) => ipcRenderer.invoke('customers:get', { id }),
  customers_update: (id, payload) => ipcRenderer.invoke('customers:update', { id }, payload),
  customers_toggle: (id) => ipcRenderer.invoke('customers:toggle', { id }),
  customers_delete: (id) => ipcRenderer.invoke('customers:delete', { id }),
  customers_reset_all: () => ipcRenderer.invoke('customers:reset_all'),

  // Appointments
  appointments_add: (payload) => ipcRenderer.invoke('appointments:add', payload),
  appointments_list: (query) => ipcRenderer.invoke('appointments:list', query),
  appointments_get: (id) => ipcRenderer.invoke('appointments:get', id),
  appointments_update: (payload) => ipcRenderer.invoke('appointments:update', payload),
  appointments_delete: (id) => ipcRenderer.invoke('appointments:delete', id),

  // Suppliers
  suppliers_add: (payload) => ipcRenderer.invoke('suppliers:add', payload),
  suppliers_list: (query) => ipcRenderer.invoke('suppliers:list', query),
  suppliers_get: (id) => ipcRenderer.invoke('suppliers:get', { id }),
  suppliers_update: (id, payload) => ipcRenderer.invoke('suppliers:update', { id }, payload),
  suppliers_toggle: (id) => ipcRenderer.invoke('suppliers:toggle', { id }),
  suppliers_delete: (id) => ipcRenderer.invoke('suppliers:delete', { id }),

  // Employees
  employees_add: (payload) => ipcRenderer.invoke('employees:add', payload),
  employees_list: (query) => ipcRenderer.invoke('employees:list', query),
  employees_get: (id) => ipcRenderer.invoke('employees:get', { id }),
  employees_update: (id, payload) => ipcRenderer.invoke('employees:update', { id }, payload),
  employees_delete: (id) => ipcRenderer.invoke('employees:delete', { id }),

  // Main types (categories)
  types_add: (payload) => ipcRenderer.invoke('types:add', payload),
  types_list: () => ipcRenderer.invoke('types:list'),
  types_list_for_display: () => ipcRenderer.invoke('types:list_for_display'),
  types_list_all: () => ipcRenderer.invoke('types:list_all'),
  types_get: (id) => ipcRenderer.invoke('types:get', { id }),
  types_update: (id, payload) => ipcRenderer.invoke('types:update', { id }, payload),
  types_toggle: (id) => ipcRenderer.invoke('types:toggle', { id }),
  types_toggle_hide: (id) => ipcRenderer.invoke('types:toggle_hide', { id }),
  types_delete: (id) => ipcRenderer.invoke('types:delete', { id }),
  types_reorder: (items) => ipcRenderer.invoke('types:reorder', items),

  // Batch init for sales screen (settings + types + products + global_offer in ONE call)
  sales_init: (params) => ipcRenderer.invoke('sales:init', params),

  // Settings
  settings_get: () => ipcRenderer.invoke('settings:get'),
  settings_save: (payload) => ipcRenderer.invoke('settings:save', payload),

  // Branches
  branches_get: () => ipcRenderer.invoke('branches:get'),
  branches_save: (payload) => ipcRenderer.invoke('branches:save', payload),
  branches_delete: (payload) => ipcRenderer.invoke('branches:delete', payload),
  branches_test_connection: (payload) => ipcRenderer.invoke('branches:test_connection', payload),

  // Scheduler
  scheduler_trigger_daily_email: () => ipcRenderer.invoke('scheduler:trigger_daily_email'),
  scheduler_trigger_backup: () => ipcRenderer.invoke('scheduler:trigger_backup'),
  scheduler_send_daily_now: () => ipcRenderer.invoke('scheduler:send_daily_now'),

  // Backup: email database dump (gz)
  backup_email_db: (to) => ipcRenderer.invoke('backup:email_db', { to }),
  // Backup: save database dump locally
  backup_db_local: (dirPath) => ipcRenderer.invoke('backup:db_local', dirPath ? { dirPath } : null),
  backup_pick_dir: () => ipcRenderer.invoke('backup:pick_dir'),

  // Drivers
  drivers_list: (q) => ipcRenderer.invoke('drivers:list', q),
  drivers_add: (payload) => ipcRenderer.invoke('drivers:add', payload),
  drivers_update: (id, payload) => ipcRenderer.invoke('drivers:update', { id }, payload),
  drivers_toggle: (id) => ipcRenderer.invoke('drivers:toggle', { id }),

  // Quotations (عروض الأسعار)
  quotations_generate_number: () => ipcRenderer.invoke('quotations:generate_number'),
  quotations_save: (payload) => ipcRenderer.invoke('quotations:save', payload),
  // Accept optional params: { search, page, pageSize }
  quotations_list: (params) => ipcRenderer.invoke('quotations:list', params || null),
  quotations_get: (id) => ipcRenderer.invoke('quotations:get', id),
  quotations_delete: (id) => ipcRenderer.invoke('quotations:delete', id),
  drivers_delete: (id) => ipcRenderer.invoke('drivers:delete', { id }),
  drivers_get: (id) => ipcRenderer.invoke('drivers:get', { id }),

  // Held Invoices
  held_invoices_list: () => ipcRenderer.invoke('held_invoices:list'),
  held_invoices_add: (payload) => ipcRenderer.invoke('held_invoices:add', payload),
  held_invoices_delete: (db_id) => ipcRenderer.invoke('held_invoices:delete', { db_id }),

  // Kitchen Printers
  kitchen_list: () => ipcRenderer.invoke('kitchen:list'),
  kitchen_add: (payload) => ipcRenderer.invoke('kitchen:add', payload),
  kitchen_update: (id, payload) => ipcRenderer.invoke('kitchen:update', { id }, payload),
  kitchen_delete: (id) => ipcRenderer.invoke('kitchen:delete', { id }),
  kitchen_set_routes: (id, types) => ipcRenderer.invoke('kitchen:set_routes', { id }, types),
  kitchen_test_print: (id) => ipcRenderer.invoke('kitchen:test_print', { id }),
  kitchen_print_order: (payload) => ipcRenderer.invoke('kitchen:print_order', payload),
  kitchen_list_system_printers: () => ipcRenderer.invoke('kitchen:list_system_printers'),

  // Rooms
  rooms_list: (q) => ipcRenderer.invoke('rooms:list', q),
  rooms_add: (payload) => ipcRenderer.invoke('rooms:add', payload),
  rooms_update: (id, payload) => ipcRenderer.invoke('rooms:update', { id }, payload),
  rooms_delete: (id) => ipcRenderer.invoke('rooms:delete', { id }),
  rooms_open_session: (room_id) => ipcRenderer.invoke('rooms:open_session', { id: room_id }),
  rooms_get_session: (room_id) => ipcRenderer.invoke('rooms:get_session', { id: room_id }),
  rooms_save_cart: (room_id, cart, state) => ipcRenderer.invoke('rooms:save_cart', { id: room_id }, cart, state),
  rooms_set_status: (room_id, status) => ipcRenderer.invoke('rooms:set_status', { id: room_id }, status),
  rooms_clear: (room_id) => ipcRenderer.invoke('rooms:clear', { id: room_id }),

  // Inventory + BOM
  inventory_list: (q) => ipcRenderer.invoke('inv:list', q),
  inventory_add: (payload) => ipcRenderer.invoke('inv:add', payload),
  inventory_update: (id, payload) => ipcRenderer.invoke('inv:update', { id }, payload),
  inventory_toggle: (id) => ipcRenderer.invoke('inv:toggle', { id }),
  inventory_delete: (id) => ipcRenderer.invoke('inv:delete', { id }),


  // Customer pricing
  cust_price_list: (q) => ipcRenderer.invoke('cust_price:list', q),
  cust_price_upsert: (payload) => ipcRenderer.invoke('cust_price:upsert', payload),
  cust_price_update: (id, payload) => ipcRenderer.invoke('cust_price:update', { id }, payload),
  cust_price_delete: (id) => ipcRenderer.invoke('cust_price:delete', { id }),
  cust_price_find: (payload) => ipcRenderer.invoke('cust_price:find_price', payload),

  // Offers
  offers_list: (q) => ipcRenderer.invoke('offers:list', q),
  offers_add: (payload) => ipcRenderer.invoke('offers:add', payload),
  offers_update: (id, payload) => ipcRenderer.invoke('offers:update', { id }, payload),
  offers_delete: (id) => ipcRenderer.invoke('offers:delete', { id }),
  offers_toggle: (id) => ipcRenderer.invoke('offers:toggle', { id }),
  offers_set_products: (id, items) => ipcRenderer.invoke('offers:set_products', { id }, items),
  offers_find_for_product: (payload) => ipcRenderer.invoke('offers:find_for_product', payload),
  offers_find_global_active: () => ipcRenderer.invoke('offers:find_global_active'),
  offers_get_products: (id) => ipcRenderer.invoke('offers:get_products', { id }),
  offers_set_excluded_products: (id, items) => ipcRenderer.invoke('offers:set_excluded_products', { id }, items),
  offers_get_excluded_products: (id) => ipcRenderer.invoke('offers:get_excluded_products', { id }),

  // Quantity-based Offers
  offers_qty_list: (q) => ipcRenderer.invoke('offers_qty:list', q),
  offers_qty_add: (payload) => ipcRenderer.invoke('offers_qty:add', payload),
  offers_qty_update: (id, payload) => ipcRenderer.invoke('offers_qty:update', { id }, payload),
  offers_qty_delete: (id) => ipcRenderer.invoke('offers_qty:delete', { id }),
  offers_qty_toggle: (id) => ipcRenderer.invoke('offers_qty:toggle', { id }),
  offers_qty_set_products: (id, items) => ipcRenderer.invoke('offers_qty:set_products', { id }, items),
  offers_qty_get_products: (id) => ipcRenderer.invoke('offers_qty:get_products', { id }),
  offers_qty_find_for_product: (payload) => ipcRenderer.invoke('offers_qty:find_for_product', payload),

  coupons_validate: (payload) => ipcRenderer.invoke('coupons:validate', payload),

  // Coupons
  coupons_list: (q) => ipcRenderer.invoke('coupons:list', q),
  coupons_add: (payload) => ipcRenderer.invoke('coupons:add', payload),
  coupons_update: (id, payload) => ipcRenderer.invoke('coupons:update', { id }, payload),
  coupons_delete: (id) => ipcRenderer.invoke('coupons:delete', { id }),
  coupons_toggle: (id) => ipcRenderer.invoke('coupons:toggle', { id }),

  // Vouchers (سندات القبض والصرف)
  vouchers_create: (data) => ipcRenderer.invoke('vouchers:create', data),
  vouchers_list: (filters) => ipcRenderer.invoke('vouchers:list', filters),
  vouchers_get: (id) => ipcRenderer.invoke('vouchers:get', id),
  vouchers_delete: (id) => ipcRenderer.invoke('vouchers:delete', id),
  vouchers_stats: (filters) => ipcRenderer.invoke('vouchers:stats', filters),
  vouchers_get_next_number: (voucherType) => ipcRenderer.invoke('vouchers:get_next_number', voucherType),

  // WhatsApp APIs
  whatsapp_initialize: () => ipcRenderer.invoke('whatsapp:initialize'),
  whatsapp_get_qr: () => ipcRenderer.invoke('whatsapp:get_qr'),
  whatsapp_status: () => ipcRenderer.invoke('whatsapp:status'),
  whatsapp_send_text: (phone, message) => ipcRenderer.invoke('whatsapp:send_text', phone, message),
  whatsapp_send_file: (phone, filePath, filename, caption) => 
    ipcRenderer.invoke('whatsapp:send_file', phone, filePath, filename, caption),
  whatsapp_disconnect: () => ipcRenderer.invoke('whatsapp:disconnect'),
  whatsapp_logout: () => ipcRenderer.invoke('whatsapp:logout'),
  whatsapp_get_messages_stats: () => ipcRenderer.invoke('whatsapp:get_messages_stats'),
  whatsapp_update_messages_limit: (limit) => ipcRenderer.invoke('whatsapp:update_messages_limit', limit),
  whatsapp_reset_messages_count: () => ipcRenderer.invoke('whatsapp:reset_messages_count'),

  // Customer Display APIs
  customer_display_list_ports:  ()             => ipcRenderer.invoke('customer-display:list-ports'),
  customer_display_status:      ()             => ipcRenderer.invoke('customer-display:status'),
  customer_display_reinit:      ()             => ipcRenderer.invoke('customer-display:reinit'),
  customer_display_welcome:     (msg)          => ipcRenderer.invoke('customer-display:welcome', msg),
  customer_display_show_welcome: (msg)         => ipcRenderer.invoke('customer-display:welcome', msg),
  customer_display_show_item:   (name, price, currency) => ipcRenderer.invoke('customer-display:item', name, price, currency),
  customer_display_show_total:  (data)         => ipcRenderer.invoke('customer-display:total', data && data.total != null ? data.total : data, data && data.currency ? data.currency : undefined),
  customer_display_thankyou:    (msg)          => ipcRenderer.invoke('customer-display:thankyou', msg),
  customer_display_show_thank:  (msg)          => ipcRenderer.invoke('customer-display:thankyou', msg),
  customer_display_clear:       ()             => ipcRenderer.invoke('customer-display:clear'),
  customer_display_test:        ()             => ipcRenderer.invoke('customer-display:test'),
  customer_display_connect:     ()             => ipcRenderer.invoke('customer_display:connect'),
  customer_display_disconnect:  ()             => ipcRenderer.invoke('customer_display:disconnect'),
  customer_display_send_text:   (text)         => ipcRenderer.invoke('customer_display:send_text', text),

  // ─── Batch screen-init calls (reduce round-trips, fast screen open) ───
  screen_init_invoices:  ()       => ipcRenderer.invoke('screen:init:invoices'),
  screen_init_customers: ()       => ipcRenderer.invoke('screen:init:customers'),
  screen_init_products:  ()       => ipcRenderer.invoke('screen:init:products'),
  screen_init_shifts:    (params) => ipcRenderer.invoke('screen:init:shifts', params),
  sales_init:            (params) => ipcRenderer.invoke('sales:init', params),

  // Generic invoke method for any IPC handler
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  
  // Event listener registration
  on: (channel, callback) => {
    const listener = (_event, ...args) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});

// ZATCA Electronic Invoice APIs
contextBridge.exposeInMainWorld('electronAPI', {
  zatca: {
    // إعدادات ZATCA
    getConfig: () => ipcRenderer.invoke('zatca:getConfig'),
    saveConfig: (config) => ipcRenderer.invoke('zatca:saveConfig', config),

    // إدارة الشهادات
    generateCSR: (data) => ipcRenderer.invoke('zatca:generateCSR', data),
    submitCSR: (csr, otp) => ipcRenderer.invoke('zatca:submitCSR', csr, otp),
    installCertificate: (certData) => ipcRenderer.invoke('zatca:installCertificate', certData),

    // الفواتير الإلكترونية
    generateInvoice: (invoiceData) => ipcRenderer.invoke('zatca:generateInvoice', invoiceData),
    signInvoice: (invoiceXML) => ipcRenderer.invoke('zatca:signInvoice', invoiceXML),
    submitInvoice: (signedInvoice) => ipcRenderer.invoke('zatca:submitInvoice', signedInvoice),

    // تقارير الامتثال
    complianceCheck: (invoiceData) => ipcRenderer.invoke('zatca:complianceCheck', invoiceData),
    getComplianceReport: () => ipcRenderer.invoke('zatca:getComplianceReport'),

    // التكامل مع المبيعات
    generateForSale: (saleData) => ipcRenderer.invoke('sales:zatca_generate', saleData),
    submitForSale: (invoiceData) => ipcRenderer.invoke('sales:zatca_submit', invoiceData),
    getSalesStatus: () => ipcRenderer.invoke('sales:zatca_status'),
    updateSaleZatcaData: (payload) => ipcRenderer.invoke('sales:update_zatca_data', payload)
  },

  navigation: {
    goTo: (page) => ipcRenderer.invoke('navigation:goTo', page)
  },
  
  // Local bridge to submit invoice to your backend
  localZatca: {
    // Option A: submit by sale_id (server builds body)
    submitBySaleId: async (sale_id) => {
      try {
        const res = await ipcRenderer.invoke('zatca:submitLocal', { sale_id });
        if (!res || res.success !== true) {
          const detail = res && (res.message || res.error || res.data) || 'Unknown error';
          throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
        }
        return res;
      } catch (e) {
        // Bubble up rich error to renderer for clear display
        throw new Error('فشل الإرسال: ' + (e && e.message || String(e)));
      }
    },
    // Option B: submit with explicit body payload (exact structure you provided)
    submitWithBody: async (body) => {
      try {
        const res = await ipcRenderer.invoke('zatca:submitLocal', { body });
        if (!res || res.success !== true) {
          const detail = res && (res.message || res.error || res.data) || 'Unknown error';
          throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
        }
        return res;
      } catch (e) {
        throw new Error('فشل الإرسال: ' + (e && e.message || String(e)));
      }
    }
  }
});