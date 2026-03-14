const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Switch implementation from WPPConnect (Puppeteer/Chrome) to Baileys (WA Web protocol)
// Baileys is ESM-only in recent versions, while this project is CommonJS.
// So we must load it via dynamic import().
let baileys;
async function loadBaileys() {
  if (baileys) return baileys;
  try {
    // eslint-disable-next-line no-return-await
    baileys = await import('@whiskeysockets/baileys');
    return baileys;
  } catch (err) {
    console.error('Baileys module not installed:', err.message);
    return null;
  }
}

let qrcode;
try {
  qrcode = require('qrcode');
} catch (err) {
  console.error('qrcode module not installed:', err.message);
}

class WhatsAppService {
  constructor() {
    this.client = null;              // Baileys sock
    this.isConnected = false;
    this.qrCode = null;              // dataURL (base64) for UI compatibility
    this.qrString = null;            // raw QR string from Baileys
    this.sessionDir = null;          // base dir in userData
    this.authDir = null;             // baileys auth state dir
    this.isInitializing = false;
    this._saveCreds = null;

    // Reconnect management
    this._reconnectAttempts = 0;
    this._reconnectTimer = null;
  }

  async hasValidSession() {
    // Baileys uses multi-file auth state. If credentials exist, we consider session valid.
    try {
      this.ensureSessionDirs();

      try {
        await fs.access(path.join(this.authDir, 'creds.json'));
        return true;
      } catch (_) {
        return false;
      }
    } catch (err) {
      console.error('Error checking session:', err);
      return false;
    }
  }

  ensureSessionDirs() {
    if (!this.sessionDir) {
      // Keep old folder name to avoid confusion for support, but auth will be stored in a new subdir.
      this.sessionDir = path.join(app.getPath('userData'), 'whatsapp-tokens');
    }
    if (!this.authDir) {
      this.authDir = path.join(this.sessionDir, 'baileys-pos-session');
    }
  }

  // WPPConnect-specific helpers (Chrome/Puppeteer) are no longer needed.
  async killOrphanedChrome() { return; }
  async cleanSessionDirectory() { return; }

  async initialize() {
    const b = await loadBaileys();
    if (!b) {
      return { success: false, error: 'WhatsApp module not installed. Run: npm install @whiskeysockets/baileys' };
    }
    if (!qrcode) {
      return { success: false, error: 'QR module not installed. Run: npm install qrcode' };
    }

    // Prevent concurrent initialization attempts
    if (this.isInitializing) {
      console.log('WhatsApp initialization already in progress, waiting...');
      // Wait for existing initialization to complete
      let attempts = 0;
      while (this.isInitializing && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      if (this.isInitializing) {
        return { success: false, error: 'Another initialization is still in progress' };
      }
      // If we have a client now, return success
      if (this.client) {
        return { success: true, connected: this.isConnected };
      }
    }

    this.isInitializing = true;

    try {
      // Reset
      this.qrCode = null;
      this.qrString = null;

      if (this.client) {
        await this.disconnect();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      this.ensureSessionDirs();
      await fs.mkdir(this.authDir, { recursive: true });

      // Baileys is ESM. Depending on version, exports may be available on:
      // - module.default (common in ESM interop)
      // - module itself
      const baileysMod = b?.default || b;

      const {
        makeWASocket,
        useMultiFileAuthState,
        DisconnectReason,
        fetchLatestBaileysVersion
      } = baileysMod;

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      this._saveCreds = saveCreds;

      const { version } = await fetchLatestBaileysVersion();

      if (typeof makeWASocket !== 'function') {
        throw new Error('Baileys load error: makeWASocket is not a function (invalid module export shape)');
      }

      let logger;
      try {
        const pino = require('pino');
        logger = pino({ level: 'silent' });
      } catch (e) {
        // Fallback if pino somehow isn't directly available
        console.warn('Pino logger not found, using default');
      }

      const sock = makeWASocket({
        version,
        auth: state,
        logger, // Pass custom silent logger
        printQRInTerminal: false,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false
      });

      this.client = sock;

      sock.ev.on('creds.update', async () => {
        try { await saveCreds(); } catch (e) { console.warn('Failed saving creds:', e.message); }
      });

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrString = qr;
          try {
            // Keep same behavior as before: UI expects base64/dataURL
            this.qrCode = await qrcode.toDataURL(qr);
          } catch (e) {
            console.warn('Failed to encode QR:', e.message);
            this.qrCode = null;
          }
        }

        if (connection === 'open') {
          this.isConnected = true;
          this.qrCode = null;
          this.qrString = null;

          this._reconnectAttempts = 0;
          if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
          }
        }

        if (connection === 'close') {
          this.isConnected = false;

          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          if (!shouldReconnect) {
            // logged out: clear auth
            this._reconnectAttempts = 0;
            if (this._reconnectTimer) {
              clearTimeout(this._reconnectTimer);
              this._reconnectTimer = null;
            }
            try {
              await fs.rm(this.authDir, { recursive: true, force: true });
              await fs.mkdir(this.authDir, { recursive: true });
            } catch (_) { }
            return;
          }

          // If connection closed for transient reasons (e.g. stream error 515), schedule reconnect.
          if (!this.isInitializing) {
            const attempt = Math.min(10, this._reconnectAttempts + 1);
            this._reconnectAttempts = attempt;
            const delayMs = Math.min(60000, 2000 * Math.pow(2, attempt - 1)); // 2s,4s,8s.. up to 60s

            if (this._reconnectTimer) {
              clearTimeout(this._reconnectTimer);
            }

            console.warn(`WhatsApp disconnected (statusCode=${statusCode}). Reconnecting in ${delayMs}ms (attempt ${attempt})...`);
            this._reconnectTimer = setTimeout(() => {
              // Fire and forget
              this.initialize().catch(e => console.warn('Reconnect initialize failed:', e.message));
            }, delayMs);
          }
        }
      });

