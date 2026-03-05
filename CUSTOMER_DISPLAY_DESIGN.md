# Customer Display System — Complete Design Specification
# نظام شاشة العرض للعميل — مواصفات التصميم الكاملة

---

## 1. نظرة عامة على النظام

شاشة العرض للعميل (Customer Display) هي شاشة تُثبّت أمام العميل وتعرض له:
- رسالة ترحيب عند فتح فاتورة جديدة
- اسم وسعر كل صنف يُضاف
- الإجمالي النهائي عند إتمام البيع
- رسالة شكر بعد إتمام الدفع

يدعم النظام الشاشات المتصلة عبر **منفذ COM (Serial Port)** أو وضع **المحاكي (Simulator)** للاختبار بدون جهاز حقيقي.

---

## 2. هيكل الملفات (File Structure)

```
src/
├── main/
│   ├── customer-display.js              ← النسخة البسيطة (قديمة، لا تزال تُستخدم من preload)
│   └── customer-display/
│       ├── index.js                     ← نقطة الدخول الرئيسية + IPC handlers
│       ├── display-manager.js           ← مدير الشاشة (DisplayManager class)
│       ├── simulator.js                 ← محاكي الشاشة (نافذة Electron)
│       └── protocols/
│           ├── base.js                  ← الكلاس الأساسي المجرد (Abstract Base)
│           ├── escpos.js                ← بروتوكول ESC/POS
│           ├── cd5220.js                ← بروتوكول CD-5220
│           ├── aedex.js                 ← بروتوكول AEDEX
│           ├── ecopos.js                ← بروتوكول ECOPOS (رقمي فقط)
│           └── generic.js              ← بروتوكول عام
├── renderer/
│   └── settings/
│       ├── index.html                   ← واجهة إعدادات الشاشة
│       └── renderer.js                  ← منطق تحميل/حفظ الإعدادات
database-updates/
└── customer-display-schema.sql          ← SQL لإضافة الأعمدة لقاعدة البيانات
```

---

## 3. قاعدة البيانات — جميع الأعمدة

### الجدول: `app_settings`

| # | اسم العمود | النوع | NULL | القيمة الافتراضية | الظهور في UI | الوصف |
|---|---|---|---|---|---|---|
| 1 | `customer_display_enabled` | `TINYINT` | NO | `0` | ✅ ظاهر | تفعيل/إيقاف الشاشة (0=مغلق، 1=مفعّل) |
| 2 | `customer_display_simulator` | `TINYINT` | NO | `0` | ❌ مخفي | تشغيل المحاكي بدل الجهاز الحقيقي (0=جهاز، 1=محاكي) |
| 3 | `customer_display_port` | `VARCHAR(16)` | YES | `NULL` | ✅ ظاهر | منفذ COM مثل `COM3` أو `/dev/ttyUSB0` |
| 4 | `customer_display_baud_rate` | `INT` | NO | `9600` | ❌ مخفي | سرعة الاتصال التسلسلي (Baud Rate) |
| 5 | `customer_display_columns` | `INT` | NO | `20` | ❌ مخفي | عدد الأعمدة (الحروف في السطر) |
| 6 | `customer_display_rows` | `INT` | NO | `2` | ❌ مخفي | عدد الصفوف |
| 7 | `customer_display_protocol` | `VARCHAR(16)` | NO | `'escpos'` | ❌ مخفي | البروتوكول المستخدم |
| 8 | `customer_display_encoding` | `VARCHAR(32)` | NO | `'windows-1256'` | ❌ مخفي | ترميز النص |
| 9 | `customer_display_brightness` | `INT` | NO | `100` | ❌ مخفي | درجة الإضاءة (0-100) |
| 10 | `customer_display_welcome_msg` | `VARCHAR(255)` | YES | `'أهلا وسهلا'` | ❌ مخفي | رسالة الترحيب |
| 11 | `customer_display_thank_msg` | `VARCHAR(255)` | YES | `'شكرا لزيارتكم'` | ❌ مخفي | رسالة الشكر (النسخة القديمة) |
| 12 | `customer_display_thankyou_msg` | `VARCHAR(255)` | YES | `'شكرا لزيارتكم'` | ❌ مخفي | رسالة الشكر (النسخة الجديدة) |
| 13 | `customer_display_data_format` | `VARCHAR(32)` | YES | `'smart_spaces_8'` | ❌ مخفي | تنسيق إرسال البيانات |

> **ملاحظة:** عمودان للشكر (`customer_display_thank_msg` و `customer_display_thankyou_msg`) موجودان لأسباب تاريخية (migration). يُستخدم كلاهما.

