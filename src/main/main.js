// Electron main process
const { app, BrowserWindow, ipcMain, session, Menu, clipboard, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const dns = require('dns');
require('dotenv').config();

try {
  process.env.NODE_ENV = process.env.NODE_ENV || 'production';
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
} catch (_) { }

dns.setDefaultResultOrder('ipv4first');

// Single instance lock - focus existing window instead of opening a second one
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    try {
      const wins = require('electron').BrowserWindow.getAllWindows();
      if (wins.length > 0) {
        const w = wins[0];
        if (w.isMinimized()) w.restore();
        w.focus();
      }
    } catch (_) {}
  });
}

// Ensure userData/cache paths are writable and set Chromium cache location early
try {
  const userDataDir = path.join(app.getPath('appData'), 'POS-SA');
  app.setPath('userData', userDataDir);
  const cacheDir = path.join(userDataDir, 'Cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  app.commandLine.appendSwitch('disk-cache-dir', cacheDir);
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
  
  app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
  app.commandLine.appendSwitch('disable-dev-shm-usage');
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
} catch (_) { /* ignore */ }

const { registerAuthIPC, ensureAdminUser } = require('./auth');
const { registerUsersIPC } = require('./users');
const { registerProductsIPC } = require('./products');
const { registerCustomersIPC } = require('./customers');
const { registerAppointmentsIPC } = require('./appointments');
const { registerTypesIPC } = require('./types');
const { registerSettingsIPC } = require('./settings');
const { registerSalesIPC } = require('./sales');
const { registerShiftsIPC } = require('./shifts');
const { registerOperationsIPC } = require('./operations');
const { registerPurchasesIPC } = require('./purchases');
const { registerSuppliersIPC } = require('./suppliers');
const { registerEmployeesIPC } = require('./employees');
const { registerPurchaseInvoicesIPC } = require('./purchase_invoices');
// Rooms and Inventory modules removed per requirements
// const { registerInventoryIPC } = require('./inventory');
// const { registerRoomsIPC } = require('./rooms');
const { registerKitchenIPC } = require('./kitchen');
const { registerCustomerPricingIPC } = require('./customer_pricing');
const { registerOffersIPC } = require('./offers');
const { registerDriversIPC } = require('./drivers');
const { registerHeldInvoicesIPC } = require('./held_invoices');
const { registerPermissionsIPC } = require('./permissions');
const { registerVouchersIPC } = require('./vouchers');
const setupQuotationsIPC = require('./quotations');
const whatsappService = require('./whatsapp-service');
const { registerDailyEmailScheduler, submitUnsentInvoicesHourly, stopDailyEmailScheduler, stopUnsentInvoicesScheduler } = require('./scheduler');
const { startAppointmentReminderService, stopAppointmentReminderService } = require('./appointment-reminder');
const { updateConfig, getConfig, testConnection } = require('../db/connection');
// const ZatcaIntegration = require('./zatca');
// const ZatcaSalesIntegration = require('./zatca-sales-integration');
const { registerBackupIPC } = require('./backup');
const { setupAutoUpdater, registerUpdateIPC } = require('./updater');
const { startAPIServer, stopAPIServer } = require('./api-server');
const { isPrimaryDevice, isSecondaryDevice, fetchFromAPI } = require('./api-client');
const customerDisplay = require('./customer-display/index');

let __tWhatsAppAutoConnect = null;
let __tPrewarmPrint = null;
let __isQuitting = false;
let __mainWindow = null;
let __tForceExit = null;

// ===== Pre-warm print window pool (1 window kept ready to eliminate BrowserWindow creation overhead) =====
let _prewarmPrintWin = null;
let _prewarmPrintWinBusy = false;

function _spawnPrewarmPrintWin() {
  if (__isQuitting) return;
  if (_prewarmPrintWin && !_prewarmPrintWin.isDestroyed()) return;
  try {
    const _path = require('path');
    _prewarmPrintWin = new BrowserWindow({
      show: false,
      frame: false,
      webPreferences: {
        preload: _path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      }
    });
    const warmFile = _path.join(__dirname, '..', 'renderer', 'sales', 'print.html');
    _prewarmPrintWin.loadFile(warmFile, { query: { _warm: '1' } }).catch(() => {});
    _prewarmPrintWin.on('closed', () => {
      _prewarmPrintWin = null;
      _prewarmPrintWinBusy = false;
    });
  } catch(_) { _prewarmPrintWin = null; }
}

function _acquirePrewarmWin() {
  if (_prewarmPrintWin && !_prewarmPrintWin.isDestroyed() && !_prewarmPrintWinBusy) {
    _prewarmPrintWinBusy = true;
    return _prewarmPrintWin;
  }
  return null;
}

function _releasePrewarmWin(win, destroy) {
  if (!win || win.isDestroyed()) { _prewarmPrintWinBusy = false; _spawnPrewarmPrintWin(); return; }
  if (destroy) {
    try { win.destroy(); } catch(_) {}
    _prewarmPrintWinBusy = false;
    _prewarmPrintWin = null;
    if (!__isQuitting) {
      setTimeout(() => { try { _spawnPrewarmPrintWin(); } catch(_) {} }, 1000);
    }
  } else {
    _prewarmPrintWinBusy = false;
  }
}

// ===== Custom Protocol: product-img://id → image from DB (no IPC overhead) =====
try {
  protocol.handle('product-img', async (request) => {
    try {
      const url = new URL(request.url);
      const id = url.hostname || url.pathname.replace(/^\//, '');
      if (!id) return new Response('', { status: 400 });
      if (isSecondaryDevice()) {
        try {
          const { getApiBaseUrl } = require('./api-client');
          const axios = require('axios');
          const apiUrl = `${getApiBaseUrl()}/products/${id}/image`;
          const resp = await axios.get(apiUrl, { responseType: 'arraybuffer', timeout: 8000 });
          const ct = (resp.headers && resp.headers['content-type']) || 'image/png';
          return new Response(resp.data, { headers: { 'Content-Type': ct } });
        } catch(_) { return new Response('', { status: 404 }); }
      }
      const { dbAdapter } = require('../db/db-adapter');
      const conn = await dbAdapter.getConnection();
      try {
        const [rows] = await conn.query(
          'SELECT image_blob, image_mime, image_path FROM products WHERE id=? LIMIT 1',
          [id]
        );
        if (!rows || !rows.length) return new Response('', { status: 404 });
        const row = rows[0];
        if (row.image_blob) {
          const mime = row.image_mime || 'image/png';
          return new Response(Buffer.from(row.image_blob), { headers: { 'Content-Type': mime } });
        }
        if (row.image_path) {
          try {
            const absPath = require('path').isAbsolute(row.image_path)
              ? row.image_path
              : require('path').join(__dirname, '..', '..', row.image_path);
            const buf = require('fs').readFileSync(absPath);
            const ext = require('path').extname(row.image_path).toLowerCase().replace('.','');
            const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext || 'png'}`;
            return new Response(buf, { headers: { 'Content-Type': mime } });
          } catch(_) { return new Response('', { status: 404 }); }
        }
        return new Response('', { status: 404 });
      } finally { conn.release(); }
    } catch(e) { return new Response('', { status: 500 }); }
  });
} catch(_) { /* ignore if protocol already registered */ }

// --- Simple offline license (device-lock) helpers ---
const si = require('systeminformation');
const crypto = require('crypto');

let hwCache = null;
async function getHardwareIDs(){
  if(hwCache) return hwCache;
  try{
    const [boardData, netData, diskData] = await Promise.all([
      si.baseboard().catch(() => null),
      si.networkInterfaces().catch(() => null),
      si.diskLayout().catch(() => null)
    ]);
    
    let board = null, mac = null, disk = null;
    
    if(boardData && boardData.serial){
      board = boardData.serial.toUpperCase();
    }
    
    if(netData){
      const ethernetAdapter = netData.find(iface => 
        iface.iface && iface.iface.toLowerCase().includes('ethernet') && iface.mac
      );
      if(ethernetAdapter && ethernetAdapter.mac){
        mac = ethernetAdapter.mac.replace(/[^A-F0-9]/gi, '').toUpperCase();
      }
    }
    
    if(diskData && diskData.length > 0 && diskData[0].serialNum){
      disk = diskData[0].serialNum.toUpperCase();
    }
    
    hwCache = { board, mac, disk };
    return hwCache;
  }catch(_){
    hwCache = { board: null, mac: null, disk: null };
    return hwCache;
  }
}

async function getBoardSerial(){
  const hw = await getHardwareIDs();
  return hw.board;
}

async function getEthernetMac(){
  const hw = await getHardwareIDs();
  return hw.mac;
}

async function getDiskSerial(){
  const hw = await getHardwareIDs();
  return hw.disk;
}
function expectedCode(uuid){
  const SECRET = 'POS_SA_LICENSE_SECRET_v1';
  return crypto.createHash('sha256').update(String(uuid||'') + '|' + SECRET).digest('hex').toUpperCase();
}
async function readLicense(){
  // Read activation strictly from DB
  try{
    const { dbAdapter } = require('../db/db-adapter');
    const conn = await dbAdapter.getConnection();
    try{
      const [rows] = await conn.query('SELECT license_uuid, license_code FROM app_settings WHERE id=1 LIMIT 1');
      if(rows && rows[0] && rows[0].license_code){
        return { uuid: rows[0].license_uuid||null, code: rows[0].license_code||null };
      }
    }finally{ conn.release(); }
  }catch(_){ }
  return null;
}
async function writeLicense(data){
  // Save activation strictly to DB only
  try{
    const { dbAdapter } = require('../db/db-adapter');
    const conn = await dbAdapter.getConnection();
    try{
      await conn.query('UPDATE app_settings SET license_uuid=?, license_code=?, license_activated_at=NOW() WHERE id=1', [data.uuid||null, data.code||null]);
      return true;
    }finally{ conn.release(); }
  }catch(_){ return false; }
}
async function resetLicense(){
  // Clear activation info in DB
  try{
    const { dbAdapter } = require('../db/db-adapter');
    const conn = await dbAdapter.getConnection();
    try{
      await conn.query('UPDATE app_settings SET license_uuid=NULL, license_code=NULL, license_activated_at=NULL WHERE id=1');
      return true;
    }finally{ conn.release(); }
  }catch(_){ return false; }
}

async function isLicensed(){
  const lic = await readLicense();
  if(!lic || !lic.code) return false;
  const hw = await getHardwareIDs();
  const { board, mac, disk } = hw;
  
  if(board){
    const exp = expectedCode(board);
    if(String(lic.code).toUpperCase() === exp && String(lic.uuid||'').toUpperCase() === board){ return true; }
  }
  if(mac){
    const exp = expectedCode(mac);
    if(String(lic.code).toUpperCase() === exp && String(lic.uuid||'').toUpperCase() === mac){ return true; }
  }
  if(disk){
    const exp = expectedCode(disk);
    if(String(lic.code).toUpperCase() === exp && String(lic.uuid||'').toUpperCase() === disk){ return true; }
  }
  return false;
}
function registerWhatsAppIPC() {
  ipcMain.handle('whatsapp:initialize', async () => {
    try {
      const result = await whatsappService.initialize();
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp:get_qr', async () => {
    try {
      const qr = await whatsappService.getQRCode();
      return { success: true, qr };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp:status', async () => {
    try {
      const status = await whatsappService.getConnectionStatus();
      return { success: true, ...status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp:send_text', async (event, phone, message) => {
    try {
      const result = await whatsappService.sendTextMessage(phone, message);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp:send_file', async (event, phone, filePath, filename, caption) => {
    try {
      const result = await whatsappService.sendFile(phone, filePath, filename, caption);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp:disconnect', async () => {
    try {
      const result = await whatsappService.disconnect();
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp:logout', async () => {
    try {
      const result = await whatsappService.logout();
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp:get_messages_stats', async () => {
    try {
      if (!whatsappService) {
        return { success: false, error: 'WhatsApp service not initialized' };
      }
      const stats = await whatsappService.getMessagesStats();
      return { success: true, ...stats };
    } catch (error) {
      console.error('Error getting messages stats:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp:update_messages_limit', async (event, limit) => {
    try {
      const { dbAdapter } = require('../db/db-adapter');
      const conn = await dbAdapter.getConnection();
      try {
        await conn.query('UPDATE app_settings SET whatsapp_messages_limit = ? WHERE id=1', [limit]);
        return { success: true };
      } finally {
        conn.release();
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('whatsapp:reset_messages_count', async () => {
    try {
      const { dbAdapter } = require('../db/db-adapter');
      const conn = await dbAdapter.getConnection();
      try {
        await conn.query('UPDATE app_settings SET whatsapp_messages_sent = 0 WHERE id=1');
        return { success: true };
      } finally {
        conn.release();
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

// License IPC handlers function
function registerLicenseIPC() {
  // IPC for license check/activation
  ipcMain.handle('license:check', async () => {
    try{ const ok = await isLicensed(); return { ok }; }catch(_){ return { ok:false }; }
  });
  ipcMain.handle('license:activate', async (_e, { code }) => {
    try{
      const input = String(code||'').replace(/\s|-/g,'').toUpperCase();
      if(!input){ return { ok:false, error:'يرجى إدخال كود التفعيل' }; }
      const hw = await getHardwareIDs();
      const { board, mac, disk } = hw;
      const candidates = [];
      if(board) candidates.push({ id: board.toUpperCase(), type: 'baseboard' });
      if(mac) candidates.push({ id: mac.toUpperCase(), type: 'mac' });
      if(disk) candidates.push({ id: disk.toUpperCase(), type: 'disk' });
      if(candidates.length===0){ return { ok:false, error:'تعذر قراءة أي معرف جهاز (لوحة/شبكة/قرص)' }; }
      for(const {id,type} of candidates){
        const full = expectedCode(id);
        const short = full.slice(0,16);
        if(input === full || input === short || input === id){
          await writeLicense({ uuid: id, code: full, activated_at: Date.now(), type });
          hwCache = null;
          return { ok:true, type };
        }
      }
      return { ok:false, error:'كود التفعيل غير صحيح' };
    }catch(e){ return { ok:false, error: String(e && e.message || e) }; }
  });
  // Reset license (DB only)
  ipcMain.handle('license:reset', async () => {
    try{ const ok = await resetLicense(); return { ok }; }catch(_){ return { ok:false }; }
  });
}

function registerContextMenuIPC() {
  ipcMain.handle('clipboard:read', () => { try { return clipboard.readText(); } catch(_){ return ''; } });
  ipcMain.handle('clipboard:write', (_e, text) => { try { clipboard.writeText(String(text || '')); } catch(_){} });

  ipcMain.handle('context:show', (event, payload) => {
    try{
      const win = BrowserWindow.fromWebContents(event.sender);
      if(!win) return { ok:false };
      const template = [
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'selectAll' }
      ];
      const menu = Menu.buildFromTemplate(template);
      menu.popup({ window: win });
      return { ok:true };
    }catch(_){ return { ok:false }; }
  });
}

async function createMainWindow() {
  // Determine which page to load BEFORE creating window
  const activationPage = path.join(__dirname, '../renderer/activation/index.html');
  const loginPage = path.join(__dirname, '../renderer/login/index.html');
  const branchSelectionPage = path.join(__dirname, '../renderer/branch-selection/index.html');
  const startPagePromise = (async () => {
    let startPage = loginPage;
    try{
      // إذا تم تكوين فرع واحد أو أكثر، نبدأ بصفحة اختيار الفرع
      try {
        const branchesFile = path.join(app.getPath('userData'), 'branches.json');
        if (fs.existsSync(branchesFile)) {
          const raw = fs.readFileSync(branchesFile, 'utf-8') || '[]';
          const branchesData = JSON.parse(raw);
          const activeBranches = Array.isArray(branchesData) ? branchesData.filter(b => b.is_active !== 0) : [];
          if (activeBranches.length > 0) {
            return branchSelectionPage;
          }
        }
      } catch (_){ /* ignore */ }

      const cfg = getConfig();
      const isLocalhost = !cfg.host || cfg.host === '127.0.0.1' || cfg.host.toLowerCase() === 'localhost';
      
      if(isLocalhost){
        // Test DB connection
        const testPromise = new Promise((resolve, reject) => {
          const net = require('net');
          const socket = new net.Socket();
          const timeout = setTimeout(() => { socket.destroy(); reject(new Error('timeout')); }, 3000);
          socket.setTimeout(3000);
          socket.once('connect', () => { clearTimeout(timeout); socket.destroy(); resolve(true); });
          socket.once('error', () => { clearTimeout(timeout); reject(new Error('connection failed')); });
          socket.connect(cfg.port || 3306, cfg.host);
        });
        
        try{
          await testPromise;
          
          // Check if multiple branches are configured
          const { dbAdapter } = require('../db/db-adapter');
          const conn = await dbAdapter.getConnection();
          try {
            const [branchRows] = await conn.query('SELECT COUNT(*) as count FROM branches WHERE is_active = 1');
            const branchCount = branchRows[0].count;
            
            if (branchCount > 1) {
              // Multiple branches configured - show branch selection
              startPage = branchSelectionPage;
            } else {
              // Check license
              let ok = false;
              try{
                ok = await isLicensed();
              }catch(err){
                ok = false;
              }
              
              if(!ok){
                startPage = activationPage;
              }
            }
          } finally {
            conn.release();
          }
        }catch(dbErr){
          // DB connection failed - show activation page
          startPage = activationPage;
        }
      } else {
        // Remote DB - skip license check, go to login
        startPage = loginPage;
      }
    }catch(_){ /* ignore */ }
    return startPage;
  })();

  // Now create window with correct start page
  const win = new BrowserWindow({
    width: 1200,
    height: 760,
    fullscreen: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      spellcheck: false,
      enableWebSQL: false,
      v8CacheOptions: 'code',
    },
    title: 'نظام الرابط - الرئيسية',
    show: false,
    backgroundColor: '#667eea',
    icon: path.join(__dirname, '..', '..', 'assets', 'icon', 'app.ico')
  });

  __mainWindow = win;
  win.on('closed', () => {
    __mainWindow = null;
  });

  win.on('close', () => {
    try {
      if (process.platform !== 'darwin' && !__isQuitting) {
        __isQuitting = true;
        app.quit();
      }
    } catch (_) {}
  });

  win.loadFile(loginPage);

  let _shown = false;
  function _showWin() {
    if (_shown || win.isDestroyed()) return;
    _shown = true;
    try { win.show(); } catch (_) {}
    try { setupAutoUpdater(win); } catch (_) {}
    try { win.webContents.setFrameRate(60); } catch (_) {}
    try { win.webContents.setBackgroundThrottling(false); } catch (_) {}
  }

  win.once('ready-to-show', _showWin);

  setTimeout(() => { _showWin(); }, 6000);

  startPagePromise
    .then((page) => {
      try{
        if(!win.isDestroyed() && page && page !== loginPage){
          if(page === branchSelectionPage){
            win.setSize(460, 560);
            win.center();
            win.setResizable(false);
          } else if(page === activationPage){
            win.setSize(460, 520);
            win.center();
            win.setResizable(false);
          }
          win.loadFile(page);
        }
      }catch(_){ }
    })
    .catch(() => { });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('quotation.html')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          frame: false,
          width: 800,
          height: 900,
          webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
          }
        }
      };
    }
    return { action: 'allow' };
  });

  // Alt key toggles menu (File/Edit/View) visibility explicitly on Windows/Linux
  try{
    win.webContents.on('before-input-event', (event, input) => {
      try{
        if(process.platform !== 'darwin' && input && input.type === 'keyDown' && String(input.key).toLowerCase() === 'alt'){
          const next = !win.isMenuBarVisible();
          win.setMenuBarVisibility(next);
          event.preventDefault();
        }
      }catch(_){ /* ignore */ }
    });
  }catch(_){ }

  // Background monitor disabled - license check only happens on app start

  // App-level IPC
  ipcMain.handle('app:quit', () => { app.quit(); });
  ipcMain.handle('app:relaunch', () => { app.relaunch(); app.quit(); });
  ipcMain.handle('app:restart', () => { app.relaunch(); app.quit(); });

  // Register Backup IPC (email DB dump)
  try{ registerBackupIPC && registerBackupIPC(); }catch(_){ }

  // Register Update IPC (electron-updater)
  try{ registerUpdateIPC && registerUpdateIPC(); }catch(_){ }

  // Window controls (fullscreen toggle, back)
  ipcMain.handle('window:set_size', async (event, { width, height, center, resizable } = {}) => {
    try {
      const { BrowserWindow } = require('electron');
      const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (!w) return { ok: false, error: 'no-window' };
      if (resizable !== undefined) w.setResizable(resizable);
      if (width && height) w.setSize(Math.round(width), Math.round(height));
      if (center !== false) w.center();
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  });
  ipcMain.handle('window:toggle_fullscreen', async (event) => {
    try{
      const { BrowserWindow } = require('electron');
      const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if(!w) return { ok:false, error:'no-window' };
      const next = !w.isFullScreen();
      w.setFullScreen(next);
      return { ok:true, fullscreen: next };
    }catch(e){ return { ok:false, error: String(e && e.message || e) }; }
  });
  ipcMain.handle('window:back', async (event) => {
    try{
      const { BrowserWindow } = require('electron');
      const path = require('path');
      const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if(!w) return { ok:false, error:'no-window' };
      if(w.webContents && w.webContents.canGoBack()){
        w.webContents.goBack();
        return { ok:true, didGoBack:true };
      }
      // If cannot goBack, navigate to main screen
      await w.loadFile(path.join(__dirname, '../renderer/main/index.html'));
      return { ok:true, didGoBack:false };
    }catch(e){ return { ok:false, error: String(e && e.message || e) }; }
  });

  // Get assets path for fonts
  ipcMain.handle('app:get_assets_path', async () => {
    try {
      const assetsPath = path.join(__dirname, '..', '..', 'assets', 'fonts');
      return { ok: true, path: assetsPath };
    } catch (err) {
      console.error('app:get_assets_path error:', err);
      return { ok: false, error: err.message };
    }
  });

  // App locale IPC backed by DB settings
  ipcMain.handle('app:get_locale', async () => {
    // 1) Try DB setting
    try{
      const r = await registerSettingsIPC.settings_get_direct?.();
      if(r && r.app_locale){ return { ok:true, lang: r.app_locale }; }
    }catch(_){ }
    try{ const st = await (require('./settings').__get_app_locale())(); if(st) return { ok:true, lang: st }; }catch(_){ }
    // 2) Fallback to local file in userData
    try{
      const p = path.join(app.getPath('userData'), 'app-locale.json');
      if(fs.existsSync(p)){
        const j = JSON.parse(fs.readFileSync(p,'utf-8'));
        const v = (j && j.lang==='en')?'en':'ar';
        return { ok:true, lang: v };
      }
    }catch(_){ }
    return { ok:true, lang: 'ar' };
  });
  ipcMain.handle('app:set_locale', async (event, { lang }) => {
    const v = (lang==='en'?'en':'ar');
    try{ await (require('./settings').__set_app_locale())(v); }catch(_){ }
    // Persist to local file as well for robustness (e.g., if DB not reachable early)
    try{
      const p = path.join(app.getPath('userData'), 'app-locale.json');
      fs.writeFileSync(p, JSON.stringify({ lang: v }), 'utf-8');
    }catch(_){ }
    try{
      const senderId = event && event.sender && event.sender.id;
      BrowserWindow.getAllWindows().forEach(w => {
        try{ w.webContents.send('app:locale_changed', v); }catch(_){ }
        // Reload all other windows except the one that initiated the change to avoid flicker
        try{
          if(w.webContents && w.webContents.id !== senderId){
            if (typeof w.webContents.reloadIgnoringCache === 'function') {
              w.webContents.reloadIgnoringCache();
            } else {
              w.webContents.reload();
            }
          }
        }catch(_){ }
      });
    }catch(_){ }
    return { ok:true };
  });

  // Zoom level persist + broadcast
  ipcMain.handle('zoom:get', async () => {
    try {
      const p = path.join(app.getPath('userData'), 'app-zoom.json');
      if (fs.existsSync(p)) {
        const f = parseFloat(JSON.parse(fs.readFileSync(p, 'utf-8')).factor);
        if (!isNaN(f) && f >= 0.5 && f <= 2.0) return f;
      }
    } catch (_) {}
    return 1.0;
  });

  ipcMain.handle('zoom:set', async (event, factor) => {
    const f = Math.max(0.5, Math.min(2.0, parseFloat(factor) || 1.0));
    try {
      const p = path.join(app.getPath('userData'), 'app-zoom.json');
      fs.writeFileSync(p, JSON.stringify({ factor: f }), 'utf-8');
    } catch (_) {}
    try {
      BrowserWindow.getAllWindows().forEach(w => {
        try { if (!w.isDestroyed()) w.webContents.send('zoom:apply', f); } catch (_) {}
      });
    } catch (_) {}
    return { ok: true };
  });

  // Saved accounts fallback (userData JSON)
  ipcMain.handle('saved_accounts:get', async () => {
    try{
      const p = path.join(app.getPath('userData'), 'saved-accounts.json');
      if(fs.existsSync(p)){
        const list = JSON.parse(fs.readFileSync(p, 'utf-8') || '[]');
        return { ok:true, list: Array.isArray(list) ? list : [] };
      }
    }catch(_){ }
    return { ok:true, list: [] };
  });
  ipcMain.handle('saved_accounts:set', async (_e, list) => {
    try{
      const p = path.join(app.getPath('userData'), 'saved-accounts.json');
      const arr = Array.isArray(list) ? list : [];
      fs.writeFileSync(p, JSON.stringify(arr), 'utf-8');
      return { ok:true };
    }catch(e){
      return { ok:false, error: String(e && e.message || e) };
    }
  });

  // DB config IPC for linking to primary device
  ipcMain.handle('db:get_config', async () => {
    try{ return { ok:true, config: getConfig() }; }catch(e){ return { ok:false, error: String(e && e.message || e) }; }
  });
  ipcMain.handle('db:test', async (_e, cfg) => {
    try{ await testConnection(cfg||{}); return { ok:true }; }catch(e){ return { ok:false, error: String(e && e.message || e) }; }
  });
  ipcMain.handle('db:apply', async (_e, cfg) => {
    try{ const applied = await updateConfig(cfg||{}); return { ok:true, config: applied }; }catch(e){ return { ok:false, error: String(e && e.message || e) }; }
  });

  // Relay UI sales change events to all windows (safety net)
  ipcMain.on('ui:sales_changed', (_e, payload) => {
    try{
      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows().forEach(w => w.webContents.send('sales:changed', payload || { action: 'updated' }));
    }catch(_){ }
  });

  // Relay UI products change events to all windows
  ipcMain.on('ui:products_changed', (_e, payload) => {
    try{
      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows().forEach(w => w.webContents.send('products:changed', payload || { action: 'stock-updated' }));
    }catch(_){ }
  });

  // Relay WhatsApp invoice sent events to all windows
  ipcMain.on('ui:whatsapp_invoice_sent', (_e, payload) => {
    try{
      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows().forEach(w => w.webContents.send('whatsapp-invoice-sent', payload || {}));
    }catch(_){ }
  });

  // PDF export handler
  ipcMain.handle('pdf:export', async (_e, { html, options }) => {
    let tmpWin = null;
    try{
      const { BrowserWindow, shell } = require('electron');
      const fs = require('fs');
      const path = require('path');
      const os = require('os');

      // Inline local images (e.g., logo) as data URLs to ensure they render in data: URL context
      function inlineImages(htmlIn){
        try{
          const appRoot = path.resolve(__dirname, '..', '..');
          const toDataUrl = (absPath) => {
            try{
              if(!fs.existsSync(absPath)) return null;
              const buf = fs.readFileSync(absPath);
              const ext = (path.extname(absPath).toLowerCase()||'').slice(1);
              const mime = ext==='png' ? 'image/png' : (ext==='jpg'||ext==='jpeg' ? 'image/jpeg' : (ext==='webp' ? 'image/webp' : 'application/octet-stream'));
              return `data:${mime};base64,${buf.toString('base64')}`;
            }catch(_){ return null; }
          };
          const resolveSrc = (src) => {
            try{
              if(/^file:\/\//i.test(src)){
                // file:///C:/... -> absolute path
                const p = src.replace(/^file:\/\//i,'').replace(/\//g, path.sep);
                return toDataUrl(p) || src;
              }
              if(/^assets\//i.test(src)){
                const p = path.join(appRoot, src.replace(/\//g, path.sep));
                return toDataUrl(p) || src;
              }
              return src;
            }catch(_){ return src; }
          };
          return htmlIn.replace(/(<img\b[^>]*\bsrc=)("|\')([^"\']+)(\2)/gi, (m, p1, q, url, q2) => {
            const newUrl = resolveSrc(url);
            return p1 + q + newUrl + q2;
          });
        }catch(_){ return htmlIn; }
      }

      const processedHtml = (function(htmlIn){
        try{
          const appRoot = path.resolve(__dirname, '..', '..');
          const toDataUrl = (absPath) => {
            try{
              if(!fs.existsSync(absPath)) return null;
              const buf = fs.readFileSync(absPath);
              const ext = (path.extname(absPath).toLowerCase()||'').slice(1);
              const mime = ext==='woff2' ? 'font/woff2' : (ext==='woff' ? 'font/woff' : (ext==='otf' ? 'font/otf' : 'font/ttf'));
              return `data:${mime};base64,${buf.toString('base64')}`;
            }catch(_){ return null; }
          };
          // Replace font URLs inside inline <style> blocks with data URLs so they load in data: documents
          const replaced = String(htmlIn).replace(/url\((['"]?)([^'"\)]+)\1\)/gi, (m, q, url) => {
            try{
              const u = (url||'').trim();
              const lower = u.toLowerCase();
              if(!/\.(woff2?|ttf|otf)(?:[?#].*)?$/.test(lower)) return m; // handle only font urls
              let abs = null;
              if(/^file:\/\//i.test(u)){
                abs = u.replace(/^file:\/\//i,'').replace(/\//g, path.sep);
              }else if(u.startsWith('../../../assets/')){
                const rel = u.replace(/^\.\.\/\.\.\/\.\.\//,'');
                abs = path.join(appRoot, rel.replace(/\//g, path.sep));
              }else if(u.startsWith('assets/')){
                abs = path.join(appRoot, u.replace(/\//g, path.sep));
              }else{
                return m; // leave others untouched
              }
              const data = toDataUrl(abs);
              return data ? `url('${data}')` : m;
            }catch(_){ return m; }
          });
          return replaced;
        }catch(_){ return htmlIn; }
      })(inlineImages(html));

      tmpWin = new BrowserWindow({
        width: 1000,
        height: 700,
        show: false,
        // Disable webSecurity so file:// images are not blocked if any remain
        webPreferences: { sandbox: false, webSecurity: false }
      });
      
      // Use temp file instead of data: URL to avoid ERR_INVALID_URL with large HTML
      const tmpHtmlPath = path.join(os.tmpdir(), `pdf-export-${Date.now()}.html`);
      fs.writeFileSync(tmpHtmlPath, processedHtml, 'utf-8');
      
      try{
        await tmpWin.loadFile(tmpHtmlPath);
      }finally{
        // Clean up temp file after loading
        try{ fs.unlinkSync(tmpHtmlPath); }catch(_){}
      }
      
      // Wait for all images to finish loading before printing to PDF
      try{
        await new Promise(res => setTimeout(res, 500)); // brief delay for content render
        await tmpWin.webContents.executeJavaScript(`
          new Promise((resolve) => {
            const checkReady = () => {
              const imgs = Array.from(document.images || []);
              const allLoaded = imgs.every(img => img.complete);
              if (allLoaded) {
                resolve(true);
              } else {
                setTimeout(checkReady, 100);
              }
            };
            checkReady();
          });
        `);
      }catch(e){ 
        console.warn('Image wait warning:', e);
        await new Promise(res => setTimeout(res, 500));
      }
      
      const { saveMode, filename, openAfterSave, ...printOpts } = options || {};
      const pdf = await tmpWin.webContents.printToPDF({
        marginsType: 1,
        pageSize: 'A4',
        printBackground: true,
        landscape: false,
        ...printOpts,
      });
      
      if (!pdf || pdf.length === 0) {
        throw new Error('PDF generation returned empty buffer');
      }
      
      tmpWin.destroy();
      tmpWin = null;

      // If temp mode: save to temp directory without opening
      if (saveMode === 'temp') {
        const outName = filename && String(filename).trim() ? filename.trim() : `report-${Date.now()}.pdf`;
        const outPath = path.join(os.tmpdir(), outName);
        fs.writeFileSync(outPath, pdf);
        return { ok: true, path: outPath };
      }

      // If auto-save requested: save directly to Downloads without showing dialog
      if (saveMode === 'auto') {
        const outName = filename && String(filename).trim() ? filename.trim() : `report-${Date.now()}.pdf`;
        const outPath = path.join(app.getPath('downloads'), outName);
        fs.writeFileSync(outPath, pdf);
        // Only open if explicitly requested (default: don't open for WhatsApp)
        if (openAfterSave !== false) {
          await shell.openPath(outPath);
        }
        return { ok: true, path: outPath };
      }

      // Otherwise: save temp then show Save Dialog
      const tmpPath = path.join(os.tmpdir(), `report-${Date.now()}.pdf`);
      fs.writeFileSync(tmpPath, pdf);
      const { dialog } = require('electron');
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'حفظ ملف PDF',
        defaultPath: filename && String(filename).trim() ? filename.trim() : 'report.pdf',
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });
      if(canceled){ return { ok:false, canceled:true, tmpPath }; }
      fs.copyFileSync(tmpPath, filePath);
      await shell.openPath(filePath);
      return { ok:true, path: filePath };
    }catch(e){ 
      console.error('pdf:export error:', e); 
      if(tmpWin) try{ tmpWin.destroy(); }catch(_){ }
      // include stack/details to help debug issues like A4 export failures
      const msg = e && e.message ? e.message : 'خطأ غير محدد';
      const details = e && e.stack ? String(e.stack) : String(e || '');
      return { ok:false, error: 'تعذر إنشاء PDF: ' + msg, details };
    }
  });

  // File delete handler (for temp files cleanup)
  ipcMain.handle('file:delete', async (_e, filePath) => {
    try {
      const fs = require('fs');
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return { ok: true };
      }
      return { ok: false, error: 'File not found' };
    } catch (e) {
      console.error('file:delete error:', e);
      return { ok: false, error: e.message };
    }
  });

  // CSV export handler
  ipcMain.handle('csv:export', async (_e, { csv, options }) => {
    try{
      const { app, shell, dialog } = require('electron');
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const bom = Buffer.from('\uFEFF', 'utf-8'); // UTF-8 BOM for Excel
      const data = Buffer.concat([bom, Buffer.from(String(csv||''), 'utf-8')]);
      const { saveMode, filename } = options || {};
      if(saveMode === 'auto'){
        const outName = filename && String(filename).trim() ? filename.trim() : `report-${Date.now()}.csv`;
        const outPath = path.join(app.getPath('downloads'), outName);
        fs.writeFileSync(outPath, data);
        await shell.openPath(outPath);
        return { ok:true, path: outPath };
      }
      const tmpPath = path.join(os.tmpdir(), `report-${Date.now()}.csv`);
      fs.writeFileSync(tmpPath, data);
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'حفظ ملف CSV',
        defaultPath: filename && String(filename).trim() ? filename.trim() : 'report.csv',
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      });
      if(canceled){ return { ok:false, canceled:true, tmpPath }; }
      fs.copyFileSync(tmpPath, filePath);
      await shell.openPath(filePath);
      return { ok:true, path: filePath };
    }catch(e){ console.error('csv:export error', e); return { ok:false, error:'تعذر إنشاء CSV' }; }
  });

  // Print raw HTML to system printer (silent, configurable page size, no margins) — aligned with invoice printing
  ipcMain.handle('print:html', async (_e, { html, options }) => {
    try{
      const { BrowserWindow } = require('electron');
      const tmpWin = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: { sandbox: false, webSecurity: false, partition: `print-${Date.now()}-${Math.random()}` }
      });
      await tmpWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(String(html||'')));

      const {
        silent = true,
        deviceName = undefined,
        printBackground = true,
        copies = 1,
        pageSize: customPageSize = null,
      } = options || {};

      // Minimal delay for thermal printer speed
      await new Promise((resolve) => setTimeout(resolve, 10));

      await new Promise((resolve, reject) => {
        const baseOptions = {
          silent,
          deviceName,
          printBackground,
          margins: { marginType: 'none' },
          landscape: false,
          pageSize: { width: 80000, height: 297000 }, // default microns: 80mm x 297mm
          copies,
        };
        const finalOptions = customPageSize
          ? { ...baseOptions, pageSize: customPageSize }
          : baseOptions;

        tmpWin.webContents.print(finalOptions, (ok, err) => {
          if(!ok && err){ reject(new Error(err)); } else { resolve(true); }
        });
      });
      tmpWin.destroy();
      return { ok:true };
    }catch(e){ console.error('print:html error', e); return { ok:false, error: 'تعذر الطباعة' }; }
  });

  // Silent print invoice (load template and print to default printer)
  ipcMain.handle('print:invoice_silent', async (_e, { id, pay, cash, room, format, cashier, copyNumber }) => {
    const { BrowserWindow } = require('electron');
    const path = require('path');
    try{
      false && console.log('print:invoice_silent start', { id, pay, cash, room, format, cashier, copyNumber });
      const isA4 = String(format || '').toLowerCase() === 'a4';
      const file = isA4 ? 'print-a4.html' : 'print.html';
      const filePath = path.join(__dirname, '..', 'renderer', 'sales', file);
      const q = new URLSearchParams({ id: String(id||''), pay: String(pay||''), cash: String(cash||'') });
      if(room){ q.set('room', String(room)); }
      if(cashier){ q.set('cashier', String(cashier)); }
      const prewarmed = !isA4 ? _acquirePrewarmWin() : null;
      const tmpWin = prewarmed || new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
      await tmpWin.loadFile(filePath, { query: Object.fromEntries(q) });
      try{
        const contentReady = await tmpWin.webContents.executeJavaScript(`new Promise((resolve)=>{ 
          const step=()=>{ 
            try{ if(window.__CONTENT_READY__===true){ resolve(true); return; } }catch(_){}
            setTimeout(step,25);
          };
          step();
        })`);
        false && console.log('print:invoice_silent content_ready', { id, contentReady });
      }catch(e){ false && console.log('print:invoice_silent content_ready error', { id, error: String(e && e.message || e) }); }
      await new Promise((resolve, reject) => {
        // احترام صيغة الطباعة: A4 أو حراري 80mm
        const printOpts = isA4 ? {
          silent: true,
          printBackground: true,
          margins: { marginType: 'default' },
          pageSize: 'A4',
        } : {
          silent: true,
          printBackground: true,
          margins: { marginType: 'none' },
          pageSize: { width: 80000, height: 297000 }, // microns: 80mm x 297mm
        };
        tmpWin.webContents.print(printOpts, async (ok, err) => {
          false && console.log('print:invoice_silent print_result', { id, ok, err });
          if(!ok && err){ 
            if(prewarmed) _releasePrewarmWin(tmpWin, true);
            reject(new Error(err)); 
          } else { 
            // Destroy window after a delay to allow renderer to finish its tasks (like WhatsApp sending)
            setTimeout(() => {
              _releasePrewarmWin(tmpWin, true);
            }, 45000);
            resolve(); 
          }
        });
      });
      return { ok: true };
    }catch(e){ false && console.error('print:invoice_silent error', e); return { ok:false, error:'فشل الطباعة الصامتة' }; }
  });

  // Preview print invoice: open hidden BrowserWindow, wait for content + autoshrink, resize, then show
  ipcMain.handle('print:invoice_preview', async (_e, { file, format, query, silentMode }) => {
    const { BrowserWindow, screen } = require('electron');
    const path = require('path');
    try {
      const isA4 = String(format || '').toLowerCase() === 'a4';
      const fileName = file || (isA4 ? 'print-a4.html' : 'print.html');
      const filePath = path.join(__dirname, '..', 'renderer', 'sales', fileName);
      const queryObj = { preview: '1' };
      if (query) { Object.keys(query).forEach(k => { if (query[k] !== '' && query[k] != null) queryObj[k] = String(query[k]); }); }

      const initW = isA4 ? 800 : 420;
      const initH = isA4 ? 900 : 680;

      const previewWin = new BrowserWindow({
        width: initW,
        height: initH,
        show: false,
        title: 'طباعة الفاتورة',
        frame: false,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          backgroundThrottling: false,
        }
      });

      await previewWin.loadFile(filePath, { query: queryObj });

      previewWin.center();
      previewWin.show();

      try {
        await previewWin.webContents.executeJavaScript(`new Promise((resolve) => {
          const step = () => {
            try { if (window.__CONTENT_READY__ === true) { resolve(true); return; } } catch(_) {}
            setTimeout(step, 25);
          };
          step();
          setTimeout(() => resolve(false), 5000);
        })`);
      } catch(_) {}

      if (!isA4) {
        try {
          await previewWin.webContents.executeJavaScript(`new Promise((resolve) => {
            let lastW = 0;
            let lastH = 0;
            let stableCount = 0;
            const startedAt = Date.now();
            const maxWaitMs = 1800;
            const step = () => {
              try {
                if (window.__LAYOUT_READY__ === true) { resolve(true); return; }
                const ticket = document.querySelector('.ticket');
                if (ticket) {
                  const rect = ticket.getBoundingClientRect();
                  const w = Math.ceil(rect.width || 0);
                  const h = Math.ceil(rect.height || 0);
                  if (w > 0 && h > 0 && Math.abs(w - lastW) <= 1 && Math.abs(h - lastH) <= 1) {
                    stableCount += 1;
                    if (stableCount >= 2) { resolve(true); return; }
                  } else {
                    stableCount = 0;
                  }
                  lastW = w;
                  lastH = h;
                }
              } catch(_) {}
              if (Date.now() - startedAt >= maxWaitMs) { resolve(false); return; }
              setTimeout(step, 25);
            };
            step();
          })`);
        } catch(_) {}
        try {
          const [outerW, outerH] = previewWin.getSize();
          const [innerW, innerH] = previewWin.getContentSize();
          const frameW = outerW - innerW;
          const frameH = outerH - innerH;
          const dims = await previewWin.webContents.executeJavaScript(`(() => {
            try {
              const ticket = document.querySelector('.ticket');
              if (!ticket) return null;
              const rect = ticket.getBoundingClientRect();
              return { w: Math.ceil(rect.width), h: Math.ceil(rect.height) };
            } catch(_) { return null; }
          })()`);
          if (dims && dims.w && dims.h) {
            const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
            previewWin.setSize(
              Math.min(Math.max(360, dims.w + frameW), screenW),
              Math.min(Math.max(320, dims.h + 16 + frameH), Math.floor(screenH * 0.85))
            );
            previewWin.center();
          }
        } catch(_) {}
      }

      if(!silentMode){
        try { previewWin.webContents.executeJavaScript('setTimeout(function(){ window.print(); }, 80)'); } catch(_) {}
      }
      return { ok: true };
    } catch(e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  });

  // QR generation handlers (run in main to ensure availability)
  ipcMain.handle('qr:to_data_url', async (_e, { text, opts }) => {
    try{
      const QRCode = require('qrcode');
      const { errorCorrectionLevel = 'M', width = 120, margin = 1 } = opts || {};
      const dataUrl = await QRCode.toDataURL(String(text||''), { errorCorrectionLevel, width, margin });
      return { ok:true, dataUrl };
    }catch(e){ console.error('qr:to_data_url error', e); return { ok:false, error: String(e && e.message || e) }; }
  });

  ipcMain.handle('qr:to_svg', async (_e, { text, opts }) => {
    try{
      const QRCode = require('qrcode');
      const { width = 120, margin = 1 } = opts || {};
      const svg = await QRCode.toString(String(text||''), { type: 'svg', width, margin });
      return { ok:true, svg };
    }catch(e){ console.error('qr:to_svg error', e); return { ok:false, error: String(e && e.message || e) }; }
  });

  // Navigation handler for ZATCA integration
  ipcMain.handle('navigation:goTo', async (_e, page) => {
    try {
      let targetPath;
      switch(page) {
        case 'main':
          targetPath = '../renderer/main/index.html';
          break;
        case 'zatca':
          targetPath = '../renderer/zatca/index.html';
          break;
        default:
          targetPath = '../renderer/main/index.html';
      }
      
      win.loadFile(path.join(__dirname, targetPath));
      return { ok: true };
    } catch (error) {
      console.error('Navigation error:', error);
      return { ok: false, error: error.message };
    }
  });

  // File dialog for image picking
  const { dialog } = require('electron');
  ipcMain.handle('fs:pick_image', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'اختر صورة المنتج',
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png','jpg','jpeg','webp'] }
      ]
    });
    if(r.canceled || !r.filePaths || !r.filePaths.length) return { ok:false, canceled:true };
    return { ok:true, path: r.filePaths[0] };
  });

  // Import selected image into app assets and return relative + absolute path
  ipcMain.handle('fs:import_image', async (_e, srcPath) => {
    try{
      const fs = require('fs');
      const fsp = require('fs/promises');
      const path = require('path');
      const appRoot = path.resolve(__dirname, '..', '..');
      const destDir = path.join(appRoot, 'assets', 'products');
      await fsp.mkdir(destDir, { recursive: true });
      const ext = path.extname(srcPath || '').toLowerCase() || '.png';
      const base = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8) + ext;
      const destAbs = path.join(destDir, base);
      await fsp.copyFile(srcPath, destAbs);
      const rel = path.join('assets', 'products', base).replace(/\\/g, '/');
      return { ok:true, rel, abs: destAbs };
    }catch(e){ console.error(e); return { ok:false, error:'فشل استيراد الصورة' }; }
  });

  // Read a file as base64 without copying (for image preview before saving to DB)
  ipcMain.handle('fs:read_file_base64', async (_e, srcPath) => {
    try{
      const fs = require('fs');
      const path = require('path');
      const MAX = 1024 * 1024; // 1MB
      if(!srcPath || !fs.existsSync(srcPath)) return { ok:false, error:'لم يتم العثور على الملف' };
      const stat = fs.statSync(srcPath);
      if(stat && stat.size > MAX){
        return { ok:false, error:'حجم الصورة أكبر من 1 ميجابايت. يرجى اختيار صورة أصغر.', tooLarge:true, max: MAX };
      }
      const buf = fs.readFileSync(srcPath);
      const base64 = buf.toString('base64');
      const ext = String(path.extname(srcPath)).toLowerCase();
      const mime = ext==='.jpg'||ext==='.jpeg' ? 'image/jpeg' : ext==='.webp' ? 'image/webp' : 'image/png';
      return { ok:true, base64, mime };
    }catch(e){ console.error(e); return { ok:false, error:'تعذر قراءة الملف' }; }
  });

  // Resolve relative asset path to absolute
  ipcMain.handle('fs:resolve_path', async (_e, rel) => {
    try{
      const path = require('path');
      const abs = path.resolve(__dirname, '..', '..', rel);
      return { ok:true, abs };
    }catch(e){ console.error(e); return { ok:false, error:'تعذر تحويل المسار' }; }
  });

  // Open external URL (e.g., WhatsApp link)
  ipcMain.handle('app:open_external', async (_e, { url }) => {
    try{
      const { shell } = require('electron');
      if(!url) return { ok:false, error:'no url' };
      const ok = await shell.openExternal(String(url));
      return { ok: !!ok };
    }catch(e){ console.error('open_external error', e); return { ok:false, error: String(e && e.message || e) }; }
  });

  // Reveal file in explorer
  ipcMain.handle('app:reveal_file', async (_e, { path: p }) => {
    try{
      const { shell } = require('electron');
      if(!p) return { ok:false, error:'no path' };
      const ok = await shell.showItemInFolder(String(p));
      return { ok: !!ok };
    }catch(e){ console.error('reveal_file error', e); return { ok:false, error: String(e && e.message || e) }; }
  });

  return win;
}

app.whenReady().then(async () => {
  // Cache clearing disabled for faster startup
  // try{
  //   await session.defaultSession.clearCache();
  //   await session.defaultSession.clearStorageData({ storages: ['appcache','cachestorage','shadercache'] });
  // }catch(_){ }

  try {
    app.setAppUserModelId('com.alrabt.cashier');
  } catch (_) { }

  // Pre-warm hardware ID cache for faster license checks
  try {
    getHardwareIDs().catch(() => {});
  } catch (_) { }

  // إعداد قائمة التطبيق الافتراضية (File / Edit / View ...) مع إبقائها مخفية افتراضيًا
  try {
    const isMac = process.platform === 'darwin';
    const template = [
      ...(isMac ? [{ role: 'appMenu' }] : []),
      { role: 'fileMenu' },
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
      { role: 'help', submenu: [ { role: 'about' } ] }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  } catch(_) { /* ignore */ }

  // أبقِ شريط القوائم مخفيًا وافتحه يدويًا عند الضغط على Alt
  try {
    app.on('browser-window-created', (_e, w) => {
      try{ w.setMenuBarVisibility(false); }catch(_){ }
      try{ w.autoHideMenuBar = true; }catch(_){ }
    });
  }catch(_){ }

  registerLicenseIPC();
  registerContextMenuIPC();
  
  // Register auth handler immediately to avoid race condition
  registerAuthIPC();
  registerSettingsIPC();
  try { customerDisplay.setupIPCHandlers(); } catch (_) {}
  try { require('./customer-display').setupLegacyIPCHandlers(); } catch (_) {}

  try{
    createMainWindow();
  }catch(e){
    console.error('Error creating main window:', e);
  }

  (async () => {
    try{
      await ensureAdminUser();
      try { await customerDisplay.initialize(); } catch (_) {}
      registerUsersIPC();
      registerProductsIPC();
      registerCustomersIPC();
      registerAppointmentsIPC();
      registerTypesIPC();
      registerSalesIPC();
      registerShiftsIPC();
      registerOperationsIPC();
      registerPurchasesIPC();
      registerSuppliersIPC();
      registerEmployeesIPC();
      registerPurchaseInvoicesIPC();
      registerKitchenIPC();
      registerCustomerPricingIPC();
      registerOffersIPC();
      registerDriversIPC();
      registerHeldInvoicesIPC();
      registerPermissionsIPC();
      registerVouchersIPC();
      setupQuotationsIPC();
      registerWhatsAppIPC();
      
      // Auto-connect to WhatsApp if enabled and session exists
      try { if (__tWhatsAppAutoConnect) clearTimeout(__tWhatsAppAutoConnect); } catch (_) {}
      __tWhatsAppAutoConnect = setTimeout(() => {
        try {
          whatsappService.autoConnectIfEnabled().catch(err => {
            console.log('WhatsApp auto-connect skipped:', err.reason || err.message);
          });
        } catch (_) {}
      }, 3000); // Wait 3 seconds after app start
      
      registerDailyEmailScheduler();
      submitUnsentInvoicesHourly();
      startAppointmentReminderService();

      // Start API Server if this is Primary device
      if (isPrimaryDevice()) {
        try {
          startAPIServer();
          console.log('✓ API Server started on Primary device');
        } catch (err) {
          console.error('Failed to start API Server:', err);
        }
      }

      // ─── sales:init — batch IPC: settings + types + products + global_offer in ONE call ───
      ipcMain.handle('sales:init', async (_e, params) => {
        try {
          if (isSecondaryDevice()) {
            const result = await fetchFromAPI('/sales-init', params || {});
            return { ok: true, ...result };
          }
          const { dbAdapter } = require('../db/db-adapter');
          const conn = await dbAdapter.getConnection();
          try {
            const { sort = 'custom', limit = 48, category } = params || {};
            const SELECT_COLS = `id,name,name_en,barcode,price,min_price,cost,stock,category,is_tobacco,is_active,hide_from_sales,sort_order,(image_blob IS NOT NULL OR (image_path IS NOT NULL AND image_path != '')) AS has_image`;
            const prodWhere = ['is_active=1', 'hide_from_sales=0'];
            const prodParams = [];
            if (category) { prodWhere.push('category=?'); prodParams.push(category); }
            const whereSql = 'WHERE ' + prodWhere.join(' AND ');
            let order = 'ORDER BY sort_order ASC, is_active DESC, name ASC';
            if (sort === 'name_asc') order = 'ORDER BY name ASC';
            const lim = Math.min(parseInt(limit) || 48, 200);
            const nowCond = '(start_date IS NULL OR NOW() >= start_date) AND (end_date IS NULL OR NOW() <= end_date)';
            const [[settingsRow], [types], [typesDisplay], [products], [globalOfferRows]] = await Promise.all([
              conn.query('SELECT * FROM app_settings WHERE id=1 LIMIT 1'),
              conn.query('SELECT id, name FROM main_types WHERE is_active=1 ORDER BY sort_order ASC, name ASC'),
              conn.query('SELECT id, name FROM main_types WHERE is_active=1 AND hidden_from_sales=0 ORDER BY sort_order ASC, name ASC'),
              conn.query(`SELECT ${SELECT_COLS} FROM products ${whereSql} ${order} LIMIT ?`, [...prodParams, lim]),
              conn.query(`SELECT * FROM offers WHERE is_global=1 AND is_active=1 AND ${nowCond} ORDER BY id DESC LIMIT 1`),
            ]);
            return {
              ok: true,
              settings: (settingsRow && settingsRow[0]) || {},
              types: types,
              types_for_display: typesDisplay,
              products: products,
              products_total: null,
              global_offer: (globalOfferRows && globalOfferRows[0]) || null,
            };
          } finally { conn.release(); }
        } catch(e) { return { ok: false, error: e.message }; }
      });

      // ─── screen:init batch IPC handlers — reduce round-trips on all screens ───
      ipcMain.handle('screen:init:invoices', async () => {
        try {
          if (isSecondaryDevice()) { return await fetchFromAPI('/init/invoices-screen'); }
          const { dbAdapter } = require('../db/db-adapter');
          const conn = await dbAdapter.getConnection();
          try {
            const [[settingsRow], [cntRow]] = await Promise.all([
              conn.query('SELECT * FROM app_settings WHERE id=1 LIMIT 1'),
              conn.query(`SELECT COUNT(*) AS total FROM sales WHERE (doc_type IS NULL OR doc_type='invoice')`),
            ]);
            return { ok: true, settings: (settingsRow && settingsRow[0]) || {}, total_invoices: Number((cntRow && cntRow[0] && cntRow[0].total) || 0) };
          } finally { conn.release(); }
        } catch(e) { return { ok: false, error: e.message }; }
      });

      ipcMain.handle('screen:init:customers', async () => {
        try {
          if (isSecondaryDevice()) { return await fetchFromAPI('/init/customers-screen'); }
          const { dbAdapter } = require('../db/db-adapter');
          const conn = await dbAdapter.getConnection();
          try {
            const [[settingsRow], [customers], [cntRow]] = await Promise.all([
              conn.query('SELECT * FROM app_settings WHERE id=1 LIMIT 1'),
              conn.query('SELECT id, name, phone, email, vat_number, is_active, created_at FROM customers ORDER BY id DESC LIMIT 100'),
              conn.query('SELECT COUNT(*) AS total FROM customers'),
            ]);
            return { ok: true, settings: (settingsRow && settingsRow[0]) || {}, customers, total: Number((cntRow && cntRow[0] && cntRow[0].total) || 0) };
          } finally { conn.release(); }
        } catch(e) { return { ok: false, error: e.message }; }
      });

      ipcMain.handle('screen:init:products', async () => {
        try {
          if (isSecondaryDevice()) { return await fetchFromAPI('/init/products-screen'); }
          const { dbAdapter } = require('../db/db-adapter');
          const conn = await dbAdapter.getConnection();
          try {
            const [[settingsRow], [products], [types], [operations], [cntRow]] = await Promise.all([
              conn.query('SELECT * FROM app_settings WHERE id=1 LIMIT 1'),
              conn.query('SELECT id, name, name_en, barcode, price, cost, stock, category, is_tobacco, is_active, sort_order FROM products ORDER BY sort_order ASC, name ASC LIMIT 100'),
              conn.query('SELECT * FROM main_types WHERE is_active=1 ORDER BY sort_order ASC, name ASC'),
              conn.query('SELECT * FROM operations ORDER BY id'),
              conn.query('SELECT COUNT(*) AS total FROM products'),
            ]);
            return { ok: true, settings: (settingsRow && settingsRow[0]) || {}, products, types, operations, total: Number((cntRow && cntRow[0] && cntRow[0].total) || 0) };
          } finally { conn.release(); }
        } catch(e) { return { ok: false, error: e.message }; }
      });

      ipcMain.handle('screen:init:shifts', async (_e, params) => {
        try {
          if (isSecondaryDevice()) { return await fetchFromAPI('/init/shifts-screen', params || {}); }
          const { dbAdapter } = require('../db/db-adapter');
          const conn = await dbAdapter.getConnection();
          try {
            const userId = params && params.user_id ? Number(params.user_id) : null;
            const lim = Math.min(Number((params && params.limit) || 20), 200);
            const shiftWhere = userId ? 'WHERE user_id=?' : '';
            const shiftParams = userId ? [userId] : [];
            const [[settingsRow], [shifts], [openShift]] = await Promise.all([
              conn.query('SELECT * FROM app_settings WHERE id=1 LIMIT 1'),
              conn.query(`SELECT * FROM shifts ${shiftWhere} ORDER BY id DESC LIMIT ?`, [...shiftParams, lim]),
              conn.query(`SELECT * FROM shifts WHERE status='open' ORDER BY opened_at DESC LIMIT 1`),
            ]);
            return { ok: true, settings: (settingsRow && settingsRow[0]) || {}, shifts, open_shift: openShift[0] || null };
          } finally { conn.release(); }
        } catch(e) { return { ok: false, error: e.message }; }
      });

      // Pre-warm print window after 4s to avoid slowing startup
      try { if (__tPrewarmPrint) clearTimeout(__tPrewarmPrint); } catch (_) {}
      __tPrewarmPrint = setTimeout(() => { try { _spawnPrewarmPrintWin(); } catch(_) {} }, 4000);

      try {
        const ZatcaSalesIntegration = require('./zatca-sales-integration');
        const LocalZatcaBridge = require('./local-zatca');
        const zatcaSalesInstance = new ZatcaSalesIntegration();
        const localZatca = new LocalZatcaBridge();
        console.log('تم تفعيل نظام ZATCA بنجاح (الرسمي + المحلي)');
      } catch (error) {
        console.error('خطأ في تفعيل نظام ZATCA:', error);
      }
    }catch(e){
      console.error('Error initializing backend:', e);
    }
  })();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createMainWindow();
  });
});

app.on('before-quit', async () => {
  __isQuitting = true;
  try { if (__tWhatsAppAutoConnect) clearTimeout(__tWhatsAppAutoConnect); } catch (_) {}
  try { if (__tPrewarmPrint) clearTimeout(__tPrewarmPrint); } catch (_) {}
  try { if (__tForceExit) clearTimeout(__tForceExit); } catch (_) {}
  __tWhatsAppAutoConnect = null;
  __tPrewarmPrint = null;
  __tForceExit = null;

  try { stopDailyEmailScheduler && stopDailyEmailScheduler(); } catch (_) {}
  try { stopUnsentInvoicesScheduler && stopUnsentInvoicesScheduler(); } catch (_) {}
  try { stopAppointmentReminderService && stopAppointmentReminderService(); } catch (_) {}
  try { stopAPIServer && stopAPIServer(); } catch (_) {}

  try { await whatsappService.disconnect(); } catch (_) {}
  try { await customerDisplay.cleanup(); } catch (_) {}

  try {
    if (_prewarmPrintWin && !_prewarmPrintWin.isDestroyed()) {
      _prewarmPrintWin.destroy();
    }
  } catch (_) {}
  _prewarmPrintWin = null;
  _prewarmPrintWinBusy = false;

  __tForceExit = setTimeout(() => {
    try { app.exit(0); } catch (_) {}
    try { process.exit(0); } catch (_) {}
  }, 3000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

try {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.alrabt.cashier');
  }
} catch (_) { }