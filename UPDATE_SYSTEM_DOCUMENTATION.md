# 📦 نظام التحديث التلقائي للبرنامج - دليل شامل

## 📋 نظرة عامة

نظام تحديث تلقائي متكامل باستخدام **electron-updater** مع ربط بـ GitHub Releases، يتضمن:
- ✅ التحقق من التحديثات تلقائياً عند تسجيل الدخول
- ✅ إشعارات في شاشة تسجيل الدخول
- ✅ نافذة تحديث احترافية في شاشة الإعدادات
- ✅ نظام حماية بالدعم الفني (منع التحديث إذا انتهى الدعم)
- ✅ شريط تقدم التحميل
- ✅ رسائل خطأ واضحة

---

## 🛠️ المتطلبات والإعدادات

### 1. المكتبات المطلوبة

```json
{
  "dependencies": {
    "electron-updater": "^6.1.7",
    "electron-log": "^5.0.1",
    "electron-is-dev": "^2.0.0"
  }
}
```

### 2. إعدادات package.json

```json
{
  "name": "pos1",
  "version": "1.0.2",
  "build": {
    "appId": "com.yourcompany.yourapp",
    "productName": "اسم البرنامج",
    "publish": {
      "provider": "github",
      "owner": "your-github-username",
      "repo": "your-repo-name"
    }
  }
}
```

### 3. قاعدة البيانات - جدول app_settings

```sql
ALTER TABLE app_settings 
ADD COLUMN support_end_date DATE NULL 
COMMENT 'تاريخ انتهاء الدعم الفني - إذا كان منتهياً يُمنع التحديث';
```

**مثال بيانات:**
```sql
UPDATE app_settings SET support_end_date = '2026-12-31' WHERE id = 1;
```

---

## 📁 هيكل الملفات

```
project/
├── src/
│   ├── main/
│   │   ├── updater.js          # ملف التحديث الرئيسي (Backend)
│   │   └── main.js             # تهيئة النظام
│   └── renderer/
│       ├── login/
│       │   ├── index.html      # شاشة تسجيل الدخول مع إشعار التحديث
│       │   └── renderer.js     # منطق الإشعار
│       └── settings/
│           ├── index.html      # نافذة التحديث (Modal)
│           └── renderer.js     # منطق التحديث
└── package.json
```

---

## 💻 الكود الكامل

### 1. ملف updater.js (Main Process)

