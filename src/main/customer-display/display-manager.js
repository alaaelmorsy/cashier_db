'use strict';

const { SerialPort } = require('serialport');
const CustomerDisplaySimulator = require('./simulator');
const ESCPOSProtocol   = require('./protocols/escpos');
const CD5220Protocol   = require('./protocols/cd5220');
const AEDEXProtocol    = require('./protocols/aedex');
const ECOPOSProtocol   = require('./protocols/ecopos');
const GenericProtocol  = require('./protocols/generic');

class DisplayManager {
  constructor() {
    this.protocol          = null;
    this.serialPort        = null;
    this.simulator         = null;
    this.config            = {};
    this.isConnected       = false;
    this.reconnectInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async init(config) {
    this.config = config || {};
    if (this.config.simulator) {
      await this.initSimulator();
    } else {
      await this.initHardware();
    }
  }

  async initSimulator() {
    this.simulator = new CustomerDisplaySimulator(this.config);
    this.simulator.open();
    this.isConnected = true;
    this.protocol = {
      clear:           () => { this.simulator.clear(); return Promise.resolve({ success: true }); },
      write:           (t, r) => { this.simulator.write(t, r); return Promise.resolve({ success: true }); },
      init:            () => Promise.resolve(),
      displayWelcome:  (m) => { this.simulator.clear(); this.simulator.write(m || this.config.welcomeMsg || '', 0); return Promise.resolve({ success: true }); },
      displayItem:     (n, p, c) => { this.simulator.clear(); this.simulator.write(`${n} ${p} ${c}`, 0); return Promise.resolve({ success: true }); },
      displayTotal:    (t, c) => { this.simulator.clear(); this.simulator.write(`TOTAL ${t} ${c}`, 0); return Promise.resolve({ success: true }); },
      displayThankYou: (m) => { this.simulator.clear(); this.simulator.write(m || this.config.thankyouMsg || '', 0); return Promise.resolve({ success: true }); },
      setBrightness:   () => Promise.resolve({ success: true }),
      close:           () => { this.simulator.close(); return Promise.resolve(); },
    };
  }

  async initHardware() {
    if (!this.config.port) {
      throw new Error('Port not configured');
    }

    this.serialPort = new SerialPort({
      path:     this.config.port,
      baudRate: this.config.baudRate || 2400,
      dataBits: 8,
      stopBits: 1,
      parity:   'none',
      rtscts:   false,
      xon:      false,
      xoff:     false,
      autoOpen: false,
    });

    await this.openPort();
    this.protocol = this.createProtocol(this.serialPort);
    await this.protocol.init();
    this.isConnected = true;
    this.setupErrorHandlers();
  }

  createProtocol(serialPort) {
    const proto = (this.config.protocol || 'ecopos').toLowerCase();
    switch (proto) {
      case 'escpos':   return new ESCPOSProtocol(serialPort, this.config);
      case 'cd5220':   return new CD5220Protocol(serialPort, this.config);
      case 'aedex':    return new AEDEXProtocol(serialPort, this.config);
      case 'ecopos':   return new ECOPOSProtocol(serialPort, this.config);
      case 'generic':  return new GenericProtocol(serialPort, this.config);
      default:         return new ECOPOSProtocol(serialPort, this.config);
    }
  }

  openPort() {
    return new Promise((resolve, reject) => {
      this.serialPort.open((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  setupErrorHandlers() {
    if (!this.serialPort) return;
    this.serialPort.on('error', (err) => {
      console.error('[CustomerDisplay] Serial port error:', err.message);
      this.isConnected = false;
      this.scheduleReconnect();
    });
    this.serialPort.on('close', () => {
      if (this.isConnected) {
        console.log('[CustomerDisplay] Port closed unexpectedly');
        this.isConnected = false;
        this.scheduleReconnect();
      }
    });
  }

  scheduleReconnect() {
    if (this.reconnectInterval) return;
    this.reconnectInterval = setInterval(async () => {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.warn('[CustomerDisplay] Max reconnect attempts reached, stopping.');
        this.clearReconnectInterval();
        return;
      }
      this.reconnectAttempts++;
      console.log(`[CustomerDisplay] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
      try {
        await this.initHardware();
        console.log('[CustomerDisplay] Reconnected successfully.');
        this.reconnectAttempts = 0;
        this.clearReconnectInterval();
      } catch (err) {
        console.error('[CustomerDisplay] Reconnect failed:', err.message);
      }
    }, 5000);
  }

  clearReconnectInterval() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  async clear() {
    if (!this.isConnected || !this.protocol) return { success: false, error: 'Not connected' };
    try {
      await this.protocol.clear();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async write(text, row = 0) {
    if (!this.isConnected || !this.protocol) return { success: false, error: 'Not connected' };
    try {
      await this.protocol.write(text, row);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async displayWelcome(customMessage = null) {
    if (!this.isConnected || !this.protocol) return { success: false, error: 'Not connected' };
    try {
      await this.protocol.displayWelcome(customMessage || this.config.welcomeMsg || '');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async displayItem(itemName, price, currency) {
    if (!this.isConnected || !this.protocol) return { success: false, error: 'Not connected' };
    try {
      await this.protocol.displayItem(itemName, price, currency);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async displayTotal(total, currency) {
    if (!this.isConnected || !this.protocol) return { success: false, error: 'Not connected' };
    try {
      await this.protocol.displayTotal(total, currency);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async displayThankYou(customMessage = null) {
    if (!this.isConnected || !this.protocol) return { success: false, error: 'Not connected' };
    try {
      await this.protocol.displayThankYou(customMessage || this.config.thankyouMsg || '');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async setBrightness(level) {
    if (!this.isConnected || !this.protocol) return { success: false, error: 'Not connected' };
    try {
      return await this.protocol.setBrightness(level);
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async close() {
    this.clearReconnectInterval();
    if (this.protocol) {
      try { await this.protocol.close(); } catch (_) {}
    }
    if (this.serialPort && this.serialPort.isOpen) {
      await new Promise((resolve) => {
        this.serialPort.close(() => resolve());
      });
    }
    if (this.simulator) {
      this.simulator.close();
    }
    this.isConnected = false;
    this.protocol = null;
    this.serialPort = null;
    this.simulator = null;
  }

  async listPorts() {
    try {
      const ports = await SerialPort.list();
      return { success: true, ports };
    } catch (e) {
      return { success: false, error: e.message, ports: [] };
    }
  }

  getStatus() {
    return {
      isConnected:       this.isConnected,
      config:            this.config,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

module.exports = DisplayManager;