### SQL لإنشاء الأعمدة:

```sql
-- Customer Display Schema
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS customer_display_enabled     TINYINT      NOT NULL DEFAULT 0;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS customer_display_simulator   TINYINT      NOT NULL DEFAULT 0;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS customer_display_port        VARCHAR(16)  NULL;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS customer_display_baud_rate   INT          NOT NULL DEFAULT 9600;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS customer_display_columns     TINYINT      NOT NULL DEFAULT 20;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS customer_display_rows        TINYINT      NOT NULL DEFAULT 2;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS customer_display_protocol    VARCHAR(16)  NOT NULL DEFAULT 'escpos';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS customer_display_encoding    VARCHAR(32)  NOT NULL DEFAULT 'windows-1256';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS customer_display_brightness  TINYINT      NOT NULL DEFAULT 100;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS customer_display_welcome_msg VARCHAR(255) NULL     DEFAULT 'أهلا وسهلا';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS customer_display_thank_msg   VARCHAR(255) NULL     DEFAULT 'شكرا لزيارتكم';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS customer_display_thankyou_msg VARCHAR(255) NULL    DEFAULT 'شكرا لزيارتكم';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS customer_display_data_format VARCHAR(32)  NULL     DEFAULT 'smart_spaces_8';
```

---

## 4. الإعدادات التفصيلية لكل حقل

### 4.1 `customer_display_enabled`
- **النوع:** Boolean (TINYINT 0/1)
- **الافتراضي:** `0` (مغلق)
- **ظاهر في UI:** نعم — checkbox بعنوان "تفعيل شاشة العرض"
- **ID في HTML:** `f_customer_display_enabled`
- **السلوك:** إذا كان `0`، يتجاهل النظام كل عمليات الشاشة تماماً دون خطأ.

### 4.2 `customer_display_simulator`
- **النوع:** Boolean (TINYINT 0/1)
- **الافتراضي:** `0` (جهاز حقيقي)
- **ظاهر في UI:** لا — مخفي تماماً (يُعيَّن برمجياً)
- **السلوك:** إذا `1` → يفتح نافذة Electron بمحاكاة الشاشة بدلاً من فتح SerialPort
- **القيمة في الكود الفعلي:** دائماً `false` في `index.js` (السطر 51): `simulator: false`
- **ملاحظة:** الحقل موجود في DB لكن `index.js` لا يقرأه — المحاكي معطّل فعلياً.

### 4.3 `customer_display_port`
- **النوع:** String — اسم المنفذ
- **الافتراضي:** `NULL`
- **ظاهر في UI:** نعم — dropdown يتم ملؤه تلقائياً بالمنافذ المتاحة
- **ID في HTML:** `f_customer_display_port`
- **أمثلة:** `COM1`, `COM3`, `COM5`, `/dev/ttyUSB0`, `/dev/ttyS0`
- **السلوك:** إذا كان `NULL` أو فارغاً وكانت الشاشة مفعّلة → يُرجع خطأ `'Port not configured'`

### 4.4 `customer_display_baud_rate`
- **النوع:** Integer
- **الافتراضي في DB:** `9600`
- **القيمة الفعلية المستخدمة:** مُثبّتة برمجياً على `2400` في `settings.js` (السطر 413) و `9600` في `customer-display.js` (السطر 54)
- **ظاهر في UI:** لا — مخفي
- **القيم الممكنة:** `1200`, `2400`, `4800`, `9600`, `19200`, `38400`
- **المستخدم الفعلي:** SerialPort يستخدم `baudRate` عند `new SerialPort({...})`

### 4.5 `customer_display_columns`
- **النوع:** Integer
- **الافتراضي في DB:** `20`
- **القيمة الفعلية المستخدمة:** مُثبّتة برمجياً على `8` في `index.js` (السطر 51) و `settings.js` (السطر 414)
- **ظاهر في UI:** لا — مخفي
- **الاستخدام:** تحديد عرض السطر عند padding/truncate النص

### 4.6 `customer_display_rows`
- **النوع:** Integer
- **الافتراضي في DB:** `2`
- **القيمة الفعلية المستخدمة:** مُثبّتة برمجياً على `1` في `index.js` (السطر 52) و `settings.js` (السطر 415)
- **ظاهر في UI:** لا — مخفي
- **الاستخدام:** تحديد عدد الصفوف (شاشات ذات صف واحد أو صفين)

