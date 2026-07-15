# Tasks: الربط الإلكتروني المباشر مع ZATCA في الكاشير (بدون وسيط)

**Input**: Design documents from `specs/002-zatca-direct-integration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc-api.md, quickstart.md

**Tests**: مطلوبة — المواصفة تشترط توافقًا خلفيًا حرجًا وصحة مجاميع مالية؛ اختبارات الوحدات مذكورة صراحة في الخطة (`__tests__/zatca-direct/`).

**Organization**: مهام مجمعة حسب قصص المستخدم. المرجع الدائم أثناء التنفيذ: `D:\PLUS\Laundry\server\services\zatca\` و`D:\PLUS\Laundry\database\db.js` (migrateZatcaSettings) و`D:\PLUS\Laundry\screens\zatca-settings\`.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: التبعيات وبنية المجلدات

- [X] T001 إضافة التبعية `@talha7k/zatca@0.11.1` (نفس إصدار المغاسل بالضبط) إلى `package.json` وتثبيتها، والتحقق أنها لا تتطلب Java/بينَرِيات خارجية عند التحميل على Windows
- [X] T002 إنشاء بنية المجلدات `src/main/zatca/`، `src/renderer/zatca/direct/`، `__tests__/zatca-direct/` كما في plan.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: طبقة البيانات والتشفير والراوتر — كل القصص تعتمد عليها. **حرج**: كشف الوضع (T005) هو ضمانة FR-002/FR-003.

- [X] T003 [P] نقل `vault.js` من `D:\PLUS\Laundry\server\services\zatca\vault.js` إلى `src/main/zatca/vault.js` كما هو (AES-256-GCM، candidateKeys، setStoredKey) — بلا اعتماد على `.env` المغاسل: تبقى fallbacks كما هي لكن المصدر الأساسي `vault_key` من DB
- [X] T004 إنشاء `src/main/zatca/db.js`: هجرة idempotent لجدول `zatca_settings` (كل أعمدة data-model.md بما فيها `integration_mode` و`vault_key`) وجدول `zatca_submissions` (ENUM `('sale','credit_note')` + القيود الثلاثة)، وأعمدة العملاء الأربعة `customers.zatca_street/zatca_building/zatca_district/zatca_city` (data-model.md)، وتوليد `vault_key` مرة واحدة + `vault.setStoredKey`، ودوال: `getZatcaDirectSettings`, `saveZatcaOnboardingState`, `getZatcaSettings` (بلا أسرار), `saveZatcaSettings` (تحقق VAT 15 رقمًا يبدأ/ينتهي بـ3 + رسائل عربية كما في المغاسل db.js:1032-1077), `getZatcaSubmission`, `createZatcaSubmission`, `updateZatcaSubmission`, `getPendingZatcaSubmissions`, `getUnsentZatcaSales`, حجز ICV ذرّي (UPDATE current_icv=current_icv+1 ثم قراءة) — كل SQL بمعاملات `?` عبر `src/db/db-adapter`
- [X] T005 إنشاء `src/main/zatca/router.js`: `detectModeOnce()` تُستدعى بعد الهجرة — إن كان `integration_mode` غير محسوم و`app_settings.zatca_enabled=1` → `'legacy'`، وإلا `'unlinked'`؛ ولا يوجد أي مسار يكتب `'direct'` سوى نجاح شهادة الإنتاج. **`getMode()` ديناميكية وقت الإرسال**: إن كان `integration_mode='direct'` → direct؛ وإلا إن كانت `zatca_enabled=1` → legacy (يغطي جهازًا unlinked فعّل الوضع القديم يدويًا لاحقًا — FR-004)؛ وإلا unlinked. الحقل المخزن يمنع فقط التحول التلقائي إلى direct. واجهة: `getMode()`, `submitSale(saleId)` (legacy → `LocalZatcaBridge.getInstance().submitSaleById` / direct → queue / unlinked → لا شيء), `retryUnsent(limit)`
- [X] T006 [P] نقل `index.js` من المرجع إلى `src/main/zatca/index.js` (classifyInvoice, effectiveVatNumber مع SANDBOX_SAMPLE_VAT, validateCorporateCustomer, buildPhaseOneQr) مع تكييف حقول الكاشير (`customer_vat` → من صف العميل المرتبط بالفاتورة)
- [X] T007 [P] اختبارات وحدة `__tests__/zatca-direct/vault.test.js` (تشفير/فك، صيغة iv:tag:cipher، مفتاح خاطئ يفشل GCM) و`__tests__/zatca-direct/router.test.js` (zatca_enabled=1→legacy، 0→unlinked، تفعيل zatca_enabled لاحقًا على جهاز unlinked يجعل getMode ترجع legacy، direct له الأولوية على zatca_enabled، لا انتقال تلقائي لـdirect، legacy يفوض للـbridge)

**Checkpoint**: الهجرة تعمل على قاعدة قديمة وجديدة، والوضع يُكشف صحيحًا

---

## Phase 3: User Story 1 — استمرارية الوضع القديم بعد التحديث (P1) 🎯 MVP

**Goal**: صفر تأثير على أجهزة legacy؛ الراوتر يفوض للمسار القديم دون تغيير سلوكي

**Independent Test**: quickstart سيناريو 1 — قاعدة `zatca_enabled=1` + وسيط 8080، بعد الترقية تُرسل الفواتير عبر الوسيط كما قبل

- [X] T008 [US1] تعديل `src/main/sales.js`: استبدال جسم `autoSubmitZatcaIfEnabled(saleId)` باستدعاء `router.submitSale(saleId)` غير محجوب (setImmediate)، مع بقاء فحص `zatca_enabled` داخل مسار legacy في الراوتر كما هو اليوم — **ممنوع** أي تعديل آخر على `local-zatca.js` أو `zatca-invoice-generator.js`
- [X] T009 [US1] تعديل `src/main/scheduler.js` (`submitUnsentInvoicesHourly`): استدعاء `router.retryUnsent(500)` بدل الحلقة المباشرة على `LocalZatcaBridge`؛ مسار legacy داخل الراوتر ينفذ نفس المنطق الحالي حرفيًا (نفس الاستعلام، نفس فلتر `.zatca-config.json` sendFromDate، نفس مهلة 5 ثوانٍ بين الفواتير)
- [X] T010 [US1] استدعاء `router.detectModeOnce()` عند إقلاع التطبيق في `src/main/main.js` (بعد جاهزية DB adapter) بحيث تُهاجَر الجداول ويُثبَّت الوضع قبل أول عملية بيع
- [ ] T011 [US1] اختبار ترقية يدوي موثق: تشغيل التطبيق على نسخة قاعدة بيانات فيها `zatca_enabled=1` وبلا `zatca_settings`، والتحقق من `integration_mode='legacy'` وأن الإرسال يمر عبر 8080 (quickstart سيناريو 1) — تسجيل النتيجة في `specs/002-zatca-direct-integration/verification.md`

**Checkpoint**: MVP — التحديث آمن تمامًا على العملاء الحاليين

---

## Phase 4: User Story 2 — ربط جهاز جديد بالوضع المباشر (P1)

**Goal**: دورة onboarding كاملة من داخل البرنامج (CSR → OTP → امتثال → إنتاج)

**Independent Test**: quickstart سيناريو 2 على sandbox/simulation، جهاز بلا Java

- [X] T012 [US2] نقل `onboarding.js` من المرجع إلى `src/main/zatca/onboarding.js`: نفس ENVIRONMENTS وCOMPLIANCE_CHECKS الستة وrequiredSettings ورسائلها العربية؛ التغييرات: مصدر DB = `src/main/zatca/db.js`، وEGS serial بصيغة `1-PLUSCashier|2-POS|3-<uuid>`؛ عند `requestProductionCsid` الناجح يكتب `integration_mode='direct'`
- [X] T013 [US2] تسجيل قنوات IPC للتهيئة في `src/main/main.js` حسب `contracts/ipc-api.md`: `zatca-direct:get-status`, `get-settings`, `save-settings`, `generate-csr`, `request-compliance-csid`, `run-compliance-checks`, `request-production-csid` — كلها ترفض على الأجهزة الثانوية (`isSecondaryDevice`) وترد `{success, message}` عربية، والأسرار لا تعبر IPC
- [X] T014 [US2] كشف الواجهة في `src/main/preload.js`: `zatcaDirect.*` عبر `contextBridge` (نفس نمط `localZatca` الحالي في preload.js:1345)
- [X] T015 [US2] إنشاء شاشة الربط المباشر `src/renderer/zatca/direct/index.html` + `renderer.js` بنقل بنية `D:\PLUS\Laundry\screens\zatca-settings\` وتكييفها لنمط شاشات الكاشير (Tailwind المجمّع، RTL): نموذج بيانات المنشأة (تعبئة افتراضية من app_settings)، اختيار البيئة، أزرار الخطوات (CSR → OTP → فحوص الامتثال مع نتائج الستة → شهادة الإنتاج)، بطاقة الحالة (البيئة/الحالة/انتهاء الشهادة/ICV)، وحقل send_start_date؛ وعندما `mode='legacy'` تعرض الشاشة تحذيرًا صريحًا أن الجهاز على الوضع القديم + تأكيدًا إلزاميًا قبل `request-production-csid` بنص يوضح أن الانتقال يبدأ سلسلة فواتير جديدة (FR-003)
- [X] T016 [US2] إضافة مدخل للشاشة الجديدة في `src/renderer/settings/` (زر/رابط "الربط الإلكتروني المباشر") مع إظهار الوضع النشط الحالي، وربط الصلاحيات بنفس نمط شاشة zatca الحالية في `src/main/permissions.js`
- [ ] T017 [US2] تحقق end-to-end على sandbox: دورة كاملة حتى `production_ready` (quickstart سيناريو 2) وتوثيقها في `verification.md`

**Checkpoint**: جهاز جديد يرتبط بالكامل دون Java/Payara

---

## Phase 5: User Story 3 — إرسال الفواتير والإشعارات بالوضع المباشر (P1)

**Goal**: توقيع محلي وإرسال مباشر مع ICV/PIH وQR مرحلة 2

**Independent Test**: quickstart سيناريو 3 — مبسطة/ضريبية/إشعار دائن تُقبل على simulation

- [X] T018 [US3] إنشاء `src/main/zatca/mapper.js` بنقل منطق مرجع المغاسل وتكييف مصدر البيانات (التكييف الجوهري الوحيد — research.md R3): `mapSale(saleData, settings, submission)` من `sales`+`sale_items` (invoice_no، discount_amount، extra_value كبند "رسوم إضافية"، divisor للأسعار الشاملة حسب إعداد الكاشير، منع ضريبة 0% وBR-16، شبكة أمان مطابقة `grand_total` بحد 0.1)، و`mapCreditNote` من صف `sales` بـ`doc_type='credit_note'` مع مرجع الفاتورة الأصلية (uuid/seq/تاريخ) ونوع 381؛ عميل standard يستخدم تعيين UBL الصريح من data-model.md (`customers.zatca_street/zatca_building/zatca_district/zatca_city` + `postal_code` + `vat_number` — الأعمدة الأربعة الجديدة تُهاجَر في T004 وتُضاف حقولها لشاشة العميل في `src/renderer` بنفس نمط حقول العميل الحالية) وأي نقص → رفض قبل استهلاك ICV برسالة "العنوان النظامي لعميل الشركة غير مكتمل"
- [X] T019 [P] [US3] اختبارات وحدة `__tests__/zatca-direct/mapper.test.js`: مبسطة/ضريبية، خصم موزع على البنود، extra_value، أسعار شاملة/غير شاملة، إجمالي غير مطابق يرمي خطأ، credit note يرث ويعكس صحيحًا، شركة بلا VAT تُرفض
- [X] T020 [US3] نقل `directService.js` إلى `src/main/zatca/directService.js` كما هو (signingCertificate بمطابقة المفتاح العام، injectDeliveryDate/KSA-5، retryable/retryDate، ACCEPTED_STATUSES، توليد TLV مرحلة 2) مع تكييف: `submitSale`/`submitCreditNote` تقرأ عبر db.js الجديد، وعند القبول تكتب النتيجة في `zatca_submissions` **وأيضًا** ملخصًا في `sales.zatca_uuid/hash/qr/submitted/status/rejection_reason/response` (توافق شاشات التقارير)
- [X] T021 [US3] نقل `queue.js` إلى `src/main/zatca/queue.js` (سلسلة promise تسلسلية + `retryEligibleSales` — إعادة تسمية مقصودة لـ`retryEligibleOrders` المرجعية لمطابقة مسميات الكاشير — بنفس منطق المرجع: المعلقون أولًا ثم غير المرسلين، توقف الدفعة عند خطأ شبكي فقط) وربطه بمسار direct في `router.submitSale`/`retryUnsent` مع احترام `send_start_date`
- [X] T022 [US3] تسجيل قنوات الإرسال في `src/main/main.js` + `preload.js`: `zatca-direct:submit-sale`, `submit-credit-note`, `get-document-status`, `download-xml`, `retry-unsent` حسب العقد
- [X] T023 [US3] عرض QR المرحلة الثانية في الطباعة: التأكد أن `src/renderer/sales/print.html` و`print-a4.html` يقرآن `sales.zatca_qr` كما يفعلان مع الوضع القديم (المتوقع: يعمل تلقائيًا بفضل الكتابة المزدوجة — التحقق وإصلاح أي افتراض خاص بالوسيط)؛ والتحقق من سلوك QR المرحلة الأولى قبل اكتمال الربط (FR-012): الكاشير يولّد QR مرحلة 1 من مساره الحالي عند الطباعة — إن تبين أنه مربوط بالوسيط فقط، يُستخدم `buildPhaseOneQr` من `src/main/zatca/index.js` للأجهزة غير مكتملة الربط
- [X] T024 [US3] ربط أزرار الإرسال اليدوي/إعادة الإرسال في شاشة الفواتير `src/renderer/invoices/renderer.js` بالراوتر (عند direct تستدعي `zatca-direct:submit-sale` بدل `localZatca`) مع إبقاء سلوك legacy كما هو
- [ ] T025 [US3] تحقق end-to-end على simulation: فاتورتان متتاليتان (تسلسل ICV/PIH)، ضريبية بمخالصة، إشعار دائن، خصم+extra (quickstart سيناريو 3) وتوثيق في `verification.md`

**Checkpoint**: الإرسال اليومي يعمل مباشرة بلا وسيط

---

## Phase 6: User Story 4 — العمل دون اتصال وإعادة المحاولة (P2)

**Goal**: البيع لا يتوقف؛ قائمة انتظار ذاتية الشفاء

**Independent Test**: quickstart سيناريو 4

- [X] T026 [US4] التأكد أن مسار direct في `src/main/zatca/queue.js` + `scheduler.js` ينفذ كامل سياسة المرجع: backoff `min(360, 2^attempts)` دقيقة عبر `next_attempt_at`، تمييز retryable عن رفض البيانات (rejected لا يعاد تلقائيًا)، والحفاظ على uuid/icv المحجوزين عبر إعادة التشغيل (منع الازدواج FR-017)
- [X] T027 [P] [US4] اختبار وحدة `__tests__/zatca-direct/queue.test.js`: خطأ شبكي يوقف الدفعة ويجدول، رفض بيانات لا يوقفها، إعادة إرسال بنفس uuid، ترتيب تسلسلي
- [ ] T028 [US4] تحقق يدوي لسيناريو الانقطاع وإعادة التشغيل (quickstart سيناريو 4) مع فحص عدم الازدواج لدى الهيئة وتوثيق في `verification.md`

**Checkpoint**: الموثوقية التشغيلية مثبتة

---

## Phase 7: User Story 5 — المتابعة والتقارير وإدارة الشهادة (P3)

**Goal**: رؤية الحالة، تنبيه الشهادة، إعادة الإرسال اليدوي للمرفوض

**Independent Test**: quickstart سيناريوهات 5 و6

- [X] T029 [US5] إكمال `zatca-direct:get-status` بأعداد المستندات (sent/pending/rejected من `zatca_submissions` + غير المرسل من `sales`) وحقول الشهادة (`certificateExpiresSoon` عند ≤30 يومًا، `certificateExpired`) في `src/main/zatca/onboarding.js`/`db.js`
- [X] T030 [US5] تنبيه انتهاء/قرب انتهاء الشهادة عند الإقلاع في الشاشة الرئيسية `src/renderer/main/renderer.js` (نفس نمط تنبيهات الكاشير الحالية)، والإرسال يتعلق برسالة واضحة عند انتهائها (السلوك موجود في directService — التحقق من ظهور الرسالة للمستخدم)؛ ويشمل ذلك مسار تلف/ضياع الأسرار: فشل فك التشفير (vault) يظهر للمستخدم كرسالة "أعد خطوات الربط" في بطاقة الحالة وشاشة الفواتير دون أي توقف للبيع (Edge Case المواصفة)
- [X] T031 [US5] تكييف تقرير ZATCA الحالي `src/renderer/reports/zatca_report.js` ليعمل مع الوضعين (الحقول من `sales.zatca_*` تعمل أصلًا بفضل الكتابة المزدوجة؛ إضافة عمود/فلتر لحالة القائمة وسبب الرفض من `zatca_submissions` عند direct)
- [X] T032 [US5] زر "إعادة إرسال" للمستند المرفوض في شاشة الفواتير/التقرير يستدعي `zatca-direct:submit-sale` بعد التصحيح، مع عرض سبب الرفض كما ورد من الهيئة
- [ ] T033 [US5] الانتقال الطوعي legacy→direct: التحقق اليدوي الكامل من quickstart سيناريو 5 (التحذير والتأكيد بُنيا في T015) — بما فيه أن إعادة التشغيل المتكررة بلا إجراء صريح تبقي الوضع legacy — وتوثيقه في `verification.md`

**Checkpoint**: كل القصص مكتملة

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T034 [P] مراجعة أمنية: لا أسرار في logs/IPC/REST، كل SQL الجديد بمعاملات، الشاشة الجديدة تحت contextIsolation، قنوات الكتابة ترفض على الأجهزة الثانوية
- [X] T035 [P] مراجعة رسائل الأخطاء العربية في كل المسارات الجديدة (FR-022) ومطابقة صياغة المغاسل حيث نُقلت
- [ ] T036 تشغيل كامل حزمة `npm test` والتحقق من عدم كسر اختبارات موجودة، ثم جولة quickstart كاملة (السيناريوهات 1-6) وتوثيق نهائي في `verification.md`
- [X] T037 تحديث `docs/` أو `UPDATE_SYSTEM.md` بملاحظة إصدار: الوضعان، ضمانة عدم إعادة الربط، خطوات الربط الجديد

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2 → Phase 3 (US1/MVP)** تسلسلية إلزامية.
- **US2 (Phase 4)** تعتمد على Phase 2 فقط — يمكن أن تسير موازيةً لـ US1 بعد T005.
- **US3 (Phase 5)** تعتمد على US2 (تحتاج production_ready) + T008 (نقطة الربط في sales.js).
- **US4 (Phase 6)** تعتمد على US3 (القائمة موجودة أصلًا في T021 — هذه المرحلة تحقق وتختبر).
- **US5 (Phase 7)** تعتمد على US3.
- **Phase 8** أخيرة.

**Parallel opportunities**: T003/T006/T007 معًا؛ T012 موازية لـ T008-T010؛ T019 موازية لـ T020؛ T027 موازية لـ T028؛ T034/T035 معًا.

## Implementation Strategy

**MVP** = Phases 1-3 (حتى T011): تحديث آمن للعملاء الحاليين قبل أي شيء آخر — يمكن شحنه وحده.
ثم تسليم تدريجي: US2 (الربط) → US3 (الإرسال) → US4 (الموثوقية) → US5 (المتابعة) → Polish. كل checkpoint قابل للاختبار المستقل حسب quickstart.
