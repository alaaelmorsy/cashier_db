# Blueprint: ربط الجهاز الرئيسي والفرعي (Primary/Secondary) في مشروع POS-SA (Electron)

> الهدف: هذا الملف يشرح **بشكل عملي قابل لإعادة الاستخدام** كيف يتم ربط الجهاز الرئيسي (Primary) والجهاز الفرعي (Secondary) داخل هذا المشروع: من المعمارية (Main/Renderer/IPC) إلى التواصل (DB + API) إلى أماكن الأكواد وواجهة المستخدم (Login + Activation).

---

## 1) الفكرة العامة للربط (High-Level)

الربط هنا **Hybrid**:

- **ربط قاعدة البيانات (DB Linking)**
  - الجهاز الفرعي لا يستخدم قاعدة بيانات محلية.
  - بدلًا من ذلك، يتم تغيير إعدادات MySQL لتشير إلى **IP الجهاز الرئيسي**.
  - النتيجة: كل استعلامات الـ SQL التي تتم عبر `getPool()` على الفرعي ستذهب فعليًا لقاعدة بيانات الرئيسي.

- **ربط عبر API (API Proxy/Acceleration)**
  - الجهاز الرئيسي يشغل Express API Server على منفذ افتراضي `4310`.
  - بعض IPC handlers على الفرعي تتحول إلى `fetchFromAPI()` بدل SQL المباشر لتحسين الأداء وتقليل نقل البيانات (خصوصًا عبر VPN).

---

## 2) المعمارية (Electron: Main / Preload / Renderer)

### 2.1 Main Process (منطق النظام + DB + API)
- **Entrypoint**: `src/main/main.js`
- مسؤول عن:
  - تهيئة Electron window
  - تسجيل `ipcMain.handle(...)`
  - تشغيل API Server إذا الجهاز Primary
  - توفير IPC خاص بتغيير إعدادات DB أثناء التشغيل (`db:apply`)

### 2.2 Preload (الجسر الآمن)
- **ملف**: `src/main/preload.js`
- يعرض للـ Renderer واجهات عبر `window.api.*` باستخدام `ipcRenderer.invoke`.
- أهم دوال الربط:
  - `window.api.db_get_config()` → `db:get_config`
  - `window.api.db_test(cfg)` → `db:test`
  - `window.api.db_apply(cfg)` → `db:apply`
  - `window.api.device_get_mode()` → `device:get_mode`
  - `window.api.device_set_mode(payload)` → `device:set_mode`

### 2.3 Renderer (الواجهات: Login / Activation / Settings)
- **Login**: `src/renderer/login/index.html` + `src/renderer/login/renderer.js`
- **Activation**: `src/renderer/activation/index.html` (يحتوي UI + JS داخل نفس الملف)
- **Settings** (يوجد ربط/إعدادات أيضًا): `src/renderer/settings/index.html` + `src/renderer/settings/renderer.js`

---

## 3) تحديد نوع الجهاز (Primary/Secondary) + ملف إعدادات الجهاز

### 3.1 مكان منطق الـ Mode
- **ملف**: `src/main/api-client.js`

### 3.2 ملف الإعدادات
- اسم الملف: `device-config.json`
- القيم الافتراضية:
  - `mode`: `primary`
  - `api_host`: `127.0.0.1`
  - `api_port`: `4310`

### 3.3 وظائف رئيسية في `api-client.js`
- `getDeviceMode()`
- `setDeviceMode(mode, api_host, api_port)`
- `isPrimaryDevice()`
- `isSecondaryDevice()`
- `getApiBaseUrl()` → يبني `http://{api_host}:{api_port}/api`
- `fetchFromAPI(path, params)` / `postToAPI(path, body)`

---

## 4) تشغيل API Server (على الجهاز الرئيسي فقط)

### 4.1 ملف السيرفر
- **ملف**: `src/main/api-server.js`

### 4.2 إعدادات الاستماع
- `DEFAULT_API_PORT`: `4310`
- `DEFAULT_API_HOST`: `0.0.0.0`

### 4.3 متى يبدأ؟
- في `src/main/main.js`:
  - يتم استدعاء `startAPIServer()` فقط عند `isPrimaryDevice() === true`.