### 4.7 `customer_display_protocol`
- **النوع:** String
- **الافتراضي في DB:** `'escpos'`
- **القيمة الفعلية المستخدمة:** مُثبّتة برمجياً على `'ecopos'` في `index.js` (السطر 52) و `settings.js` (السطر 416)
- **ظاهر في UI:** لا — مخفي
- **القيم الممكنة:**

| القيمة | الكلاس | الوصف |
|---|---|---|
| `'escpos'` | `ESCPOSProtocol` | بروتوكول ESC/POS القياسي (الأكثر شيوعاً) |
| `'cd5220'` | `CD5220Protocol` | بروتوكول شاشات CD-5220 |
| `'aedex'` | `AEDEXProtocol` | بروتوكول AEDEX |
| `'ecopos'` | `ECOPOSProtocol` | بروتوكول ECOPOS (رقمي فقط - 8 خانات) |
| `'generic'` | `GenericProtocol` | بروتوكول عام بسيط |

### 4.8 `customer_display_encoding`
- **النوع:** String
- **الافتراضي في DB:** `'windows-1256'`
- **القيمة الفعلية المستخدمة:** مُثبّتة برمجياً على `'ascii'` في `index.js` (السطر 53) و `settings.js` (السطر 417)
- **ظاهر في UI:** لا — مخفي
- **القيم الممكنة:**

| القيمة | الوصف |
|---|---|
| `'ascii'` | ASCII فقط (للأرقام والحروف الإنجليزية) |
| `'windows-1256'` | ترميز عربي Windows-1256 (للنصوص العربية) |
| `'utf-8'` | UTF-8 |

### 4.9 `customer_display_brightness`
- **النوع:** Integer (0-100)
- **الافتراضي:** `100`
- **القيمة الفعلية:** `100` في جميع الأماكن
- **ظاهر في UI:** لا — مخفي
- **الاستخدام في البروتوكولات:**
  - ESC/POS: يُحوَّل إلى 0-3 → `ESC * brightness`
  - CD5220: يُحوَّل إلى 1-4 → `STX B n ETX`
  - AEDEX: يُحوَّل إلى 1-8 → `SOH B n`
  - ECOPOS / Generic: لا يدعم الإضاءة (يُرجع success بدون فعل)

### 4.10 `customer_display_welcome_msg`
- **النوع:** VARCHAR(255)
- **الافتراضي:** `'أهلا وسهلا'`
- **ظاهر في UI:** لا — مخفي
- **متى يُعرض:** عند تهيئة الشاشة (بداية البرنامج) وعند إنشاء فاتورة جديدة

### 4.11 `customer_display_thank_msg`
- **النوع:** VARCHAR(255)
- **الافتراضي:** `'شكرا لزيارتكم'`
- **ظاهر في UI:** لا — مخفي
- **يُستخدم في:** `customer-display.js` (النسخة البسيطة)

### 4.12 `customer_display_thankyou_msg`
- **النوع:** VARCHAR(255)
- **الافتراضي:** `'شكرا لزيارتكم'`
- **ظاهر في UI:** لا — مخفي
- **يُستخدم في:** `customer-display/index.js` (النسخة الجديدة)

### 4.13 `customer_display_data_format`
- **النوع:** VARCHAR(32)
- **الافتراضي:** `'smart_spaces_8'`
- **ظاهر في UI:** لا — مخفي
- **يُستخدم في:** `customer-display/index.js` عند قراءة الإعدادات (لكن لا يُطبَّق فعلياً في المنطق الحالي)
- **القيم الممكنة:** `'smart_spaces_8'`

---

## 5. واجهة الإعدادات (UI) — ما هو ظاهر فقط

في صفحة الإعدادات، قسم **"شاشة العرض والعملة"** (السطر ~1480 في settings/index.html):

### العناصر الظاهرة:

```html
<!-- 1. checkbox: تفعيل الشاشة -->
<input 
  id="f_customer_display_enabled" 
  type="checkbox"
  style="width:15px; height:15px; accent-color:#8b5cf6;"
>
<label for="f_customer_display_enabled">تفعيل شاشة العرض</label>

<!-- 2. dropdown: اختيار منفذ COM -->
<label for="f_customer_display_port">منفذ COM</label>
<select id="f_customer_display_port">
  <option value="">-- جاري التحميل... --</option>
  <!-- تُملأ ديناميكياً من SerialPort.list() -->
</select>
<div>المنافذ المتاحة على الكمبيوتر</div>
```

### تحميل المنافذ ديناميكياً:
```javascript
// يتم استدعاء هذا عند فتح الإعدادات
const result = await window.api.invoke('customer-display:list-ports');
// result = { success: true, ports: [{ path: 'COM3', manufacturer: 'FTDI' }, ...] }
// كل port يعرض: path + (manufacturer إن وجد)
```