```javascript
const { app, ipcMain, BrowserWindow } = require('electron');
const log = require('electron-log');
const isDev = require('electron-is-dev');

let autoUpdater = null;
let updateWindow = null;

/**
 * مقارنة إصدارين (semantic versioning)
 * @returns {number} 1 إذا كان v1 أكبر، -1 إذا كان v2 أكبر، 0 إذا كانا متساويين
 */
function compareVersions(v1, v2) {
  const v1Parts = String(v1).split('.').map(Number);
  const v2Parts = String(v2).split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;
    
    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }
  
  return 0;
}

/**
 * التحقق من صلاحية الدعم الفني
 * @returns {Promise<{valid: boolean, daysLeft: number, endDate: string}>}
 */
async function checkSupportValidity() {
  try {
    console.log('checkSupportValidity: Starting check...');
    const { dbAdapter } = require('../db/db-adapter');
    const conn = await dbAdapter.getConnection();
    try {
      const [rows] = await conn.query('SELECT support_end_date FROM app_settings WHERE id=1 LIMIT 1');
      console.log('checkSupportValidity: Query result:', rows);
      
      if (rows && rows[0] && rows[0].support_end_date) {
        const endDate = new Date(rows[0].support_end_date);
        const today = new Date();
        const baseToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const diffDays = Math.ceil((endDate - baseToday) / (1000 * 60 * 60 * 24));
        
        console.log('checkSupportValidity: End date:', endDate);
        console.log('checkSupportValidity: Today:', baseToday);
        console.log('checkSupportValidity: Days left:', diffDays);
        console.log('checkSupportValidity: Valid:', diffDays >= 0);
        
        return {
          valid: diffDays >= 0,
          daysLeft: diffDays,
          endDate: rows[0].support_end_date
        };
      }
      // لا يوجد تاريخ محدد - السماح بالتحديث
      console.log('checkSupportValidity: No support_end_date found, allowing update');
      return { valid: true, daysLeft: null, endDate: null };
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('checkSupportValidity: Error:', error);
    // في حالة الخطأ، السماح بالتحديث
    return { valid: true, daysLeft: null, endDate: null };
  }
}

function getAutoUpdater() {
  if (!autoUpdater) {
    try {
      const { autoUpdater: updater } = require('electron-updater');
      
      // إعداد logger
      updater.logger = log;
      updater.logger.transports.file.level = 'info';
      
      // إعدادات التحديث
      updater.autoDownload = false;
      updater.autoInstallOnAppQuit = true;
      
      // السماح بالتحديثات في وضع التطوير
      if (isDev) {
        updater.forceDevUpdateConfig = true;
        console.log('Update: Development mode - forcing update config');
      }
      
      // تعيين GitHub repo للتحديثات
      updater.setFeedURL({
        provider: 'github',
        owner: 'your-github-username',    // غيّر هنا
        repo: 'your-repo-name'             // غيّر هنا
      });
      
      console.log('AutoUpdater initialized with GitHub repo');
      
      autoUpdater = updater;
    } catch (error) {
      console.error('Failed to load electron-updater:', error);
      autoUpdater = {
        on: () => {},
        checkForUpdates: async () => { throw new Error('electron-updater not available'); },
        downloadUpdate: async () => { throw new Error('electron-updater not available'); },
        quitAndInstall: () => {}
      };
    }
  }
  return autoUpdater;
}

function setupAutoUpdater(mainWindow) {
  updateWindow = mainWindow;
  const updater = getAutoUpdater();

  updater.on('checking-for-update', () => {
    console.log('Update: Checking for updates...');
    sendStatusToWindow('checking-for-update');
  });

  updater.on('update-available', (info) => {
    console.log('Update: Update available', info);
    console.log('Update: Current version:', app.getVersion());
    console.log('Update: Available version:', info.version);
    
    // تحقق من أن الإصدار الجديد أعلى فعلياً
    const currentVersion = app.getVersion();
    const newVersion = info.version;
    
    // مقارنة الإصدارات
    if (compareVersions(currentVersion, newVersion) >= 0) {
      console.log('Update: Current version is same or newer, ignoring update notification');
      sendStatusToWindow('update-not-available', { version: currentVersion });
      return;
    }
    
    sendStatusToWindow('update-available', info);
  });

  updater.on('update-not-available', (info) => {
    console.log('Update: No update available', info);
    sendStatusToWindow('update-not-available', info);
  });

  updater.on('error', (err) => {
    console.log('Update: Error occurred', err);
    sendStatusToWindow('update-error', err);
  });

  updater.on('download-progress', (progressObj) => {
    sendStatusToWindow('download-progress', progressObj);
  });

  updater.on('update-downloaded', (info) => {
    sendStatusToWindow('update-downloaded', info);
  });
}

function sendStatusToWindow(status, data) {
  const win = updateWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    win.webContents.send('update-status', { status, data });
  }
}

function registerUpdateIPC() {
  // 1. التحقق من التحديثات
  ipcMain.handle('check-for-updates', async () => {
    try {
      // التحقق من صلاحية الدعم الفني (للمعلومات فقط، نسمح بإظهار الإشعار حتى لو كان منتهياً)
      const supportStatus = await checkSupportValidity();
      console.log('Update: Support status:', supportStatus);
      
      console.log('Update: Checking for updates... (isDev:', isDev, ')');
      console.log('Update: Current version:', app.getVersion());
      if (supportStatus.daysLeft !== null) {
        console.log('Update: Support days left:', supportStatus.daysLeft);
      }
      
      // حفظ حالة الدعم لاستخدامها لاحقاً عند التحميل/التثبيت
      global.supportStatus = supportStatus;
      
      const updater = getAutoUpdater();
      
      // التأكد من تسجيل الأحداث قبل البحث
      setupAutoUpdater(BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]);
      
      // إضافة timeout للتحقق من التحديثات (15 ثانية)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          console.log('Update: Timeout reached');
          reject(new Error('انتهت مهلة البحث عن التحديثات'));
        }, 15000);
      });
      
      console.log('Update: Starting checkForUpdates...');
      const updatePromise = updater.checkForUpdates();
      
      const result = await Promise.race([updatePromise, timeoutPromise]);
      console.log('Update: Check completed', result);
      return { success: true, result };
    } catch (error) {
      console.error('Update check error:', error);
      
      let errorMessage = error.message || error.toString();
      
      // خطأ 404 يعني عدم وجود releases منشورة
      if (errorMessage.includes('404')) {
        console.log('Update: 404 error - treating as no update available');
        errorMessage = 'لا يوجد إصدارات منشورة على GitHub';
        sendStatusToWindow('update-not-available', { version: app.getVersion() });
        return { success: true, noReleases: true };
      }
      
      console.log('Update: Sending error to window:', errorMessage);
      sendStatusToWindow('update-error', { message: errorMessage });
      return { success: false, error: errorMessage };
    }
  });

  // 2. تحميل التحديث
  ipcMain.handle('download-update', async () => {
    try {
      // التحقق من صلاحية الدعم الفني قبل السماح بالتحميل
      const supportStatus = global.supportStatus || await checkSupportValidity();
      console.log('Download: Support status check:', supportStatus);
      
      if (!supportStatus.valid) {
        const errorMsg = 'انتهت فترة الدعم الفني. يرجى تجديد الدعم الفني للحصول على التحديثات';
        console.log('Download: Support expired - blocking download');
        console.log('Download: Days left:', supportStatus.daysLeft);
        console.log('Download: End date:', supportStatus.endDate);
        sendStatusToWindow('support-expired', { 
          message: errorMsg,
          daysLeft: supportStatus.daysLeft,
          endDate: supportStatus.endDate
        });
        return { 
          success: false, 
          supportExpired: true,
          error: errorMsg,
          daysLeft: supportStatus.daysLeft,
          endDate: supportStatus.endDate
        };
      }
      
      console.log('Download: Support valid, proceeding with download');
      const updater = getAutoUpdater();
      await updater.downloadUpdate();
      return { success: true };
    } catch (error) {
      console.error('Download: Error:', error);
      return { success: false, error: error.message };
    }
  });

  // 3. تثبيت التحديث
  ipcMain.handle('install-update', async () => {
    try {
      // التحقق من صلاحية الدعم الفني قبل السماح بالتثبيت
      const supportStatus = global.supportStatus || await checkSupportValidity();
      console.log('Install: Support status check:', supportStatus);
      
      if (!supportStatus.valid) {
        const errorMsg = 'انتهت فترة الدعم الفني. يرجى تجديد الدعم الفني للحصول على التحديثات';
        console.log('Install: Support expired - blocking install');
        console.log('Install: Days left:', supportStatus.daysLeft);
        console.log('Install: End date:', supportStatus.endDate);
        sendStatusToWindow('support-expired', { 
          message: errorMsg,
          daysLeft: supportStatus.daysLeft,
          endDate: supportStatus.endDate
        });
        return { 
          success: false, 
          supportExpired: true,
          error: errorMsg,
          daysLeft: supportStatus.daysLeft,
          endDate: supportStatus.endDate
        };
      }
      
      console.log('Install: Support valid, proceeding with installation');
      const updater = getAutoUpdater();
      updater.quitAndInstall(false, true);
      return { success: true };
    } catch (error) {
      console.error('Install: Error:', error);
      return { success: false, error: error.message };
    }
  });

  // 4. الحصول على رقم الإصدار
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // 5. الحصول على حالة الدعم الفني
  ipcMain.handle('get-support-status', async () => {
    try {
      const status = await checkSupportValidity();
      return { success: true, ...status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = {
  setupAutoUpdater,
  registerUpdateIPC,
  getAutoUpdater,
  checkSupportValidity
};
```

