# Data Model: Cashier Web Migration (Phase 1)

**قاعدة البيانات**: `cashier_db` (MySQL 5.7+، UTF8MB4) — **تُستخدم كما هي بدون أي تعديل**. لا جداول جديدة ولا أعمدة جديدة ولا migrations. المصدر الوحيد للحقيقة عن البنية هو كود `cashier/src/main/*.js` (دوال `ensureTables()`) الذي أنشأ الجداول فعليًا.

## قاعدة إلزامية

- تطبيق الويب **لا ينفّذ** `CREATE TABLE` / `ALTER TABLE` من تلقاء نفسه؛ عند نقل وحدة تحتوي `ensureTables()` تُنقل الدالة كما هي (فهي `IF NOT EXISTS` وغير مؤذية على قاعدة قائمة) لكن يُمنع إضافة أي تغيير بنيوي جديد فيها.
- كل SQL بـ placeholders (`?`) حصريًا.
- الاتصال عبر نسخة منقولة من `connection.js` + `db-adapter.js` بنفس pool والمعاملات.

## الكيانات الرئيسية (كما هي في القاعدة الحالية)

| الكيان | الجداول الأساسية | ملاحظات نقل |
|---|---|---|
| المستخدمون والصلاحيات | `users`, `permissions`, `user_permissions` | نفس منطق bcrypt/plain-text في auth؛ مفاتيح `module.action`؛ junction PK مركب |
| المنتجات | `products`, وحدات/متغيرات/عمليات المنتج | `barcode` مفهرس؛ الصور: `image_blob` أولًا ثم `image_path`؛ `price` و`price_with_vat` يبقيان متزامنين |
| المبيعات | `sales`, `sales_items`, `payment_transactions` | snapshot بيانات العميل داخل `sales` إلزامي؛ `doc_type` (فاتورة/credit_note/عرض سعر)؛ تسلسل الفواتير عبر `invoice-sequence` وجداول العدادات داخل معاملة |
| الورديات | جداول الورديات (`shifts` وملحقاتها) | لا بيع بدون وردية مفتوحة؛ الوردية المغلقة لا تُفتح؛ `cash_difference = closing_cash - expected_cash` |
| العملاء | `customers`, تسعير العملاء الخاص | `balance` = المديونية؛ الدفعات الجزئية تحدّث `sales.remaining_amount` و`customers.balance` ذريًا |
| الموردون والمشتريات | `suppliers`, `purchase_invoices`, `purchase_invoice_details`, طلبات الشراء | cascade على التفاصيل |
| السندات والمدفوعات | جداول vouchers / payments | كما في الأصل |
| الموظفون/السائقون/المواعيد | جداول employees, drivers, appointments | مع تنبيهات المواعيد (scheduler على الخادم) |
| العروض والكوبونات | جداول offers/coupons | ترتيب الخصم: تسعير عميل ← محرك العروض ← كوبون |
| ZATCA | أعمدة `sales.zatca_*` + إعدادات | الإرسال غير متزامن + إعادة المحاولة بالمجدول |
| الإعدادات | `app_settings`, `app_counters`, `app_state` | VAT من `app_settings.vat_percent` دائمًا؛ عدّاد رسائل واتساب وحدّه |
| الفواتير المعلّقة | جدول held invoices | كما في الأصل |

## حالة جديدة خاصة بالويب (بدون تغيير في `cashier_db`)

- **جلسات الويب**: تُخزن في ذاكرة الخادم (express-session) في المرحلة الأولى. إن احتجنا ثباتًا عبر إعادة التشغيل، يُستخدم مخزن جلسات في **قاعدة/جدول منفصل خاص بالويب فقط** بعد موافقة المستخدم — ولا يُضاف أي جدول إلى بنية الأعمال الحالية دون ضرورة واتفاق.
- **إعدادات تشغيل الويب** (منفذ، بيانات الاتصال): ملف `.env` داخل `cashier-web` — لا تُخزن في القاعدة.

## قواعد الانتقالات (منقولة كما هي من الدستور §13)

- تدفق إنشاء الفاتورة: وردية ← تحقق البنود ← الخصومات بالترتيب ← snapshot العميل ← إدراج `sales`+`sales_items` بمعاملة واحدة ← `payment_transactions` ← خصم المخزون ← ZATCA غير متزامن ← بث `ui:sales_changed`.
- المرتجع: صف `sales` جديد بـ `doc_type='credit_note'` و`ref_base_sale_id`، إرجاع المخزون، تحديث حالة سداد الأصل.
