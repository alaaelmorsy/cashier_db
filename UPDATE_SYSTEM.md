# نظام التحديثات التلقائية — توثيق شامل

> **الإصدار الحالي**: 1.0.117  
> **التقنية**: `electron-updater` v6.1.7 + GitHub Releases  
> **التطبيق**: الرابط كاشير (`com.alrabt.cashier`)

---

## جدول المحتويات

1. [نظرة عامة](#1-نظرة-عامة)
2. [الملفات المعنية](#2-الملفات-المعنية)
3. [إعداد electron-updater](#3-إعداد-electron-updater)
4. [تدفق التحديث كاملاً](#4-تدفق-التحديث-كاملاً)
5. [مقارنة الإصدارات](#5-مقارنة-الإصدارات)
6. [التحقق من صلاحية الدعم الفني](#6-التحقق-من-صلاحية-الدعم-الفني)
7. [قنوات IPC بين Main وRenderer](#7-قنوات-ipc-بين-main-وrenderer)
8. [واجهة المستخدم للتحديث](#8-واجهة-المستخدم-للتحديث)
9. [CI/CD وإصدار الملفات](#9-cicd-وإصدار-الملفات)
10. [كيفية النقل لبرنامج آخر](#10-كيفية-النقل-لبرنامج-آخر)

---

## 1. نظرة عامة

النظام يعتمد على:
- **electron-updater**: مكتبة التحديث التلقائي لتطبيقات Electron
- **GitHub Releases**: مستودع إصدارات الملفات (`alaaelmorsy/cashier_db`)
- **electron-builder**: بناء المثبّت ورفع `latest.yml` مع كل إصدار

### خصائص النظام

| الخاصية | القيمة |
|---------|--------|
| التحميل التلقائي | ❌ يدوي (المستخدم يبدأ التحميل) |
| التثبيت عند الإغلاق | ✅ `autoInstallOnAppQuit = true` |
| توقيع الكود | ❌ `verifyUpdateCodeSignature: false` |
| صيغ المثبّت | NSIS (`.exe`) + MSI (`.msi`) |
| لغة الواجهة | عربي بالكامل |
| حماية انتهاء الدعم | ✅ يمنع التحميل/التثبيت إذا انتهى الدعم |

---

## 2. الملفات المعنية

```
project/
├── package.json                          ← رقم الإصدار (version)
├── dev-app-update.yml                    ← إعداد التحديث في بيئة التطوير
├── .github/workflows/build-release.yml   ← CI/CD pipeline
├── src/
│   ├── main/
│   │   ├── main.js                       ← يستدعي setupAutoUpdater()
│   │   ├── updater.js                    ← منطق التحديث الكامل (368 سطر)
│   │   └── preload.js                    ← جسر IPC بين Main/Renderer
│   └── renderer/
│       ├── login/renderer.js             ← فحص تلقائي عند تحميل الصفحة
│       └── settings/
│           ├── index.html                ← نافذة التحديث (modal)
│           └── renderer.js              ← معالج نافذة التحديث
└── dist/
    ├── latest.yml                        ← بيانات الإصدار الأخير
    └── app-update.yml                    ← إعداد التحديث (يُولَّد تلقائياً)
```

---

## 3. إعداد electron-updater

### `dev-app-update.yml`
```yaml
provider: github
owner: alaaelmorsy
repo: cashier_db
```

### `package.json` — قسم `build.publish`
```json
{
  "build": {
    "appId": "com.alrabt.cashier",
    "productName": "الرابط كاشير",
    "win": {
      "target": ["nsis", "msi"],
      "verifyUpdateCodeSignature": false,
      "sign": null
    },
    "publish": {
      "provider": "github",
      "owner": "alaaelmorsy",
      "repo": "cashier_db"
    }
  }
}
```

### `src/main/updater.js` — دالة الإعداد

```javascript
const { autoUpdater: updater } = require('electron-updater');
const log = require('electron-log');

function setupAutoUpdater(win) {
  updater.logger = log;
  updater.autoDownload = false;           // التحميل يدوي
  updater.autoInstallOnAppQuit = true;    // التثبيت عند الإغلاق

  // ربط الأحداث
  updater.on('checking-for-update',  () => sendStatusToWindow('checking-for-update'));
  updater.on('update-available',   info => sendStatusToWindow('update-available', info));
  updater.on('update-not-available', () => sendStatusToWindow('update-not-available'));
  updater.on('download-progress', prog => sendStatusToWindow('download-progress', prog));
  updater.on('update-downloaded',  info => sendStatusToWindow('update-downloaded', info));
  updater.on('error',               err => sendStatusToWindow('update-error', { message: err.message }));
}

function sendStatusToWindow(status, data = null) {
  win.webContents.send('update-status', { status, data });
}
```

### استدعاء الدالة في `src/main/main.js`
```javascript
// line 592
try { setupAutoUpdater(win); } catch (_) {}
```

---

## 4. تدفق التحديث كاملاً

```
┌─────────────────────────────────────────────────────────┐
│                   تسلسل التحديث                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. تشغيل التطبيق → صفحة تسجيل الدخول                  │
│     └─ بعد 2 ثانية: فحص تلقائي للتحديثات               │
│                                                         │
│  2. فحص التحديث                                         │
│     ├─ طلب IPC: check-for-updates                       │
│     ├─ فحص صلاحية الدعم الفني (قاعدة البيانات)          │
│     ├─ updater.checkForUpdates() → GitHub API           │
│     └─ مقارنة الإصدارات                                 │
│                                                         │
│  3a. لا يوجد تحديث → إشعار "أحدث إصدار"                │
│  3b. يوجد تحديث → إشعار "🎉 يتوفر تحديث جديد!"         │
│                                                         │
│  4. المستخدم يفتح الإعدادات → يضغط "تحديث البرنامج"    │
│     ├─ نافذة التحديث تفتح                               │
│     └─ يظهر زر "تحميل التحديث"                          │
│                                                         │
│  5. تحميل التحديث                                       │
│     ├─ طلب IPC: download-update                         │
│     ├─ فحص صلاحية الدعم (إذا انتهت → خطأ)              │
│     ├─ updater.downloadUpdate()                         │
│     ├─ أحداث download-progress في الوقت الفعلي          │
│     └─ يُحفظ في: %APPDATA%\..\الرابط كاشير-updater\    │
│                                                         │
│  6. اكتمال التحميل → يظهر زر "تثبيت الآن"              │
│                                                         │
│  7. تثبيت التحديث                                       │
│     ├─ طلب IPC: install-update                          │
│     ├─ فحص صلاحية الدعم (إذا انتهت → خطأ)              │
│     ├─ updater.quitAndInstall(false, true)               │
│     └─ التطبيق يُغلق، المثبّت يعمل، التطبيق يُعاد فتحه │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 5. مقارنة الإصدارات

**الموقع**: `src/main/updater.js` (السطور 12-25) + `src/renderer/login/renderer.js` (السطور 219-232)

```javascript
function compareVersions(v1, v2) {
  const v1Parts = String(v1).split('.').map(Number);
  const v2Parts = String(v2).split('.').map(Number);

  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;

    if (v1Part > v2Part) return  1;  // v1 أحدث
    if (v1Part < v2Part) return -1;  // v2 أحدث
  }
  return 0; // متساويان
}
```

**أمثلة**:
```
compareVersions('1.0.117', '1.0.118') → -1  (يوجد تحديث)
compareVersions('1.0.117', '1.0.117') →  0  (لا يوجد تحديث)
compareVersions('1.0.118', '1.0.117') →  1  (الحالي أحدث)
```

**الاستخدام في فحص التحديث**:
```javascript
if (compareVersions(currentVersion, newVersion) >= 0) {
  return 'update-not-available'; // الإصدار الحالي متساوٍ أو أحدث
}
```

---

## 6. التحقق من صلاحية الدعم الفني

**الهدف**: منع التحديث إذا انتهت صلاحية الدعم الفني للعميل.

**الموقع**: `src/main/updater.js` (السطور 31-68)

```javascript
async function checkSupportValidity() {
  const db = getDatabase();
  const row = db.prepare(
    'SELECT support_end_date FROM app_settings WHERE id=1 LIMIT 1'
  ).get();

  if (!row || !row.support_end_date) {
    return { valid: true, daysLeft: null, endDate: null };
  }

  const endDate  = new Date(row.support_end_date);
  const today    = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysLeft = Math.ceil((endDate - today) / msPerDay);

  return {
    valid:   daysLeft > 0,
    daysLeft: daysLeft,
    endDate: row.support_end_date
  };
}
```

**نقاط الحماية**:

| العملية | الحماية |
|---------|---------|
| فحص التحديث | ✅ مسموح دائماً |
| تحميل التحديث | ❌ محظور إذا `valid = false` |
| تثبيت التحديث | ❌ محظور إذا `valid = false` |

**رسالة الخطأ عند انتهاء الدعم**:
```
"انتهت فترة الدعم الفني. يرجى تجديد الدعم الفني للحصول على التحديثات"
```

---

## 7. قنوات IPC بين Main وRenderer

### Handlers في `src/main/updater.js`

```javascript
function registerUpdateIPC() {

  // فحص التحديث
  ipcMain.handle('check-for-updates', async () => {
    const supportStatus = await checkSupportValidity();
    const result = await updater.checkForUpdates();
    const newVersion = result?.updateInfo?.version;
    const currentVersion = app.getVersion();

    if (compareVersions(currentVersion, newVersion) >= 0) {
      return 'update-not-available';
    }
    sendStatusToWindow('update-available', result.updateInfo);
    return 'update-available';
  });

  // تحميل التحديث
  ipcMain.handle('download-update', async () => {
    const support = await checkSupportValidity();
    if (!support.valid) {
      return { success: false, supportExpired: true };
    }
    await updater.downloadUpdate();
    return { success: true };
  });

  // تثبيت التحديث
  ipcMain.handle('install-update', async () => {
    const support = await checkSupportValidity();
    if (!support.valid) {
      return { success: false, supportExpired: true };
    }
    updater.quitAndInstall(false, true);
  });

  // معلومات إضافية
  ipcMain.handle('get-app-version',       () => app.getVersion());
  ipcMain.handle('get-support-status',    () => checkSupportValidity());
  ipcMain.handle('get-update-cache-path', () => getCachePath());
}
```

### `src/main/preload.js` — الجسر
```javascript
contextBridge.exposeInMainWorld('api', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  }
});
```

### الأحداث التي يستقبلها الـ Renderer

**القناة**: `update-status`

```javascript
window.api.on('update-status', ({ status, data }) => {
  // status يمكن أن يكون:
  // 'checking-for-update'
  // 'update-available'
  // 'update-not-available'
  // 'download-progress'
  // 'update-downloaded'
  // 'update-error'
  // 'support-expired'
});
```

---

## 8. واجهة المستخدم للتحديث

### A. إشعار صفحة تسجيل الدخول

**الموقع**: `src/renderer/login/renderer.js` (السطور 313-394)

```javascript
// فحص تلقائي بعد تحميل الصفحة
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(async () => {
    const status = await window.api.invoke('check-for-updates');
    if (status === 'update-available') {
      showUpdateNotification(data.version);
    }
  }, 2000);
});

function showUpdateNotification(version) {
  const el = document.getElementById('updateNotification');
  el.innerHTML = `🎉 يتوفر تحديث جديد! الإصدار ${version} متاح الآن`;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 6000); // يختفي بعد 6 ثوان
}
```

**HTML المطلوب**:
```html
<div id="updateNotification" style="display:none">
  <span class="icon">🎉</span>
  <div id="updateTitle">يتوفر تحديث جديد!</div>
  <div id="updateMessage"></div>
</div>
```

---

### B. نافذة التحديث في الإعدادات

**الموقع**: `src/renderer/settings/index.html` (السطور 2502-2533)

```html
<dialog id="updateModal">
  <div id="updateStatus">
    <div id="updateIcon">🔍</div>
    <div id="updateSearchText">جاري البحث عن التحديثات...</div>
  </div>
  <div id="updateMessage"></div>
  <div id="updateProgress" style="display:none">
    <div id="updateProgressBar" style="width:0%"></div>
    <div id="updateProgressText">0%</div>
  </div>
  <button id="updateDownloadBtn" style="display:none">تحميل التحديث</button>
  <button id="updateInstallBtn"  style="display:none">تثبيت الآن</button>
  <button id="updateCloseBtn">إغلاق</button>
</dialog>
```

**زر فتح النافذة**:
```html
<button id="checkUpdateBtn">تحديث البرنامج</button>
```

---

### C. معالج الأحداث في `src/renderer/settings/renderer.js`

```javascript
document.getElementById('checkUpdateBtn').addEventListener('click', async () => {
  document.getElementById('updateModal').showModal();
  await window.api.invoke('check-for-updates');
});

document.getElementById('updateDownloadBtn').addEventListener('click', async () => {
  const result = await window.api.invoke('download-update');
  if (result?.supportExpired) showSupportExpiredMessage();
});

document.getElementById('updateInstallBtn').addEventListener('click', async () => {
  await window.api.invoke('install-update');
});

window.api.on('update-status', ({ status, data }) => {
  switch (status) {
    case 'checking-for-update':
      setUpdateUI('🔍', 'جاري البحث عن التحديثات...', false, false);
      break;
    case 'update-available':
      setUpdateUI('🎉', `يوجد تحديث جديد! الإصدار ${data.version}`, true, false);
      break;
    case 'update-not-available':
      setUpdateUI('✅', 'أنت تستخدم أحدث إصدار', false, false);
      break;
    case 'download-progress':
      showProgress(data.percent);
      break;
    case 'update-downloaded':
      setUpdateUI('✅', 'اكتمل التحميل! جاهز للتثبيت', false, true);
      break;
    case 'update-error':
      setUpdateUI('❌', `حدث خطأ: ${data.message}`, false, false);
      break;
    case 'support-expired':
      setUpdateUI('⚠️', 'انتهت فترة الدعم الفني. يرجى تجديد الدعم للحصول على التحديثات', false, false);
      break;
  }
});

function setUpdateUI(icon, message, showDownload, showInstall) {
  document.getElementById('updateIcon').textContent = icon;
  document.getElementById('updateMessage').textContent = message;
  document.getElementById('updateDownloadBtn').style.display = showDownload ? 'block' : 'none';
  document.getElementById('updateInstallBtn').style.display = showInstall  ? 'block' : 'none';
}

function showProgress(percent) {
  document.getElementById('updateProgress').style.display = 'block';
  document.getElementById('updateProgressBar').style.width = percent + '%';
  document.getElementById('updateProgressText').textContent = Math.round(percent) + '%';
}
```

**جدول حالات الواجهة**:

| الحدث | الأيقونة | الرسالة | زر التحميل | زر التثبيت |
|-------|---------|---------|-----------|-----------|
| `checking-for-update` | 🔍 | جاري البحث... | ❌ | ❌ |
| `update-available` | 🎉 | يوجد تحديث جديد! | ✅ | ❌ |
| `update-not-available` | ✅ | أنت تستخدم أحدث إصدار | ❌ | ❌ |
| `download-progress` | ⬇️ | شريط التقدم | ❌ | ❌ |
| `update-downloaded` | ✅ | اكتمل التحميل! | ❌ | ✅ |
| `update-error` | ❌ | رسالة الخطأ | ❌ | ❌ |
| `support-expired` | ⚠️ | يرجى تجديد الدعم | ❌ | ❌ |

---

## 9. CI/CD وإصدار الملفات

**الموقع**: `.github/workflows/build-release.yml`

### الخطوات

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'           # مثال: v1.0.117

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install Dependencies
        run: npm ci --legacy-peer-deps

      - name: Build CSS
        run: npm run build:css

      - name: Build Installers
        run: npm run dist:win:all
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Create GitHub Release
        # يرفع: cashier1.0.117.exe, cashier1.0.117.msi, latest.yml
```

### `latest.yml` — ملف بيانات الإصدار
```yaml
version: 1.0.117
files:
  - url: cashier1.0.117.exe
    sha512: <hash>
    size: 110651285
path: cashier1.0.117.exe
sha512: <hash>
releaseDate: '2026-06-15T00:00:00.000Z'
```

> هذا الملف يُقرأ بواسطة `electron-updater` لتحديد أحدث إصدار.

---

## 10. كيفية النقل لبرنامج آخر

### المتطلبات الأساسية

```bash
npm install electron-updater electron-log
```

### خطوات النقل

#### الخطوة 1 — تحديث `package.json`
```json
{
  "version": "1.0.0",
  "build": {
    "appId": "com.yourcompany.yourapp",
    "productName": "اسم برنامجك",
    "win": {
      "target": ["nsis"],
      "verifyUpdateCodeSignature": false
    },
    "publish": {
      "provider": "github",
      "owner": "YOUR_GITHUB_USERNAME",
      "repo": "YOUR_RELEASE_REPO"
    }
  }
}
```

#### الخطوة 2 — نسخ `dev-app-update.yml`
```yaml
provider: github
owner: YOUR_GITHUB_USERNAME
repo: YOUR_RELEASE_REPO
```

#### الخطوة 3 — نسخ `src/main/updater.js`
- عدّل `getDatabase()` ليشير لقاعدة بياناتك
- عدّل جدول `app_settings` وعمود `support_end_date` (أو احذف التحقق إن لم تحتج إليه)

#### الخطوة 4 — استدعاء في `main.js`
```javascript
const { setupAutoUpdater, registerUpdateIPC } = require('./updater');

app.whenReady().then(() => {
  const win = createWindow();
  try {
    setupAutoUpdater(win);
    registerUpdateIPC();
  } catch (_) {}
});
```

#### الخطوة 5 — تحديث `preload.js`
```javascript
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, callback) => {
    ipcRenderer.on(channel, (_, ...args) => callback(...args));
  }
});
```

#### الخطوة 6 — إضافة HTML وJS للـ Renderer
انسخ كود HTML وJS من القسمين [8A](#a-إشعار-صفحة-تسجيل-الدخول) و [8B/8C](#b-نافذة-التحديث-في-الإعدادات).

#### الخطوة 7 — إعداد CI/CD
انسخ `.github/workflows/build-release.yml` وعدّل اسم الملف التنفيذي.

### ملخص الملفات المطلوبة للنقل

| الملف | ما تحتاج لتعديله |
|-------|----------------|
| `package.json` | `appId`, `productName`, `owner`, `repo` |
| `dev-app-update.yml` | `owner`, `repo` |
| `src/main/updater.js` | دالة `getDatabase()` وجدول الدعم الفني |
| `src/main/main.js` | إضافة `setupAutoUpdater(win)` |
| `src/main/preload.js` | لا تعديل إذا كان مطابقاً |
| `src/renderer/settings/index.html` | HTML النافذة (نسخ) |
| `src/renderer/settings/renderer.js` | JS معالج الأحداث (نسخ) |
| `src/renderer/login/renderer.js` | JS الإشعار التلقائي (نسخ) |
| `.github/workflows/build-release.yml` | اسم الملف التنفيذي |

---

## الملاحظات الختامية

- **مستودع الإصدارات** مستقل عن مستودع الكود — يمكنك رفع الإصدارات في أي مستودع GitHub
- **`latest.yml`** يجب أن يُرفع مع كل إصدار (يُولَّد تلقائياً بواسطة `electron-builder`)
- **التوقيت**: الفحص يحدث بعد ثانيتين من فتح صفحة الدخول — يمكن تغيير هذا الوقت
- **انتهاء الدعم**: إذا لم تحتج لهذه الميزة، احذف استدعاءات `checkSupportValidity()` من الـ handlers