### ما يتم حفظه عند الضغط على "حفظ":
```javascript
{
  customer_display_enabled:   checkbox.checked,          // boolean
  customer_display_port:      select.value || null,      // string | null
  // القيم التالية ثابتة لا تتغير من الواجهة:
  customer_display_baud_rate: 2400,
  customer_display_columns:   8,
  customer_display_rows:      1,
  customer_display_protocol:  'ecopos',
  customer_display_encoding:  'ascii',
  customer_display_brightness: 100
}
```

### بعد الحفظ:
```javascript
// إعادة تهيئة الشاشة تلقائياً إذا كانت مفعّلة
if (payload.customer_display_enabled) {
  await window.api.invoke('customer-display:reinit');
}
```

---

## 6. IPC Channels (Electron IPC)

### القنوات المسجّلة في `customer-display/index.js`:

| Channel | المُدخلات | الوصف |
|---|---|---|
| `customer-display:init` | — | تهيئة الشاشة (يقرأ الإعدادات من DB) |
| `customer-display:reinit` | — | إغلاق ثم إعادة تهيئة |
| `customer-display:close` | — | إغلاق الاتصال |
| `customer-display:clear` | — | مسح محتوى الشاشة |
| `customer-display:write` | `text: string, row: number` | كتابة نص في صف محدد |
| `customer-display:welcome` | `customMessage?: string` | عرض رسالة ترحيب |
| `customer-display:item` | `itemName: string, price: number, currency: string` | عرض صنف وسعره |
| `customer-display:total` | `total: number, currency: string` | عرض الإجمالي |
| `customer-display:thankyou` | `customMessage?: string` | عرض رسالة الشكر |
| `customer-display:brightness` | `level: number` | تعديل الإضاءة (0-100) |
| `customer-display:list-ports` | — | قائمة منافذ COM المتاحة |
| `customer-display:status` | — | حالة الاتصال والإعدادات الحالية |
| `customer-display:test` | — | اختبار متكامل (صنف → إجمالي → ترحيب) |

### القنوات القديمة في `preload.js` (تستخدم `customer-display.js` البسيط):

| دالة في preload | Channel | الوصف |
|---|---|---|
| `customer_display_connect()` | `customer_display:connect` | اتصال |
| `customer_display_disconnect()` | `customer_display:disconnect` | قطع اتصال |
| `customer_display_send_text(text)` | `customer_display:send_text` | إرسال نص |
| `customer_display_show_welcome()` | `customer-display:welcome` | ترحيب |
| `customer_display_show_thank()` | `customer-display:thankyou` | شكر |
| `customer_display_show_total(data)` | `customer-display:total` | إجمالي |
| `customer_display_clear()` | `customer-display:clear` | مسح |

---

## 7. REST API Endpoints

### POST `/api/customer-display/show`

**الطلب:**
```json
{
  "action": "welcome | thankyou | total | clear | item",
  "text": "النص أو القيمة الرقمية"
}
```

**الاستجابة:**
```json
{ "success": true }
// أو
{ "ok": true }
// أو عند الخطأ:
{ "ok": false, "error": "failed to update customer display" }
```

**أمثلة:**
```json
// عرض ترحيب
{ "action": "welcome", "text": "أهلا بكم" }

// عرض إجمالي
{ "action": "total", "text": "125.50" }

// عرض شكر
{ "action": "thankyou" }

// مسح الشاشة
{ "action": "clear" }

// عرض صنف (action = غير معروف)
{ "action": "item", "text": "برجر لحم" }
```

---

## 8. تدفق العمل (Flow of Operations)

### عند بدء البرنامج:
```
main.js:
  └─ customerDisplay.setupIPCHandlers()   ← تسجيل جميع IPC handlers
  └─ customerDisplay.initialize()
       └─ loadSettings() من DB
       └─ إذا enabled=false → خروج بنجاح
       └─ إذا enabled=true:
            └─ DisplayManager.init(config)
                 └─ إذا simulator=true → initSimulator()
                 └─ إذا simulator=false → initHardware()
                      └─ new SerialPort({ path, baudRate, ... })
                      └─ port.open()
                      └─ createProtocol() حسب نوع البروتوكول
                      └─ protocol.init() ← تهيئة الشاشة
                      └─ setupErrorHandlers() ← مراقبة الأخطاء
            └─ displayManager.displayWelcome()
```

