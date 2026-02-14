const { app, ipcMain, BrowserWindow } = require('electron');
const log = require('electron-log');
const isDev = require('electron-is-dev');

let autoUpdater = null;
let updateWindow = null;

/**
 * مقارنة إصدارين
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
      
      // تعيين GitHub repo للتحديثات (يجب أن يطابق dev-app-update.yml و package.json)
      updater.setFeedURL({
        provider: 'github',
        owner: 'alaaelmorsy',
        repo: 'cashier_db'
      });
      
      console.log('AutoUpdater initialized with GitHub repo: alaaelmorsy/cashier_db');
      
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
  console.log('Update: setupAutoUpdater called, window set');
  const updater = getAutoUpdater();

  // إزالة المستمعات القديمة لتجنب التكرار
  updater.removeAllListeners('checking-for-update');
  updater.removeAllListeners('update-available');
  updater.removeAllListeners('update-not-available');
  updater.removeAllListeners('error');
  updater.removeAllListeners('download-progress');
  updater.removeAllListeners('update-downloaded');

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
    console.error('Update: Error occurred:', err);
    const errorMessage = err && err.message ? err.message : (err ? err.toString() : 'خطأ غير معروف');
    sendStatusToWindow('update-error', { message: errorMessage });
  });

  updater.on('download-progress', (progressObj) => {
    console.log('Update: Download progress:', progressObj);
    console.log(`Update: Downloading to: ${app.getPath('userData')}\\..\\الرابط كاشير-updater\\pending`);
    sendStatusToWindow('download-progress', progressObj);
  });

  updater.on('update-downloaded', (info) => {
    console.log('Update: Update downloaded successfully:', info);
    sendStatusToWindow('update-downloaded', info);
  });
}

function sendStatusToWindow(status, data) {
  // محاولة استخدام updateWindow المحفوظة، وإلا استخدم النافذة الحالية
  const win = updateWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) {
    console.log('Update: Sending status to window:', status, data ? 'with data' : 'no data');
    win.webContents.send('update-status', { status, data });
  } else {
    console.warn('Update: No window available to send status');
  }
}

function registerUpdateIPC() {
  ipcMain.handle('check-for-updates', async (event) => {
    try {
      // تحديث updateWindow للنافذة الحالية
      const currentWindow = BrowserWindow.fromWebContents(event.sender);
      if (currentWindow) {
        updateWindow = currentWindow;
        console.log('Update: Updated window reference from check-for-updates');
      }
      
      // التحقق من صلاحية الدعم الفني (للمعلومات فقط، نسمح بإظهار الإشعار حتى لو كان منتهياً)
      const supportStatus = await checkSupportValidity();
      console.log('Update: Support status:', supportStatus);
      
      // السماح باختبار التحديثات حتى في وضع التطوير
      console.log('Update: Checking for updates... (isDev:', isDev, ')');
      console.log('Update: Current version:', app.getVersion());
      if (supportStatus.daysLeft !== null) {
        console.log('Update: Support days left:', supportStatus.daysLeft);
      }
      
      // حفظ حالة الدعم لاستخدامها لاحقاً عند التحميل/التثبيت
      global.supportStatus = supportStatus;
      
      const updater = getAutoUpdater();
      
      // التأكد من تسجيل الأحداث قبل البحث
      setupAutoUpdater(updateWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]);
      
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
      
      // معالجة أخطاء محددة
      let errorMessage = error.message || error.toString();
      
      // خطأ 404 يعني عدم وجود releases منشورة
      if (errorMessage.includes('404')) {
        console.log('Update: 404 error - treating as no update available');
        errorMessage = 'لا يوجد إصدارات منشورة على GitHub';
        // إرسال حالة "لا يوجد تحديث" بدلاً من خطأ
        sendStatusToWindow('update-not-available', { version: app.getVersion() });
        return { success: true, noReleases: true };
      }
      
      // إرسال رسالة خطأ للمستخدم
      console.log('Update: Sending error to window:', errorMessage);
      sendStatusToWindow('update-error', { message: errorMessage });
      return { success: false, error: errorMessage };
    }
  });

  ipcMain.handle('download-update', async (event) => {
    try {
      // تحديث updateWindow للنافذة الحالية
      const currentWindow = BrowserWindow.fromWebContents(event.sender);
      if (currentWindow) {
        updateWindow = currentWindow;
        console.log('Download: Updated window reference from download-update');
      }
      
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
      
      // بدء التحميل مع timeout (10 دقائق)
      const downloadPromise = updater.downloadUpdate();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          console.log('Download: Timeout reached (10 minutes)');
          reject(new Error('انتهت مهلة تحميل التحديث (10 دقائق)'));
        }, 600000);
      });
      
      console.log('Download: Starting download...');
      console.log('Download: Cache directory:', app.getPath('userData'));
      console.log('Download: Update will be saved to:', `${app.getPath('userData')}\\..\\الرابط كاشير-updater\\pending`);
      await Promise.race([downloadPromise, timeoutPromise]);
      console.log('Download: Download completed successfully');
      
      return { success: true };
    } catch (error) {
      console.error('Download: Error:', error);
      const errorMsg = error.message || error.toString();
      sendStatusToWindow('update-error', { message: errorMsg });
      return { success: false, error: errorMsg };
    }
  });

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

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('get-support-status', async () => {
    try {
      const status = await checkSupportValidity();
      return { success: true, ...status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-update-cache-path', () => {
    const basePath = app.getPath('userData');
    const updatePath = require('path').join(basePath, '..', 'الرابط كاشير-updater', 'pending');
    return { success: true, path: updatePath };
  });
}

module.exports = {
  setupAutoUpdater,
  registerUpdateIPC,
  getAutoUpdater,
  checkSupportValidity
};
