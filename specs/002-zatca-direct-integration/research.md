# Research: نقل الربط المباشر من المغاسل إلى الكاشير

**Date**: 2026-07-14 — كل النتائج أدناه من فحص فعلي للكودين.

## R1: آلية المغاسل المرجعية (ما الذي يُنقل حرفيًا)

**Decision**: نسخ الملفات الستة `server/services/zatca/{index,vault,onboarding,mapper,directService,queue}.js` من المغاسل مع أدنى تكييف (مصدر DB ومسميات الحقول فقط).

**Rationale**: المنظومة مثبتة في الإنتاج وتغطي كل التفاصيل الدقيقة التي كلفت إصلاحات سابقة:
- ProfileID دائمًا `reporting:1.0` (BT-23) والمخالصة تُشار بـ type-code name `0100000`.
- حقن `cac:Delivery/ActualDeliveryDate` (KSA-5) للفواتير الضريبية لأن المكتبة لا تصدره.
- sandbox يستخدم رقم الهيئة التجريبي `399999999900003` مع بقاء الرقم الحقيقي محفوظًا.
- اختيار شهادة التوقيع بمطابقة المفتاح العام (الشهادة الإنتاجية للـ sandbox لا تطابق المفتاح).
- التوقيت المحلي وليس UTC في issueDate/issueTime.
- منع الإرسال بنسبة ضريبة 0% ومنع مستند بلا بنود (BR-16).
- سلسلة promise تسلسلية تحفظ ترتيب ICV/PIH، وbackoff `min(360, 2^attempts)` دقيقة.
- تصنيف retryable: `API_CONN_ERR|API_TIMEOUT_ERR|ZATCA_CHAIN_BUSY|429|HTTP_5xx|timed out|connection failed`.

**Alternatives considered**: مكتبات أخرى (zatca-xml-js وغيرها) أو إعادة كتابة — مرفوضة؛ الشرط "نفس المغاسل بالظبط".

## R2: تعريف الوضع القديم في الكاشير وكشفه بعد الترقية

**الوضع القديم كما هو في الكود**: `app_settings.zatca_enabled=1` → عند كل حفظ فاتورة `sales.js:autoSubmitZatcaIfEnabled` يستدعي `LocalZatcaBridge.submitSaleById` (POST form إلى `http://localhost:8080/zatca_2/api/customerInvoice/submitInvoice` أو ما يحدده `.zatca-config.json` في userData)، و`scheduler.js:submitUnsentInvoicesHourly` يعيد إرسال غير المرسل كل ساعة. النتائج تُكتب في `sales.zatca_uuid/hash/qr/submitted/status/rejection_reason/response`.

**Decision (قاعدة الكشف)**: عند تهيئة `zatca_settings` (id=1) الجديدة يُحسب `integration_mode` مرة واحدة:
- إن كانت `app_settings.zatca_enabled=1` → `'legacy'`.
- غير ذلك → `'unlinked'`.
- القيمة `'direct'` لا تُكتب إلا عند اكتمال `requestProductionCsid` بنجاح (قرار مستخدم صريح).
- لا يوجد أي مسار كود يحول `legacy → direct` تلقائيًا؛ الانتقال حصراً عبر شاشة الربط المباشر بعد تأكيد صريح.
- `zatca_enabled` القديم يبقى مصدر الحقيقة لتفعيل الإرسال في الوضع القديم — لا يُعاد استخدامه للوضع المباشر (الوضع المباشر يفعّل بـ `onboarding_status='production_ready'` + `integration_mode='direct'`).

**Rationale**: صفر تغيير على بيانات أو سلوك الأجهزة القديمة؛ الحقل الجديد إضافي فقط.

## R3: فروق نموذج بيانات الكاشير عن المغاسل (نطاق تكييف mapper)

