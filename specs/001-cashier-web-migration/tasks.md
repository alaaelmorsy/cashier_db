# Tasks: تحويل برنامج الكاشير من Electron إلى تطبيق ويب (Cashier Web Migration)

**Input**: Design documents from `specs/001-cashier-web-migration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: لم تُطلب اختبارات TDD في المواصفة؛ بوابة القبول الأساسية هي **مراجعة المستخدم اليدوية لكل صفحة** (مطلب صريح). لذلك كل صفحة تنتهي بمهمة تحقق + بوابة اعتماد.

**Organization**: منظمة حسب قصص المستخدم، وداخل US2 حسب الصفحات (صفحة صفحة — لا تبدأ صفحة قبل اعتماد المستخدم للسابقة).

**Path Conventions**: كل الملفات الجديدة داخل `D:\PLUS\copy\cashier-web\` (تُكتب أدناه بصيغة `cashier-web/...`). المصدر `D:\PLUS\copy\cashier\` (`cashier/...`) **قراءة فقط**.

**نمط نقل أي صفحة `<module>`** (يتكرر في كل مهام US2):
1. انسخ `cashier/src/renderer/<module>/` → `cashier-web/public/pages/<module>/` وعدّل الحد الأدنى (روابط `../shared/`، api-shim بدل preload، إزالة أي `require`).
2. انقل منطق `cashier/src/main/<module>.js` → `cashier-web/src/modules/<module>.js` (إزالة electron فقط، نفس الدوال ونفس `{ok:…}`).
3. سجّل الـ namespace في `cashier-web/src/routes/rpc.js` + أي أحداث `ui:X_changed` في بثّ SSE.
4. تحقّق بالمتصفح مقابل نسخة Electron (نفس البيانات/الشكل/العمليات) ثم **توقف لاعتماد المستخدم**.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: تهيئة مشروع `cashier-web` من الصفر

- [X] T001 إنشاء بنية المشروع في `cashier-web/` (المجلدات: `src/db`, `src/modules`, `src/routes`, `src/middleware`, `public/shared`, `public/pages`, `__tests__`) حسب plan.md
- [X] T002 إنشاء `cashier-web/package.json` (name: cashier-web, scripts: start/dev/test) وتثبيت التبعيات: express, express-session, mysql2, bcryptjs, dotenv, qrcode, xlsx, moment-timezone, uuid, compression, helmet, morgan, jest, nodemon
- [X] T003 [P] إنشاء `cashier-web/.env` (DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME=cashier_db, PORT=4300) + `.gitignore` (node_modules, .env)
- [X] T004 [P] نسخ الأصول المشتركة من الأصل: `cashier/src/renderer/tailwind-output.css` → `cashier-web/public/shared/tailwind-output.css`، و`cashier/src/renderer/theme.js` → `cashier-web/public/shared/theme.js`، والخطوط/الأيقونات اللازمة من `cashier/assets/` → `cashier-web/public/assets/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: الخادم + القاعدة + جسر RPC + الجلسات — لا يمكن نقل أي صفحة قبله

**⚠️ CRITICAL**: يجب اكتماله قبل أي قصة مستخدم