      this.isInitializing = false;
      return { success: true, connected: this.isConnected };
    } catch (error) {
      this.isInitializing = false;
      console.error('WhatsApp initialization error:', error);
      return { success: false, error: error.message || 'Failed to initialize WhatsApp' };
    }
  }

  formatPhoneNumber(phone) {
    // Baileys expects JID like: 9665xxxxxxxx@s.whatsapp.net
    let cleaned = String(phone || '').replace(/[^\d]/g, '');

    if (/^05\d{8}$/.test(cleaned)) {
      cleaned = '966' + cleaned.slice(1);
    }

    if (!cleaned) return '';

    // NOTE: groups end with @g.us, but we only support individuals here.
    return cleaned + '@s.whatsapp.net';
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

      const buffer = await fs.readFile(filePath);

      const result = await this.client.sendMessage(formattedPhone, {
        document: buffer,
        fileName: filename,
        mimetype: 'application/pdf',
        caption: caption || undefined
      });

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
      const result = await this.client.sendMessage(formattedPhone, { text: message });
      
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

    // Baileys doesn't expose getConnectionState like WPPConnect.
    return { connected: !!this.isConnected };
  }

  async disconnect() {
    try {
      if (this._reconnectTimer) {
        clearTimeout(this._reconnectTimer);
        this._reconnectTimer = null;
      }
      this._reconnectAttempts = 0;

      if (this.client) {
        try {
          // End socket
          this.client.end?.();
        } catch (_) { }

        this.client = null;
        this.isConnected = false;
        this.qrCode = null;
        this.qrString = null;
      }

      return { success: true };
    } catch (error) {
      console.error('WhatsApp disconnect error:', error);
      return { success: false, error: error.message };
    }
  }

  async logout() {
    try {
      // For Baileys, "logout" means: end current socket + delete auth state so next init requires QR.
      await this.disconnect();

      this.ensureSessionDirs();
      try {
        await fs.rm(this.authDir, { recursive: true, force: true });
        await new Promise(resolve => setTimeout(resolve, 200));
        await fs.mkdir(this.authDir, { recursive: true });
      } catch (e) {
        console.warn('Failed to clean auth directory:', e.message);
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
