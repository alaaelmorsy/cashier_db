'use strict';

const { ipcMain } = require('electron');
const DisplayManager = require('./display-manager');

const manager = new DisplayManager();

let _dbAdapter = null;
function getDb() {
  if (!_dbAdapter) _dbAdapter = require('../../db/db-adapter').dbAdapter;
  return _dbAdapter;
}

async function loadSettings() {
  const conn = await getDb().getConnection();
  try {
    const [rows] = await conn.query('SELECT * FROM app_settings WHERE id=1 LIMIT 1');
    return rows && rows[0] ? rows[0] : {};
  } finally {
    conn.release();
  }
}

async function initialize() {
  try {
    const s = await loadSettings();
    if (!s.customer_display_enabled) return { ok: true };

    const config = {
      enabled:     true,
      simulator:   false,
      port:        s.customer_display_port || null,
      baudRate:    2400,
      columns:     8,
      rows:        1,
      protocol:    'ecopos',
      encoding:    'ascii',
      brightness:  100,
      welcomeMsg:  s.customer_display_welcome_msg || 'أهلا وسهلا',
      thankyouMsg: s.customer_display_thankyou_msg || s.customer_display_thank_msg || 'شكرا لزيارتكم',
      dataFormat:  s.customer_display_data_format || 'smart_spaces_8',
    };

    if (!config.port) {
      console.log('[CustomerDisplay] Enabled but no port configured.');
      return { ok: false, error: 'Port not configured' };
    }

    await manager.init(config);
    await manager.displayWelcome();
    console.log('[CustomerDisplay] Initialized on port', config.port);
    return { ok: true };
  } catch (e) {
    console.error('[CustomerDisplay] Initialize error:', e.message);
    return { ok: false, error: e.message };
  }
}

function setupIPCHandlers() {
  ipcMain.handle('customer-display:init', async () => {
    return await initialize();
  });

  ipcMain.handle('customer-display:reinit', async () => {
    try { await manager.close(); } catch (_) {}
    return await initialize();
  });

  ipcMain.handle('customer-display:close', async () => {
    try { await manager.close(); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('customer-display:clear', async () => {
    try {
      if (!manager.isConnected) return { ok: true };
      const r = await manager.clear();
      return { ok: r.success, error: r.error };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('customer-display:write', async (_e, text, row = 0) => {
    try {
      if (!manager.isConnected) return { ok: true };
      const r = await manager.write(text, row);
      return { ok: r.success, error: r.error };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('customer-display:welcome', async (_e, customMessage) => {
    try {
      if (!manager.isConnected) return { ok: true };
      const r = await manager.displayWelcome(customMessage || null);
      return { ok: r.success, error: r.error };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('customer-display:item', async (_e, itemName, price, currency) => {
    try {
      if (!manager.isConnected) return { ok: true };
      const r = await manager.displayItem(itemName, price, currency);
      return { ok: r.success, error: r.error };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('customer-display:total', async (_e, total, currency) => {
    try {
      if (!manager.isConnected) return { ok: true };
      const r = await manager.displayTotal(total, currency);
      return { ok: r.success, error: r.error };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('customer-display:thankyou', async (_e, customMessage) => {
    try {
      if (!manager.isConnected) return { ok: true };
      const r = await manager.displayThankYou(customMessage || null);
      return { ok: r.success, error: r.error };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('customer-display:brightness', async (_e, level) => {
    try {
      if (!manager.isConnected) return { ok: true };
      const r = await manager.setBrightness(Number(level) || 100);
      return { ok: r.success, error: r.error };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('customer-display:list-ports', async () => {
    return await manager.listPorts();
  });

  ipcMain.handle('customer-display:status', async () => {
    return { ok: true, ...manager.getStatus() };
  });

  ipcMain.handle('customer-display:test', async () => {
    try {
      if (!manager.isConnected) return { ok: false, error: 'Not connected' };
      await manager.displayWelcome();
      await new Promise(r => setTimeout(r, 800));
      await manager.displayItem('TEST ITEM', 9.99, 'SAR');
      await new Promise(r => setTimeout(r, 800));
      await manager.displayTotal(9.99, 'SAR');
      await new Promise(r => setTimeout(r, 800));
      await manager.displayThankYou();
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });
}

async function cleanup() {
  try { await manager.close(); } catch (_) {}
}

function getManager() { return manager; }

module.exports = { initialize, setupIPCHandlers, cleanup, getManager };