- [X] T005 نقل طبقة القاعدة: `cashier/src/db/{connection.js, db-adapter.js, invoice-sequence.js}` → `cashier-web/src/db/` مع إزالة فرع `electron.app.getPath('userData')` (استخدام `cashier-web/app/db-config.json` كمسار الإعداد) وبدون أي تغيير آخر
- [X] T006 إنشاء `cashier-web/server.js`: Express + helmet + compression + morgan + json body + static (`public/`) + express-session + mounting للمسارات + استماع على `0.0.0.0:PORT`
- [X] T007 [P] إنشاء `cashier-web/src/middleware/session-auth.js`: حماية كل `/pages/*` (عدا login) بإعادة توجيه، وكل `/api/*` (عدا auth) بـ 401 `{ok:false,error:"unauthorized"}`
- [X] T008 [P] إنشاء `cashier-web/src/middleware/permissions.js`: فحص `user_permissions` بمفاتيح `module.action` (admin يمرّ دائمًا) — منقول من منطق `cashier/src/main/permissions.js`
- [X] T009 إنشاء جسر RPC في `cashier-web/src/routes/rpc.js`: `POST /api/rpc/:namespace/:action` → سجل معالجات `{namespace: {action: fn}}`، استجابة `{ok:…}` دائمًا، 404 لـ action غير مسجل، تمرير `req.session.user` للمعالج
- [X] T010 [P] إنشاء بثّ الأحداث SSE في `cashier-web/src/routes/events.js`: `GET /api/events` + دالة `broadcast(event, data)` تحل محل `webContents.send`
- [X] T011 [P] إنشاء `cashier-web/public/shared/api-shim.js`: يوفر `window.api = { invoke(channel, payload), on(event, cb), off(event, cb) }` بنفس واجهة preload الأصلي (`cashier/src/main/preload.js` — اقرأه وطابق الأسماء المكشوفة) عبر fetch/SSE
- [X] T012 إنشاء مسار الصور في `cashier-web/src/routes/assets.js`: `GET /img/product/:id` بنفس منطق `product-img://` في `cashier/src/main/main.js` (blob → image_path → افتراضية)

**Checkpoint**: `npm start` يعمل، الاتصال بـ`cashier_db` ناجح، `/api/rpc/*` و`/api/events` يستجيبان

---

## Phase 3: User Story 1 — تسجيل الدخول والدخول للنظام (Priority: P1) 🎯 MVP

**Goal**: فتح التطبيق من المتصفح وتسجيل الدخول بنفس مستخدمي `cashier_db` وصلاحياتهم

**Independent Test**: فتح `http://localhost:4300` → صفحة دخول مطابقة للأصل → دخول ناجح بمستخدم حقيقي → رفض بيانات خاطئة بنفس رسائل الأصل

- [X] T013 [US1] نقل منطق المصادقة: `cashier/src/main/auth.js` (+ ما يلزم من `users.js`) → `cashier-web/src/modules/auth.js` بنفس منطق bcrypt/plain-text fallback
- [X] T014 [US1] إنشاء `cashier-web/src/routes/auth.js`: `POST /api/auth/login`، `POST /api/auth/logout`، `GET /api/auth/session` حسب contracts/http-api.md §1 (تحميل صلاحيات المستخدم في الجلسة)
- [X] T015 [US1] نقل صفحة تسجيل الدخول: `cashier/src/renderer/login/` → `cashier-web/public/pages/login/` (استبدال استدعاءات IPC بالـ shim، الحفاظ على RTL والشكل، حفظ الحسابات السابقة في localStorage بدل saved-accounts.json)
- [X] T016 [US1] تحقق يدوي حسب quickstart §1 (دخول صحيح/خاطئ، إعادة التوجيه بدون جلسة، المطابقة البصرية مع Electron) — **⛔ بوابة: اعتماد المستخدم قبل المتابعة**

**Checkpoint**: تسجيل الدخول يعمل ومعتمد — MVP الأساس جاهز

---

## Phase 4: User Story 2 — نقل الصفحات واحدة تلو الأخرى (Priority: P1)

**Goal**: نقل كل صفحات البرنامج بنمط النقل الموحد، مع بوابة اعتماد المستخدم بعد كل صفحة

**Independent Test**: لكل صفحة: عقد النقل في contracts/http-api.md §6 (مطابقة الشكل والبيانات والعمليات مع Electron على نفس القاعدة)

**⚠️ ترتيب تسلسلي إلزامي — لا [P] بين الصفحات: كل مهمة تحقق (⛔) توقف العمل حتى اعتماد المستخدم**

### 4أ — الدخول للنظام وقلب التطبيق

