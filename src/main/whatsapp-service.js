const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { execSync } = require('child_process');

let wppconnect;
try {
  wppconnect = require('@wppconnect-team/wppconnect');
} catch (err) {
  console.error('WhatsApp module not installed:', err.message);
}

class WhatsAppService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.qrCode = null;
    this.sessionDir = null;
  }

  async hasValidSession() {
    try {
      if (!this.sessionDir) {
        this.sessionDir = path.join(app.getPath('userData'), 'whatsapp-tokens');
      }
      
      const sessionPath = path.join(this.sessionDir, 'pos-session');
      
      try {
        await fs.access(sessionPath);
        const files = await fs.readdir(sessionPath);
        return files.length > 0;
      } catch (_) {
        return false;
      }
    } catch (err) {
      console.error('Error checking session:', err);
      return false;
    }
  }

  async killAllChrome() {
    try {
      execSync('taskkill /F /IM chrome.exe', { 
        stdio: 'ignore', 
        windowsHide: true 
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (_) { }
  }

  async initialize() {
    if (!wppconnect) {
      return { success: false, error: 'WhatsApp module not installed. Run: npm install @wppconnect-team/wppconnect' };
    }

    try {
      if (this.client) {
        await this.disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      await this.killAllChrome();
      
      this.client = null;
      this.isConnected = false;
      this.qrCode = null;
      
      if (!this.sessionDir) {
        this.sessionDir = path.join(app.getPath('userData'), 'whatsapp-tokens');
      }
      
      await fs.mkdir(this.sessionDir, { recursive: true });

      const chromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(process.env.PROGRAMFILES || '', 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google\\Chrome\\Application\\chrome.exe')
      ];

      let chromePath = null;
      for (const p of chromePaths) {
        try {
          await fs.access(p);
          chromePath = p;
          break;
        } catch (_) { }
      }

      const createOptions = {
        session: 'pos-session',
        catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
          this.qrCode = base64Qr;
        },
        statusFind: (statusSession, session) => {
          this.isConnected = statusSession === 'isLogged' || 
                             statusSession === 'qrReadSuccess' || 
                             statusSession === 'inChat';
        },
        folderNameToken: this.sessionDir,
        headless: true,
        devtools: false,
        useChrome: true,
        debug: false,
        logQR: false,
        autoClose: 0,
        userDataDir: this.sessionDir,
        browserArgs: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-blink-features=AutomationControlled'
        ],
        disableWelcome: true,
        updatesLog: false
      };

      if (chromePath) {
        createOptions.browserArgs.push(`--user-data-dir=${this.sessionDir}`);
      }

      this.client = await wppconnect.create(createOptions);

      this.client.onStateChange((state) => {
        this.isConnected = state === 'CONNECTED';
      });

      return { success: true, connected: this.isConnected };
    } catch (error) {
      console.error('WhatsApp initialization error:', error);
      return { success: false, error: error.message || 'Failed to initialize WhatsApp' };
    }
  }

  formatPhoneNumber(phone) {
    let cleaned = String(phone || '').replace(/[^\d+]/g, '');
    
    if (/^05\d{8}$/.test(cleaned)) {
      cleaned = '966' + cleaned.slice(1);
    }
    
    if (!cleaned.includes('@')) {
      cleaned = cleaned + '@c.us';
    }
    
    return cleaned;
  }

  async sendFile(phone, filePath, filename, caption = '') {
    try {
      const hasLimit = await this.checkMessagesLimit();
      if (!hasLimit) {
        const stats = await this.getMessagesStats();
        return { 
          success: false, 
          error: 'تم انتهاء عدد الرسائل المتاحة. يرجى التجديد.',
          limitReached: true,
          stats
        };
      }

      if (!this.client) {
        return { success: false, error: 'WhatsApp client not initialized' };
      }

      const status = await this.getConnectionStatus();
      if (!status.connected) {
        return { success: false, error: 'WhatsApp not connected' };
      }

      const formattedPhone = this.formatPhoneNumber(phone);
      
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!fileExists) {
        return { success: false, error: 'File not found: ' + filePath };
      }

      const result = await this.client.sendFile(
        formattedPhone,
        filePath,
        filename,
        caption
      );

      await this.incrementMessagesSent();

      return { success: true, result };
    } catch (error) {
      console.error('WhatsApp send file error:', error);
      return { success: false, error: error.message || 'Failed to send file' };
    }
  }

  async sendTextMessage(phone, message) {
    try {
      const hasLimit = await this.checkMessagesLimit();
      if (!hasLimit) {
        const stats = await this.getMessagesStats();
        return { 
          success: false, 
          error: 'تم انتهاء عدد الرسائل المتاحة. يرجى التجديد.',
          limitReached: true,
          stats
        };
      }

      if (!this.client || !this.isConnected) {
        return { success: false, error: 'WhatsApp not connected' };
      }

      const formattedPhone = this.formatPhoneNumber(phone);
      const result = await this.client.sendText(formattedPhone, message);
      
      await this.incrementMessagesSent();
      
      return { success: true, result };
    } catch (error) {
      console.error('Error sending text message:', error);
      return { success: false, error: error.message };
    }
  }

  async getQRCode() {
    return this.qrCode;
  }

  async getConnectionStatus() {
    if (!this.client) {
      this.isConnected = false;
      return { connected: false };
    }
    
    try {
      const state = await this.client.getConnectionState();
      const isConnected = state === 'CONNECTED';
      this.isConnected = isConnected;
      return { connected: isConnected, state };
    } catch (error) {
      console.warn('Failed to get connection state:', error.message);
      this.isConnected = false;
      return { connected: false, error: error.message };
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        try {
          await this.client.close();
        } catch (e) {
          console.warn('Close call failed:', e.message);
        }
        
        try {
          const browser = await this.client.pupBrowser;
          if (browser && browser.process()) {
            browser.process().kill('SIGKILL');
          }
        } catch (_) { }
        
        this.client = null;
        this.isConnected = false;
        this.qrCode = null;
      }
      
      await this.killAllChrome();
      
      return { success: true };
    } catch (error) {
      console.error('WhatsApp disconnect error:', error);
      return { success: false, error: error.message };
    }
  }

  async logout() {
    try {
      if (this.client) {
        try {
          await this.client.logout();
        } catch (e) {
          console.warn('Logout call failed:', e.message);
        }
        
        try {
          await this.client.close();
        } catch (e) {
          console.warn('Close call failed:', e.message);
        }
        
        try {
          const browser = await this.client.pupBrowser;
          if (browser && browser.process()) {
            browser.process().kill('SIGKILL');
          }
        } catch (_) { }
      }
      
      this.client = null;
      this.isConnected = false;
      this.qrCode = null;
      
      await this.killAllChrome();
      
      try {
        await fs.rm(this.sessionDir, { recursive: true, force: true });
        await new Promise(resolve => setTimeout(resolve, 500));
        await fs.mkdir(this.sessionDir, { recursive: true });
      } catch (e) {
        console.warn('Failed to clean session directory:', e.message);
      }
      
      return { success: true };
    } catch (error) {
      console.error('WhatsApp logout error:', error);
      return { success: false, error: error.message };
    }
  }

  async getMessagesStats() {
    try {
      console.log('WhatsApp Service: Getting messages stats from DB...');
      const { dbAdapter } = require('../db/db-adapter');
      const conn = await dbAdapter.getConnection();
      try {
        const checkColumn = async (colName) => {
          const [cols] = await conn.query('SHOW COLUMNS FROM app_settings LIKE ?', [colName]);
          return cols.length > 0;
        };
        
        if (!(await checkColumn('whatsapp_messages_limit'))) {
          console.log('WhatsApp Service: Adding whatsapp_messages_limit column');
          await conn.query('ALTER TABLE app_settings ADD COLUMN whatsapp_messages_limit INT NOT NULL DEFAULT 0');
        }
        
        if (!(await checkColumn('whatsapp_messages_sent'))) {
          console.log('WhatsApp Service: Adding whatsapp_messages_sent column');
          await conn.query('ALTER TABLE app_settings ADD COLUMN whatsapp_messages_sent INT NOT NULL DEFAULT 0');
        }
        
        const [existingRows] = await conn.query('SELECT id FROM app_settings WHERE id=1 LIMIT 1');
        if (existingRows.length === 0) {
          console.log('WhatsApp Service: No settings row found, creating with defaults');
          await conn.query(
            "INSERT INTO app_settings (id, vat_percent, prices_include_vat, currency_code, currency_symbol, currency_symbol_position, whatsapp_messages_limit, whatsapp_messages_sent) VALUES (1, 15.00, 1, 'SAR', '﷼', 'after', 0, 0)"
          );
        }
        
        const [rows] = await conn.query('SELECT whatsapp_messages_limit, whatsapp_messages_sent FROM app_settings WHERE id=1');
        console.log('WhatsApp Service: Query result:', rows);
        
        const settings = rows[0];
        if (!settings) {
          console.log('WhatsApp Service: No settings found after insert, using defaults');
          return { limit: 0, sent: 0, remaining: 0 };
        }
        
        const limit = Number(settings.whatsapp_messages_limit != null ? settings.whatsapp_messages_limit : 0);
        const sent = Number(settings.whatsapp_messages_sent != null ? settings.whatsapp_messages_sent : 0);
        const remaining = Math.max(0, limit - sent);
        console.log(`WhatsApp Service: Calculated stats - limit: ${limit}, sent: ${sent}, remaining: ${remaining}`);
        return { limit, sent, remaining };
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error('WhatsApp Service: Error getting messages stats:', error);
      return { limit: 0, sent: 0, remaining: 0, error: error.message };
    }
  }

  async incrementMessagesSent() {
    try {
      const { dbAdapter } = require('../db/db-adapter');
      const conn = await dbAdapter.getConnection();
      try {
        const [rows] = await conn.query('SELECT whatsapp_messages_sent FROM app_settings WHERE id=1');
        if (rows.length === 0) {
          console.log('No settings row found in incrementMessagesSent');
          return { success: false, error: 'Settings row not found' };
        }
        
        await conn.query('UPDATE app_settings SET whatsapp_messages_sent = whatsapp_messages_sent + 1 WHERE id=1');
        return { success: true };
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error('Error incrementing messages sent:', error);
      return { success: false, error: error.message };
    }
  }

  async checkMessagesLimit() {
    const stats = await this.getMessagesStats();
    return stats.remaining > 0;
  }

  async autoConnectIfEnabled() {
    try {
      const { dbAdapter } = require('../db/db-adapter');
      const conn = await dbAdapter.getConnection();
      try {
        const checkColumn = async (colName) => {
          const [cols] = await conn.query('SHOW COLUMNS FROM app_settings LIKE ?', [colName]);
          return cols.length > 0;
        };
        
        if (!(await checkColumn('whatsapp_auto_connect'))) {
          await conn.query('ALTER TABLE app_settings ADD COLUMN whatsapp_auto_connect TINYINT(1) NOT NULL DEFAULT 0');
        }
        
        const [rows] = await conn.query('SELECT whatsapp_auto_connect FROM app_settings WHERE id=1');
        if (rows.length === 0 || !rows[0].whatsapp_auto_connect) {
          console.log('WhatsApp auto-connect disabled');
          return { success: false, reason: 'Auto-connect disabled' };
        }
        
        const hasSession = await this.hasValidSession();
        if (!hasSession) {
          console.log('No WhatsApp session found');
          return { success: false, reason: 'No session found' };
        }
        
        console.log('Auto-connecting to WhatsApp...');
        const result = await this.initialize();
        
        if (result.success) {
          console.log('✅ WhatsApp auto-connected successfully');
        } else {
          console.log('⚠️ WhatsApp auto-connect failed:', result.error);
        }
        
        return result;
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error('Error in autoConnectIfEnabled:', error);
      return { success: false, error: error.message };
    }
  }
}

const whatsappService = new WhatsAppService();
module.exports = whatsappService;