### 4.4 Middleware (مهم للأداء/الأمان)
- `helmet()`
- `cors()`
- `compression()`
- `express.json({ limit: '5mb' })`
- `morgan('tiny')`

> ملاحظة: يوجد تحقق بسيط في بعض المسارات (مثال: يتطلب `x-user-id`).

---

## 5) ربط قاعدة البيانات (MySQL) بين الجهازين

### 5.1 ملف الاتصال
- **ملف**: `src/db/connection.js`

### 5.2 ملف إعدادات DB
- اسم الملف: `db-config.json`
- يتم حفظه داخل `app.getPath('userData')`.

### 5.3 أهم الدوال
- `getPool()`
- `getConfig()`
- `updateConfig(partial)` ← يغير الإعدادات ويعيد تهيئة الـ pool
- `testConnection(tempCfg)` ← اختبار اتصال بدون تغيير الحالة

### 5.4 IPC الخاصة بالـ DB Linking (موجودة في Main)
- **ملف**: `src/main/main.js`
- القنوات:
  - `db:get_config` → يرجع config الحالي
  - `db:test` → اختبار اتصال MySQL
  - `db:apply` → تطبيق config جديد (تغيير host/port…)

### 5.5 منطق الربط الفعلي للفرعي
- عندما يحفظ المستخدم IP الجهاز الرئيسي:
  - يتم تنفيذ `db_test({host,port})`
  - ثم `db_apply({host,port})`
- بعد ذلك **كل عمليات SQL** على الفرعي ستذهب للجهاز الرئيسي.

---

## 6) كيف تتغير شاشات النظام على الفرعي؟ (IPC يتحول إلى API)

الفكرة: نفس IPC handler يختار طريقة التنفيذ حسب نوع الجهاز:

- إذا **Secondary**:
  - يرجع `fetchFromAPI('/endpoint', query)`
- إذا **Primary**:
  - ينفذ SQL عبر `getPool()`

### أمثلة واضحة
- `src/main/sales.js`
  - `sales:list` → Secondary: `/invoices`
  - `sales:list_credit` → Secondary: `/credit-invoices`
  - `sales:list_credit_notes` → Secondary: `/credit-notes`
  - `sales:get` → Secondary: `/invoices/:id`
  - `sales:period_summary` → Secondary: `/period-summary`

- `src/main/products.js`
  - `products:list` → Secondary: `/products`
  - `products:get` → Secondary: `/products/:id`
  - `products:barcode` → Secondary: `/products/barcode/:code`
  - batch endpoints → `/products-images-batch`, `/products-ops-batch`

---

## 7) جزء الربط داخل شاشة تسجيل الدخول (Login)

### 7.1 الملفات
- UI: `src/renderer/login/index.html`
- Logic: `src/renderer/login/renderer.js`

### 7.2 سلوك المستخدم (UX Flow)
- زر/نافذة إعداد الاتصال تظهر/تختفي حسب إعداد DB:
  - `app_settings.show_conn_modal` (إذا غير مفعلة → يتم إخفاء زر الإعدادات)

- داخل Modal:
  - اختيار نوع الجهاز:
    - Primary
    - Secondary
  - Secondary:
    - إدخال IP الرئيسي (يدعم `IP:PORT`)
    - Test DB
    - Save → يطبق `db_apply(host=IP)` ثم `device_set_mode(secondary, api_host=IP, api_port=4310)`
  - Primary:
    - Save Primary → يطبق `db_apply(host=127.0.0.1)` ثم `device_set_mode(primary)`

### 7.3 تصميم وألوان Login (مختصر)
- `--primary: #0057FF` (أزرق)
- `--accent: #00B894` (أخضر)
- خلفية بها صورة: `assets/icon/back.png`

---

## 8) جزء الربط داخل شاشة التفعيل (Activation) — المطلوب إضافته

### 8.1 الملفات
- `src/renderer/activation/index.html`
  - يحتوي HTML + CSS + JavaScript داخل نفس الملف.

