# Data Model: الربط المباشر مع ZATCA في الكاشير

المخطط منقول من المغاسل (`database/db.js:migrateZatcaSettings`) مع إضافة `integration_mode` وتكييف أسماء مستندات الكاشير. كل الهجرات idempotent بنمط `ADD COLUMN ... catch(()=>{})` المتبع في المشروعين.

## جدول `zatca_settings` (صف وحيد id=1) — جديد في الكاشير

### وضع التكامل (جديد — غير موجود في المغاسل)

| العمود | النوع | ملاحظات |
|---|---|---|
| `integration_mode` | ENUM('unlinked','legacy','direct') NOT NULL DEFAULT 'unlinked' | يُحسب مرة واحدة عند الهجرة: `app_settings.zatca_enabled=1` → 'legacy'، وإلا 'unlinked'. يصبح 'direct' فقط عند نجاح شهادة الإنتاج بقرار مستخدم. لا يتغير تلقائيًا أبدًا |

### بيانات المنشأة والعنوان الوطني

`company_name`, `vat_number` (15 رقمًا يبدأ وينتهي بـ3), `commercial_registration`, `business_category` (default 'Supply activities'), `branch_name`, `email`, `street`, `building`, `city` (default 'الرياض'), `postal_code`, `district`, `send_start_date DATE NULL` — كما في المغاسل حرفيًا. تُعبّأ افتراضيًا من `app_settings.seller_legal_name/seller_vat_number/commercial_register` عند أول فتح للشاشة.

### حالة التهيئة والشهادات (كما في المغاسل)

| العمود | النوع |
|---|---|
| `environment` | ENUM('sandbox','simulation','production') DEFAULT 'sandbox' |
| `onboarding_status` | VARCHAR(30) DEFAULT 'not_started' |
| `egs_serial_number` | VARCHAR(200) |
| `private_key_enc`, `compliance_token_enc`, `compliance_secret_enc`, `production_token_enc`, `production_secret_enc` | LONGTEXT — مشفرة AES-256-GCM (`iv:tag:cipher` base64) |
| `public_key_pem`, `csr_pem`, `production_certificate_pem` | LONGTEXT صريحة |
| `compliance_request_id` | VARCHAR(200) |
| `certificate_expires_at` | DATETIME |
| `current_icv` | BIGINT UNSIGNED DEFAULT 0 |
| `current_pih` | VARCHAR(255) NULL |
| `last_tested_at` | DATETIME |
| `vault_key` | VARCHAR(100) — يولَّد مرة واحدة (32 بايت base64) |

**انتقالات `onboarding_status`**:
`not_started → csr_generated → compliance_issued → compliance_passed → production_ready`
- توليد CSR جديد يعيد الحالة إلى `csr_generated` ويمسح كل الشهادات/الرموز (مفتاح جديد).
- تغيير البيئة أثناء توليد CSR يصفّر `current_icv=0` و`current_pih=NULL`.

## جدول `zatca_submissions` — جديد في الكاشير (نسخة المغاسل مع تكييف document_type)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | BIGINT UNSIGNED AI PK | |
| `document_type` | ENUM('sale','credit_note') | المغاسل: ('order','credit_note') — هنا كلاهما صف في `sales` مميز بـ`doc_type` |
| `document_id` | INT | `sales.id` |
| `invoice_kind` | ENUM('simplified','standard') | |
| `submission_type` | ENUM('REPORTING','CLEARANCE') | |
| `uuid` | VARCHAR(100) UNIQUE | يولَّد مرة ويُثبت قبل الإرسال (منع الازدواج FR-017) |
| `icv` | BIGINT UNSIGNED | يُحجز ذرّيًا من `zatca_settings.current_icv` |
| `previous_invoice_hash` | VARCHAR(255) | PIH المستخدم فعلًا |
| `invoice_hash` | VARCHAR(255) NULL | بعد التوقيع |
| `qr_code` | LONGTEXT | TLV المرحلة 2 |
| `signed_xml`, `cleared_xml` | LONGTEXT | |
| `status` | VARCHAR(30) DEFAULT 'pending' | pending / reported / cleared / accepted_with_warnings / rejected |
| `attempts` | INT UNSIGNED DEFAULT 0 | |
| `next_attempt_at` | DATETIME NULL | backoff: `min(360, 2^attempts)` دقيقة |
| `http_status` | INT | |
| `warnings_json`, `errors_json` | JSON | |
| `response_json` | LONGTEXT | |
| `created_at`, `updated_at` | DATETIME | |

**قيود**: `UNIQUE(document_type, document_id)`, `UNIQUE(uuid)`, `KEY(status, next_attempt_at)`.

**دورة حياة السجل**: يُنشأ (uuid+icv+pih محجوزة) قبل أول محاولة → عند القبول يُحدَّث status/hash/qr/xml ويُرفَّع `zatca_settings.current_pih` → عند خطأ شبكي يبقى pending مع attempts++ وnext_attempt_at → عند رفض بيانات status='rejected' (لا يعيد المجدول إرساله؛ يدويًا فقط بعد التصحيح).

## جداول موجودة — تعديلات

### `sales` (موجود — بلا تغيير بنيوي)

أعمدة `zatca_uuid`, `zatca_hash`, `zatca_qr`, `zatca_submitted`, `zatca_status`, `zatca_rejection_reason`, `zatca_response` موجودة أصلًا ويكتب فيها الوضع القديم. الوضع المباشر يكتب فيها ملخصًا متوافقًا (uuid/hash/qr/submitted/status/سبب الرفض) حتى تعمل شاشات الفواتير وتقرير ZATCA الحالية دون تعديل.

### `customers` (موجود — إضافة أعمدة عنوان ZATCA بنمط المغاسل)

الأعمدة الحالية (`address`, `national_address`, `postal_code`, `street_number`, `sub_number`) لا تكفي لحقول UBL الإلزامية لفاتورة standard. تُضاف — كما فعلت المغاسل على جدول عملائها — الأعمدة:

| عمود جديد | النوع | حقل UBL |
|---|---|---|
| `zatca_street` | VARCHAR(200) NULL | street |
| `zatca_building` | VARCHAR(20) NULL | building |
| `zatca_district` | VARCHAR(120) NULL | district |
| `zatca_city` | VARCHAR(100) NULL | city |

**تعيين UBL الصريح لعميل standard**: street=`zatca_street`، building=`zatca_building`، district=`zatca_district`، city=`zatca_city`، postalCode=`customers.postal_code` (الموجود)، countryCode='SA'، vatNumber=`customers.vat_number`. أي حقل منها فارغ → رفض قبل الإرسال (وقبل استهلاك ICV) برسالة "العنوان النظامي لعميل الشركة غير مكتمل". الأعمدة القديمة تبقى للعرض/الطباعة كما هي، وشاشة العميل تعبّئ حقول ZATCA الجديدة.

### `app_settings` (موجود — بلا تغيير)

`zatca_enabled` يبقى مفتاح الوضع القديم كما هو. لا أعمدة جديدة هنا.

## كيانات المواصفة → الجداول

- **إعدادات الربط المباشر** → `zatca_settings`
- **سجل إرسال المستند** → `zatca_submissions` (+ ملخص في `sales.zatca_*`)
- **وضع الربط للجهاز** → `zatca_settings.integration_mode`
