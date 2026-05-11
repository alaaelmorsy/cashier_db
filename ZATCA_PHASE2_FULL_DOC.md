# 🏛️ التوثيق الكامل للربط الإلكتروني مع هيئة الزكاة والضريبة والجمارك (ZATCA) - المرحلة الثانية

---

## 📋 المحتويات

1. [نظرة عامة على المعمارية](#1-نظرة-عامة-على-المعمارية)
2. [ملف التكوين والإعدادات](#2-ملف-التكوين-والإعدادات)
3. [شاشة ربط ZATCA (المرحلة الثانية)](#3-شاشة-ربط-zatca-المرحلة-الثانية)
4. [شاشة الإعدادات - تفعيل الربط](#4-شاشة-الإعدادات---تفعيل-الربط)
5. [شاشة الفواتير - زر إرسال الفواتير](#5-شاشة-الفواتير---زر-إرسال-الفواتير)
6. [شاشة الفواتير الدائنة - زر الإرسال](#6-شاشة-الفواتير-الدائنة---زر-الإرسال)
7. [الإرسال التلقائي (Auto-Submit)](#7-الإرسال-التلقائي-auto-submit)
8. [الجدولة الدورية لإعادة الإرسال](#8-الجدولة-الدورية-لإعادة-الإرسال)
9. [جسر الإرسال المحلي (LocalZatcaBridge)](#9-جسر-الإرسال-المحلي-localzatcabridge)
10. [بناء جسم الفاتورة (buildBodyFromSaleId)](#10-بناء-جسم-الفاتورة-buildbodyfromsaleid)
11. [استراتيجيات الإرسال المتعددة (Fallback Strategies)](#11-استراتيجيات-الإرسال-المتعددة-fallback-strategies)
12. [معالجة الردود وتحديث الحالة](#12-معالجة-الردود-وتحديث-الحالة)
13. [التكامل المباشر مع بوابة ZATCA](#13-التكامل-المباشر-مع-بوابة-zatca)
14. [إنشاء شهادة الامتثال (CSR)](#14-إنشاء-شهادة-الامتثال-csr)
15. [توليد فاتورة XML بصيغة UBL 2.0](#15-توليد-فاتورة-xml-بصيغة-ubl-20)
16. [التوقيع الرقمي (XAdES)](#16-التوقيع-الرقمي-xades)
17. [الفواتير الدائنة (Credit Notes)](#17-الفواتير-الدائنة-credit-notes)
18. [جميع حقول قاعدة البيانات](#18-جميع-حقول-قاعدة-البيانات)
19. [جميع قنوات IPC](#19-جميع-قنوات-ipc)
20. [جميع السيناريوهات وسير العمل](#20-جميع-السيناريوهات-وسير-العمل)

---

## 1. نظرة عامة على المعمارية

### هيكل الملفات

```
المشروع
├── .zatca-config.json                          # ملف إعدادات ZATCA (التكوين)
├── src/main/
│   ├── zatca.js                                # الفئة الأساسية لتكامل ZATCA
│   ├── zatca-invoice-generator.js              # منشئ فاتورة XML بصيغة UBL 2.0
│   ├── zatca-digital-signature.js              # التوقيع الرقمي والتشفير
│   ├── zatca-sales-integration.js              # جسر المبيعات <-> ZATCA
│   ├── local-zatca.js                          # جسر الإرسال المحلي (API خارجي)
│   ├── sales.js                                # معالجات IPC للمبيعات + الإرسال التلقائي
│   ├── scheduler.js                            # الجدولة الدورية للإرسال
│   ├── settings.js                             # إعدادات التطبيق + تفعيل ZATCA
│   ├── main.js                                 # تهيئة التطبيق الرئيسي
│   ├── preload.js                              # كشف APIs للواجهة الأمامية
│   └── api-server.js                           # خادم REST API
├── src/renderer/
│   ├── zatca/
│   │   ├── index.html                          # شاشة تكوين ZATCA
│   │   └── zatca.js                            # منطق شاشة التكوين
│   ├── invoices/
│   │   ├── index.html                          # شاشة الفواتير + نافذة رد الهيئة
│   │   └── renderer.js                         # أزرار الإرسال وعرض الردود
│   ├── credit_notes/
│   │   ├── index.html                          # شاشة الفواتير الدائنة
│   │   └── renderer.js                         # أزرار الإرسال للأشعارات الدائنة
│   ├── sales/
│   │   └── renderer.js                         # زر إرسال ZATCA برقم الفاتورة
│   ├── settings/
│   │   ├── index.html                          # شاشة الإعدادات - تبويب الضريبة
│   │   └── renderer.js                         # تشغيل/إيقاف الربط
│   ├── reports/
│   │   ├── zatca_report.html                   # تقرير هيئة الزكاة
│   │   └── zatca_report.js                     # منطق تقرير ZATCA
│   └── main/
│       ├── index.html                          # بطاقة الفاتورة الإلكترونية
│       └── renderer.js                         # التنقل لشاشة ZATCA
```

### نموذج التدفق العام

```
┌──────────────────────────────────────────────────────────────────┐
│                      الواجهة الأمامية (Renderer)                   │
│                                                                  │
│  ┌─────────────┐  ┌──────────┐  ┌──────────────┐  ┌───────────┐ │
│  │ تكوين ZATCA │  │ الفواتير  │  │ فواتير دائنة  │  │ الإعدادات  │ │
│  │   zatca/    │  │ invoices/ │  │ credit_notes/ │  │ settings/  │ │
│  └──────┬──────┘  └────┬─────┘  └──────┬───────┘  └─────┬─────┘ │
│         │              │               │                 │       │
│         └──────────────┴───────────────┴─────────────────┘       │
│                            │ IPC                                  │
└────────────────────────────┼──────────────────────────────────────┘
                             │
┌────────────────────────────┼──────────────────────────────────────┐
│                      العملية الرئيسية (Main Process)               │
│                            │                                      │
│  ┌─────────────────────────┼──────────────────────────────────┐  │
│  │            preload.js (contextBridge)                       │  │
│  │  electronAPI.zatca.*      (11 وظيفة)                       │  │
│  │  electronAPI.localZatca.* (وظيفتان)                        │  │
│  └─────────────────────────┼──────────────────────────────────┘  │
│                            │                                      │
│  ┌─────────────────────────┼──────────────────────────────────┐  │
│  │  ┌──────────────┐  ┌────┴────────┐  ┌──────────────────┐  │  │
│  │  │   zatca.js   │  │ sales.js    │  │  local-zatca.js  │  │  │
│  │  │  (التكامل    │  │ (IPC +      │  │  (جسر API محلي)  │  │  │
│  │  │   الأساسي)   │  │  الإرسال    │  │                  │  │  │
│  │  └──────┬───────┘  │  التلقائي)  │  └────────┬─────────┘  │  │
│  │         │          └─────────────┘           │            │  │
│  │         │                                    │            │  │
│  │  ┌──────┴──────────┐              ┌─────────┴──────────┐ │  │
│  │  │ Invoice Gen.    │              │ scheduler.js       │ │  │
│  │  │ (XML UBL 2.0)   │              │ (إعادة إرسال دوري)  │ │  │
│  │  └──────┬──────────┘              └────────────────────┘ │  │
│  │         │                                                 │  │
│  │  ┌──────┴──────────┐                                     │  │
│  │  │ Digital Sig.    │                                     │  │
│  │  │ (XAdES/RSA)     │                                     │  │
│  │  └─────────────────┘                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
     ┌────────┴────────┐          ┌────────┴──────────┐
     │  بوابة ZATCA     │          │  API محلي خارجي    │
     │  gw-fatoora.     │          │  localhost:8080    │
     │  zatca.gov.sa    │          │  /zatca_2/api/...  │
     └─────────────────┘          └───────────────────┘
```

---

## 2. ملف التكوين والإعدادات

### `.zatca-config.json` (جذر المشروع + مجلد userData)

```json
{
  "environment": "sandbox",           // sandbox | simulation | production
  "endpoints": {
    "sandbox": "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal",
    "simulation": "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation",
    "production": "https://gw-fatoora.zatca.gov.sa/e-invoicing/core"
  },
  "certificates": {
    "privateKey": null,               // مفتاح RSA الخاص (PEM)
    "certificate": null,              // شهادة الامتثال (Base64)
    "csr": null                       // طلب توقيع الشهادة
  },
  "credentials": {
    "username": null,                 // requestID من ZATCA
    "password": null,                 // secret من ZATCA
    "otp": null                       // رمز التحقق OTP
  },
  "companyData": {
    "organizationName": "...",        // اسم المنشأة
    "vatNumber": "...",               // الرقم الضريبي (15 رقم)
    "commercialRegistration": "...",  // السجل التجاري
    "businessCategory": "...",        // فئة النشاط
    "address": {
      "street": "...",               // اسم الشارع
      "building": "...",             // رقم المبنى
      "city": "...",                  // المدينة
      "postalCode": "...",           // الرمز البريدي
      "district": "...",             // الحي
      "country": "SA"
    }
  },
  "localApi": {                       // (اختياري) إعدادات API المحلي
    "endpoint": "http://localhost:8080/zatca_2/api/customerInvoice/submitInvoice",
    "paramName": "invoiceJO",
    "paramAliases": ["invoiceJO","invoiceIO", ...],
    "preferredMode": "json-raw",       // استراتيجية الإرسال المفضلة
    "enableTextPlain": false           // تفعيل محاولة text/plain
  }
}
```

#### ملاحظات مهمة:
- **مسار الملف**: `app.getPath('userData')/.zatca-config.json` في الإنتاج، أو `process.cwd()/.zatca-config.json` كاحتياطي.
- **البيانات الحساسة** (privateKey, password) تحجب عند استدعاء `getConfig()`.
- **localApi**: تكوين اختياري يسمح بتخصيص endpoint الإرسال المحلي واستراتيجياته.

---

## 3. شاشة ربط ZATCA (المرحلة الثانية)

### المسار: `src/renderer/zatca/index.html` + `zatca.js`
### الوصول: من الشاشة الرئيسية > بطاقة "الفاتورة الإلكترونية"

### الحقول المطلوبة في شاشة التكوين:

| الحقل | النوع | الوصف |
|-------|------|-------|
| اسم المنشأة | نص | اسم المنشأة بالعربية |
| اسم المنشأة (إنجليزي) | نص | الاسم بالإنجليزية |
| الرقم الضريبي | نص (15 رقم) | رقم التسجيل في ضريبة القيمة المضافة |
| السجل التجاري | نص (10 أرقام) | رقم السجل التجاري (CRN) |
| فئة النشاط التجاري | قائمة منسدلة | تصنيف النشاط (مطاعم، تقنية، إلخ) |
| اسم الفرع | نص | اسم الفرع التجاري |
| البريد الإلكتروني | بريد إلكتروني | البريد الإلكتروني للمنشأة |
| الشارع | نص | اسم الشارع |
| رقم المبنى | نص | رقم المبنى |
| المدينة | نص | المدينة |
| الرمز البريدي | نص | الرمز البريدي (5 أرقام) |
| الحي | نص | اسم الحي/المنطقة الفرعية |

### ماذا يحدث عند حفظ التكوين:

1. **استدعاء الواجهة**: `window.electronAPI.zatca.saveConfig(config)` 
2. **قناة IPC**: `zatca:saveConfig`
3. **التنفيذ في `zatca.js`**: 
   - دمج البيانات الجديدة مع التكوين الحالي
   - حفظ الملف في `.zatca-config.json`
4. **النتيجة**: يعود `{ success: true, message: 'تم حفظ الإعدادات بنجاح' }`
5. **عرض Toast**: نجاح (أخضر) أو فشل (أحمر)

### ماذا يحدث عند تحميل الشاشة:

1. **استدعاء**: `window.electronAPI.zatca.getConfig()`
2. **قناة IPC**: `zatca:getConfig`
3. **الاستجابة**: التكوين مع إخفاء البيانات الحساسة (privateKey → `***محجوب***`)
4. **ملء الحقول**: تعبئة النموذج بالبيانات المسترجعة

---

## 4. شاشة الإعدادات - تفعيل الربط

### المسار: `src/renderer/settings/index.html` > تبويب "البيانات الضريبية والرسمية"

### مربع الاختيار:

```html
<input id="f_zatca_enabled" type="checkbox" />
<label for="f_zatca_enabled">تفعيل الربط الإلكتروني (ZATCA)</label>
```

### مكانه في قاعدة البيانات:

- **الجدول**: `app_settings` (الصف id=1)
- **العمود**: `zatca_enabled` (TINYINT NOT NULL DEFAULT 0)
- **0**: الربط غير مفعل
- **1**: الربط مفعل

### ماذا يحدث عند تفعيل/إلغاء التفعيل:

1. عند الحفظ: يُكتب `zatca_enabled` = 0 أو 1 في `app_settings`
2. **إذا = 1 (مفعل)**:
   - ✅ الإرسال التلقائي يعمل (عند إنشاء إشعار دائن)
   - ✅ المجدول الدوري يعمل (كل 15 دقيقة)
   - ✅ أزرار الإرسال اليدوي تظهر في شاشات الفواتير
   - ✅ عمود "حالة ZATCA" يظهر في قوائم الفواتير والفواتير الدائنة
3. **إذا = 0 (غير مفعل)**:
   - ❌ لا إرسال تلقائي ولا دوري
   - ❌ عمود الحالة يظهر "غير مفعل"
   - ❌ أزرار الإرسال مخفية

### عملية التحقق من التفعيل:

كل عملية إرسال (تلقائي، دوري، يدوي) تتحقق من `zatca_enabled`:
```sql
SELECT zatca_enabled FROM app_settings WHERE id=1
```

---

## 5. شاشة الفواتير - زر إرسال الفواتير

### المسار: `src/renderer/invoices/renderer.js`

### عمود حالة ZATCA في جدول الفواتير:

| الحالة | النمط | الوصف |
|--------|-------|-------|
| غير مفعل | رمادي `T.disabled` | ZATCA غير مفعلة من الإعدادات |
| ✅ تم الإرسال | أخضر | `zatca_status = 'submitted'` أو `'accepted'` أو `zatca_submitted` موجود |
| ❌ فشل | أحمر | `zatca_status = 'rejected'` |
| ⏳ لم يتم الإرسال | أصفر | `zatca_status = 'pending'` أو NULL |

### الأزرار المتاحة لكل فاتورة:

| الزر | يظهر عندما |
|------|-----------|
| 📤 إرسال للهيئة | ZATCA مفعلة + الفاتورة غير مرسلة |
| 📄 رد الهيئة | يوجد `zatca_response` أو `zatca_rejection_reason` |
| عرض الفاتورة | لدى المستخدم صلاحية `invoices.view` |

### ماذا يحدث عند الضغط على "📤 إرسال للهيئة":

```
الخطوة 1: تعطيل الزر مؤقتاً وتغيير النص إلى "⏳ جاري الإرسال..."
         ↓
الخطوة 2: استدعاء window.electronAPI.localZatca.submitBySaleId(id)
         ↓
الخطوة 3: (preload.js) ipcRenderer.invoke('zatca:submitLocal', { sale_id })
         ↓
الخطوة 4: (local-zatca.js) ipcMain.handle('zatca:submitLocal', ...)
         │
         ├── بناء جسم الفاتورة: buildBodyFromSaleId(sale_id)
         │   └── استعلام قاعدة البيانات: SELECT * FROM sales + sales_items
         │
         ├── إرسال مع استراتيجيات Fallback: sendWithFallback(body)
         │   └── POST إلى localhost:8080/zatca_2/api/...
         │
         ├── تحليل الرد:
         │   ├── نجاح (HTTP 2xx + ليس NOT_REPORTED):
         │   │   └── UPDATE sales SET zatca_status='submitted', zatca_submitted=NOW()
         │   │
         │   ├── NOT_REPORTED (مرفوض):
         │   │   └── UPDATE sales SET zatca_status='rejected', zatca_rejection_reason='NOT_REPORTED'
         │   │
         │   └── فشل (خطأ شبكة/HTTP):
         │       └── UPDATE sales SET zatca_status='rejected', zatca_rejection_reason=<الخطأ>
         │
         ↓
الخطوة 5: العودة للواجهة الأمامية
         │
         ├── نجاح: عرض رسالة "✅ تم الإرسال بنجاح" + نافذة منبثقة برد الهيئة
         ├── NOT_REPORTED: عرض رسالة "❌ فشل الإرسال" + نافذة منبثقة بالسبب
         └── فشل: عرض رسالة "❌ تعذر الإرسال: <السبب>" + نافذة منبثقة
         │
الخطوة 6: إعادة تحميل قائمة الفواتير لتعكس الحالة الجديدة
الخطوة 7: إعادة الزر لوضعه الطبيعي
```

### نافذة رد الهيئة المنبثقة:

- عنصر HTML: `#zatcaModal`
- تظهر تلقائياً بعد كل محاولة إرسال (نجاح أو فشل)
- المحتوى: JSON المُرسل والرد المستلم منسق
- يمكن إغلاقها بالضغط على زر الإغلاق أو خارج النافذة
- يمكن فتحها يدوياً من زر "📄 رد الهيئة"

---

## 6. شاشة الفواتير الدائنة - زر الإرسال

### المسار: `src/renderer/credit_notes/renderer.js`

### الأزرار المتاحة لكل إشعار دائن:

| الزر | يظهر عندما |
|------|-----------|
| عرض الإشعار | صلاحية `credit_notes.view` |
| عرض الفاتورة | يوجد `ref_base_sale_id` + صلاحية `credit_notes.view_base` |
| 📤 إرسال للهيئة | ZATCA مفعلة + الإشعار لم يُرسل بعد |
| 📄 رد الهيئة | يوجد رد سابق (`zatca_response` أو `zatca_rejection_reason`) |
| ❌ فشل الإرسال | `zatca_status = 'rejected'` (شارة حمراء فقط) |

### السلوك المميز للفواتير الدائنة:

1. **عند الضغط على "📤 إرسال للهيئة"**:
   - نفس تدفق إرسال الفواتير العادية
   - يظهر Toast أعلى الصفحة: "⏳ جاري الإرسال للهيئة..."
   - النجاح: Toast أخضر + نافذة رد
   - الفشل: Toast أحمر + نافذة رد

2. **عند الضغط على "عرض الفاتورة"**:
   - يفتح الفاتورة الأصلية (مرجع الإشعار الدائن)
   - يمرر `hide_pay_remain=1` لإخفاء المتبقي

3. **تلميح سبب الرفض**:
   - عند وجود `zatca_rejection_reason`، يظهر tooltip عند hover على زر الإرسال

### كيفية بناء جسم الإشعار الدائن:

في `local-zatca.js > buildBodyFromSaleId`:

```javascript
// إذا كان doc_type = 'credit_note':
const type_inv = '381';  // كود الإشعار الدائن
const isCredit = true;

// القيم موجبة دائماً
const usedSum = Math.abs(sumNoVat);
const usedVat = Math.abs(vatVal);
const usedGrand = Math.abs(grandVal);

// مرجع الفاتورة الأصلية
return_id: sale.ref_base_sale_id
return_invoices: [sale.ref_base_invoice_no]

// paid = 0 (المبلغ مسترد وليس مدفوع)
paid: 0

// معلومات سبب الإشعار الدائن
branch.reason_code: sale.credit_reason_code || '01'
branch.reason_text: sale.credit_reason || sale.notes || 'Credit note'
```

---

## 7. الإرسال التلقائي (Auto-Submit)

### متى يحدث:

يتم استدعاء `autoSubmitZatcaIfEnabled(saleId)` تلقائياً عند:

1. **إنشاء إشعار دائن كامل** (`sales:create_credit_note`) - السطر 1794
2. **إنشاء إشعار دائن جزئي** (`sales:create_partial_credit_note`) - السطر 1996

### ملاحظة مهمة:
> ❗ **الفاتورة العادية** (`sales:create`) لا تشغل الإرسال التلقائي مباشرة!  
> تعتمد على **المجدول الدوري** (Scheduler) لالتقاط الفواتير غير المرسلة.

### آلية التنفيذ:

```javascript
async function autoSubmitZatcaIfEnabled(saleId) {
  // 1. التحقق من تفعيل ZATCA في الإعدادات
  const [[s]] = await conn.query('SELECT zatca_enabled FROM app_settings WHERE id=1');
  if(!s || !s.zatca_enabled) return;  // خروج صامت إذا غير مفعل

  // 2. الحصول على نسخة من جسر الإرسال (Singleton)
  const bridge = LocalZatcaBridge.getInstance();

  // 3. إرسال في الخلفية (setImmediate - غير معطل للمستخدم)
  setImmediate(async () => {
    try {
      await bridge.submitSaleById(saleId);
    } catch(_) { /* فشل صامت - المجدول سيعيد المحاولة */ }
  });
}
```

### الخصائص:
- **تنفيذ خلفي**: `setImmediate` يضمن أن المستخدم لا ينتظر
- **فشل صامت**: الأخطاء لا تظهر للمستخدم؛ المجدول يعيد المحاولة لاحقاً
- **Singleton**: نسخة واحدة فقط من `LocalZatcaBridge`
- **شرط مسبق**: يتحقق من `zatca_enabled` قبل أي محاولة

---

## 8. الجدولة الدورية لإعادة الإرسال

### المسار: `src/main/scheduler.js > submitUnsentInvoicesHourly()`

### آلية العمل:

```
بداية التطبيق
     │
     ├── setTimeout(1000ms): تشغيل أول مرة بعد ثانية واحدة
     │
     └── setInterval(15 دقيقة): تكرار كل 15 دقيقة
              │
              ▼
         ┌─────────────────────────────────────┐
         │        دالة runOnce()               │
         │                                     │
         │ 1. التحقق من عدم وجود عملية جارية    │
         │    (running flag - قفل حصري)         │
         │                                     │
         │ 2. التحقق من zatca_enabled = 1       │
         │    إذا = 0 ➜ خروج فوري               │
         │                                     │
         │ 3. استعلام الفواتير غير المرسلة:      │
         │    SELECT id FROM sales             │
         │    WHERE (zatca_status IS NULL      │
         │      OR zatca_status NOT IN         │
         │         ('submitted','accepted'))    │
         │      AND zatca_submitted IS NULL    │
         │      AND zatca_response NOT LIKE    │
         │          '%NOT_REPORTED%'           │
         │    ORDER BY id ASC                  │
         │    LIMIT 500                        │
         │                                     │
         │ 4. لكل فاتورة:                       │
         │    ├── bridge.submitSaleById(id)    │
         │    ├── console.error إذا فشل         │
         │    └── انتظار 5 ثواني بين الفواتير    │
         │        (setTimeout 5000ms)          │
         │                                     │
         │ 5. تحرير القفل (running = false)     │
         └─────────────────────────────────────┘
```

### الفواتير التي يتم تخطيها:

المجدول يتخطى الفواتير التي تستوفي أي من الشروط التالية:
- `zatca_status IN ('submitted', 'accepted')` - تم إرسالها بالفعل
- `zatca_submitted IS NOT NULL` - لديها طابع زمني للإرسال
- `zatca_response LIKE '%NOT_REPORTED%'` - مرفوضة نهائياً من الهيئة

### مهلة بين الفواتير: **5 ثواني**
لتجنب إغراق خادم API المحلي بالطلبات.

---

## 9. جسر الإرسال المحلي (LocalZatcaBridge)

### المسار: `src/main/local-zatca.js`

### نظرة عامة:

`LocalZatcaBridge` هو الجسر الأساسي الذي يستخدمه النظام لإرسال الفواتير إلى **API خارجي محلي** (عادة `localhost:8080`)، وليس مباشرة إلى بوابة ZATCA.

### الإعدادات الافتراضية:

```javascript
this.endpoint = 'http://localhost:8080/zatca_2/api/customerInvoice/submitInvoice';
this.paramName = 'invoiceJO';
this.paramAliases = ['invoiceJO','invoiceIO','invoiceIo','invoiceJson','invoice','data','payload'];
this.preferredMode = 'json-raw';
this.enableTextPlain = false;
```

### نمط Singleton:

```
أول استدعاء ➜ new LocalZatcaBridge() ➜ تخزين في LocalZatcaBridge._instance
أي استدعاء لاحق ➜ getInstance() ➜ إرجاع نفس النسخة
```

يتم تسجيل IPC handler `zatca:submitLocal` مرة واحدة فقط (`LocalZatcaBridge._ipcRegistered`).

### الخصائص التي يمكن تخصيصها عبر `.zatca-config.json > localApi`:

| الخاصية | الوصف | القيمة الافتراضية |
|---------|-------|-------------------|
| `endpoint` | عنوان API المحلي | `localhost:8080/zatca_2/...` |
| `paramName` | اسم المعلمة المفضلة | `invoiceJO` |
| `paramAliases` | الأسماء البديلة للمعلمة | مصفوفة من 7 قيم |
| `preferredMode` | استراتيجية الإرسال المفضلة | `json-raw` |
| `enableTextPlain` | السماح بمحاولة `text/plain` | `false` |

---

## 10. بناء جسم الفاتورة (buildBodyFromSaleId)

### المسار: `src/main/local-zatca.js:323-462`

### الخطوات بالتفصيل:

#### الخطوة 1: استعلام قاعدة البيانات
```sql
SELECT * FROM sales WHERE id = ?
SELECT * FROM sales_items WHERE sale_id = ?
SELECT vat_percent FROM app_settings WHERE id = 1
```

#### الخطوة 2: تحميل بيانات الشركة
من `.zatca-config.json > companyData`:
```javascript
const company = zcfg.companyData || {};
```

#### الخطوة 3: حساب المجاميع
```javascript
const subTotal = Math.abs(Number(sale.sub_total || 0));
const discount = Math.abs(Number(sale.discount_amount || 0));
const totalWithoutVAT = sale.total_after_discount ?? (subTotal - discount);
const vatTotal = Math.abs(Number(sale.vat_total || 0));
const grandTotal = Math.abs(Number(sale.grand_total || (totalWithoutVAT + vatTotal)));
```

#### الخطوة 4: UUID
```javascript
// استخدام uuid المخزن مسبقاً أو إنشاء جديد
const uuid = sale.zatca_uuid || crypto.randomUUID();
```

#### الخطوة 5: تعيين نوع المستند
```javascript
const type_inv = sale.doc_type === 'credit_note' ? '381' : '388';
```
- `388` = فاتورة ضريبية (Tax Invoice)
- `381` = إشعار دائن (Credit Note)

#### الخطوة 6: تعيين طريقة الدفع (رموز رقمية)
```javascript
mapPaymentType(method):
  'cash' / 'كاش'                    ➜ 10
  'card' / 'network' / 'mada' / 'شبكة' ➜ 20
  'transfer' / 'bank'               ➜ 30
  'mixed'                           ➜ 40
  (افتراضي)                          ➜ 10
```

#### الخطوة 7: توزيع الخصم على البنود (نسبياً)
```javascript
// لكل بند:
const linePreVat = unitPrice * qty;
const share = linePreVat / sumPreVat;    // نسبة البند من الإجمالي
const lineDiscount = discount * share;   // حصة البند من الخصم
const lineAfterDisPreVat = linePreVat - lineDiscount;
const lineTax = lineAfterDisPreVat * (taxRate / 100);
```

#### الخطوة 8: بناء كائن العميل
```javascript
customer = {
  ar_name: sale.customer_name || 'عميل نقدي',
  en_name: 'Cash Customer',
  tax_number: sale.customer_vat || '300000000000003',
  // ... عنوان افتراضي
};
```

#### الخطوة 9: بناء كائن الفرع
```javascript
branch = {
  ar_name: company.organizationName,
  branch_name: company.branchName || 'Main Branch',
  tax_number: company.vatNumber,
  commercial_num: company.commercialRegistration,
  // للإشعارات الدائنة:
  reason_code: isCredit ? sale.credit_reason_code || '01' : '',
  reason_text: isCredit ? sale.credit_reason || sale.notes : '',
  // ... عنوان من companyData.address
};
```

#### الخطوة 10: تجميع الجسم النهائي

```javascript
body = {
  id, uuid, payment_type,
  total, wanted_amount: 0,
  invoice_date: 'YYYY-MM-DD HH:mm:ss',
  return_id: (للإشعار الدائن) sale.ref_base_sale_id,
  return_invoices: [sale.ref_base_invoice_no],
  tax_rate, tax, discount,
  delivery_date: null, shipping_price: 0, shipping_tax: 0,
  type_inv: '388' أو '381',
  type_invoice: '0200000',
  sum, total_without_tax, total_with_tax,
  paid: (للإشعار الدائن) 0,
  customer, branch, products: itemsMapped
};
```

**ملاحظة هامة**: قيم الفواتير الدائنة تكون موجبة دائماً (`Math.abs()`).

---

## 11. استراتيجيات الإرسال المتعددة (Fallback Strategies)

### المسار: `src/main/local-zatca.js:216-283`

عند إرسال فاتورة، يحاول الجسر 6 استراتيجيات مختلفة بالتسلسل حتى ينجح:

```
preferredMode ➜ باقي الاستراتيجيات (بالترتيب)
```

### الاستراتيجيات الستة:

| # | النمط | Content-Type | شكل البيانات |
|---|-------|-------------|-------------|
| 1 | `json-raw` | `application/json` | `JSON.stringify(body)` مباشرة |
| 2 | `json-wrapped` | `application/json` | `{ "invoiceJO": body }` (يجرب كل الأسماء المستعارة) |
| 3 | `json-wrapped-string` | `application/json` | `{ "invoiceJO": JSON.stringify(body) }` |
| 4 | `form` | `application/x-www-form-urlencoded` | `invoiceJO=JSON.stringify(body)` |
| 5 | `multipart` | `multipart/form-data` | بناء multipart يدوي |
| 6 | `text-plain` | `text/plain` | `JSON.stringify(body)` (معطل افتراضياً) |

### آلية التكرار:

```javascript
async sendWithFallback(body) {
  for (const mode of modes) {
    try {
      return await tryMode(mode);
    } catch (e) {
      // تخزين الخطأ والانتقال للاستراتيجية التالية
      // استثناء: إذا كان الخطأ ليس 415 أو "Missing invoiceJO/IO"،
      //   نتوقف فوراً (الخطأ ليس متعلقاً بشكل البيانات)
    }
  }
  throw lastError; // جميع المحاولات فشلت
}
```

### منطق التوقف المبكر:

لكل اسم معلمة (`invoiceJO`, `invoiceIO`, ...):
- إذا كان كود HTTP = **415** (Unsupported Media Type): نجرب الاسم التالي
- إذا كان الرد يحتوي `Missing invoice...`: نجرب الاسم التالي  
- أي خطأ آخر: **نتوقف فوراً** - المشكلة ليست في شكل البيانات

### سجل المحاولات:

في حالة الفشل، يُرفق سجل بكل المحاولات:
```
HTTP 500 at http://... | mode=json-raw, param=invoiceJO
Internal Server Error
Attempts: [json-raw:invoiceJO -> 500] [json-wrapped:invoiceJO -> 415] [json-wrapped:invoiceIO -> 500] [form:invoiceJO -> 500]
```

---

## 12. معالجة الردود وتحديث الحالة

### تحديث قاعدة البيانات بعد الإرسال:

#### حالة النجاح (Submitted):
```sql
UPDATE sales SET 
  zatca_uuid = ?,
  zatca_hash = ?,
  zatca_qr = ?,
  zatca_submitted = NOW(),
  zatca_status = 'submitted',
  zatca_rejection_reason = NULL,
  zatca_response = ?
WHERE id = ?
```

#### حالة NOT_REPORTED (مرفوض):
يتم الكشف عن هذه الحالة عبر:
```javascript
const notReported = /NOT[_\s-]?REPORTED/i.test(rawResp)
  || obj?.statusCode === 'NOT_REPORTED'
  || obj?.status === 'NOT_REPORTED'
  || obj?.data?.status === 'NOT_REPORTED';
```

```sql
UPDATE sales SET
  zatca_uuid = ?,
  zatca_hash = NULL,        -- مسح الهاش
  zatca_qr = NULL,           -- مسح QR
  zatca_status = 'rejected',
  zatca_rejection_reason = 'NOT_REPORTED',
  zatca_response = ?
WHERE id = ?
```

#### حالة فشل (خطأ HTTP/شبكة):
```sql
UPDATE sales SET
  zatca_status = 'rejected',
  zatca_rejection_reason = ?,   -- نص الخطأ
  zatca_response = ?            -- الرد الكامل
WHERE id = ?
```

### استخراج البيانات من الرد:

```javascript
// محاولة استخراج invoiceHash و qrCode من الرد
const obj = JSON.parse(respData);
invoiceHash = obj?.invoiceHash || obj?.data?.invoiceHash || null;
qrCode = obj?.qrCode || obj?.data?.qrCode || null;
```

### قيم `zatca_status` المحتملة:

| القيمة | المعنى |
|--------|--------|
| `NULL` | لم تتم محاولة الإرسال بعد |
| `pending` | قيد الانتظار (افتراضي) |
| `submitted` | تم الإرسال بنجاح |
| `accepted` | مقبولة من الهيئة (للاستخدام المستقبلي) |
| `rejected` | مرفوضة من الهيئة |

---

## 13. التكامل المباشر مع بوابة ZATCA

### المسار: `src/main/zatca.js` - `ZatcaIntegration`

هذا المكون يوفر التكامل المباشر مع بوابة ZATCA الرسمية (غير مستخدم حالياً في المسار التلقائي، لكنه جاهز للتكامل المباشر).

### نقاط النهاية (Endpoints):

| البيئة | العنوان |
|--------|---------|
| Sandbox (تجريبي) | `https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal` |
| Simulation (محاكاة) | `https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation` |
| Production (إنتاج) | `https://gw-fatoora.zatca.gov.sa/e-invoicing/core` |

### التدفق الكامل للتكامل المباشر:

```
┌──────────────────────────────────────────────────────┐
│  المرحلة 1: إنشاء شهادة الامتثال                       │
│                                                      │
│  1. إدخال OTP من بوابة فاتورة                          │
│  2. generateCSR(companyData)                         │
│     ├── إنشاء زوج مفاتيح RSA 2048-bit                 │
│     ├── بناء CSR بمعلومات المنشأة                      │
│     ├── توقيع CSR بالمفتاح الخاص                       │
│     └── حفظ privateKey + CSR في config               │
│                                                      │
│  3. submitCSR(csr, otp)                              │
│     ├── POST إلى {endpoint}/compliance               │
│     ├── Headers: OTP, Accept-Version: V2              │
│     └── استلام binarySecurityToken (شهادة الامتثال)   │
│                                                      │
│  4. installCertificate(certData)                     │
│     └── حفظ الشهادة + credentials                    │
└──────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────┐
│  المرحلة 2: إنشاء وإرسال الفواتير                      │
│                                                      │
│  1. generateInvoice(invoiceData)                     │
│     ├── التحقق من صحة البيانات                        │
│     ├── بناء XML UBL 2.0                            │
│     └── (لفاتورة دائنة) generateCreditNoteXML()      │
│                                                      │
│  2. signInvoice(invoiceXML)                          │
│     ├── إنشاء SHA256 hash للـ XML                    │
│     ├── توقيع XML باستخدام RSA-SHA256                │
│     ├── تضمين XAdES enveloped signature              │
│     ├── إضافة UUID                                   │
│     └── ترميز Base64                                 │
│                                                      │
│  3. submitInvoice(signedInvoice)                     │
│     ├── POST إلى {endpoint}/invoices/reporting/single│
│     ├── Authorization: Basic (username:password)     │
│     └── Body: { invoiceHash, uuid, invoice(base64) } │
└──────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────┐
│  المرحلة 3: فحص الامتثال                               │
│                                                      │
│  1. complianceCheck(invoiceData)                     │
│     ├── generateInvoice ➜ signInvoice                │
│     └── POST إلى {endpoint}/compliance/invoices      │
│                                                      │
│  2. getComplianceReport()                            │
│     └── تقرير محلي: حالة الشهادة، البيئة، وقت التحديث  │
└──────────────────────────────────────────────────────┘
```

---

## 14. إنشاء شهادة الامتثال (CSR)

### المسار: `src/main/zatca.js:109-167`

### خطوات إنشاء CSR:

```javascript
async generateCSR(companyData) {
  // 1. إنشاء زوج مفاتيح RSA 2048 بت
  const keys = forge.pki.rsa.generateKeyPair(2048);
  
  // 2. إنشاء طلب CSR
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = keys.publicKey;
  
  // 3. إعداد موضوع الشهادة (Subject)
  csr.setSubject([
    { name: 'countryName',            value: 'SA' },
    { name: 'organizationName',       value: companyData.organizationName },
    { name: 'organizationalUnitName', value: companyData.organizationalUnit || 'IT Department' },
    { name: 'commonName',             value: companyData.commonName },
    { name: 'serialNumber',           value: companyData.serialNumber }
  ]);
  
  // 4. إضافة الامتدادات المطلوبة من ZATCA (SubjectAltName)
  extensions = [
    { type: 1, value: companyData.serialNumber },        // الرقم الضريبي
    { type: 2, value: companyData.vatNumber },            // رقم التسجيل
    { type: 6, value: companyData.businessCategory },     // فئة النشاط
    { type: 1, value: companyData.location }              // الموقع
  ];
  
  // 5. توقيع CSR
  csr.sign(keys.privateKey);
  
  // 6. حفظ المفاتيح
  this.config.certificates.privateKey = privateKeyPem;
  this.config.certificates.csr = csrPem;
  await this.saveConfig(this.config);
  
  return { success: true, csr: csrPem };
}
```

### إرسال CSR إلى ZATCA:

```javascript
async submitCSR(csr, otp) {
  // POST إلى {endpoint}/compliance
  const response = await axios.post(url, {
    csr: Buffer.from(csr).toString('base64')
  }, {
    headers: {
      'Accept': 'application/json',
      'OTP': otp,                    // رمز التحقق من بوابة فاتورة
      'Accept-Version': 'V2',
      'Content-Type': 'application/json'
    }
  });
  
  // حفظ الشهادة المستلمة
  this.config.certificates.certificate = response.data.binarySecurityToken;
  this.config.credentials.username = response.data.requestID;
  this.config.credentials.password = response.data.secret;
}
```

---

## 15. توليد فاتورة XML بصيغة UBL 2.0

### المسار: `src/main/zatca-invoice-generator.js`

### مواصفات XML:

- **مساحة الأسماء**: `urn:oasis:names:specification:ubl:schema:xsd:Invoice-2`
- **التخصيص**: `urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0`
- **الملف التعريفي**: `reporting:1.0`
- **العملة**: `SAR` (ريال سعودي)

### هيكل الفاتورة XML:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  
  <!-- معلومات أساسية -->
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#...</cbc:CustomizationID>
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>رقم الفاتورة</cbc:ID>
  <cbc:IssueDate>YYYY-MM-DD</cbc:IssueDate>
  <cbc:IssueTime>HH:mm:ss</cbc:IssueTime>
  <cbc:InvoiceTypeCode listAgencyID="6" listID="UN/ECE 1001 Subset">388</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>
  
  <!-- البائع (Supplier) -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>اسم المنشأة</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>الشارع</cbc:StreetName>
        <cbc:BuildingNumber>رقم المبنى</cbc:BuildingNumber>
        <cbc:CityName>المدينة</cbc:CityName>
        <cbc:PostalZone>الرمز البريدي</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>300238587100003</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>اسم المنشأة</cbc:RegistrationName>
        <cbc:CompanyID schemeID="CRN">4031067948</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  
  <!-- المشتري (Customer) -->
  <cac:AccountingCustomerParty>...</cac:AccountingCustomerParty>
  
  <!-- طريقة الدفع (UN/ECE 4461) -->
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode listAgencyID="6" listID="UN/ECE 4461">10</cbc:PaymentMeansCode>
  </cac:PaymentMeans>
  
  <!-- المجموع الضريبي -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">XX.XX</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="SAR">XX.XX</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="SAR">XX.XX</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>15.00</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  
  <!-- المجاميع القانونية -->
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">XX.XX</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">XX.XX</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">XX.XX</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="SAR">XX.XX</cbc:PayableAmount>
    <cbc:AllowanceTotalAmount currencyID="SAR">XX.XX</cbc:AllowanceTotalAmount> <!-- إن وجد -->
  </cac:LegalMonetaryTotal>
  
  <!-- بنود الفاتورة -->
  <cac:InvoiceLine>...</cac:InvoiceLine>
</Invoice>
```

### رموز طرق الدفع (UN/ECE 4461):

| الطريقة | الكود |
|---------|-------|
| نقدي (Cash) | 10 |
| بطاقة ائتمان (Credit) | 48 |
| بطاقة خصم (Debit) | 49 |
| تحويل بنكي (Transfer) | 42 |
| شيك (Check) | 20 |

### أنواع المستندات (UN/ECE 1001):

| النوع | الكود |
|-------|-------|
| فاتورة ضريبية (Tax Invoice) | 388 |
| إشعار دائن (Credit Note) | 381 |

### دقة الحسابات (EN16931-11):

```javascript
// التقريب لضمان توافق EN16931-11:
const round2 = (n) => Number((Math.round((Number(n)||0) * 100) / 100).toFixed(2));
const toFixed4 = (n) => (Number(n)||0).toFixed(4);

// BT-131 = Qty(BT-129) * (PriceAmount(BT-146) / BaseQuantity(BT-149))
//         + Sum(Charges) - Sum(Allowances)
const lineNet = round2(lineBase - lineDiscount + lineCharge);
```

### التعامل مع الأسعار شاملة الضريبة:

إذا كان `prices_include_vat = true` (الإعداد الافتراضي):
- `unitPrice` يعتبر شامل الضريبة
- يستخدم `unitPriceIsGross = true` للإشارة إلى ذلك
- يتم اشتقاق السعر الصافي تلقائياً: `unitPrice / (1 + vatRate/100)`

إذا كان `prices_include_vat = false`:
- يستخدم `unitPriceNet` مباشرة كسعر صافي

---

## 16. التوقيع الرقمي (XAdES)

### المسار: `src/main/zatca-digital-signature.js`

### خطوات التوقيع:

```
1. تحليل XML ➜ كائن JavaScript
         ↓
2. التأكد من إيجابية كل القيم الرقمية
   ensureAllAmountsPositive(node)
   ├── يمر على جميع العناصر: Amount, TaxAmount, Quantity, PriceAmount, ...
   └── يحول أي قيمة سالبة إلى موجبة Math.abs()
         ↓
3. إعادة بناء XML من الكائن المُصحح
         ↓
4. إنشاء SHA256 hash للـ XML
   generateInvoiceHash(xml)
   ├── تنظيف XML: إزالة المسافات بين الوسوم
   └── crypto.createHash('sha256') ➜ base64
         ↓
5. إنشاء UUID v4 للفاتورة
         ↓
6. بناء توقيع XAdES المغلف (Enveloped)
   ├── SignedInfo:
   │   ├── CanonicalizationMethod: xml-c14n11
   │   ├── SignatureMethod: rsa-sha256
   │   └── Reference (URI=""):
   │       ├── Transforms: enveloped-signature + xml-c14n11
   │       ├── DigestMethod: sha256
   │       └── DigestValue: invoiceHash
   ├── SignatureValue: signData(xml, privateKey)
   │   └── crypto.createSign('SHA256') ➜ RSA ➜ base64
   └── KeyInfo:
       └── X509Data:
           └── X509Certificate: compliance certificate
         ↓
7. تضمين التوقيع في UBLExtensions
   xmlDoc.Invoice.UBLExtensions.UBLExtension.push(signatureExtension)
         ↓
8. بناء XML النهائي الموقع
         ↓
9. ترميز Base64 للإرسال
   Buffer.from(finalXML).toString('base64')
         ↓
10. إرجاع: { signedXML, hash, uuid, base64 }
```

### التأكد من إيجابية القيم:

الدالة `ensureAllAmountsPositive()` تمر على جميع القيم الرقمية في XML وتضمن أنها موجبة:

```javascript
const numericTags = new Set([
  'Amount','TaxAmount','TaxableAmount','LineExtensionAmount','PriceAmount',
  'PayableAmount','TaxExclusiveAmount','TaxInclusiveAmount',
  'AllowanceTotalAmount','ChargeTotalAmount','PrepaidAmount','RoundingAmount',
  'Quantity','InvoicedQuantity','CreditedQuantity','DebitedQuantity',
  'BaseQuantity','Percent'
]);
```

### خوارزمية التوقيع:

- **التجزئة**: SHA-256
- **التوقيع**: RSA مع مفتاح خاص 2048-bit
- **التنسيق**: PKCS#1 v1.5 padding
- **الترميز**: Base64
- **XAdES**: UBL Digital Signature Extension (enveloped)

---

## 17. الفواتير الدائنة (Credit Notes)

### المسار: `src/main/zatca-invoice-generator.js:634-710` + `src/main/local-zatca.js:398-457`

### هيكل XML للإشعار الدائن:

```xml
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2" ...>
  <cbc:CreditNoteTypeCode listAgencyID="6" listID="UN/ECE 1001 Subset">381</cbc:CreditNoteTypeCode>
  
  <!-- مرجع الفاتورة الأصلية -->
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>رقم الفاتورة الأصلية</cbc:ID>
      <cbc:IssueDate>YYYY-MM-DD</cbc:IssueDate>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>
  
  <!-- بنود الإشعار الدائن (كميات موجبة) -->
  <cac:CreditNoteLine>
    <cbc:CreditedQuantity unitCode="PCE">XX.XXXX</cbc:CreditedQuantity>
    ...
  </cac:CreditNoteLine>
</CreditNote>
```

### الفروقات بين الفاتورة والإشعار الدائن:

| العنصر | الفاتورة (388) | الإشعار الدائن (381) |
|--------|---------------|---------------------|
| مساحة الأسماء | `Invoice-2` | `CreditNote-2` |
| نوع المستند | `InvoiceTypeCode` | `CreditNoteTypeCode` |
| الكمية | `InvoicedQuantity` | `CreditedQuantity` |
| البنود | `InvoiceLine` | `CreditNoteLine` |
| مرجع الفاتورة | لا يوجد | `BillingReference` |
| القيم | عادية | `Math.abs()` موجبة |
| paid | = grandTotal | = 0 |
| type_inv | '388' | '381' |
| return_id | null | ref_base_sale_id |
| return_invoices | [] | [ref_base_invoice_no] |
| reason_code | '' | credit_reason_code أو '01' |
| reason_text | '' | credit_reason أو notes |

### أكواد أسباب الإشعار الدائن (ZATCA):

| الكود | السبب |
|-------|-------|
| 01 | إرجاع بضاعة |
| 02 | خصم تجاري |
| 03 | خطأ في الفاتورة |
| 04 | تصحيح ضريبي |
| ... | (حسب متطلبات الهيئة) |

### سيناريو إنشاء إشعار دائن:

```
1. المستخدم ينشئ إشعار دائن (كامل أو جزئي)
   ↓
2. sales.js: createCreditNote / createPartialCreditNote
   ├── حفظ sale جديد مع doc_type='credit_note'
   ├── ربطه بالفاتورة الأصلية (ref_base_sale_id, ref_base_invoice_no)
   └── commit المعاملة
   ↓
3. autoSubmitZatcaIfEnabled(newId)
   ├── التحقق من zatca_enabled
   └── setImmediate ➜ bridge.submitSaleById(newId)
   ↓
4. LocalZatcaBridge.buildBodyFromSaleId:
   ├── type_inv = '381' (إشعار دائن)
   ├── القيم موجبة (Math.abs)
   ├── paid = 0
   ├── return_id = ref_base_sale_id
   └── return_invoices = [ref_base_invoice_no]
   ↓
5. إرسال إلى API المحلي
   ↓
6. تحديث zatca_status في قاعدة البيانات
```

---

## 18. جميع حقول قاعدة البيانات

### جدول `app_settings` (id=1):

| العمود | النوع | الوصف |
|--------|-------|-------|
| `zatca_enabled` | `TINYINT NOT NULL DEFAULT 0` | مفتاح التفعيل الرئيسي (0=معطل، 1=مفعل) |
| `vat_percent` | (موجود مسبقاً) | نسبة الضريبة (15% افتراضي) |
| `prices_include_vat` | (موجود مسبقاً) | هل الأسعار شاملة الضريبة |

### جدول `sales` (حقول ZATCA):

| العمود | النوع | الوصف |
|--------|-------|-------|
| `zatca_uuid` | `VARCHAR(255) NULL` | معرف فريد للفاتورة (UUID v4) |
| `zatca_hash` | `VARCHAR(255) NULL` | SHA256 hash للـ XML الموقع |
| `zatca_qr` | `TEXT NULL` | QR Code بتنسيق Base64 (TLV) |
| `zatca_submitted` | `DATETIME NULL` | تاريخ ووقت آخر محاولة إرسال |
| `zatca_status` | `ENUM('pending','submitted','accepted','rejected') NULL DEFAULT 'pending'` | حالة الإرسال |
| `zatca_rejection_reason` | `TEXT NULL` | سبب الرفض من الهيئة |
| `zatca_response` | `LONGTEXT NULL` | الرد الكامل من API الهيئة |

### حقول أخرى ذات صلة في `sales`:

| العمود | الوصف |
|--------|-------|
| `doc_type` | `ENUM('invoice','credit_note')` - نوع المستند |
| `ref_base_sale_id` | معرف الفاتورة الأصلية (للإشعار الدائن) |
| `ref_base_invoice_no` | رقم الفاتورة الأصلية (للإشعار الدائن) |
| `credit_reason_code` | كود سبب الإشعار الدائن |
| `credit_reason` | نص سبب الإشعار الدائن |
| `customer_vat` | الرقم الضريبي للعميل |

---

## 19. جميع قنوات IPC

### مجموعة `zatca:*` (من `zatca.js`):

| القناة | الاتجاه | الوصف |
|--------|---------|-------|
| `zatca:getConfig` | renderer ➜ main | استرجاع إعدادات ZATCA (بدون بيانات حساسة) |
| `zatca:saveConfig` | renderer ➜ main | حفظ إعدادات ZATCA |
| `zatca:generateCSR` | renderer ➜ main | إنشاء زوج مفاتيح + CSR |
| `zatca:submitCSR` | renderer ➜ main | إرسال CSR للهيئة مع OTP |
| `zatca:installCertificate` | renderer ➜ main | تثبيت شهادة الامتثال |
| `zatca:generateInvoice` | renderer ➜ main | توليد XML فاتورة UBL 2.0 |
| `zatca:signInvoice` | renderer ➜ main | توقيع XML الفاتورة |
| `zatca:submitInvoice` | renderer ➜ main | إرسال فاتورة موقعة لبوابة ZATCA |
| `zatca:complianceCheck` | renderer ➜ main | فحص امتثال فاتورة تجريبية |
| `zatca:getComplianceReport` | renderer ➜ main | تقرير حالة الامتثال |

### مجموعة `sales:*` (من `sales.js`):

| القناة | الوصف |
|--------|-------|
| `sales:zatca_generate` | إنشاء فاتورة ZATCA من بيانات بيع |
| `sales:zatca_submit` | إرسال فاتورة ZATCA للبوابة |
| `sales:zatca_status` | حالة تكامل ZATCA (مفعل/مهيأ/البيئة) |
| `sales:update_zatca_data` | تحديث سجل بيع ببيانات ZATCA |

### مجموعة `zatca:*` (من `local-zatca.js`):

| القناة | الوصف |
|--------|-------|
| `zatca:submitLocal` | إرسال فاتورة إلى API المحلي (المستخدم الأساسي حالياً) |

### الوظائف المكشوفة للواجهة الأمامية عبر `contextBridge`:

```javascript
// في preload.js
window.electronAPI.zatca = {
  getConfig, saveConfig,
  generateCSR, submitCSR, installCertificate,
  generateInvoice, signInvoice, submitInvoice,
  complianceCheck, getComplianceReport,
  generateForSale, submitForSale, getSalesStatus, updateSaleZatcaData
};

window.electronAPI.localZatca = {
  submitBySaleId(sale_id),    // الخيار A: إرسال بـ sale_id
  submitWithBody(body)        // الخيار B: إرسال بجسم مخصص
};
```

---

## 20. جميع السيناريوهات وسير العمل

### السيناريو 1: التهيئة الأولية للربط

```
1. فتح شاشة ZATCA من القائمة الرئيسية
   (بطاقة "الفاتورة الإلكترونية")
         ↓
2. إدخال بيانات المنشأة:
   - اسم المنشأة
   - الرقم الضريبي (15 رقم)
   - السجل التجاري (10 أرقام)
   - العنوان الكامل
   - فئة النشاط
         ↓
3. حفظ التكوين
   ➜ zatca:saveConfig
   ➜ كتابة .zatca-config.json
         ↓
4. فتح شاشة الإعدادات > تبويب الضريبة
         ↓
5. تفعيل "الربط الإلكتروني (ZATCA)"
   ➜ zatca_enabled = 1 في app_settings
         ↓
✅ النظام جاهز للإرسال
```

### السيناريو 2: إرسال فاتورة عادية

```
1. إنشاء فاتورة جديدة (sales:create)
   ➜ حفظ في جدول sales
   ➜ zatca_status = NULL (افتراضي)
   ➜ لا يتم الإرسال فوراً!
         ↓
2. المجدول الدوري يلتقط الفاتورة (خلال 15 دقيقة)
   أو
   المستخدم يضغط "📤 إرسال للهيئة" من شاشة الفواتير
         ↓
3. LocalZatcaBridge.submitSaleById(sale_id)
   ├── buildBodyFromSaleId: بناء الجسم
   ├── sendWithFallback: تجربة 6 استراتيجيات
   └── POST إلى API المحلي
         ↓
4. تحليل الرد:
   ├── نجاح ➜ zatca_status='submitted'
   ├── NOT_REPORTED ➜ zatca_status='rejected'
   └── فشل ➜ zatca_status='rejected'
         ↓
5. ظهور الحالة في جدول الفواتير:
   ✅ تم الإرسال / ❌ فشل / ⏳ لم يتم الإرسال
```

### السيناريو 3: إرسال إشعار دائن

```
1. إنشاء إشعار دائن من شاشة المبيعات
   (مرتجع كامل أو جزئي)
         ↓
2. sales:create_credit_note / sales:create_partial_credit_note
   ├── doc_type = 'credit_note'
   ├── ref_base_sale_id + ref_base_invoice_no
   ├── credit_reason_code + credit_reason
   └── commit
         ↓
3. autoSubmitZatcaIfEnabled(newId) يُستدعى فوراً!
   (على عكس الفاتورة العادية)
         ↓
4. setImmediate ➜ bridge.submitSaleById(newId)
   ├── type_inv = '381'
   ├── paid = 0
   ├── return_id + return_invoices
   └── القيم موجبة (Math.abs)
         ↓
5. إرسال إلى API المحلي
         ↓
6. تحديث الحالة في قاعدة البيانات
```

### السيناريو 4: إعادة إرسال فاتورة فشلت

```
1. المجدول الدوري يعمل كل 15 دقيقة
         ↓
2. استعلام الفواتير غير المرسلة:
   WHERE zatca_status NOT IN ('submitted','accepted')
     AND zatca_submitted IS NULL
     AND zatca_response NOT LIKE '%NOT_REPORTED%'
         ↓
3. محاولة إرسال كل فاتورة (بحد أقصى 500)
   ├── انتظار 5 ثواني بين كل فاتورة
   └── تسجيل الأخطاء في console.error
         ↓
4. إذا نجح الإرسال:
   zatca_status = 'submitted'
   zatca_submitted = NOW()
         ↓
5. إذا فشل مرة أخرى:
   zatca_status = 'rejected'
   zatca_rejection_reason = نص الخطأ
   (لن يعاد محاولة هذه الفاتورة لأن zatca_submitted سيصبح NOT NULL)
```

### السيناريو 5: فاتورة مرفوضة (NOT_REPORTED)

```
1. API المحلي يرجع رد يحتوي على "NOT_REPORTED"
         ↓
2. LocalZatcaBridge يكتشف الحالة:
   /NOT[_\s-]?REPORTED/i.test(rawResp)
   || obj.statusCode === 'NOT_REPORTED'
   || obj.status === 'NOT_REPORTED'
         ↓
3. تحديث قاعدة البيانات:
   zatca_status = 'rejected'
   zatca_rejection_reason = 'NOT_REPORTED'
   zatca_hash = NULL (مسح)
   zatca_qr = NULL (مسح)
         ↓
4. المجدول لن يعيد محاولة هذه الفاتورة
   (شرط zatca_response NOT LIKE '%NOT_REPORTED%')
         ↓
5. المستخدم يرى: ❌ فشل في جدول الفواتير
   + tooltip بسبب الرفض
```

### السيناريو 6: فشل الاتصال بـ API المحلي

```
1. محاولة الإرسال تفشل (خطأ شبكة، API غير متاح، ...)
         ↓
2. sendWithFallback يجرب كل الاستراتيجيات
   json-raw ➜ json-wrapped ➜ json-wrapped-string
   ➜ form ➜ multipart ➜ text-plain
         ↓
3. جميع المحاولات تفشل
         ↓
4. تحديث قاعدة البيانات:
   zatca_status = 'rejected'
   zatca_rejection_reason = رسالة الخطأ
   zatca_response = الرد الكامل (إن وجد)
         ↓
5. المجدول سيعيد المحاولة في الدورة التالية
   (لأن zatca_submitted لا يزال NULL)
         ↓
6. المستخدم يرى رسالة خطأ مفصلة:
   HTTP ERR at http://... | mode=json-raw, param=invoiceJO
   [نص الخطأ]
   Attempts: [json-raw -> ERR] [json-wrapped:invoiceJO -> ERR] ...
```

### السيناريو 7: إرسال يدوي من شاشة المبيعات

```
1. المستخدم في شاشة المبيعات
         ↓
2. الضغط على زر "إرسال للهيئة" (btnZatcaSendTop)
         ↓
3. ظهور prompt: "أدخل رقم الفاتورة"
         ↓
4. zatcaSendByInvoiceNo(invoiceNo):
   ├── sales_list({ q: invoiceNo }) للبحث عن الفاتورة
   ├── مطابقة تامة على invoice_no
   └── localZatca.submitBySaleId(row.id)
         ↓
5. نجاح ➜ alert("تم الإرسال بنجاح")
   فشل ➜ alert("فشل الإرسال: ...")
```

### السيناريو 8: التكامل المباشر مع بوابة ZATCA (للاختبار)

```
1. الحصول على OTP من بوابة فاتورة (fatoora.zatca.gov.sa)
         ↓
2. zatca:generateCSR ➜ إنشاء CSR
         ↓
3. zatca:submitCSR(csr, otp) ➜ إرسال CSR
   ➜ استلام شهادة الامتثال (binarySecurityToken)
         ↓
4. zatca:generateInvoice ➜ إنشاء XML
         ↓
5. zatca:signInvoice ➜ توقيع XML
         ↓
6. zatca:submitInvoice ➜ إرسال للبوابة
   POST إلى {endpoint}/invoices/reporting/single
         ↓
7. zatca:complianceCheck ➜ فحص امتثال
   POST إلى {endpoint}/compliance/invoices
```

### السيناريو 9: تعطيل الربط الإلكتروني

```
1. فتح شاشة الإعدادات > تبويب الضريبة
         ↓
2. إلغاء تحديد "تفعيل الربط الإلكتروني (ZATCA)"
         ↓
3. حفظ الإعدادات
   ➜ zatca_enabled = 0
         ↓
4. التأثيرات:
   ❌ الإرسال التلقائي يتوقف (autoSubmitZatcaIfEnabled)
   ❌ المجدول الدوري يتوقف (submitUnsentInvoicesHourly)
   ❌ أزرار الإرسال تختفي من شاشات الفواتير
   ❌ عمود ZATCA يظهر "غير مفعل"
   ✅ الفواتير المخزنة سابقاً لا تتأثر
```

### السيناريو 10: إرسال بجسم مخصص (خارجي)

```
1. نظام خارجي يرسل بيانات فاتورة كاملة
         ↓
2. localZatca.submitWithBody(body)
   ➜ zatca:submitLocal مع { body } فقط
         ↓
3. لا يتم بناء الجسم من قاعدة البيانات
   يتم استخدام body مباشرة كما هو
         ↓
4. إرسال إلى API المحلي
         ↓
5. (اختياري) تحديث سجل البيع إذا تضمن sale_id
```

---

## 📊 ملخص التدفق الكامل

```
┌─────────────────────────────────────────────────────────────────────┐
│                        دورة حياة الفاتورة مع ZATCA                    │
│                                                                     │
│  1. إنشاء فاتورة                                                     │
│     sales:create                                                    │
│     └── حفظ في قاعدة البيانات (zatca_status = NULL)                 │
│                                                                     │
│  2. الإرسال (أحد المسارات التالية)                                   │
│     ├── [تلقائي] للإشعارات الدائنة فقط (autoSubmitZatcaIfEnabled)    │
│     ├── [دوري] المجدول كل 15 دقيقة (submitUnsentInvoicesHourly)     │
│     └── [يدوي] زر "إرسال للهيئة" من شاشات الفواتير                  │
│                                                                     │
│  3. بناء جسم الفاتورة (LocalZatcaBridge)                             │
│     ├── استعلام sales + sales_items                                 │
│     ├── تحميل بيانات الشركة من .zatca-config.json                   │
│     ├── حساب المجاميع والضرائب                                       │
│     ├── توزيع الخصم على البنود                                       │
│     └── تعيين نوع المستند وطريقة الدفع                               │
│                                                                     │
│  4. الإرسال (sendWithFallback)                                       │
│     ├── المحاولة 1: json-raw (application/json)                     │
│     ├── المحاولة 2: json-wrapped (مع اسماء معلمة مختلفة)             │
│     ├── المحاولة 3: json-wrapped-string                             │
│     ├── المحاولة 4: form-urlencoded                                 │
│     ├── المحاولة 5: multipart/form-data                             │
│     └── المحاولة 6: text/plain (إذا مفعلة)                          │
│                                                                     │
│  5. معالجة الرد                                                      │
│     ├── نجاح ➜ submitted                                            │
│     ├── NOT_REPORTED ➜ rejected (لن يعاد المحاولة)                  │
│     └── فشل ➜ rejected (سيعاد المحاولة في الدورة التالية)           │
│                                                                     │
│  6. تحديث قاعدة البيانات                                             │
│     ├── zatca_uuid, zatca_hash, zatca_qr                            │
│     ├── zatca_submitted = NOW()                                     │
│     ├── zatca_status = 'submitted' | 'rejected'                     │
│     ├── zatca_rejection_reason (للرفض)                               │
│     └── zatca_response (الرد الكامل)                                 │
│                                                                     │
│  7. التغذية الراجعة للمستخدم                                         │
│     ├── تحديث جدول الفواتير (حالة ZATCA)                             │
│     ├── نافذة منبثقة برد الهيئة                                       │
│     └── Toast (نجاح/فشل) للأشعارات الدائنة                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔑 مفاتيح ومتطلبات هامة

1. **تفعيل `zatca_enabled`**: يجب أن يكون = 1 في `app_settings` لأي عملية إرسال
2. **ملف `zatca-config.json`**: يجب أن يحتوي على `companyData` صالحة (خاصة vatNumber)
3. **API المحلي**: يجب أن يكون متاحاً على `localhost:8080` (أو endpoint مخصص)
4. **UUID**: كل فاتورة تحصل على UUID فريد، يُعاد استخدامه في المحاولات اللاحقة
5. **5 ثواني**: المهلة بين الفواتير في الإرسال الدوري
6. **15 دقيقة**: دورة المجدول الدوري
7. **500 فاتورة**: الحد الأقصى للفاتورة في الدورة الواحدة
8. **NOT_REPORTED**: حالة خاصة لا يُعاد معها الإرسال أبداً
9. **قيم موجبة**: جميع المبالغ في XML تكون موجبة (Math.abs)
10. **نسبة الضريبة**: تقرأ من `app_settings.vat_percent` (افتراضي 15%)
