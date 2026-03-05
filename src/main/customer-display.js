'use strict';

const { ipcMain } = require('electron');

function setupLegacyIPCHandlers() {
  const getManager = () => {
    try { return require('./customer-display/index').getManager(); } catch (_) { return null; }
  };

  ipcMain.handle('customer_display:connect', async () => {
    try {
      const r = await require('./customer-display/index').initialize();
      return { ok: r.ok };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('customer_display:disconnect', async () => {
    try {
      const m = getManager();
      if (m) await m.close();
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('customer_display:send_text', async (_e, text) => {
    try {
      const m = getManager();
      if (!m || !m.isConnected) return { ok: true };
      await m.write(String(text || ''), 0);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });
}

module.exports = { setupLegacyIPCHandlers };