| المغاسل | الكاشير | التعامل |
|---|---|---|
| `orders` + `order_items` | `sales` (doc_type='invoice') + `sale_items` | mapper يقرأ من sales/sale_items |
| `credit_notes` جدول مستقل | `sales` بـ `doc_type='credit_note'` | mapCreditNote يقرأ من sales مع مرجع الفاتورة الأصلية |
| `invoice_seq` | `invoice_no` | invoiceNumber = invoice_no |
| `zatca_settings.company_name/vat_number...` تُدخل في شاشة ZATCA | الكاشير عنده `app_settings.seller_legal_name/seller_vat_number/commercial_register` | شاشة الربط الجديدة تعبّئ افتراضيًا من `app_settings` وتخزن نسخة في `zatca_settings` (مصدر حقيقة الربط، كما في المغاسل) |
| `price_display_mode` على الطلب | إعداد أسعار شامل/غير شامل في إعدادات الكاشير + أعمدة sub_total/vat_total/grand_total محفوظة | mapper الكاشير يبني البنود من sale_items ويطبّق نفس منطق divisor، وشبكة الأمان تطابق `grand_total` (tolerance 0.1) |
| `extra_amount` | `extra_value` | بند مستقل "رسوم إضافية" بنفس المنطق |
| عنوان عميل الشركة `customers.zatca_street...` | `customers` فيه vat_number/cr_number/postal_code/street_number/national_address... | فاتورة standard تتطلب اكتمال عنوان العميل؛ نستخدم أعمدة الكاشير الحالية وإلا رسالة "العنوان النظامي لعميل الشركة غير مكتمل" |
| الدفع المختلط | جداول دفع الكاشير | لا يؤثر على UBL (المجاميع فقط)؛ يبقى خارج mapper |

## R4: التخزين والتشفير

**Decision**: نفس نمط المغاسل حرفيًا — `vault_key` (32 بايت base64) يولَّد مرة واحدة ويُخزن في `zatca_settings`، والأسرار (private key، tokens، secrets) AES-256-GCM بصيغة `iv:tag:cipher` base64. النسخة الاحتياطية لقاعدة البيانات تكفي وحدها للانتقال لجهاز جديد.

**Alternatives**: Electron safeStorage / DPAPI — مرفوض: يكسر قابلية النقل بنسخة DB وحدها ويخالف المرجع.

## R5: نقاط الإرسال والتزامن

**Decision**: `router.js` واجهة وحيدة: `submitSale(saleId)`, `retryUnsent(limit)`, `getMode()`. sales.js وscheduler.js يستدعيانها. عند legacy تفوض حرفيًا للكود القديم (نفس الاستدعاءات الحالية)، وعند direct تمر عبر queue. عند `unlinked` لا شيء.

كتابة مزدوجة عند direct: تفاصيل الإرسال الكاملة في `zatca_submissions` (المصدر المعتمد للسلسلة)، وملخص الحالة في `sales.zatca_*` حتى تعمل شاشات الفواتير/تقرير ZATCA الحالية بلا تعديل جوهري.

## R6: الأجهزة الثانوية

الكاشير يدعم أجهزة ثانوية عبر REST قراءة فقط + تمرير المبيعات للجهاز الرئيسي. الإرسال للهيئة يحدث حيث تُحفظ الفاتورة (الجهاز الرئيسي). لا عمل إضافي مطلوب سوى أن شاشة الربط المباشر تُعطَّل على الأجهزة الثانوية (`isSecondaryDevice`).

## R7: المهام المجدولة

المغاسل تشغل retryEligibleOrders دوريًا عبر invokeHandlers/scheduler. الكاشير لديه `submitUnsentInvoicesHourly` كل ساعة — تُعمَّم لتستدعي router (فتخدم الوضعين) بنفس الإيقاع، مع إبقاء منطق `sendFromDate`: القديم من `.zatca-config.json`، والمباشر من `zatca_settings.send_start_date` (نفس حقل المغاسل).

## قرارات إضافية

- **إشعار المدين**: خارج نطاق الإرسال التشغيلي (لا يوجد تدفق له في الكاشير) لكنه ضمن اختبارات الامتثال الستة أثناء الربط — تُنفذ كما في المرجع.
- **EGS serial**: `1-PLUSCashier|2-POS|3-<uuid>` (يختلف الاسم فقط عن المغاسل).
- **تبديل البيئة**: نفس المرجع — تغيير البيئة عند توليد CSR جديد يصفّر ICV/PIH ويمسح الشهادات القديمة.
- **إصدار المكتبة**: تثبيت `@talha7k/zatca@0.11.1` بالضبط (نفس المغاسل) لتطابق السلوك، بما فيه الحقن اليدوي لـ KSA-5.