### 2. تهيئة في main.js

```javascript
const { setupAutoUpdater, registerUpdateIPC } = require('./updater');

// عند إنشاء النافذة الرئيسية
function createWindow() {
  const win = new BrowserWindow({
    // ... إعدادات النافذة
  });

  win.loadFile(loginPage);
  
  win.once('ready-to-show', () => {
    win.show();
    setupAutoUpdater(win);  // تهيئة نظام التحديث
  });
}

app.whenReady().then(() => {
  registerUpdateIPC();  // تسجيل IPC handlers
  createWindow();
});
```

---

## 🎨 واجهة المستخدم (UI)

### 1. شاشة تسجيل الدخول - إشعار التحديث

**HTML (login/index.html):**

```html
<!-- إشعار التحديث (مخفي افتراضياً) -->
<div id="updateNotification" class="update-notification" style="display: none;">
  <div class="icon">🎉</div>
  <div class="content">
    <div class="title" id="updateTitle">يتوفر تحديث جديد!</div>
    <div class="message" id="updateMessage">توجه إلى الإعدادات لتحديث البرنامج</div>
  </div>
</div>
```

**CSS:**

```css
.update-notification {
  position: fixed;
  top: -100px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 16px 24px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 9999;
  transition: top 0.5s ease-in-out;
  max-width: 90vw;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.update-notification.show {
  top: 20px;
}

.update-notification .icon {
  font-size: 24px;
}

.update-notification .content {
  flex: 1;
}

.update-notification .title {
  font-weight: 700;
  font-size: 16px;
  margin-bottom: 4px;
}

.update-notification .message {
  font-size: 13px;
  opacity: 0.95;
}

.update-notification.expired {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  box-shadow: 0 10px 30px rgba(239, 68, 68, 0.3);
}
```