### عند إضافة صنف (من شاشة البيع):
```javascript
await window.api.customer_display_show_total({ total: 50.00, currency: 'SAR' });
// أو
await window.api.invoke('customer-display:item', 'برجر لحم', 25.00, 'SAR');
```

### عند إتمام البيع:
```javascript
await window.api.invoke('customer-display:total', 125.50, 'SAR');
await window.api.invoke('customer-display:thankyou');
```

### عند إغلاق البرنامج:
```
app.on('before-quit'):
  └─ customerDisplay.cleanup()
       └─ displayManager.close()
            └─ protocol.close()
            └─ serialPort.close()
```

### عند انقطاع الاتصال (Auto-Reconnect):
```
serialPort.on('error') أو serialPort.on('close'):
  └─ isConnected = false
  └─ scheduleReconnect()
       └─ setInterval(5000ms)
       └─ محاولات إعادة الاتصال حتى maxReconnectAttempts=5
       └─ عند النجاح → clearInterval
```

---

## 9. البروتوكولات — تفاصيل تقنية

### 9.1 BaseProtocol (base.js) — الكلاس المجرد

**الدوال المطلوب تنفيذها في كل بروتوكول:**
```
init()              ← تهيئة الشاشة
clear()             ← مسح المحتوى
write(text, row)    ← كتابة نص في صف
setCursorPosition(row, col) ← تحريك المؤشر
setBrightness(level) ← تعديل الإضاءة
close()             ← إغلاق

displayWelcome(message)                 ← عرض رسالة ترحيب (مركزة)
displayItem(itemName, price, currency)  ← عرض صنف وسعر
displayTotal(total, currency)           ← عرض الإجمالي
displayThankYou(message)               ← عرض رسالة شكر
```

**الدوال المشتركة المُنجزة في Base:**
```javascript
padText(text, length, align)     // محاذاة: 'left' | 'center' | 'right'
truncateText(text, maxLength)    // قطع النص إذا تجاوز الحد
getDisplayLength(text)           // حساب طول العرض (عربي=1، غير ASCII=2)
getCharLength(char)              // طول الحرف في الشاشة
encodeText(text)                 // تحويل النص حسب الترميز
encodeWindows1256(text)          // تحويل عربي إلى Windows-1256
arabicToWindows1256(unicode)     // جدول تحويل حروف عربية
formatPrice(amount, currency)    // تنسيق السعر (2 decimal)
splitLines(text, maxWidth)       // تقسيم النص إلى أسطر
```

**جدول تحويل الحروف العربية (Windows-1256):**
```
U+0621 (ء) → 0xC1   U+0622 (آ) → 0xC2   U+0623 (أ) → 0xC3
U+0624 (ؤ) → 0xC4   U+0625 (إ) → 0xC5   U+0626 (ئ) → 0xC6
U+0627 (ا) → 0xC7   U+0628 (ب) → 0xC8   U+0629 (ة) → 0xC9
U+062A (ت) → 0xCA   U+062B (ث) → 0xCB   U+062C (ج) → 0xCC
U+062D (ح) → 0xCD   U+062E (خ) → 0xCE   U+062F (د) → 0xCF
U+0630 (ذ) → 0xD0   U+0631 (ر) → 0xD1   U+0632 (ز) → 0xD2
U+0633 (س) → 0xD3   U+0634 (ش) → 0xD4   U+0635 (ص) → 0xD5
U+0636 (ض) → 0xD6   U+0637 (ط) → 0xD8   U+0638 (ظ) → 0xD9
U+0639 (ع) → 0xDA   U+063A (غ) → 0xDB   U+0640 (ـ) → 0xE0
U+0641 (ف) → 0xE1   U+0642 (ق) → 0xE2   U+0643 (ك) → 0xE3
U+0644 (ل) → 0xE4   U+0645 (م) → 0xE5   U+0646 (ن) → 0xE6
U+0647 (ه) → 0xE7   U+0648 (و) → 0xE8   U+0649 (ى) → 0xE9
U+064A (ي) → 0xEA   U+064B (ً) → 0xEB   U+064C (ٌ) → 0xEC
U+064D (ٍ) → 0xED   U+064E (َ) → 0xEE   U+064F (ُ) → 0xEF
U+0650 (ِ) → 0xF0   U+0651 (ّ) → 0xF1   U+0652 (ْ) → 0xF2
```

---

### 9.2 ESCPOSProtocol (escpos.js)

**أوامر ESC/POS:**
```
ESC = 0x1B    LF  = 0x0A    CR  = 0x0D
CLR = 0x0C    HT  = 0x09    US  = 0x1F
CAN = 0x18    DC1 = 0x11    DC2 = 0x12    DC4 = 0x14
```

