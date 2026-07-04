# Implementation Plan: تحويل برنامج الكاشير من Electron إلى تطبيق ويب (Cashier Web Migration)

**Branch**: `001-cashier-web-migration` | **Date**: 2026-07-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-cashier-web-migration/spec.md`

## Summary

إنشاء نسخة ويب كاملة من برنامج الكاشير (`pos1` — تطبيق Electron) داخل مجلد `D:\PLUS\copy\cashier-web`، تعمل بخادم Node.js (Express) وتُفتح من المتصفح، وتتصل بنفس قاعدة البيانات `cashier_db` (MySQL) بدون أي تعديل على البنية. التقنية: نفس واجهات HTML/Tailwind/vanilla JS المنقولة من `src/renderer/*`، مع استبدال جسر IPC بطبقة HTTP API + عميل ويب (`window.api` shim) بحيث تعمل ملفات `renderer.js` بأقل تعديل ممكن. منطق الأعمال في `src/main/*.js` يُنقل إلى وحدات خادم مطابقة. النقل يتم صفحةً صفحة مع مراجعة المستخدم واعتماده قبل كل صفحة تالية، ومجلد `cashier` الأصلي للقراءة فقط.

## Technical Context

**Language/Version**: Node.js 18+ (نفس توافق نسخة Electron 28)، JavaScript ES2020+ بدون TypeScript

**Primary Dependencies**: Express 5، mysql2/promise، bcryptjs، express-session (جلسات الدخول)، dotenv، qrcode، xlsx، moment-timezone، uuid — نفس مكتبات الأصل حيثما أمكن. Tailwind CSS v4 (مُجمّع مسبقًا؛ يُعاد استخدام `tailwind-output.css` الحالي)

**Storage**: MySQL 5.7+ — قاعدة `cashier_db` الحالية نفسها، UTF8MB4، بدون أي migration أو تعديل schema (الجداول ينشئها الأصل بالفعل عبر نمط `ensureTables()`)

**Testing**: Jest (نفس إطار الأصل)؛ اختبارات التكامل مع MySQL خلف `RUN_INTEGRATION_TESTS=1`. المراجعة الأساسية يدوية من المستخدم لكل صفحة (مطلب صريح)

**Target Platform**: خادم Windows 10/11 يشغّل Node.js؛ العميل أي متصفح حديث (Chrome/Edge) على الشبكة المحلية، RTL عربي

**Project Type**: Web application (خادم + صفحات متصفح) في مجلد مستقل `cashier-web` بجانب `cashier`

**Performance Goals**: مطابقة تجربة سطح المكتب: فتح صفحة المبيعات تفاعلية خلال ~2 ثانية، دورة بيع كاملة بنفس عدد خطوات الأصل، دعم عدة مستخدمين متزامنين على الشبكة المحلية

**Constraints**:
- قاعدة البيانات نفسها بالضبط (`cashier_db`) — صفر تعديل على البنية والبيانات
- مجلد `cashier` قراءة فقط — كل الكود الجديد في `D:\PLUS\copy\cashier-web`
- النقل صفحة صفحة مع بوابة اعتماد من المستخدم بعد كل صفحة
- التشغيل المتزامن مع نسخة Electron بدون تعارض (تسلسل الفواتير، الورديات)
- الميزات العتادية (طباعة حرارية، ميزان، شاشة عميل، serialport) تُقيَّم عند صفحتها ببدائل ويب متفق عليها

**Scale/Scope**: ~30 صفحة renderer، ~38 وحدة منطق أعمال في `src/main`، ~30 جدول MySQL، +200 قناة IPC تتحول لمسارات HTTP

## Constitution Check

*GATE: دستور المشروع (v2.0.0) مكتوب لتطبيق Electron؛ البنود المنقولة للويب تُطبَّق بمكافئها الويبي كما يلي. لا توجد انتهاكات غير مبررة.*

| بند الدستور | الحالة في cashier-web |
|---|---|
| §2 حدود الطبقات: renderer لا يصل لـ Node مباشرة | ✅ يُحفظ: المتصفح → HTTP API → وحدات المنطق → db adapter. طبقة `api-shim.js` تحل محل preload bridge بنفس أسماء الدوال |
| §3 Technology Stack | ✅ نفس المكدس (Express، mysql2، bcryptjs، Tailwind v4، vanilla JS). تُستبعد مكتبات Electron فقط (electron-updater، serialport…) |
| §4 المعايير: async/await، `{ok:true/false}`، release في finally، لا `catch(_){}` | ✅ تُطبق حرفيًا؛ مسارات HTTP ترجع نفس صيغة `{ok:…}` التي ترجعها معالجات IPC |
| §5 التسمية: قنوات `namespace:action` | ✅ تتحول إلى `POST /api/rpc/<namespace>/<action>` (تعيين آلي 1:1) مع الإبقاء على مسارات REST القرائية الحالية بنفس أسمائها |
| §6 قواعد قاعدة البيانات | ✅ لا schema جديد؛ يُعاد استخدام `ensureTables()` كما هو. Parameterized SQL إلزامي |
| §7 "الـ REST API قراءة فقط" | ⚠️ مُكيَّف بمبرر: هذا البند يخص خادم :4310 داخل تطبيق Electron. خادم `cashier-web` هو الواجهة الأساسية للتطبيق الويب، فالكتابة عبره هي المكافئ المباشر لـ IPC (نفس وحدات المنطق تُستدعى). موثق في Complexity Tracking |
| §7 TODO(API_AUTH) | ✅ يُحل: كل مسارات الويب خلف جلسة دخول (express-session) — لا وصول بدون تسجيل دخول |
| §8 قواعد الواجهة: صفحة/مجلد، Tailwind مُجمّع، RTL | ✅ تُنقل الصفحات بنفس البنية `pages/<module>/index.html + renderer.js`، ويُعاد استخدام `tailwind-output.css` المُجمّع |
| §9 الأمان: bcrypt، تحقق الصلاحيات لكل عملية حساسة، SQL parameterized | ✅ نفس منطق `auth.js` و`permissions.js` منقول؛ التحقق في middleware لكل مسار |
| §13 قواعد الأعمال: تدفق الفاتورة، الوردية قبل البيع، snapshot العميل، VAT من الإعدادات، ZATCA غير متزامن | ✅ تُنقل الوحدات كما هي بنفس الترتيب والقواعد |
| §14 القيود الصلبة (2,4,5,6,7,9,10,11,13,14) | ✅ كلها سارية. القيدان 1 و12 (contextIsolation، بروتوكول `product-img://`) خاصان بـ Electron؛ مكافئهما الويبي: عدم كشف أي وصول خادم للمتصفح + مسار `GET /img/product/:id` بنفس منطق blob/path fallback |

**Gate result**: PASS (تكييف واحد مبرر — انظر Complexity Tracking)

## Project Structure

### Documentation (this feature)

```text
specs/001-cashier-web-migration/
├── plan.md              # هذا الملف
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1 (عقد HTTP API + عقد نقل الصفحات)
└── tasks.md             # Phase 2 (/speckit-tasks — ليس من هذا الأمر)
```

### Source Code (المجلد الجديد `D:\PLUS\copy\cashier-web`)

```text
cashier-web/
├── package.json               # اسم: cashier-web؛ نفس تبعيات الأصل الصالحة للويب
├── .env                       # DB_HOST/PORT/USER/PASS/DB_NAME=cashier_db + منفذ الويب
├── server.js                  # نقطة التشغيل: Express + جلسات + static + تركيب المسارات
├── src/
│   ├── db/
│   │   ├── connection.js      # منقول من الأصل (بدون فرع electron userData)
│   │   ├── db-adapter.js      # منقول كما هو
│   │   └── invoice-sequence.js
│   ├── modules/               # منطق الأعمال المنقول من cashier/src/main/*.js
│   │   ├── auth.js, sales.js, products.js, customers.js, shifts.js, …
│   │   └── (بدون: updater/preload/serial — لكل ميزة عتادية بديل ويب يُقرر عند صفحتها)
│   ├── routes/
│   │   ├── rpc.js             # POST /api/rpc/:ns/:action → نفس دوال الوحدات (بديل IPC)
│   │   ├── auth.js            # login/logout/session
│   │   └── assets.js          # /img/product/:id وغيرها
│   └── middleware/
│       ├── session-auth.js    # حماية كل الصفحات والمسارات
│       └── permissions.js     # فحص user_permissions لكل عملية
├── public/
│   ├── shared/
│   │   ├── api-shim.js        # يوفر window.api بنفس واجهة preload → fetch إلى /api/rpc
│   │   ├── tailwind-output.css# منسوخ من الأصل
│   │   └── theme.js           # منقول من الأصل
│   └── pages/                 # الصفحات المنقولة واحدة واحدة
│       ├── login/  (index.html + renderer.js)
│       ├── main/
│       ├── sales/
│       └── … (باقي الـ~30 صفحة بنفس أسماء مجلدات الأصل)
└── __tests__/                 # Jest
```

**Structure Decision**: تطبيق ويب أحادي (خادم Express يقدّم الصفحات والـ API معًا) داخل `cashier-web`، ببنية مطابقة لبنية الأصل (`db / modules≈main / pages≈renderer`) لتسهيل النقل صفحةً صفحة والمقارنة المباشرة مع المصدر.

## ترتيب نقل الصفحات (بوابة اعتماد المستخدم بعد كل صفحة)

1. **الأساس** (يُبنى مرة واحدة): server.js + db + api-shim + جلسات — ثم **صفحة تسجيل الدخول** ← مراجعة
2. **التفعيل / اختيار الفرع** (إن لزم للدخول) ← مراجعة
3. **الشاشة الرئيسية (main)** ← مراجعة
4. **فتح الوردية → المبيعات → إغلاق الوردية → قائمة الورديات** (دورة البيع الأساسية) ← مراجعة لكل واحدة
5. **الفواتير، المرتجعات/credit_notes، عروض الأسعار، المدفوعات، السندات**
6. **المنتجات، العمليات، العروض، تسعير العملاء، العملاء، الموردون**
7. **المشتريات وفواتيرها وطلباتها**
8. **المستخدمون، الموظفون، الصلاحيات، السائقون، المواعيد، المطبخ**
9. **التقارير، الإعدادات، واتساب، ZATCA، الفواتير المعلّقة**

(الترتيب قابل للتعديل باتفاق المستخدم أثناء العمل — الثابت: صفحة واحدة في كل مرة + اعتماد قبل التالية.)

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| الكتابة عبر HTTP API (الدستور §7 يجعل REST قراءة فقط) | في الويب لا يوجد IPC؛ HTTP هو قناة النقل الوحيدة بين المتصفح والخادم. المسارات محمية بجلسة دخول + فحص صلاحيات، وتستدعي نفس وحدات المنطق التي كانت خلف IPC | إبقاء الكتابة عبر تطبيق Electron فقط يلغي الهدف الأساسي (تطبيق ويب كامل الوظائف). بند القراءة-فقط وُضع لخادم :4310 غير المُصادَق داخل Electron، وعلّته (غياب المصادقة) محلولة هنا |