**JavaScript (login/renderer.js):**

```javascript
// التحقق من التحديثات عند تحميل الصفحة
(async function checkForUpdatesOnLoad() {
  try {
    // انتظر قليلاً قبل التحقق من التحديثات
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Checking for updates on login page...');
    const result = await window.api.invoke('check-for-updates');
    console.log('Update check result:', result);
  } catch (error) {
    console.error('Error checking for updates:', error);
  }
})();

// الاستماع لأحداث التحديث من main process
window.api?.on?.('update-status', (event, data) => {
  const { status, data: statusData } = data;
  
  console.log('Update status event received:', status, statusData);

  if (status === 'update-available') {
    showUpdateAvailableNotification(statusData);
  }
});

// دالة لإظهار إشعار التحديث المتوفر
function showUpdateAvailableNotification(updateInfo) {
  const updateNotification = document.getElementById('updateNotification');
  if (!updateNotification) return;

  const version = updateInfo?.version || 'جديد';
  
  console.log('Showing update notification for version:', version);

  // تعيين محتوى الإشعار
  updateNotification.querySelector('.icon').textContent = '🎉';
  updateNotification.querySelector('#updateTitle').textContent = 'يتوفر تحديث جديد!';
  updateNotification.querySelector('#updateMessage').textContent = `الإصدار ${version} متاح الآن. توجه إلى الإعدادات للتحديث`;
  updateNotification.classList.remove('expired');
  
  // إظهار الإشعار
  updateNotification.style.display = 'flex';
  requestAnimationFrame(() => {
    updateNotification.classList.add('show');
  });
  
  // إخفاء الإشعار بعد 6 ثوان
  setTimeout(() => {
    updateNotification.classList.remove('show');
    setTimeout(() => {
      updateNotification.style.display = 'none';
    }, 500);
  }, 6000);
}
```

### 2. شاشة الإعدادات - نافذة التحديث (Modal)

**HTML (settings/index.html):**