**عمليات مخصصة:**
```javascript
init():             [ESC, 0x40]           // إعادة ضبط الشاشة
clear():            [CLR]                 // مسح + تأخير 50ms
setCursorPosition(row, col): [ESC, 0x6C, col+1, row+1]
setBrightness(level):        [ESC, 0x2A, floor(level/100 * 3)]   // 0-3

displayItem(name, price):
  row0 = اسم الصنف (محاذاة يسار، مقطوع بـ columns-1)
  row1 = السعر (محاذاة يمين) — إذا rows >= 2

displayTotal(total):
  row0 = 'TOTAL' (مركز) — إذا rows >= 2
  row1 = السعر (مركز)
  // أو صف واحد: 'TOTAL: X.XX'
```

---

### 9.3 CD5220Protocol (cd5220.js)

**أوامر CD-5220:**
```
STX = 0x02    ETX = 0x03    ENQ = 0x05
ACK = 0x06    NAK = 0x15    DC1 = 0x11
DC2 = 0x12    DC3 = 0x13    DC4 = 0x14
CLR = 0x0C    CR  = 0x0D    LF  = 0x0A
```

**عمليات مخصصة:**
```javascript
init():             [DC2]
setCursorPosition(row, col): [STX, 0x47, 0x30+row, 0x30+col, ETX]
setBrightness(level):        [STX, 0x42, 0x30 + (floor(level/100*3)+1), ETX]
// brightness map: 0-25%→1, 26-50%→2, 51-75%→3, 76-100%→4
```

---

### 9.4 AEDEXProtocol (aedex.js)

**أوامر AEDEX:**
```
SOH = 0x01    STX = 0x02    ETX = 0x03
EOT = 0x04    CR  = 0x0D    LF  = 0x0A    CLR = 0x0C
```

**عمليات مخصصة:**
```javascript
init():              [SOH, 0x30, 0x30]
setCursorPosition(row, col): [SOH, '0'+row, '0'+col]  // ASCII chars
write(text, row):    [STX, ...encodedText, ETX]        // محاط بـ STX/ETX
setBrightness(level):        [SOH, 0x42, 0x30 + (floor(level/100*7)+1)]
// brightness map: 8 مستويات
close():             [...clear(), EOT]
```

---

### 9.5 ECOPOSProtocol (ecopos.js) ← المستخدم الحالي

> **تنبيه:** هذا البروتوكول مخصص لشاشات العرض الرقمية (8 خانات) — يعرض أرقاماً فقط.

**أوامر:**
```
STX = 0x02    ETX = 0x03    CR = 0x0D    LF = 0x0A    CLR = 0x0C
```

**طريقة الإرسال:**
```javascript
// format: "  123.45\r\n" (padded to 8 chars)
sendNumber(value):
  numStr = formatNumber(value)          // رقم بدون أصفار زائدة
  formattedData = numStr.padStart(8, ' ') + '\r\n'
  buffer = Buffer.from(formattedData)   // ASCII
  port.write(buffer)
  port.drain()
  sleep(50ms)

// عند التهيئة:
init():
  setSignals(DTR=true, RTS=true)       // إشارات التحكم
  sleep(100ms)
  clear() → sendNumber('0.00')

// عمليات العرض:
displayItem(name, price):  sendNumber(price.toFixed(2))
displayTotal(total):       sendNumber(total.toFixed(2))
displayWelcome():          sendNumber('0.00')
displayThankYou():         sleep(1000) → sendNumber('0.00')
clear():                   sendNumber('0.00')
```

**تنسيق الرقم:**
```javascript
formatNumber('125.50') → '125.50'   (8 chars: '  125.50')
formatNumber('5')      → '5'        (8 chars: '       5')
formatNumber('0.00')   → '0'        (8 chars: '       0')
```

---

### 9.6 GenericProtocol (generic.js)

**أبسط بروتوكول — يرسل نصاً مع CR+LF:**
```javascript
clear():  rows مسافات فارغة + '\r\n' لكل صف
write(text, row):  encodedText + CR + LF
setBrightness(): لا يفعل شيئاً (success فقط)
setCursorPosition(): لا يفعل شيئاً
```

---

## 10. المحاكي (Simulator)

**يفتح نافذة Electron مستقلة تحاكي شاشة العرض:**

```javascript
new BrowserWindow({
  width: 600,
  height: 200 + (rows * 30),
  title: 'Customer Display Simulator',
  backgroundColor: '#000000',
  resizable: false,
  frame: true,
  alwaysOnTop: true,
  webPreferences: { nodeIntegration: false, contextIsolation: true }
})
```

