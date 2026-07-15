# Implementation Plan: الربط الإلكتروني المباشر مع ZATCA في الكاشير (بدون وسيط)

**Branch**: `002-zatca-direct-integration` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-zatca-direct-integration/spec.md`

## Summary

نقل آلية الربط المباشر مع ZATCA من برنامج المغاسل (`D:\PLUS\Laundry\server\services\zatca\`) إلى الكاشير كما هي: مكتبة `@talha7k/zatca` تولّد CSR وتوقّع XML وترسل مباشرة لبوابة الهيئة من داخل عملية main في Electron — بلا Java ولا Payara. يُضاف **وضع تكامل** (`integration_mode`) يفصل مسارين:

- **legacy**: المسار الحالي (`src/main/local-zatca.js` → وسيط Java على `localhost:8080`) يبقى دون أي تعديل، وهو الوضع المفترض لكل تركيبة كانت `zatca_enabled=1` قبل التحديث.
- **direct**: خدمات جديدة منسوخة/مكيّفة من المغاسل (onboarding, vault, mapper, directService, queue) تعمل على جداول `zatca_settings` + `zatca_submissions` الجديدة في قاعدة كاشير MySQL نفسها.

اختيار المسار عند الإرسال يتم من نقطة واحدة (`zatca-router`) حسب `integration_mode`، ولا يوجد أي تبديل تلقائي إلى direct.

## Technical Context

**Language/Version**: Node.js (Electron 31.x main process), vanilla JS renderer — نفس المكدس الحالي للكاشير

**Primary Dependencies**: `@talha7k/zatca@0.11.1` (إضافة جديدة — نفس إصدار المغاسل)، `mysql2` (موجود)، Electron IPC (موجود). لا Java، لا Payara، لا خدمات خارجية.

**Storage**: MySQL (نفس قاعدة الكاشير عبر `src/db/db-adapter`): جدولان جدد `zatca_settings` (صف id=1) و`zatca_submissions`، وعمود `integration_mode` ضمن `zatca_settings`. أعمدة `sales.zatca_*` الحالية تبقى كما هي (يكتب فيها كلا الوضعين لتوافق شاشات التقارير).

**Testing**: `__tests__/` الموجودة (Jest-style حسب نمط المشروع) + تحقق يدوي على بيئة sandbox/simulation عبر quickstart.md

**Target Platform**: Windows desktop (Electron)، الجهاز الرئيسي فقط (الأجهزة الثانوية ترسل البيع عبر REST/IPC للجهاز الرئيسي أصلًا — الإرسال للهيئة من الرئيسي حصرًا)

**Project Type**: desktop-app (Electron main + renderer)

**Performance Goals**: الإرسال لا يحجب البيع/الطباعة (submission غير متزامن بعد الحفظ، بنفس نمط `setImmediate` الحالي)؛ قائمة انتظار تسلسلية promise-chain كما في المغاسل

**Constraints**: توافق خلفي مطلق مع الوضع القديم (FR-002/003)؛ contextIsolation=true؛ كل SQL بمعاملات `?`؛ الكتابة عبر IPC فقط (REST للقراءة)؛ رسائل عربية

**Scale/Scope**: منشأة واحدة لكل تركيب، مئات الفواتير يوميًا، ~6 ملفات خدمة جديدة + شاشة إعدادات + تعديل نقطتي إرسال (sales.js, scheduler.js)

## Constitution Check

*GATE: از constitution v2.0.0 (`.specify/memory/constitution.md`)*

| Gate | الحكم |
|------|-------|
| contextIsolation=true / nodeIntegration=false | ✅ لا تغيير على نوافذ؛ الشاشة الجديدة تستخدم preload الحالي |
| SQL بمعاملات `?` فقط | ✅ كل الاستعلامات الجديدة parameterized (نمط المغاسل نفسه) |
| الكتابة عبر IPC وليس REST | ✅ كل عمليات الربط والإرسال handlers في main عبر IPC؛ REST يبقى قراءة فقط |
| KSA/ZATCA compliance | ✅ هذا هو موضوع الميزة؛ ICV/PIH/UUID/QR وفق المرجع |
| Security: أسرار مشفرة | ✅ AES-256-GCM مع `vault_key` مخزّن في `zatca_settings` (نمط المغاسل) — أقوى من الوضع الحالي |
| Simplicity | ✅ نسخ بنية مثبتة عاملة بدل تصميم جديد؛ لا تجريدات إضافية |
| Offline-capable | ✅ البيع لا يتوقف؛ قائمة انتظار وإعادة محاولة |

لا توجد انتهاكات — جدول Complexity Tracking غير مطلوب.

## Project Structure

### Documentation (this feature)

```text
specs/002-zatca-direct-integration/
├── plan.md              # هذا الملف
├── research.md          # قرارات النقل من المغاسل وفروق الكاشير
├── data-model.md        # جداول zatca_settings / zatca_submissions وحالاتها
├── quickstart.md        # دليل التحقق على بيئة المحاكاة
├── contracts/
│   └── ipc-api.md       # عقود قنوات IPC الجديدة
└── tasks.md             # (يولَّد لاحقًا بـ /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── main/
│   ├── local-zatca.js            # الوضع القديم — لا يُمَس
│   ├── zatca-invoice-generator.js# خاص بالوضع القديم — لا يُمَس
│   ├── zatca/                    # جديد: منقول من المغاسل server/services/zatca/
│   │   ├── index.js              # تصنيف المستند، QR المرحلة 1، ثوابت
│   │   ├── vault.js              # تشفير/فك أسرار AES-256-GCM بمفتاح من DB
│   │   ├── onboarding.js         # CSR → CSID امتثال → اختبارات → CSID إنتاج
│   │   ├── mapper.js             # sale/credit_note (كاشير) → مستند UBL للمكتبة
│   │   ├── directService.js      # توقيع + إرسال + ICV/PIH + إعادة المحاولة
│   │   ├── queue.js              # سلسلة promise تسلسلية + retryEligible
│   │   ├── db.js                 # هجرة الجداول + getZatcaDirectSettings + submissions CRUD
│   │   └── router.js             # نقطة القرار الوحيدة legacy/direct + كشف الوضع عند أول تشغيل
│   ├── sales.js                  # تعديل: autoSubmitZatcaIfEnabled → router
│   ├── scheduler.js              # تعديل: دورة إعادة المحاولة → router
│   ├── main.js                   # تعديل: تسجيل IPC handlers الجديدة
│   └── preload.js                # تعديل: كشف zatcaDirect.* للواجهة
└── renderer/
    └── zatca/                    # الشاشة الحالية (الوضع القديم) تبقى
        └── direct/               # جديد: شاشة الربط المباشر (نقل UI من screens/zatca-settings في المغاسل)
            ├── index.html
            └── renderer.js