- [X] T017 [US2] نقل صفحة التفعيل: `cashier/src/renderer/activation/` + منطقها من `cashier/src/main/` → `cashier-web/` (بصمة الجهاز تُحسب من الخادم عبر systeminformation — حسب research §5) ثم ⛔ اعتماد
- [X] T018 [US2] نقل صفحة اختيار الفرع: `cashier/src/renderer/branch-selection/` → `cashier-web/public/pages/branch-selection/` (+ منطق branches) ثم ⛔ اعتماد
- [X] T019 [US2] نقل الشاشة الرئيسية: `cashier/src/renderer/main/` → `cashier-web/public/pages/main/` (روابط البلاطات → مسارات `/pages/*`، إخفاء العناصر حسب الصلاحيات كما في الأصل) ثم ⛔ اعتماد

### 4ب — دورة البيع الأساسية

- [X] T020 [US2] نقل فتح الوردية: `cashier/src/renderer/shift-open/` + `cashier/src/main/shifts.js` → `cashier-web/src/modules/shifts.js` + الصفحة، ثم ⛔ اعتماد
- [X] T021 [US2] نقل صفحة المبيعات (الأكبر): `cashier/src/renderer/sales/` (index + renderer + calculations-worker + virtual-scroll + unit-selector) + `cashier/src/main/sales.js` → `cashier-web/` — تدفق الفاتورة الكامل حسب الدستور §13 (وردية → تحقق → خصومات → snapshot → معاملة → مخزون → ZATCA async → بث)، الطباعة عبر قوالب print.html/print-a4.html بـ`window.print` (research §5)، ثم ⛔ اعتماد
- [X] T022 [US2] نقل إغلاق الوردية: `cashier/src/renderer/shift-close/` → `cashier-web/public/pages/shift-close/` (حساب cash_difference كما في الأصل) ثم ⛔ اعتماد
- [X] T023 [US2] نقل قائمة الورديات: `cashier/src/renderer/shifts-list/` → `cashier-web/public/pages/shifts-list/` ثم ⛔ اعتماد

### 4ج — الفواتير والمستندات المالية

- [X] T024 [US2] نقل صفحة الفواتير: `cashier/src/renderer/invoices/` + ما يلزم من sales.js (قوائم/بحث/طباعة/إلغاء) ثم ⛔ اعتماد
- [X] T025 [US2] نقل المرتجعات/إشعارات الدائن: `cashier/src/renderer/credit_notes/` (إرجاع مخزون + تحديث حالة السداد) ثم ⛔ اعتماد
- [X] T026 [US2] نقل عروض الأسعار: `cashier/src/renderer/quotations/` + `cashier/src/main/quotations.js` ثم ⛔ اعتماد
- [X] T027 [US2] نقل المدفوعات: `cashier/src/renderer/payments/` (الدفعات الجزئية تحدّث remaining_amount وbalance ذريًا) ثم ⛔ اعتماد
- [X] T028 [US2] نقل السندات: `cashier/src/renderer/vouchers/` + `cashier/src/main/vouchers.js` ثم ⛔ اعتماد
- [X] T029 [US2] نقل الفواتير المعلّقة: `cashier/src/main/held_invoices.js` + واجهتها ثم ⛔ اعتماد

### 4د — الأصناف والأطراف

- [X] T030 [US2] نقل المنتجات: `cashier/src/renderer/products/` + `cashier/src/main/products.js` (استيراد Excel عبر رفع ملف، الصور عبر `/img/product/:id` والدفعات) ثم ⛔ اعتماد
- [X] T031 [US2] نقل العمليات/الأقسام الفرعية: `cashier/src/renderer/operations/` + `cashier/src/main/operations.js` ثم ⛔ اعتماد
- [ ] T032 [US2] نقل العروض والكوبونات: `cashier/src/renderer/offers/` + `cashier/src/main/offers.js` ثم ⛔ اعتماد
- [ ] T033 [US2] نقل العملاء: `cashier/src/renderer/customers/` + `cashier/src/main/customers.js` ثم ⛔ اعتماد
- [ ] T034 [US2] نقل تسعير العملاء: `cashier/src/renderer/customer_pricing/` + `cashier/src/main/customer_pricing.js` ثم ⛔ اعتماد
- [ ] T035 [US2] نقل الموردين: `cashier/src/renderer/suppliers/` + `cashier/src/main/suppliers.js` ثم ⛔ اعتماد