**مظهر المحاكي:**
- خلفية سوداء (`#000000`)
- نص بلون أصفر (درجة حسب brightness): `rgb(255, 255, 0)` عند 100%
- خط: `Courier New, monospace` حجم 48px
- إطار داخلي: `background:#111; border:3px solid #333; border-radius:10px`
- نص المعلومات: `Customer Display Simulator - {columns}x{rows}`

**حساب لون النص:**
```javascript
const brightness = this.config.brightness / 100;  // 0.0 - 1.0
const color = Math.floor(255 * brightness);        // 0 - 255
// → rgb(color, color, 0)   [أصفر بدرجات]
```

---

## 11. DisplayManager — هيكل الكلاس

```javascript
class DisplayManager {
  constructor() {
    this.protocol = null;            // كلاس البروتوكول الحالي
    this.serialPort = null;          // SerialPort instance
    this.simulator = null;           // CustomerDisplaySimulator instance
    this.config = {};                // الإعدادات المُحمَّلة
    this.isConnected = false;        // حالة الاتصال
    this.reconnectInterval = null;   // timer إعادة الاتصال
    this.reconnectAttempts = 0;      // عداد محاولات إعادة الاتصال
    this.maxReconnectAttempts = 5;   // الحد الأقصى للمحاولات
  }

  // الدوال العامة:
  async init(config)                           // تهيئة بإعدادات
  async initSimulator()                        // تهيئة المحاكي
  async initHardware()                         // تهيئة الجهاز الحقيقي
  createProtocol(serialPort)                   // إنشاء البروتوكول المناسب
  openPort()                                   // فتح SerialPort (Promise)
  setupErrorHandlers()                         // أحداث error/close
  scheduleReconnect()                          // جدولة إعادة اتصال كل 5 ثوانٍ
  clearReconnectInterval()                     // إلغاء timer إعادة الاتصال

  async clear()                                // مسح الشاشة
  async write(text, row = 0)                   // كتابة نص
  async displayWelcome(customMessage = null)   // رسالة ترحيب
  async displayItem(itemName, price, currency) // صنف وسعر
  async displayTotal(total, currency)          // إجمالي
  async displayThankYou(customMessage = null)  // رسالة شكر
  async setBrightness(level)                   // إضاءة
  async close()                                // إغلاق كامل
  async listPorts()                            // قائمة المنافذ
  getStatus()                                  // الحالة الحالية
}
```

**config object عند init():**
```javascript
{
  enabled:     Boolean,   // هل الشاشة مفعّلة
  simulator:   Boolean,   // هل نستخدم المحاكي
  port:        String,    // COM port (e.g. 'COM3')
  baudRate:    Number,    // سرعة الاتصال
  columns:     Number,    // عدد الأعمدة
  rows:        Number,    // عدد الصفوف
  protocol:    String,    // نوع البروتوكول
  encoding:    String,    // الترميز
  brightness:  Number,    // الإضاءة 0-100
  welcomeMsg:  String,    // رسالة الترحيب
  thankyouMsg: String     // رسالة الشكر
}
```

**getStatus() يُرجع:**
```javascript
{
  isConnected:       Boolean,
  config:            Object,   // الإعدادات الكاملة
  reconnectAttempts: Number
}
```

---

## 12. listPorts() — بنية البيانات

```javascript
// يُرجع:
{
  success: true,
  ports: [
    {
      path:         'COM3',           // اسم المنفذ
      manufacturer: 'FTDI',           // الشركة المصنعة (قد يكون null)
      serialNumber: 'A12345',         // الرقم التسلسلي (قد يكون undefined)
      vendorId:     '0403',           // Vendor ID (hex string)
      productId:    '6001'            // Product ID (hex string)
    },
    ...
  ]
}

// عند الخطأ:
{ success: false, error: 'error message', ports: [] }
```

---

## 13. SerialPort الإعدادات التقنية الثابتة

```javascript
new SerialPort({
  path:     settings.customer_display_port,  // من DB
  baudRate: this.config.baudRate,            // من config
  dataBits: 8,                               // ثابت
  stopBits: 1,                               // ثابت
  parity:   'none',                          // ثابت
  rtscts:   false,                           // ثابت (hardware flow control)
  xon:      false,                           // ثابت (software flow control)
  xoff:     false,                           // ثابت
  autoOpen: false                            // ثابت (نفتحه يدوياً)
})
```

---

## 14. التكامل مع البرنامج الرئيسي (main.js)