### 8.2 أين يظهر الربط في شاشة التفعيل؟
- يوجد زر أسفل شاشة التفعيل:
  - `#openConnDialog` نصه: "⚙️ إعداد الاتصال بالجهاز الرئيسي"
- يفتح Modal:
  - `#connModal`

### 8.3 لماذا الربط موجود في شاشة التفعيل؟ (منطق مهم)
داخل script في بداية الصفحة:

- إذا الترخيص صالح (`window.api.license_check()` يرجع ok)
  - يتم التحويل مباشرة إلى `../login/index.html`

- إذا الترخيص غير صالح:
  - يتم محاولة اعتبار الجهاز فرعي:
    - قراءة `db_get_config()`
    - إذا `host` ليس `127.0.0.1/localhost`
    - اختبار `db_test({host,port})`
    - إذا نجح → التحويل إلى `../login/index.html`

> هذا يعني: **الجهاز الفرعي لا يحتاج تفعيل محلي** طالما يستطيع الاتصال بقاعدة بيانات الرئيسي.

### 8.4 منطق Modal الربط في Activation
- نفس فكرة Login تقريبًا:

- Primary:
  - `device_set_mode({ mode: 'primary', api_host:'127.0.0.1', api_port:4310 })`
  - `db_apply({ host:'127.0.0.1', port:3306 })`

- Secondary:
  - `db_test({ host, port||3306 })`
  - `db_apply({ host, port||3306 })`
  - `device_set_mode({ mode:'secondary', api_host:host, api_port:4310 })`
  - ثم redirect إلى `../login/index.html`

### 8.5 تصميم وألوان Activation (مختصر)
- `--primary: #6366f1` (indigo)
- `--accent: #10b981` (أخضر)
- الـ Modal overlay:
  - خلفية: `rgba(15,23,42,.6)`
- رسائل نجاح/فشل:
  - نجاح: خلفية `#dcfce7`
  - فشل: gradient أحمر خفيف + border أحمر

---

## 9) أماكن IPC التي تهم الربط (ملخص سريع)

- **DB Linking IPC**: `src/main/main.js`
  - `db:get_config`
  - `db:test`
  - `db:apply`

- **Device Mode IPC**: `src/main/settings.js`
  - `device:get_mode`
  - `device:set_mode`

- **Expose to Renderer**: `src/main/preload.js`
  - `db_get_config/db_test/db_apply`
  - `device_get_mode/device_set_mode`

---

## 10) Blueprint لإعادة بناء نفس الربط في مشروع آخر (Checklist)

### 10.1 Minimum Modules
- `db/connection.js` (persist config + updateConfig + testConnection)
- `main/api-client.js` (mode + axios fetch/post)
- `main/api-server.js` (Express server + endpoints)
- `main/preload.js` (expose IPC)
- UI: شاشة فيها Modal لضبط:
  - Primary/Secondary
  - IP الرئيسي
  - اختبار اتصال
  - حفظ

### 10.2 خطوات تشغيل عملية
- على الرئيسي:
  - MySQL يسمح باتصال خارجي (user grants + bind-address + firewall)
  - API على 4310 مفتوح داخل الشبكة/VPN

- على الفرعي:
  - اضبط `db_apply(host=IP الرئيسي)`
  - اضبط `device_set_mode(secondary, api_host=IP الرئيسي, api_port=4310)`

### 10.3 أخطاء شائعة (Pitfalls)
- MySQL لا يقبل اتصالات خارجية (صلاحيات أو bind-address أو firewall)
- API مفتوح بدون حماية في شبكة غير موثوقة
- انقطاع الشبكة: لازم UI يعرض سبب الفشل (db_test error / fetchFromAPI error)

---

## 11) ملاحظات أمنية (Security Notes)
- لو ستعيد استخدام نفس الفكرة في برنامج آخر:
  - الأفضل حماية API بـ token أو على الأقل API key + تقييد CORS وIP allowlist.
  - ربط DB مباشرة يعطي أداء وسهولة لكنه يتطلب فتح MySQL على الشبكة.

---

## 12) أماكن ملفات الإعدادات على الجهاز (Runtime Paths)
- `device-config.json` داخل `app.getPath('userData')`
- `db-config.json` داخل `app.getPath('userData')`

---
