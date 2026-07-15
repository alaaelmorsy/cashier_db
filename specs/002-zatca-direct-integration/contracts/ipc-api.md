# IPC Contracts: الربط المباشر مع ZATCA

كل القنوات handlers في عملية main، تُكشف للواجهة عبر `preload.js` تحت `window.api.zatcaDirect.*` (contextIsolation). كل الردود بالشكل `{ success: boolean, message?: string(عربية), ...payload }`. القنوات مطابقة وظيفيًا لـ invokeHandlers في المغاسل.

## التهيئة (Onboarding)

| القناة | الطلب | الرد الناجح |
|---|---|---|
| `zatca-direct:get-status` | — | `{ success, mode: 'unlinked'\|'legacy'\|'direct', environment, status, egsSerialNumber, certificateExpiresAt, certificateExpired, certificateExpiresSoon, certificateDaysLeft, currentIcv, lastTestedAt, counts: { sent, pending, rejected } }` |
| `zatca-direct:get-settings` | — | `{ success, settings }` — بيانات المنشأة/العنوان (بلا أسرار إطلاقًا)، مع تعبئة افتراضية من app_settings عند الفراغ |
| `zatca-direct:save-settings` | `{ companyName, vatNumber, commercialRegistration, businessCategory?, branchName?, email?, address: { street, building, city, postalCode, district }, sendStartDate? }` | `{ success }` — تحقق: VAT 15 رقمًا يبدأ/ينتهي بـ3 |
| `zatca-direct:generate-csr` | `{ environment: 'sandbox'\|'simulation'\|'production', egsSerialNumber? }` | `{ success, environment, egsSerialNumber, csr }` — يمسح الشهادات السابقة؛ تغيير البيئة يصفّر ICV/PIH |
| `zatca-direct:request-compliance-csid` | `{ otp: string }` | `{ success, requestId }` |
| `zatca-direct:run-compliance-checks` | — | `{ success, checks: [{ checkType, valid, messages[] }] }` — الفحوص الستة تسلسليًا؛ يتوقف عند أول فشل |
| `zatca-direct:request-production-csid` | — | `{ success, expiresAt }` — عند النجاح يضبط `integration_mode='direct'` (بعد تأكيد المستخدم إن كان الجهاز legacy) |
| `zatca-direct:set-mode` | `{ mode: 'legacy'\|'direct' }` | `{ success, mode }` — التبديل اليدوي من شاشة الربط الإلكتروني: `legacy` يعيد الوسيط المحلي ويفعّل `zatca_enabled`؛ `direct` يتطلب `onboarding_status='production_ready'` (الشهادات تبقى محفوظة عبر التبديل) |

## الإرسال والمتابعة

| القناة | الطلب | الرد الناجح |
|---|---|---|
| `zatca-direct:submit-sale` | `{ saleId }` | `{ success, status, uuid, icv, warnings[] }` — إرسال يدوي؛ يحترم send_start_date |
| `zatca-direct:submit-credit-note` | `{ saleId }` | كما أعلاه (صف sales بـ doc_type='credit_note') |
| `zatca-direct:retry-unsent` | `{ limit? }` | `{ success, outcomes: [{ id, success, status?, message? }] }` |
| `zatca-direct:get-document-status` | `{ documentType: 'sale'\|'credit_note', documentId }` | `{ success, submission }` — بلا XML كامل افتراضيًا |
| `zatca-direct:download-xml` | `{ documentType, documentId }` | `{ success, fileName, xml }` — signed أو cleared |

## قواعد عامة

1. كل قنوات الكتابة ترفض على الأجهزة الثانوية (`isSecondaryDevice`) برسالة عربية.
2. الأسرار (مفاتيح خاصة، tokens، secrets، vault_key) لا تعبر IPC أبدًا في أي اتجاه.
3. عند `mode='legacy'`: قنوات الإرسال المباشر ترفض بـ"الجهاز يعمل بالوضع القديم"؛ قنوات التهيئة تعمل (لتمكين الانتقال الطوعي) مع تحذير صريح قبل `request-production-csid`.
4. REST API (منفذ 4310) لا يضاف إليه أي مسار كتابة؛ يجوز إضافة قراءة حالة فقط عند الحاجة.
5. أخطاء الهيئة تُعاد نصيًا كما وردت ضمن `message` مع الحفاظ على التفاصيل في `zatca_submissions.errors_json`.

## نقاط الربط الداخلية (غير IPC)

- `sales.js` بعد حفظ فاتورة/إشعار: `router.submitSale(saleId)` غير محجوب (setImmediate) — الراوتر يقرر legacy (bridge القديم) / direct (queue) / unlinked (لا شيء).
- `scheduler.js` كل ساعة: `router.retryUnsent(500)`.