__tests__/
└── zatca-direct/                 # وحدات: router (كشف الوضع)، mapper (مجاميع/خصومات/شامل الضريبة)، vault
```

**Structure Decision**: بنية Electron أحادية الموجودة؛ كل الجديد معزول تحت `src/main/zatca/` و`src/renderer/zatca/direct/` حتى لا يلمس مسار الوضع القديم إطلاقًا.

## مراحل التنفيذ (مخطط عالي المستوى)

1. **الأساس والبيانات**: تبعية `@talha7k/zatca`، `zatca/db.js` (هجرة الجداول + vault key)، `vault.js`، `index.js`.
2. **كشف الوضع (P1 حرِج)**: `router.js` — عند أول تشغيل بعد التحديث: إن كانت `app_settings.zatca_enabled=1` ولا يوجد صف `zatca_settings` بوضع direct → يُثبَّت `integration_mode='legacy'` صراحةً ولا يتغير أبدًا تلقائيًا. جهاز جديد → `unlinked`.
3. **التهيئة (onboarding)**: نقل `onboarding.js` كما هو مع تكييف مصدر الإعدادات (بيانات المنشأة تُدخل في شاشة الربط الجديدة وتُخزن في `zatca_settings`)، والرقم التسلسلي `1-PLUSCashier|2-POS|3-<uuid>`.
4. **mapper الكاشير**: التكييف الجوهري الوحيد — تحويل `sales` + `sale_items` (خصم فاتورة، extra، أسعار شاملة/غير شاملة حسب إعدادات الكاشير، دفع مختلط) وcredit notes (`doc_type='credit_note'`) إلى نفس شكل مستند المغاسل، مع نفس شبكة أمان مطابقة الإجمالي (tolerance 0.1).
5. **الإرسال والقائمة**: `directService.js` + `queue.js` كما في المرجع (ICV/PIH ذرّي، تمييز الأخطاء الشبكية، backoff أسّي حتى 6 ساعات)، وكتابة النتائج في `sales.zatca_*` أيضًا لتوافق شاشات الفواتير والتقارير الحالية.
6. **نقاط الربط**: `sales.js` و`scheduler.js` يستدعيان `router` بدل `LocalZatcaBridge` مباشرة (والراوتر يفوّض للقديم كما هو عند legacy).
7. **الواجهة**: شاشة الربط المباشر (خطوات: بيانات المنشأة → البيئة → CSR → OTP → امتثال → إنتاج → الحالة والعداد)، مع بطاقة حالة في شاشة الإعدادات تبين الوضع النشط وخيار الانتقال الطوعي.
8. **التحقق**: اختبارات وحدات mapper/router/vault + سيناريو quickstart كامل على simulation + اختبار ترقية على قاعدة legacy حقيقية.

## Complexity Tracking

لا انتهاكات دستورية تستوجب تبريرًا.