```html
<!-- زر التحديث في الإعدادات -->
<button class="btn primary" id="checkUpdateBtn">
  🔄 التحقق من التحديثات
</button>

<!-- Update Modal -->
<dialog id="updateModal" style="border:0; border-radius:var(--radius-2xl); padding:0; max-width: 520px; width: 90vw; min-width: 360px;">
  <div class="card" style="margin:0; box-shadow: var(--shadow-2xl);">
    <div class="card-header">
      <div class="section-header">
        <div class="section-icon" style="background:linear-gradient(135deg, #10b981, #059669)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 10C21 10 18.995 7.26822 17.3662 5.63824C15.7373 4.00827 13 2 13 2M3 14C3 14 5.00527 16.7318 6.63424 18.3618C8.26321 19.9917 11 22 11 22M20 2L13 9M4 22L11 15" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div>
          <div class="section-title">تحديث البرنامج</div>
          <div class="section-desc">البحث عن آخر إصدار متاح</div>
        </div>
      </div>
    </div>
    <div class="card-body">
      <div id="updateStatus" style="text-align: center; padding: var(--space-8) var(--space-4);">
        <div style="font-size: 48px; margin-bottom: var(--space-4);">🔍</div>
        <div style="font-size: 16px; color: var(--gray-700); font-weight: 600; margin-bottom: var(--space-2);">جاري البحث عن التحديثات...</div>
        <div id="updateMessage" style="font-size: 13px; color: var(--gray-500);"></div>
        <div id="updateProgress" style="margin-top: var(--space-4); display: none;">
          <div style="background: var(--gray-200); height: 8px; border-radius: 4px; overflow: hidden;">
            <div id="updateProgressBar" style="background: linear-gradient(90deg, #10b981, #34d399); height: 100%; width: 0%; transition: width 0.3s;"></div>
          </div>
          <div id="updateProgressText" style="font-size: 12px; color: var(--gray-600); margin-top: var(--space-2);"></div>
        </div>
      </div>
      <div class="actions" style="justify-content: center; margin-top: var(--space-4); gap: var(--space-3);">
        <button class="btn" id="updateCancelBtn" style="min-width: 120px;">إغلاق</button>
        <button class="btn primary" id="updateDownloadBtn" style="min-width: 120px; display: none;">تحميل التحديث</button>
        <button class="btn primary" id="updateInstallBtn" style="min-width: 120px; display: none;">تثبيت الآن</button>
      </div>
    </div>
  </div>
</dialog>
```

**JavaScript (settings/renderer.js):**