### 4هـ — المشتريات

- [ ] T036 [US2] نقل المشتريات: `cashier/src/renderer/purchases/` + `cashier/src/main/purchases.js` ثم ⛔ اعتماد
- [ ] T037 [US2] نقل فواتير المشتريات: `cashier/src/renderer/purchase_invoices/` + `cashier/src/main/purchase_invoices.js` ثم ⛔ اعتماد
- [ ] T038 [US2] نقل طلبات الشراء: `cashier/src/renderer/purchase_requests/` + منطقها ثم ⛔ اعتماد

### 4و — الإدارة والتشغيل

- [ ] T039 [US2] نقل المستخدمين: `cashier/src/renderer/users/` + `cashier/src/main/users.js` (كلمات مرور جديدة bcrypt cost≥10) ثم ⛔ اعتماد
- [ ] T040 [US2] نقل الصلاحيات: `cashier/src/renderer/permissions/` + `cashier/src/main/permissions.js` ثم ⛔ اعتماد
- [ ] T041 [US2] نقل الموظفين: `cashier/src/renderer/employees/` + `cashier/src/main/employees.js` ثم ⛔ اعتماد
- [ ] T042 [US2] نقل السائقين: `cashier/src/renderer/drivers/` + `cashier/src/main/drivers.js` ثم ⛔ اعتماد
- [ ] T043 [US2] نقل المواعيد وتنبيهاتها: `cashier/src/renderer/appointments/` + `appointment-notifications.js` + `cashier/src/main/{appointments.js, appointment-reminder.js}` (المجدول على الخادم) ثم ⛔ اعتماد
- [ ] T044 [US2] نقل المطبخ: `cashier/src/renderer/kitchen/` + `cashier/src/main/kitchen.js` (بديل طابعات المطبخ يُتفق عليه — research §5) ثم ⛔ اعتماد

### 4ز — التقارير والإعدادات والتكاملات

- [ ] T045 [US2] نقل التقارير: `cashier/src/renderer/reports/` + منطقها (نفس الاستعلامات والفهارس) ثم ⛔ اعتماد
- [ ] T046 [US2] نقل الإعدادات: `cashier/src/renderer/settings/` + `cashier/src/main/settings.js` + النسخ الاحتياطي من `backup.js` (mysqldump على الخادم + تنزيل الملف — research §5؛ استبعاد أقسام Electron-only كالتحديث التلقائي باتفاق المستخدم) ثم ⛔ اعتماد
- [ ] T047 [US2] نقل واتساب: `cashier/src/renderer/whatsapp/` + `cashier/src/main/whatsapp-service.js` (Baileys على الخادم، QR في الصفحة، حدّ الرسائل من app_settings) ثم ⛔ اعتماد
- [ ] T048 [US2] نقل ZATCA: `cashier/src/renderer/zatca/` + `cashier/src/main/{zatca.js, zatca-*.js, local-zatca.js}` + المجدول من `scheduler.js` (إرسال غير متزامن + إعادة محاولة كل ساعة، التخزين في `cashier-web/app/.zatca-config.json`) ثم ⛔ اعتماد
- [ ] T049 [US2] بدائل العتاد المتبقية باتفاق المستخدم: شاشة العميل كصفحة ويب تستقبل عبر SSE (`cashier-web/public/pages/customer-display/`) والميزان عبر Web Serial أو إدخال يدوي — حسب research §5، ثم ⛔ اعتماد

**Checkpoint**: كل صفحات البرنامج منقولة ومعتمدة صفحةً صفحة

---

## Phase 5: User Story 3 — قاعدة بيانات مشتركة بلا تعارض (Priority: P1)

**Goal**: إثبات أن النسختين تعملان معًا على `cashier_db` بلا تكرار أو فقدان

**Independent Test**: quickstart §3