```javascript
const customerDisplay = require('./customer-display/index');

// عند بدء التشغيل:
customerDisplay.setupIPCHandlers();  // تسجيل IPC

// بعد تهيئة قاعدة البيانات:
await customerDisplay.initialize();

// عند إغلاق البرنامج:
await customerDisplay.cleanup();
```

---

## 15. معالجة الأخطاء (Error Handling)

| الحالة | السلوك |
|---|---|
| الشاشة معطّلة (`enabled=0`) | يُرجع `{ ok: true }` بدون فعل شيء |
| المنفذ غير مُعيَّن | يُرجع `{ ok: false, error: 'Port not configured' }` |
| فشل فتح المنفذ | يُرجع `{ ok: false, error: ... }` ويجدول إعادة اتصال |
| انقطاع الاتصال المفاجئ | يُعيد الاتصال تلقائياً (5 محاولات، كل 5 ثوانٍ) |
| تجاوز الحد الأقصى للمحاولات | يتوقف ويسجّل تحذير في console |
| فشل الإرسال | يُرجع `{ ok: false, error: ... }` |
| الشاشة غير متصلة عند الكتابة | يُرجع `{ success: false, error: 'Not connected' }` |

---

## 16. الاعتماديات (Dependencies)

```json
{
  "serialport": "^X.X.X"
}
```

يُستخدم فقط:
- `SerialPort` من `'serialport'` — للاتصال بالمنفذ التسلسلي
- `SerialPort.list()` — لاستعراض المنافذ المتاحة
- `BrowserWindow` من Electron — للمحاكي فقط
- `ipcMain` من Electron — لتسجيل handlers

---

## 17. ملخص الإعدادات الثابتة مقابل المتغيرة

### ثابتة في الكود (Hard-coded) — لا يمكن تغييرها من الواجهة:

| الإعداد | القيمة المثبتة | الملف |
|---|---|---|
| `baud_rate` | `2400` | `settings.js:413` |
| `columns` | `8` | `settings.js:414`, `index.js:51` |
| `rows` | `1` | `settings.js:415`, `index.js:52` |
| `protocol` | `'ecopos'` | `settings.js:416`, `index.js:52` |
| `encoding` | `'ascii'` | `settings.js:417`, `index.js:53` |
| `brightness` | `100` | `settings.js:418` |
| `welcomeMsg` | `'1'` | `index.js:55` |
| `thankyouMsg` | `'1'` | `index.js:56` |
| `simulator` | `false` | `index.js:48` |
| `dataBits` | `8` | `display-manager.js:83` |
| `stopBits` | `1` | `display-manager.js:84` |
| `parity` | `'none'` | `display-manager.js:85` |
| `autoOpen` | `false` | `display-manager.js:88` |
| `maxReconnectAttempts` | `5` | `display-manager.js:18` |
| `reconnectDelay` | `5000ms` | `display-manager.js:184` |

### متغيرة من الواجهة (2 فقط):

| الإعداد | العنصر في UI |
|---|---|
| `customer_display_enabled` | checkbox: `f_customer_display_enabled` |
| `customer_display_port` | select: `f_customer_display_port` |

---

## 18. ملخص مرجعي سريع

```
┌─────────────────────────────────────────────────────────────────┐
│                   Customer Display System                       │
├─────────────┬───────────────────────────────────────────────────┤
│ الجهاز     │ شاشة عرض رقمية (8 خانات) - ECOPOS Protocol       │
│ الاتصال    │ Serial Port (COM) — 2400 baud                      │
│ الأعمدة    │ 8 خانات (رقمية)                                    │
│ الصفوف     │ 1 صف                                               │
│ الترميز    │ ASCII                                              │
├─────────────┼───────────────────────────────────────────────────┤
│ التفعيل    │ customer_display_enabled = 1                       │
│ المنفذ     │ customer_display_port = 'COM3' (مثال)              │
├─────────────┼───────────────────────────────────────────────────┤
│ ترحيب      │ sendNumber('0.00') → '       0\r\n'               │
│ صنف+سعر   │ sendNumber('25.50') → '   25.50\r\n'              │
│ إجمالي     │ sendNumber('125.50') → '  125.50\r\n'             │
│ شكر        │ sleep(1000) → sendNumber('0.00')                   │
│ مسح        │ sendNumber('0.00')                                 │
├─────────────┼───────────────────────────────────────────────────┤
│ إعادة اتصال│ تلقائية: 5 محاولات كل 5 ثوانٍ                   │
│ محاكي      │ نافذة Electron (معطّل حالياً في index.js)         │
└─────────────┴───────────────────────────────────────────────────┘
```