```javascript
const updateModal = document.getElementById('updateModal');
const checkUpdateBtn = document.getElementById('checkUpdateBtn');
const updateCancelBtn = document.getElementById('updateCancelBtn');
const updateDownloadBtn = document.getElementById('updateDownloadBtn');
const updateInstallBtn = document.getElementById('updateInstallBtn');
const updateStatus = document.getElementById('updateStatus');
const updateMessage = document.getElementById('updateMessage');
const updateProgress = document.getElementById('updateProgress');
const updateProgressBar = document.getElementById('updateProgressBar');
const updateProgressText = document.getElementById('updateProgressText');

function showUpdateModal() {
  if (updateModal) {
    updateModal.showModal();
    resetUpdateModal();
  }
}

function closeUpdateModal() {
  if (updateModal) {
    updateModal.close();
  }
}

function resetUpdateModal() {
  updateStatus.querySelector('div:first-child').textContent = '🔍';
  updateStatus.querySelector('div:nth-child(2)').textContent = 'جاري البحث عن التحديثات...';
  updateMessage.textContent = '';
  updateProgress.style.display = 'none';
  updateDownloadBtn.style.display = 'none';
  updateInstallBtn.style.display = 'none';
  updateProgressBar.style.width = '0%';
}

function updateUIStatus(icon, title, message, showDownload = false, showInstall = false) {
  updateStatus.querySelector('div:first-child').textContent = icon;
  updateStatus.querySelector('div:nth-child(2)').textContent = title;
  updateMessage.textContent = message;
  updateDownloadBtn.style.display = showDownload ? 'block' : 'none';
  updateInstallBtn.style.display = showInstall ? 'block' : 'none';
}

// التحقق من التحديثات
checkUpdateBtn?.addEventListener('click', async () => {
  showUpdateModal();
  
  try {
    const appVersion = await window.api.invoke('get-app-version');
    updateMessage.textContent = `الإصدار الحالي: ${appVersion}`;
    
    const result = await window.api.invoke('check-for-updates');
    
    if (!result.success) {
      updateUIStatus('❌', 'فشل البحث عن التحديثات', result.error || 'حدث خطأ أثناء البحث عن التحديثات');
      return;
    }
  } catch (error) {
    updateUIStatus('❌', 'فشل البحث عن التحديثات', error.message || 'حدث خطأ غير متوقع');
  }
});

// تحميل التحديث
updateDownloadBtn?.addEventListener('click', async () => {
  updateDownloadBtn.disabled = true;
  updateUIStatus('⬇️', 'جاري تحميل التحديث...', 'يرجى الانتظار حتى اكتمال التحميل');
  updateProgress.style.display = 'block';
  
  try {
    console.log('Settings: Requesting download-update...');
    const result = await window.api.invoke('download-update');
    console.log('Settings: Download result:', result);
    
    // التحقق من حالة انتهاء الدعم الفني
    if (result && result.supportExpired) {
      console.log('Settings: Support expired detected, showing message');
      updateUIStatus(
        '⚠️',
        'انتهت فترة الدعم الفني',
        'يرجى تجديد الدعم الفني للحصول على التحديثات'
      );
      updateProgress.style.display = 'none';
      updateDownloadBtn.disabled = false;
      return;
    }
    
    if (!result.success) {
      console.log('Settings: Download failed:', result.error);
      updateUIStatus('❌', 'فشل تحميل التحديث', result.error || 'حدث خطأ أثناء التحميل');
      updateProgress.style.display = 'none';
      updateDownloadBtn.disabled = false;
      return;
    }
    
    console.log('Settings: Download started successfully');
  } catch (error) {
    console.error('Settings: Download error:', error);
    updateUIStatus('❌', 'فشل تحميل التحديث', error.message || 'حدث خطأ أثناء التحميل');
    updateProgress.style.display = 'none';
    updateDownloadBtn.disabled = false;
  }
});

// تثبيت التحديث
updateInstallBtn?.addEventListener('click', async () => {
  try {
    console.log('Settings: Requesting install-update...');
    const result = await window.api.invoke('install-update');
    console.log('Settings: Install result:', result);
    
    // التحقق من حالة انتهاء الدعم الفني
    if (result && result.supportExpired) {
      console.log('Settings: Support expired detected during install, showing message');
      updateUIStatus(
        '⚠️',
        'انتهت فترة الدعم الفني',
        result.error || 'يرجى تجديد الدعم الفني للحصول على التحديثات'
      );
      return;
    }
    
    if (result && !result.success) {
      console.log('Settings: Install failed:', result.error);
      updateUIStatus('❌', 'فشل تثبيت التحديث', result.error || 'حدث خطأ أثناء التثبيت');
    } else {
      console.log('Settings: Install completed successfully');
    }
  } catch (error) {
    console.error('Settings: Install error:', error);
    updateUIStatus('❌', 'فشل تثبيت التحديث', error.message || 'حدث خطأ أثناء التثبيت');
  }
});

updateCancelBtn?.addEventListener('click', () => {
  closeUpdateModal();
});

updateModal?.addEventListener('click', (e) => {
  if (e.target === updateModal) {
    closeUpdateModal();
  }
});

// الاستماع لأحداث التحديث من main process
window.api?.on?.('update-status', (event, data) => {
  const { status, data: statusData } = data;
  
  switch (status) {
    case 'checking-for-update':
      updateUIStatus(
        '🔍',
        'جاري البحث عن التحديثات...',
        'يرجى الانتظار...'
      );
      break;
      
    case 'update-available':
      updateUIStatus(
        '🎉',
        'يوجد تحديث جديد متاح!',
        `الإصدار الجديد: ${statusData.version}`,
        true,
        false
      );
      break;
      
    case 'update-not-available':
      updateUIStatus(
        '✅',
        'البرنامج محدث',
        'أنت تستخدم أحدث إصدار من البرنامج'
      );
      break;
      
    case 'download-progress':
      const percent = Math.round(statusData.percent);
      updateProgressBar.style.width = `${percent}%`;
      updateProgressText.textContent = `${percent}% - ${(statusData.transferred / 1024 / 1024).toFixed(2)} ميجا من ${(statusData.total / 1024 / 1024).toFixed(2)} ميجا`;
      break;
      
    case 'update-downloaded':
      updateUIStatus(
        '✅',
        'اكتمل التحميل!',
        'التحديث جاهز للتثبيت. سيتم إعادة تشغيل البرنامج.',
        false,
        true
      );
      updateProgress.style.display = 'none';
      break;
      
    case 'update-error':
      updateUIStatus(
        '❌',
        'حدث خطأ',
        statusData.message || 'فشل التحديث'
      );
      break;
      
    case 'support-expired':
      updateUIStatus(
        '⚠️',
        'انتهت فترة الدعم الفني',
        'يرجى تجديد الدعم الفني للحصول على التحديثات. تاريخ الانتهاء: ' + (statusData.endDate || 'غير محدد')
      );
      break;
  }
});
```

---

## 🚀 نشر التحديثات على GitHub

### 1. إنشاء Release جديد