- [ ] T050 [US3] تحقق متقاطع: فاتورة من الويب تظهر في Electron بنفس الرقم، وتعديل منتج من Electron يظهر في الويب (quickstart §3 خطوات 1–2)
- [ ] T051 [US3] اختبار تزامن: إنشاء فواتير من النسختين معًا والتأكد من عدم تكرار أرقام الفواتير وسلامة تسلسل `invoice-sequence` والورديات (quickstart §3 خطوة 3)

**Checkpoint**: التشغيل المتزامن سليم

---

## Phase 6: User Story 4 — عدم المساس بالنظام الأصلي (Priority: P1)

**Goal**: ضمان بقاء مجلد `cashier` كما هو

**Independent Test**: quickstart §4

- [ ] T052 [US4] تشغيل `git status` في `D:\PLUS\copy\cashier` والتأكد أنه نظيف (لا تغييرات خارج `specs/` وسطر CLAUDE.md الخاص بالخطة)، وتوثيق النتيجة في `specs/001-cashier-web-migration/verification.md`

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T053 [P] اختبارات Jest لوحدات الحساب الحرجة المنقولة (VAT، خصومات، تسوية الوردية) في `cashier-web/__tests__/` — تكامل MySQL خلف `RUN_INTEGRATION_TESTS=1`
- [ ] T054 [P] مراجعة أمنية: كل SQL بـ`?`، لا `catch(_){}`، release في finally، فحص صلاحيات على كل مسار حساس، helmet مفعّل — عبر `cashier-web/src/`
- [ ] T055 [P] كتابة `cashier-web/README.md`: التشغيل، `.env`، المنفذ، الفروق المتفق عليها عن نسخة Electron (بدائل العتاد)
- [ ] T056 تنفيذ quickstart.md كاملًا من جهاز آخر على الشبكة (متصفح على `http://<ip>:4300`) والتحقق من كل السيناريوهات

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: يبدأ فورًا
- **Phase 2 (Foundational)**: بعد Phase 1 — يحجب كل شيء
- **Phase 3 (US1 — الدخول)**: بعد Phase 2 — هو MVP وبوابة كل الصفحات
- **Phase 4 (US2 — الصفحات)**: بعد US1؛ **تسلسلي داخليًا** T017→T049 (بوابة اعتماد بعد كل صفحة — مطلب صريح يمنع التوازي بين الصفحات)
- **Phase 5 (US3)**: تحققاته النهائية بعد اكتمال دورة البيع (T021+)؛ ويُطبَّق جزئيًا أثناء مراجعة كل صفحة
- **Phase 6 (US4)**: فحص مستمر بعد كل جلسة + فحص نهائي T052
- **Phase 7 (Polish)**: بعد اكتمال كل القصص

### Parallel Opportunities

- T003/T004 داخل Setup؛ T007/T008/T010/T011 داخل Foundational؛ T053/T054/T055 في Polish
- **لا توازي بين صفحات US2** — بوابة الاعتماد اليدوية تفرض التسلسل

### Parallel Example: Phase 2

```text
بالتوازي بعد T005–T006:
  T007 session-auth middleware
  T008 permissions middleware
  T010 SSE events route
  T011 api-shim.js
```

---

## Implementation Strategy

### MVP First

1. Phase 1 + Phase 2 (الأساس)
2. Phase 3 (تسجيل الدخول) → **توقف واعتماد المستخدم** = MVP
3. ثم صفحة صفحة حسب ترتيب Phase 4 (قابل لإعادة الترتيب باتفاق المستخدم)

### Incremental Delivery

كل صفحة معتمدة = زيادة قابلة للاستخدام فورًا (النسختان تعملان على نفس القاعدة، فالصفحات المنقولة تُستخدم من الويب والباقي من Electron حتى اكتمال النقل).

---

## Notes

- المصدر `cashier/` قراءة فقط — أي كتابة فيه انتهاك مباشر لـ FR-005
- كل مهمة صفحة تتضمن ضمنيًا خطوات النمط الموحد الأربع (نسخ الواجهة، نقل الوحدة، تسجيل RPC/SSE، تحقق)
- علامة ⛔ = توقف إلزامي لاعتماد المستخدم قبل المهمة التالية
- Commit في `cashier-web` بعد كل صفحة معتمدة
