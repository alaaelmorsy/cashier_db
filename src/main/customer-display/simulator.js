'use strict';

const { BrowserWindow } = require('electron');

class CustomerDisplaySimulator {
  constructor(config) {
    this.config = config || {};
    this.win = null;
    this.columns = config.columns || 20;
    this.rows = config.rows || 2;
    this.brightness = config.brightness != null ? config.brightness : 100;
  }

  open() {
    if (this.win && !this.win.isDestroyed()) {
      this.win.show();
      return;
    }

    const brightnessVal = Math.floor(255 * (this.brightness / 100));
    const textColor = `rgb(${brightnessVal}, ${brightnessVal}, 0)`;
    const height = 200 + (this.rows * 30);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Customer Display Simulator</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #000; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: 'Courier New', monospace; }
  .screen { background: #111; border: 3px solid #333; border-radius: 10px; padding: 20px 30px; min-width: 320px; }
  .info { color: #555; font-size: 11px; margin-bottom: 10px; text-align: center; }
  .row { color: ${textColor}; font-size: 48px; letter-spacing: 2px; min-height: 60px; display: flex; align-items: center; white-space: pre; }
</style>
</head><body>
<div class="screen">
  <div class="info">Customer Display Simulator - ${this.columns}x${this.rows}</div>
  ${Array.from({ length: this.rows }, (_, i) => `<div class="row" id="row${i}">${' '.repeat(this.columns)}</div>`).join('')}
</div>
<script>
  const { ipcRenderer } = require('electron');
  ipcRenderer.on('simulator:update', (e, data) => {
    if (data.action === 'clear') {
      for (let i = 0; i < ${this.rows}; i++) {
        const el = document.getElementById('row' + i);
        if (el) el.textContent = ' '.repeat(${this.columns});
      }
    } else if (data.action === 'write' && data.row != null) {
      const el = document.getElementById('row' + data.row);
      if (el) el.textContent = (data.text || '').padEnd(${this.columns}, ' ').slice(0, ${this.columns});
    }
  });
</script>
</body></html>`;

    this.win = new BrowserWindow({
      width: 600,
      height,
      title: 'Customer Display Simulator',
      backgroundColor: '#000000',
      resizable: false,
      frame: true,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      }
    });

    this.win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    this.win.on('closed', () => { this.win = null; });
  }

  send(action, data = {}) {
    if (!this.win || this.win.isDestroyed()) return;
    try {
      this.win.webContents.send('simulator:update', { action, ...data });
    } catch (_) {}
  }

  clear() {
    this.send('clear');
  }

  write(text, row = 0) {
    this.send('write', { text, row });
  }

  close() {
    if (this.win && !this.win.isDestroyed()) {
      try { this.win.close(); } catch (_) {}
    }
    this.win = null;
  }
}

module.exports = CustomerDisplaySimulator;