```bash
# 1. تحديث رقم الإصدار في package.json
{
  "version": "1.0.3"
}

# 2. بناء البرنامج
npm run dist:win

# 3. إنشاء tag
git tag v1.0.3
git push origin v1.0.3

# 4. إنشاء Release على GitHub
# - اذهب إلى GitHub > Releases > Create new release
# - اختر Tag: v1.0.3
# - أضف ملفات التثبيت من dist/:
#   - cashier1.0.3.exe (NSIS installer)
#   - cashier1.0.3.msi (MSI installer)
#   - latest.yml (ملف تلقائي من electron-builder)
```

### 2. محتويات latest.yml

```yaml
version: 1.0.3
files:
  - url: cashier1.0.3.exe
    sha512: xxxxx
    size: 123456
path: cashier1.0.3.exe
sha512: xxxxx
releaseDate: '2026-01-20T10:00:00.000Z'
```

---

## 📊 سير العمل (Workflow)

```
┌─────────────────────────────────────────────────────────────┐
│                    1. عند فتح البرنامج                      │
│                   (شاشة تسجيل الدخول)                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
          ┌─────────────────────────────────┐
          │  check-for-updates() تلقائياً   │
          │  بعد 2 ثانية من تحميل الصفحة   │
          └─────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
    ┌──────────────────┐    ┌──────────────────┐
    │  تحديث متوفر     │    │  لا يوجد تحديث   │
    │  (update-        │    │  (update-not-    │
    │   available)     │    │   available)     │
    └──────────────────┘    └──────────────────┘
                │
                ▼
    ┌──────────────────────────────────────┐
    │  إظهار إشعار في أعلى شاشة الدخول    │
    │  "🎉 يتوفر تحديث جديد! الإصدار X"   │
    │  يختفي بعد 6 ثوان                   │
    └──────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│              2. المستخدم يذهب إلى الإعدادات                 │
│              ويضغط "التحقق من التحديثات"                   │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
    ┌──────────────────────────────┐
    │  فتح نافذة التحديث (Modal)  │
    │  "🔍 جاري البحث..."          │
    └──────────────────────────────┘
                │
                ▼
    ┌──────────────────────────────┐
    │  update-available            │
    │  "🎉 يوجد تحديث جديد!"       │
    │  [زر: تحميل التحديث]         │
    └──────────────────────────────┘
                │
                ▼
    ┌──────────────────────────────┐
    │  المستخدم يضغط "تحميل"       │
    │  download-update()           │
    └──────────────────────────────┘
                │
        ┌───────┴────────┐
        │                │
        ▼                ▼
┌──────────────┐  ┌──────────────────┐
│ الدعم صالح   │  │  الدعم منتهي     │
│ ✅ السماح    │  │  ⚠️ منع التحميل  │
└──────────────┘  │  رسالة: "انتهت   │
        │         │  فترة الدعم..."  │
        │         └──────────────────┘
        ▼
┌──────────────────────────────┐
│  بدء التحميل                 │
│  شريط التقدم: 0% ... 100%   │
│  (download-progress)         │
└──────────────────────────────┘
        │
        ▼
┌──────────────────────────────┐
│  اكتمل التحميل               │
│  "✅ التحديث جاهز للتثبيت"   │
│  [زر: تثبيت الآن]            │
│  (update-downloaded)         │
└──────────────────────────────┘
        │
        ▼
┌──────────────────────────────┐
│  المستخدم يضغط "تثبيت الآن"  │
│  install-update()            │
└──────────────────────────────┘
        │
        ▼
┌──────────────────────────────┐
│  فحص الدعم مرة أخرى          │
│  ثم إعادة تشغيل البرنامج     │
│  quitAndInstall()            │
└──────────────────────────────┘
```

---

## 🔐 نظام حماية الدعم الفني

### كيف يعمل:

1. **عند البحث عن التحديثات:**
   - ✅ يُسمح بالبحث دائماً (حتى لو كان الدعم منتهياً)
   - ✅ يظهر الإشعار في شاشة تسجيل الدخول
   - ✅ يحفظ حالة الدعم في `global.supportStatus`

2. **عند محاولة التحميل:**
   - ❌ إذا كان الدعم منتهياً: يمنع التحميل ويظهر رسالة
   - ✅ إذا كان الدعم صالحاً: يسمح بالتحميل

3. **عند محاولة التثبيت:**
   - ❌ إذا كان الدعم منتهياً: يمنع التثبيت ويظهر رسالة
   - ✅ إذا كان الدعم صالحاً: يسمح بالتثبيت

### رسائل النظام:

| الحالة | الرمز | العنوان | الرسالة |
|--------|------|---------|---------|
| تحديث متوفر | 🎉 | يوجد تحديث جديد متاح! | الإصدار X.X.X متاح الآن |
| لا يوجد تحديث | ✅ | البرنامج محدث | أنت تستخدم أحدث إصدار |
| جاري التحميل | ⬇️ | جاري تحميل التحديث... | يرجى الانتظار... |
| اكتمل التحميل | ✅ | اكتمل التحميل! | التحديث جاهز للتثبيت |
| الدعم منتهي | ⚠️ | انتهت فترة الدعم الفني | يرجى تجديد الدعم الفني... |
| خطأ | ❌ | حدث خطأ | رسالة الخطأ... |

---

## 🧪 الاختبار

### 1. اختبار في وضع التطوير

```javascript
// في updater.js يوجد:
if (isDev) {
  updater.forceDevUpdateConfig = true;
}
```

### 2. محاكاة تحديث منتهي الدعم

```sql
-- ضع تاريخ في الماضي
UPDATE app_settings 
SET support_end_date = '2025-01-01' 
WHERE id = 1;
```

### 3. محاكاة تحديث صالح

```sql
-- ضع تاريخ في المستقبل
UPDATE app_settings 
SET support_end_date = '2026-12-31' 
WHERE id = 1;
```

### 4. اختبار بدون دعم

```sql
-- اجعل الحقل NULL
UPDATE app_settings 
SET support_end_date = NULL 
WHERE id = 1;
```

---

## 📝 ملاحظات مهمة

1. **الأمان:**
   - electron-updater يتحقق من توقيع الملفات
   - يستخدم HTTPS للتحميل من GitHub

2. **الأداء:**
   - التحقق من التحديثات يتم بعد 2 ثانية من فتح شاشة الدخول
   - Timeout 15 ثانية للبحث عن التحديثات

3. **التوافق:**
   - يعمل على Windows فقط (NSIS/MSI)
   - يمكن توسيعه لـ macOS و Linux

4. **الصيانة:**
   - تحديث رقم الإصدار في package.json قبل كل release
   - رفع latest.yml تلقائياً من electron-builder
   - يجب نشر كل من .exe و .msi في Release

---

## 🐛 استكشاف الأخطاء

### المشكلة: لا يجد التحديثات

**الحل:**
```javascript
// تحقق من:
1. الإنترنت متصل
2. GitHub repo صحيح في package.json
3. Release منشور وعام (Public)
4. latest.yml موجود في Release
```

### المشكلة: خطأ 404

**الحل:**
```javascript
// يعني عدم وجود releases منشورة
// النظام يعالجه تلقائياً ويظهر "لا يوجد تحديث"
```

### المشكلة: الدعم صالح لكن يمنع التحديث

**الحل:**
```sql
-- تحقق من التاريخ في قاعدة البيانات
SELECT support_end_date FROM app_settings WHERE id=1;

-- تحقق من Console logs
-- checkSupportValidity: Days left: XX
```

---

## 📚 موارد إضافية

- [electron-updater Documentation](https://www.electron.build/auto-update)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)
- [Semantic Versioning](https://semver.org/)

---

**✅ تم إنشاء هذا الدليل في:** 2026-01-20  
**📧 الدعم الفني:** support@yourcompany.com  
**🏢 الناشر:** مؤسسة تعلم التقنيات

---

## 🎯 الخلاصة

هذا النظام يوفر:
- ✅ تحديثات تلقائية آمنة
- ✅ واجهة مستخدم احترافية
- ✅ حماية بنظام الدعم الفني
- ✅ رسائل واضحة للمستخدم
- ✅ تسجيل تفصيلي للأخطاء
- ✅ سهولة الصيانة والتوسع

**نسخ هذا الكود إلى أي مشروع Electron آخر يتطلب فقط:**
1. نسخ ملف `updater.js`
2. نسخ UI من `login/` و `settings/`
3. تعديل `package.json`
4. إضافة حقل `support_end_date` في قاعدة البيانات
5. تهيئة في `main.js`

**🎉 استمتع بنظام تحديث احترافي!**
