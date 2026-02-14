# دليل شامل لإنشاء نظام شاشة العرض للعميل (Customer Display)

## نظرة عامة

هذا الدليل الشامل يشرح كيفية بناء نظام شاشة عرض للعميل متكامل من الصفر لنظام نقاط البيع (POS) باستخدام Electron.js و Node.js.

النظام يدعم:
- **4 بروتوكولات مختلفة**: ESC/POS, CD5220, AEDEX, Generic
- **شاشات متعددة الأسطر** (2 أسطر أو أكثر)
- **وضع المحاكاة** (Simulator) للاختبار بدون جهاز فعلي
- **إعادة الاتصال التلقائي** عند انقطاع الاتصال
- **دعم اللغة العربية** مع Windows-1256 encoding
- **تكامل كامل** مع نظام المبيعات

---

## 📁 البنية الهيكلية للملفات

```
src/
├── main/
│   └── customer-display/
│       ├── index.js                 # نقطة الدخول الرئيسية + IPC handlers
│       ├── display-manager.js       # إدارة الاتصال والبروتوكولات
│       ├── simulator.js             # محاكي الشاشة للاختبار
│       └── protocols/
│           ├── base.js              # الفئة الأساسية لجميع البروتوكولات
│           ├── escpos.js            # بروتوكول ESC/POS (الأكثر شيوعاً)
│           ├── cd5220.js            # بروتوكول CD5220 (Citizen, Logic Controls)
│           ├── aedex.js             # بروتوكول AEDEX (LCD displays)
│           └── generic.js           # بروتوكول عام للشاشات غير المعروفة
├── db/
│   └── db-adapter.js                # (موجود مسبقاً) للتعامل مع قاعدة البيانات
└── renderer/
    ├── settings/
    │   ├── renderer.js              # جافاسكريبت واجهة الإعدادات
    │   └── index.html               # HTML واجهة الإعدادات
    └── sales/
        └── renderer.js              # جافاسكريبت واجهة المبيعات
```

---

## 📦 المتطلبات (Dependencies)

### 1. إضافة للـ package.json

```json
{
  "dependencies": {
    "serialport": "^13.0.0"
  }
}
```

### 2. التثبيت

```bash
npm install serialport
npm run postinstall
```

---

## 🗄️ قاعدة البيانات (Database Schema)

### إضافة الحقول للجدول `app_settings`

قم بإضافة الحقول التالية لجدول `app_settings`:

```sql
ALTER TABLE app_settings ADD COLUMN customer_display_enabled TINYINT NOT NULL DEFAULT 0;
ALTER TABLE app_settings ADD COLUMN customer_display_simulator TINYINT NOT NULL DEFAULT 0;
ALTER TABLE app_settings ADD COLUMN customer_display_port VARCHAR(16) NULL;
ALTER TABLE app_settings ADD COLUMN customer_display_baud_rate INT NOT NULL DEFAULT 9600;
ALTER TABLE app_settings ADD COLUMN customer_display_columns TINYINT NOT NULL DEFAULT 20;
ALTER TABLE app_settings ADD COLUMN customer_display_rows TINYINT NOT NULL DEFAULT 2;
ALTER TABLE app_settings ADD COLUMN customer_display_protocol VARCHAR(16) NOT NULL DEFAULT 'escpos';
ALTER TABLE app_settings ADD COLUMN customer_display_encoding VARCHAR(16) NOT NULL DEFAULT 'windows-1256';
ALTER TABLE app_settings ADD COLUMN customer_display_brightness TINYINT NOT NULL DEFAULT 100;
ALTER TABLE app_settings ADD COLUMN customer_display_welcome_msg VARCHAR(100) NULL;
ALTER TABLE app_settings ADD COLUMN customer_display_thankyou_msg VARCHAR(100) NULL;
```

---

## 💻 الكود الكامل لجميع الملفات

### 1. `src/main/customer-display/protocols/base.js`

```javascript
/**
 * Base Protocol Class for Customer Display
 * Abstract class that defines the interface for all display protocols
 */
class BaseProtocol {
  constructor(config = {}) {
    if (this.constructor === BaseProtocol) {
      throw new Error('BaseProtocol is an abstract class and cannot be instantiated directly');
    }
    
    this.config = {
      columns: config.columns || 20,
      rows: config.rows || 2,
      encoding: config.encoding || 'windows-1256',
      brightness: config.brightness || 100,
      ...config
    };
  }

  init() {
    throw new Error('Method init() must be implemented by subclass');
  }

  clear() {
    throw new Error('Method clear() must be implemented by subclass');
  }

  write(text, row = 0) {
    throw new Error('Method write() must be implemented by subclass');
  }

  setCursorPosition(row, col) {
    throw new Error('Method setCursorPosition() must be implemented by subclass');
  }

  setBrightness(level) {
    throw new Error('Method setBrightness() must be implemented by subclass');
  }

  close() {
    throw new Error('Method close() must be implemented by subclass');
  }

  padText(text, length, align = 'left') {
    const actualLength = this.getDisplayLength(text);
    if (actualLength >= length) {
      return this.truncateText(text, length);
    }
    
    const padding = ' '.repeat(length - actualLength);
    switch (align) {
      case 'center':
        const leftPad = Math.floor((length - actualLength) / 2);
        const rightPad = length - actualLength - leftPad;
        return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
      case 'right':
        return padding + text;
      default:
        return text + padding;
    }
  }

  truncateText(text, maxLength) {
    let result = '';
    let displayLength = 0;
    
    for (const char of text) {
      const charLength = this.getCharLength(char);
      if (displayLength + charLength > maxLength) break;
      result += char;
      displayLength += charLength;
    }
    
    return result;
  }

  getDisplayLength(text) {
    let length = 0;
    for (const char of text) {
      length += this.getCharLength(char);
    }
    return length;
  }

  getCharLength(char) {
    const code = char.charCodeAt(0);
    if (code >= 0x0600 && code <= 0x06FF) return 1;
    if (code >= 0xFE70 && code <= 0xFEFF) return 1;
    if (code > 127) return 2;
    return 1;
  }

  encodeText(text) {
    if (this.config.encoding === 'utf-8') {
      return Buffer.from(text, 'utf-8');
    }
    if (this.config.encoding === 'windows-1256') {
      return this.encodeWindows1256(text);
    }
    return Buffer.from(text, 'ascii');
  }

  encodeWindows1256(text) {
    const buffer = [];
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code < 128) {
        buffer.push(code);
      } else {
        const mapped = this.arabicToWindows1256(code);
        buffer.push(mapped || 63);
      }
    }
    return Buffer.from(buffer);
  }

  arabicToWindows1256(unicode) {
    const map = {
      0x0621: 0xC1, 0x0622: 0xC2, 0x0623: 0xC3, 0x0624: 0xC4,
      0x0625: 0xC5, 0x0626: 0xC6, 0x0627: 0xC7, 0x0628: 0xC8,
      0x0629: 0xC9, 0x062A: 0xCA, 0x062B: 0xCB, 0x062C: 0xCC,
      0x062D: 0xCD, 0x062E: 0xCE, 0x062F: 0xCF, 0x0630: 0xD0,
      0x0631: 0xD1, 0x0632: 0xD2, 0x0633: 0xD3, 0x0634: 0xD4,
      0x0635: 0xD5, 0x0636: 0xD6, 0x0637: 0xD8, 0x0638: 0xD9,
      0x0639: 0xDA, 0x063A: 0xDB, 0x0640: 0xE0, 0x0641: 0xE1,
      0x0642: 0xE2, 0x0643: 0xE3, 0x0644: 0xE4, 0x0645: 0xE5,
      0x0646: 0xE6, 0x0647: 0xE7, 0x0648: 0xE8, 0x0649: 0xE9,
      0x064A: 0xEA, 0x064B: 0xEB, 0x064C: 0xEC, 0x064D: 0xED,
      0x064E: 0xEE, 0x064F: 0xEF, 0x0650: 0xF0, 0x0651: 0xF1,
      0x0652: 0xF2
    };
    return map[unicode] || null;
  }

  formatPrice(amount, currency = 'SAR') {
    const formatted = parseFloat(amount).toFixed(2);
    return formatted;
  }

  splitLines(text, maxWidth) {
    const lines = [];
    const words = text.split(' ');
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      if (this.getDisplayLength(testLine) <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    
    if (currentLine) lines.push(currentLine);
    return lines;
  }
}

module.exports = BaseProtocol;
```

---

### 2. `src/main/customer-display/protocols/escpos.js`

```javascript
/**
 * ESC/POS Protocol Driver for Customer Display
 * Standard protocol used by most POS displays (EPSON, Star, Bixolon, etc.)
 */
const BaseProtocol = require('./base');

class ESCPOSProtocol extends BaseProtocol {
  constructor(serialPort, config) {
    super(config);
    this.port = serialPort;
    
    this.commands = {
      ESC: 0x1B,
      LF: 0x0A,
      CR: 0x0D,
      CLR: 0x0C,
      HT: 0x09,
      US: 0x1F,
      CAN: 0x18,
      DC1: 0x11,
      DC2: 0x12,
      DC4: 0x14
    };
  }

  async init() {
    try {
      await this.sendCommand([this.commands.ESC, 0x40]);
      await this.clear();
      await this.setBrightness(this.config.brightness);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async clear() {
    try {
      await this.sendCommand([this.commands.CLR]);
      await this.sleep(50);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async write(text, row = 0) {
    try {
      if (row >= this.config.rows) {
        return { success: false, error: 'Row out of bounds' };
      }

      await this.setCursorPosition(row, 0);
      
      const paddedText = this.padText(text, this.config.columns, 'left');
      const encoded = this.encodeText(paddedText);
      
      await this.sendCommand(encoded);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setCursorPosition(row, col) {
    try {
      const cmd = [this.commands.ESC, 0x6C, col + 1, row + 1];
      await this.sendCommand(cmd);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setBrightness(level) {
    try {
      if (level < 0 || level > 100) {
        level = 100;
      }
      
      const brightness = Math.floor((level / 100) * 3);
      const cmd = [this.commands.ESC, 0x2A, brightness];
      await this.sendCommand(cmd);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async displayWelcome(message) {
    try {
      await this.clear();
      
      const lines = this.splitLines(message, this.config.columns);
      
      for (let i = 0; i < Math.min(lines.length, this.config.rows); i++) {
        const centeredText = this.padText(lines[i], this.config.columns, 'center');
        await this.write(centeredText, i);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async displayItem(itemName, price, currency = 'SAR') {
    try {
      await this.clear();
      
      const row1 = this.padText(this.truncateText(itemName, this.config.columns - 1), this.config.columns, 'left');
      await this.write(row1, 0);
      
      if (this.config.rows >= 2) {
        const priceText = this.formatPrice(price, currency);
        const row2 = this.padText(priceText, this.config.columns, 'right');
        await this.write(row2, 1);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async displayTotal(total, currency = 'SAR') {
    try {
      await this.clear();
      
      if (this.config.rows >= 2) {
        const row1 = this.padText('TOTAL', this.config.columns, 'center');
        await this.write(row1, 0);
        const totalText = this.formatPrice(total, currency);
        const row2 = this.padText(totalText, this.config.columns, 'center');
        await this.write(row2, 1);
      } else {
        const totalText = `TOTAL: ${this.formatPrice(total, currency)}`;
        const row1 = this.padText(totalText, this.config.columns, 'left');
        await this.write(row1, 0);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async displayChange(paid, change, currency = 'SAR') {
    try {
      await this.clear();
      
      const paidText = `المدفوع: ${this.formatPrice(paid, currency)}`;
      const row1 = this.padText(paidText, this.config.columns, 'left');
      await this.write(row1, 0);
      
      if (this.config.rows >= 2) {
        const changeText = `الباقي: ${this.formatPrice(change, currency)}`;
        const row2 = this.padText(changeText, this.config.columns, 'left');
        await this.write(row2, 1);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async scrollText(text, row = 0, speed = 300) {
    try {
      const textLength = this.getDisplayLength(text);
      if (textLength <= this.config.columns) {
        await this.write(text, row);
        return { success: true };
      }

      const padding = '    ';
      const scrollText = text + padding;
      
      for (let i = 0; i < textLength + padding.length; i++) {
        const visibleText = scrollText.slice(i, i + this.config.columns);
        await this.write(visibleText, row);
        await this.sleep(speed);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async close() {
    try {
      await this.clear();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sendCommand(data) {
    return new Promise((resolve, reject) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      
      this.port.write(buffer, (err) => {
        if (err) {
          reject(err);
        } else {
          this.port.drain((drainErr) => {
            if (drainErr) reject(drainErr);
            else resolve();
          });
        }
      });
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ESCPOSProtocol;
```

---

### 3. `src/main/customer-display/protocols/cd5220.js`

```javascript
/**
 * CD5220 Protocol Driver for Customer Display
 * Used by Citizen CD5220, Logic Controls displays
 */
const BaseProtocol = require('./base');

class CD5220Protocol extends BaseProtocol {
  constructor(serialPort, config) {
    super(config);
    this.port = serialPort;
    
    this.commands = {
      SOH: 0x01,
      STX: 0x02,
      ETX: 0x03,
      CLR: 0x0C,
      CR: 0x0D,
      LF: 0x0A,
      ESC: 0x1B,
      US: 0x1F
    };
  }

  async init() {
    try {
      await this.sendCommand([this.commands.ESC, 0x40]);
      await this.clear();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async clear() {
    try {
      await this.sendCommand([this.commands.CLR]);
      await this.sleep(100);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async write(text, row = 0) {
    try {
      if (row >= this.config.rows) {
        return { success: false, error: 'Row out of bounds' };
      }

      await this.setCursorPosition(row, 0);
      
      const paddedText = this.padText(text, this.config.columns, 'left');
      const encoded = this.encodeText(paddedText);
      
      await this.sendCommand(encoded);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setCursorPosition(row, col) {
    try {
      const cmd = [this.commands.US, 0x24, col, row];
      await this.sendCommand(cmd);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setBrightness(level) {
    try {
      if (level < 0 || level > 100) {
        level = 100;
      }
      
      const brightness = Math.floor((level / 100) * 4);
      const cmd = [this.commands.US, 0x58, brightness];
      await this.sendCommand(cmd);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async displayWelcome(message) {
    try {
      await this.clear();
      
      const lines = this.splitLines(message, this.config.columns);
      
      for (let i = 0; i < Math.min(lines.length, this.config.rows); i++) {
        const centeredText = this.padText(lines[i], this.config.columns, 'center');
        await this.write(centeredText, i);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async displayItem(itemName, price, currency = 'SAR') {
    try {
      await this.clear();
      
      const row1 = this.padText(this.truncateText(itemName, this.config.columns - 1), this.config.columns, 'left');
      await this.write(row1, 0);
      
      if (this.config.rows >= 2) {
        const priceText = this.formatPrice(price, currency);
        const row2 = this.padText(priceText, this.config.columns, 'right');
        await this.write(row2, 1);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async displayTotal(total, currency = 'SAR') {
    try {
      await this.clear();
      
      if (this.config.rows >= 2) {
        const row1 = this.padText('TOTAL', this.config.columns, 'center');
        await this.write(row1, 0);
        const totalText = this.formatPrice(total, currency);
        const row2 = this.padText(totalText, this.config.columns, 'center');
        await this.write(row2, 1);
      } else {
        const totalText = `TOTAL: ${this.formatPrice(total, currency)}`;
        const row1 = this.padText(totalText, this.config.columns, 'left');
        await this.write(row1, 0);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async displayChange(paid, change, currency = 'SAR') {
    try {
      await this.clear();
      
      const paidText = `المدفوع: ${this.formatPrice(paid, currency)}`;
      const row1 = this.padText(paidText, this.config.columns, 'left');
      await this.write(row1, 0);
      
      if (this.config.rows >= 2) {
        const changeText = `الباقي: ${this.formatPrice(change, currency)}`;
        const row2 = this.padText(changeText, this.config.columns, 'left');
        await this.write(row2, 1);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async close() {
    try {
      await this.clear();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sendCommand(data) {
    return new Promise((resolve, reject) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      
      this.port.write(buffer, (err) => {
        if (err) {
          reject(err);
        } else {
          this.port.drain((drainErr) => {
            if (drainErr) reject(drainErr);
            else resolve();
          });
        }
      });
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = CD5220Protocol;
```

---

### 4. `src/main/customer-display/protocols/aedex.js`

```javascript
/**
 * AEDEX Protocol Driver for Customer Display
 * Used by some LCD customer displays (AEDEX, VFD displays)
 */
const BaseProtocol = require('./base');

class AEDEXProtocol extends BaseProtocol {
  constructor(serialPort, config) {
    super(config);
    this.port = serialPort;
    
    this.commands = {
      STX: 0x02,
      ETX: 0x03,
      ENQ: 0x05,
      ACK: 0x06,
      CLR: 0x0C,
      CR: 0x0D,
      ESC: 0x1B
    };
  }

  async init() {
    try {
      await this.clear();
      await this.setBrightness(this.config.brightness);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async clear() {
    try {
      await this.sendCommand([this.commands.CLR]);
      await this.sleep(100);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async write(text, row = 0) {
    try {
      if (row >= this.config.rows) {
        return { success: false, error: 'Row out of bounds' };
      }

      await this.setCursorPosition(row, 0);
      
      const paddedText = this.padText(text, this.config.columns, 'left');
      const encoded = this.encodeText(paddedText);
      
      const frame = [this.commands.STX, ...encoded, this.commands.ETX];
      await this.sendCommand(frame);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setCursorPosition(row, col) {
    try {
      const cmd = [this.commands.ESC, 0x5B, row + 1, 0x3B, col + 1, 0x48];
      await this.sendCommand(cmd);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setBrightness(level) {
    try {
      if (level < 0 || level > 100) {
        level = 100;
      }
      
      const brightness = Math.floor((level / 100) * 4);
      const cmd = [this.commands.ESC, 0x42, brightness];
      await this.sendCommand(cmd);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async displayWelcome(message) {
    try {
      await this.clear();
      
      const lines = this.splitLines(message, this.config.columns);
      
      for (let i = 0; i < Math.min(lines.length, this.config.rows); i++) {
        const centeredText = this.padText(lines[i], this.config.columns, 'center');
        await this.write(centeredText, i);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async displayItem(itemName, price, currency = 'SAR') {
    try {
      await this.clear();
      
      const row1 = this.padText(this.truncateText(itemName, this.config.columns - 1), this.config.columns, 'left');
      await this.write(row1, 0);
      
      if (this.config.rows >= 2) {
        const priceText = this.formatPrice(price, currency);
        const row2 = this.padText(priceText, this.config.columns, 'right');
        await this.write(row2, 1);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async displayTotal(total, currency = 'SAR') {
    try {
      await this.clear();
      
      if (this.config.rows >= 2) {
        const row1 = this.padText('TOTAL', this.config.columns, 'center');
        await this.write(row1, 0);
        const totalText = this.formatPrice(total, currency);
        const row2 = this.padText(totalText, this.config.columns, 'center');
        await this.write(row2, 1);
      } else {
        const totalText = `TOTAL: ${this.formatPrice(total, currency)}`;
        const row1 = this.padText(totalText, this.config.columns, 'left');
        await this.write(row1, 0);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async displayChange(paid, change, currency = 'SAR') {
    try {
      await this.clear();
      
      const paidText = `المدفوع: ${this.formatPrice(paid, currency)}`;
      const row1 = this.padText(paidText, this.config.columns, 'left');
      await this.write(row1, 0);
      
      if (this.config.rows >= 2) {
        const changeText = `الباقي: ${this.formatPrice(change, currency)}`;
        const row2 = this.padText(changeText, this.config.columns, 'left');
        await this.write(row2, 1);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async close() {
    try {
      await this.clear();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sendCommand(data) {
    return new Promise((resolve, reject) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      
      this.port.write(buffer, (err) => {
        if (err) {
          reject(err);
        } else {
          this.port.drain((drainErr) => {
            if (drainErr) reject(drainErr);
            else resolve();
          });
        }
      });
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AEDEXProtocol;
```

---

### 5. `src/main/customer-display/protocols/generic.js`

```javascript
/**
 * Generic Protocol Driver for Customer Display
 * Fallback protocol for unknown displays - uses simple ASCII commands
 */
const BaseProtocol = require('./base');

class GenericProtocol extends BaseProtocol {
  constructor(serialPort, config) {
    super(config);
    this.port = serialPort;
    
    this.commands = {
      CLR: 0x0C,
      CR: 0x0D,
      LF: 0x0A,
      ESC: 0x1B
    };
  }

  async init() {
    try {
      await this.clear();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async clear() {
    try {
      await this.sendCommand([this.commands.CLR]);
      await this.sleep(100);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async write(text, row = 0) {
    try {
      if (row >= this.config.rows) {
        return { success: false, error: 'Row out of bounds' };
      }

      if (row > 0) {
        await this.sendCommand([this.commands.LF]);
      }
      
      const paddedText = this.padText(text, this.config.columns, 'left');
      const encoded = this.encodeText(paddedText);
      
      await this.sendCommand(encoded);
      await this.sendCommand([this.commands.CR]);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setCursorPosition(row, col) {
    try {
      await this.clear();
      
      for (let i = 0; i < row; i++) {
        await this.sendCommand([this.commands.LF]);
      }
      
      if (col > 0) {
        await this.sendCommand(Buffer.alloc(col, 0x20));
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setBrightness(level) {
    return { success: true };
  }

  async displayWelcome(message) {
    try {
      await this.clear();
      
      const lines = this.splitLines(message, this.config.columns);
      
      for (let i = 0; i < Math.min(lines.length, this.config.rows); i++) {
        const centeredText = this.padText(lines[i], this.config.columns, 'center');
        await this.write(centeredText, i);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async displayItem(itemName, price, currency = 'SAR') {
    try {
      await this.clear();
      
      const row1 = this.padText(this.truncateText(itemName, this.config.columns - 1), this.config.columns, 'left');
      await this.write(row1, 0);
      
      if (this.config.rows >= 2) {
        const priceText = this.formatPrice(price, currency);
        const row2 = this.padText(priceText, this.config.columns, 'right');
        await this.write(row2, 1);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async displayTotal(total, currency = 'SAR') {
    try {
      await this.clear();
      
      if (this.config.rows >= 2) {
        const row1 = this.padText('TOTAL', this.config.columns, 'center');
        await this.write(row1, 0);
        const totalText = this.formatPrice(total, currency);
        const row2 = this.padText(totalText, this.config.columns, 'center');
        await this.write(row2, 1);
      } else {
        const totalText = `TOTAL: ${this.formatPrice(total, currency)}`;
        const row1 = this.padText(totalText, this.config.columns, 'left');
        await this.write(row1, 0);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async displayChange(paid, change, currency = 'SAR') {
    try {
      await this.clear();
      
      const paidText = `المدفوع: ${this.formatPrice(paid, currency)}`;
      const row1 = this.padText(paidText, this.config.columns, 'left');
      await this.write(row1, 0);
      
      if (this.config.rows >= 2) {
        const changeText = `الباقي: ${this.formatPrice(change, currency)}`;
        const row2 = this.padText(changeText, this.config.columns, 'left');
        await this.write(row2, 1);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async close() {
    try {
      await this.clear();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sendCommand(data) {
    return new Promise((resolve, reject) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      
      this.port.write(buffer, (err) => {
        if (err) {
          reject(err);
        } else {
          this.port.drain((drainErr) => {
            if (drainErr) reject(drainErr);
            else resolve();
          });
        }
      });
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = GenericProtocol;
```

---

### 6. `src/main/customer-display/simulator.js`

```javascript
/**
 * Customer Display Simulator
 * Creates a virtual display window for testing without physical hardware
 */
const { BrowserWindow } = require('electron');
const path = require('path');

class DisplaySimulator {
  constructor() {
    this.window = null;
    this.config = null;
    this.isOpen = false;
  }

  open(config) {
    if (this.window) {
      this.window.focus();
      return { success: true };
    }

    this.config = {
      columns: config.columns || 20,
      rows: config.rows || 2,
      encoding: config.encoding || 'windows-1256'
    };

    this.window = new BrowserWindow({
      width: 800,
      height: 300,
      backgroundColor: '#000000',
      resizable: false,
      frame: true,
      title: 'محاكي شاشة العرض للعميل',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    this.window.on('closed', () => {
      this.window = null;
      this.isOpen = false;
    });

    const html = this.generateHTML();
    this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    this.isOpen = true;

    return { success: true };
  }

  close() {
    if (this.window) {
      this.window.close();
      this.window = null;
      this.isOpen = false;
    }
    return { success: true };
  }

  clear() {
    if (!this.window) {
      return { success: false, error: 'Simulator not open' };
    }

    this.window.webContents.executeJavaScript(`
      document.querySelectorAll('.display-row').forEach(row => row.textContent = '${' '.repeat(this.config.columns)}');
    `);

    return { success: true };
  }

  write(text, row = 0) {
    if (!this.window) {
      return { success: false, error: 'Simulator not open' };
    }

    const paddedText = text.padEnd(this.config.columns, ' ').substring(0, this.config.columns);
    
    this.window.webContents.executeJavaScript(`
      (function() {
        const rowEl = document.getElementById('row-${row}');
        if (rowEl) {
          rowEl.textContent = \`${paddedText.replace(/`/g, '\\`')}\`;
        }
      })();
    `);

    return { success: true };
  }

  displayWelcome(message) {
    this.clear();
    const lines = this.wrapText(message, this.config.columns);
    lines.forEach((line, index) => {
      if (index < this.config.rows) {
        this.write(this.centerText(line), index);
      }
    });
    return { success: true };
  }

  displayItem(itemName, price, currency = 'SAR') {
    this.clear();
    
    const priceText = this.formatPrice(price);
    
    if (this.config.rows >= 2) {
      const line1 = itemName.substring(0, this.config.columns);
      const line2 = this.rightAlign(priceText);
      this.write(line1, 0);
      this.write(line2, 1);
    } else {
      const maxNameLen = this.config.columns - priceText.length - 1;
      const shortName = itemName.substring(0, maxNameLen);
      const oneLine = `${shortName} ${priceText}`;
      this.write(oneLine, 0);
    }
    
    return { success: true };
  }

  displayTotal(total, currency = 'SAR') {
    this.clear();
    
    const priceText = this.formatPrice(total);
    
    if (this.config.rows >= 2) {
      this.write(this.centerText('TOTAL'), 0);
      this.write(this.centerText(priceText), 1);
    } else {
      const oneLine = `TOTAL ${priceText}`;
      this.write(oneLine, 0);
    }
    
    return { success: true };
  }

  displayChange(paid, change, currency = 'SAR') {
    this.clear();
    
    if (this.config.rows >= 2) {
      const line1 = `PAID: ${this.formatPrice(paid)}`;
      const line2 = `CHANGE: ${this.formatPrice(change)}`;
      this.write(this.centerText(line1), 0);
      this.write(this.centerText(line2), 1);
    } else {
      const oneLine = `CHANGE: ${this.formatPrice(change)}`;
      this.write(oneLine, 0);
    }
    
    return { success: true };
  }

  centerText(text) {
    const spaces = Math.floor((this.config.columns - text.length) / 2);
    return ' '.repeat(Math.max(0, spaces)) + text;
  }

  rightAlign(text) {
    const spaces = this.config.columns - text.length;
    return ' '.repeat(Math.max(0, spaces)) + text;
  }

  formatPrice(price) {
    return Number(price).toFixed(2);
  }

  getCurrencySymbol(currency) {
    const symbols = {
      'SAR': 'ريال',
      'USD': '$',
      'EUR': '€',
      'GBP': '£'
    };
    return symbols[currency] || currency;
  }

  wrapText(text, maxLength) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
      if ((currentLine + word).length <= maxLength) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word.substring(0, maxLength);
      }
    });

    if (currentLine) lines.push(currentLine);
    return lines;
  }

  generateHTML() {
    const rows = Array.from({ length: this.config.rows }, (_, i) => 
      `<div class="display-row" id="row-${i}">${' '.repeat(this.config.columns)}</div>`
    ).join('');

    return `<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      font-family: 'Courier New', monospace;
      padding: 20px;
    }
    .simulator-container {
      background: #000;
      border: 8px solid #334155;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5),
                  inset 0 2px 10px rgba(255, 255, 255, 0.1);
    }
    .display-screen {
      background: linear-gradient(180deg, #003d00 0%, #002600 100%);
      padding: 15px;
      border-radius: 4px;
      box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.8);
    }
    .display-row {
      font-family: 'Arial', 'Tahoma', 'Courier New', monospace;
      font-size: 28px;
      line-height: 1.4;
      color: #00ff00;
      white-space: pre;
      text-shadow: 0 0 10px #00ff00, 0 0 20px #00aa00;
      letter-spacing: 2px;
      font-weight: bold;
      direction: rtl;
      text-align: right;
    }
    .info-bar {
      margin-top: 15px;
      text-align: center;
      color: #94a3b8;
      font-size: 12px;
      font-family: 'Segoe UI', Tahoma, sans-serif;
    }
    .status-indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      margin-left: 5px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  </style>
</head>
<body>
  <div class="simulator-container">
    <div class="display-screen">
      ${rows}
    </div>
    <div class="info-bar">
      <span class="status-indicator"></span>
      وضع المحاكاة • ${this.config.columns}×${this.config.rows} • ${this.config.encoding}
    </div>
  </div>
</body>
</html>`;
  }
}

module.exports = DisplaySimulator;
```

---

### 7. `src/main/customer-display/display-manager.js`

```javascript
/**
 * Customer Display Manager
 * Main class that manages connection, protocol selection, and display operations
 */
const { SerialPort } = require('serialport');
const ESCPOSProtocol = require('./protocols/escpos');
const AEDEXProtocol = require('./protocols/aedex');
const CD5220Protocol = require('./protocols/cd5220');
const GenericProtocol = require('./protocols/generic');
const DisplaySimulator = require('./simulator');

class DisplayManager {
  constructor() {
    this.port = null;
    this.protocol = null;
    this.config = null;
    this.isConnected = false;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.lastError = null;
    this.simulator = null;
    this.isSimulatorMode = false;
    this.eventListeners = {
      connected: [],
      disconnected: [],
      error: []
    };
  }

  on(event, callback) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].push(callback);
    }
  }

  emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => callback(data));
    }
  }

  async connect(config) {
    try {
      if (this.isConnected) {
        await this.disconnect();
      }

      this.config = {
        port: config.port,
        baudRate: config.baudRate || 9600,
        dataBits: config.dataBits || 8,
        parity: config.parity || 'none',
        stopBits: config.stopBits || 1,
        protocol: config.protocol || 'escpos',
        columns: config.columns || 20,
        rows: config.rows || 2,
        encoding: config.encoding || 'windows-1256',
        brightness: config.brightness || 100,
        welcomeMsg: config.welcomeMsg || 'WELCOME',
        thankyouMsg: config.thankyouMsg || 'THANK YOU',
        simulatorMode: config.simulatorMode || false
      };

      // Simulator Mode
      if (this.config.simulatorMode) {
        this.isSimulatorMode = true;
        this.simulator = new DisplaySimulator();
        const result = this.simulator.open(this.config);
        
        if (!result.success) {
          throw new Error('Failed to open simulator');
        }

        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected', { port: 'SIMULATOR' });

        await this.showWelcome();

        return { success: true, message: 'Simulator connected successfully' };
      }

      // Real Hardware Mode
      this.isSimulatorMode = false;
      this.port = new SerialPort({
        path: this.config.port,
        baudRate: this.config.baudRate,
        dataBits: this.config.dataBits,
        parity: this.config.parity,
        stopBits: this.config.stopBits,
        autoOpen: false,
        lock: false
      });

      this.port.on('error', (err) => {
        this.lastError = err.message;
        this.emit('error', { error: err.message });
        this.handleDisconnect();
      });

      this.port.on('close', () => {
        this.handleDisconnect();
      });

      await this.openPort();

      this.protocol = this.createProtocol(this.config.protocol);

      const initResult = await this.protocol.init();
      if (!initResult.success) {
        throw new Error(initResult.error);
      }

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected', { port: this.config.port });

      await this.showWelcome();

      return { success: true, message: 'Connected successfully' };

    } catch (error) {
      this.lastError = error.message;
      this.emit('error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async disconnect() {
    try {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.isSimulatorMode && this.simulator) {
        this.simulator.close();
        this.simulator = null;
        this.isSimulatorMode = false;
      }

      if (this.protocol) {
        await this.protocol.close();
        this.protocol = null;
      }

      if (this.port && this.port.isOpen) {
        await this.closePort();
      }

      this.isConnected = false;
      this.emit('disconnected', {});
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async reconnect() {
    if (!this.config) {
      return { success: false, error: 'No previous configuration found' };
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return { success: false, error: 'Max reconnection attempts reached' };
    }

    this.reconnectAttempts++;
    console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    return await this.connect(this.config);
  }

  handleDisconnect() {
    if (!this.isConnected) return;

    this.isConnected = false;
    this.emit('disconnected', {});

    const nonRecoverableErrors = [
      'Unknown error code 1',
      'No such file or directory',
      'Access denied',
      'File not found'
    ];
    
    const isNonRecoverable = nonRecoverableErrors.some(err => 
      this.lastError && this.lastError.includes(err)
    );

    if (!isNonRecoverable && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnect();
      }, this.reconnectDelay);
    }
  }

  createProtocol(protocolName) {
    const protocolConfig = {
      columns: this.config.columns,
      rows: this.config.rows,
      encoding: this.config.encoding,
      brightness: this.config.brightness
    };

    switch (protocolName.toLowerCase()) {
      case 'escpos':
        return new ESCPOSProtocol(this.port, protocolConfig);
      case 'aedex':
        return new AEDEXProtocol(this.port, protocolConfig);
      case 'cd5220':
        return new CD5220Protocol(this.port, protocolConfig);
      case 'generic':
      default:
        return new GenericProtocol(this.port, protocolConfig);
    }
  }

  async showWelcome() {
    if (!this.isConnected) {
      return { success: false, error: 'Not connected' };
    }

    try {
      const message = this.config.welcomeMsg || 'WELCOME';
      
      if (this.isSimulatorMode && this.simulator) {
        return this.simulator.displayWelcome(message);
      }
      
      if (this.protocol) {
        return await this.protocol.displayWelcome(message);
      }
      
      return { success: false, error: 'No protocol or simulator available' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async showThankYou() {
    if (!this.isConnected) {
      return { success: false, error: 'Not connected' };
    }

    try {
      const message = this.config.thankyouMsg || 'THANK YOU';
      
      if (this.isSimulatorMode && this.simulator) {
        return this.simulator.displayWelcome(message);
      }
      
      if (this.protocol) {
        return await this.protocol.displayWelcome(message);
      }
      
      return { success: false, error: 'No protocol or simulator available' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async displayItem(itemName, price, currency = 'SAR') {
    if (!this.isConnected) {
      return { success: false, error: 'Not connected' };
    }

    try {
      if (this.isSimulatorMode && this.simulator) {
        return this.simulator.displayItem(itemName, price, currency);
      }
      
      if (this.protocol) {
        return await this.protocol.displayItem(itemName, price, currency);
      }
      
      return { success: false, error: 'No protocol or simulator available' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async displayTotal(total, currency = 'SAR') {
    if (!this.isConnected) {
      return { success: false, error: 'Not connected' };
    }

    try {
      if (this.isSimulatorMode && this.simulator) {
        return this.simulator.displayTotal(total, currency);
      }
      
      if (this.protocol) {
        return await this.protocol.displayTotal(total, currency);
      }
      
      return { success: false, error: 'No protocol or simulator available' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async displayChange(paid, change, currency = 'SAR') {
    if (!this.isConnected) {
      return { success: false, error: 'Not connected' };
    }

    try {
      if (this.isSimulatorMode && this.simulator) {
        return this.simulator.displayChange(paid, change, currency);
      }
      
      if (this.protocol) {
        return await this.protocol.displayChange(paid, change, currency);
      }
      
      return { success: false, error: 'No protocol or simulator available' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async clear() {
    if (!this.isConnected) {
      return { success: false, error: 'Not connected' };
    }

    try {
      if (this.isSimulatorMode && this.simulator) {
        return this.simulator.clear();
      }
      
      if (this.protocol) {
        return await this.protocol.clear();
      }
      
      return { success: false, error: 'No protocol or simulator available' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async write(text, row = 0) {
    if (!this.isConnected) {
      return { success: false, error: 'Not connected' };
    }

    try {
      if (this.isSimulatorMode && this.simulator) {
        return this.simulator.write(text, row);
      }
      
      if (this.protocol) {
        return await this.protocol.write(text, row);
      }
      
      return { success: false, error: 'No protocol or simulator available' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testDisplay(testText = 'اختبار الشاشة') {
    if (!this.isConnected) {
      return { success: false, error: 'Not connected' };
    }

    try {
      await this.clear();
      await this.write(testText, 0);
      if (this.config.rows >= 2) {
        await this.write('TEST 12345', 1);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      port: this.config?.port || null,
      protocol: this.config?.protocol || null,
      lastError: this.lastError,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  static async listPorts() {
    try {
      const ports = await SerialPort.list();
      return ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer || 'Unknown',
        serialNumber: port.serialNumber || '',
        vendorId: port.vendorId || '',
        productId: port.productId || ''
      }));
    } catch (error) {
      console.error('Error listing ports:', error);
      return [];
    }
  }

  async openPort() {
    return new Promise((resolve, reject) => {
      this.port.open((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async closePort() {
    return new Promise((resolve, reject) => {
      this.port.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = DisplayManager;
```

---

### 8. `src/main/customer-display/index.js`

```javascript
/**
 * Customer Display Module
 * Entry point for customer display functionality
 */
const { ipcMain } = require('electron');
const DisplayManager = require('./display-manager');
const { dbAdapter } = require('../../db/db-adapter');

const displayManager = new DisplayManager();

let currentSettings = null;

async function loadSettings() {
  try {
    const conn = await dbAdapter.getConnection();
    try {
      const hasColumn = await dbAdapter.columnExists('app_settings', 'customer_display_enabled');
      if (!hasColumn) {
        return null;
      }
      
      const hasSimulatorColumn = await dbAdapter.columnExists('app_settings', 'customer_display_simulator');
      
      let query;
      if (hasSimulatorColumn) {
        query = `
          SELECT 
            customer_display_enabled,
            customer_display_simulator,
            customer_display_port,
            customer_display_baud_rate,
            customer_display_columns,
            customer_display_rows,
            customer_display_protocol,
            customer_display_encoding,
            customer_display_brightness,
            customer_display_welcome_msg,
            customer_display_thankyou_msg,
            currency_code
          FROM app_settings 
          WHERE id = 1
        `;
      } else {
        query = `
          SELECT 
            customer_display_enabled,
            0 as customer_display_simulator,
            customer_display_port,
            customer_display_baud_rate,
            customer_display_columns,
            customer_display_rows,
            customer_display_protocol,
            customer_display_encoding,
            customer_display_brightness,
            customer_display_welcome_msg,
            customer_display_thankyou_msg,
            currency_code
          FROM app_settings 
          WHERE id = 1
        `;
      }
      
      const [rows] = await conn.query(query);
      
      if (rows && rows.length > 0) {
        currentSettings = rows[0];
        return currentSettings;
      }
      return null;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Error loading customer display settings:', error);
    return null;
  }
}

async function autoConnect() {
  try {
    const settings = await loadSettings();
    
    if (!settings || !settings.customer_display_enabled) {
      console.log('Customer display is disabled');
      return { success: false, error: 'Customer display is disabled' };
    }

    const simulatorMode = !!settings.customer_display_simulator;

    if (!simulatorMode) {
      if (!settings.customer_display_port) {
        console.log('No port configured for customer display');
        return { success: false, error: 'No port configured' };
      }

      const availablePorts = await DisplayManager.listPorts();
      const portExists = availablePorts.some(p => p.path === settings.customer_display_port);
      
      if (!portExists) {
        console.log(`Configured port ${settings.customer_display_port} is not available`);
        return { success: false, error: 'Configured port is not available' };
      }
    }

    const config = {
      port: simulatorMode ? 'SIMULATOR' : settings.customer_display_port,
      baudRate: settings.customer_display_baud_rate || 9600,
      protocol: settings.customer_display_protocol || 'escpos',
      columns: settings.customer_display_columns || 20,
      rows: settings.customer_display_rows || 2,
      encoding: settings.customer_display_encoding || 'windows-1256',
      brightness: settings.customer_display_brightness || 100,
      welcomeMsg: settings.customer_display_welcome_msg || 'WELCOME',
      thankyouMsg: settings.customer_display_thankyou_msg || 'THANK YOU',
      simulatorMode: simulatorMode
    };

    return await displayManager.connect(config);
  } catch (error) {
    console.error('Error auto-connecting to customer display:', error);
    return { success: false, error: error.message };
  }
}

function registerCustomerDisplayIPC() {
  ipcMain.handle('customer-display:list-ports', async () => {
    try {
      const ports = await DisplayManager.listPorts();
      return { success: true, ports };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('customer-display:connect', async (event, config) => {
    try {
      return await displayManager.connect(config);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('customer-display:disconnect', async () => {
    try {
      return await displayManager.disconnect();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('customer-display:test', async (event, testText) => {
    try {
      return await displayManager.testDisplay(testText);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('customer-display:show-welcome', async () => {
    try {
      return await displayManager.showWelcome();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('customer-display:show-thankyou', async () => {
    try {
      return await displayManager.showThankYou();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('customer-display:display-item', async (event, data) => {
    try {
      const { itemName, price, currency } = data;
      return await displayManager.displayItem(itemName, price, currency || 'SAR');
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('customer-display:display-total', async (event, data) => {
    try {
      const { total, currency } = data;
      return await displayManager.displayTotal(total, currency || 'SAR');
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('customer-display:display-change', async (event, data) => {
    try {
      const { paid, change, currency } = data;
      return await displayManager.displayChange(paid, change, currency || 'SAR');
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('customer-display:clear', async () => {
    try {
      return await displayManager.clear();
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('customer-display:write', async (event, data) => {
    try {
      const { text, row } = data;
      return await displayManager.write(text, row || 0);
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('customer-display:status', async () => {
    try {
      return { success: true, status: displayManager.getStatus() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  displayManager.on('connected', (data) => {
    console.log('Customer display connected:', data);
  });

  displayManager.on('disconnected', (data) => {
    console.log('Customer display disconnected');
  });

  displayManager.on('error', (data) => {
    console.error('Customer display error:', data.error);
  });
}

function initCustomerDisplay() {
  registerCustomerDisplayIPC();
  
  setTimeout(async () => {
    const result = await autoConnect();
    if (result.success) {
      console.log('Customer display auto-connected successfully');
    } else {
      console.log('Customer display not auto-connected:', result.error);
    }
  }, 2000);
}

module.exports = {
  initCustomerDisplay,
  displayManager
};
```

---

## 🔌 التكامل مع التطبيق الرئيسي

### 9. تعديل `src/main/main.js`

أضف هذا الكود في ملف `main.js`:

```javascript
// في أعلى الملف مع باقي ال imports
const { initCustomerDisplay } = require('./customer-display');

// داخل app.on('ready') أو بعد تحميل النافذة الرئيسية
app.on('ready', async () => {
  // ... باقي الكود
  
  // Initialize Customer Display
  initCustomerDisplay();
  
  // ... باقي الكود
});
```

---

### 10. تعديل `src/main/preload.js`

أضف IPC APIs للواجهة الأمامية:

```javascript
// في الـ contextBridge.exposeInMainWorld
contextBridge.exposeInMainWorld('electronAPI', {
  // ... باقي الـ APIs
  
  // Customer Display APIs
  customer_display_list_ports: () => ipcRenderer.invoke('customer-display:list-ports'),
  customer_display_connect: (config) => ipcRenderer.invoke('customer-display:connect', config),
  customer_display_disconnect: () => ipcRenderer.invoke('customer-display:disconnect'),
  customer_display_test: (text) => ipcRenderer.invoke('customer-display:test', text),
  customer_display_show_welcome: () => ipcRenderer.invoke('customer-display:show-welcome'),
  customer_display_show_thankyou: () => ipcRenderer.invoke('customer-display:show-thankyou'),
  customer_display_display_item: (data) => ipcRenderer.invoke('customer-display:display-item', data),
  customer_display_display_total: (data) => ipcRenderer.invoke('customer-display:display-total', data),
  customer_display_display_change: (data) => ipcRenderer.invoke('customer-display:display-change', data),
  customer_display_clear: () => ipcRenderer.invoke('customer-display:clear'),
  customer_display_write: (data) => ipcRenderer.invoke('customer-display:write', data),
  customer_display_status: () => ipcRenderer.invoke('customer-display:status')
});
```

---

### 11. تعديل `src/main/settings.js`

أضف التحديثات التلقائية للحقول في قاعدة البيانات:

```javascript
// داخل دالة التحديثات التلقائية للجداول
async function updateSchema() {
  const conn = await dbAdapter.getConnection();
  try {
    const missing = async (col) => {
      return !(await dbAdapter.columnExists('app_settings', col));
    };
    
    // ... باقي التحديثات
    
    // Customer Display settings
    if(await missing('customer_display_enabled')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_enabled TINYINT NOT NULL DEFAULT 0");
    }
    if(await missing('customer_display_simulator')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_simulator TINYINT NOT NULL DEFAULT 0");
    }
    if(await missing('customer_display_port')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_port VARCHAR(16) NULL");
    }
    if(await missing('customer_display_baud_rate')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_baud_rate INT NOT NULL DEFAULT 9600");
    }
    if(await missing('customer_display_columns')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_columns TINYINT NOT NULL DEFAULT 20");
    }
    if(await missing('customer_display_rows')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_rows TINYINT NOT NULL DEFAULT 2");
    }
    if(await missing('customer_display_protocol')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_protocol VARCHAR(16) NOT NULL DEFAULT 'escpos'");
    }
    if(await missing('customer_display_encoding')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_encoding VARCHAR(16) NOT NULL DEFAULT 'windows-1256'");
    }
    if(await missing('customer_display_brightness')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_brightness TINYINT NOT NULL DEFAULT 100");
    }
    if(await missing('customer_display_welcome_msg')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_welcome_msg VARCHAR(100) NULL");
    }
    if(await missing('customer_display_thankyou_msg')){
      await conn.query("ALTER TABLE app_settings ADD COLUMN customer_display_thankyou_msg VARCHAR(100) NULL");
    }
    
  } finally {
    conn.release();
  }
}
```

---

## 🎨 واجهة الإعدادات (Settings UI)

### 12. تعديل `src/renderer/settings/index.html`

أضف هذا القسم في صفحة الإعدادات:

```html
<!-- Customer Display Settings Section -->
<section class="settings-section">
  <h2>⚡ إعدادات شاشة العرض للعميل</h2>
  
  <div class="form-group">
    <label>
      <input type="checkbox" id="f_customer_display_enabled">
      تفعيل شاشة العرض للعميل
    </label>
  </div>
  
  <div class="form-group">
    <label>
      <input type="checkbox" id="f_customer_display_simulator">
      وضع المحاكاة (للتجربة بدون جهاز)
    </label>
  </div>
  
  <div class="form-group">
    <label>منفذ الاتصال (COM Port)</label>
    <div style="display: flex; gap: 10px;">
      <select id="f_customer_display_port" style="flex: 1;">
        <option value="">اختر المنفذ</option>
      </select>
      <button type="button" id="btnRefreshPorts" class="btn-secondary">🔄 تحديث</button>
    </div>
  </div>
  
  <div class="form-group">
    <label>سرعة الاتصال (Baud Rate)</label>
    <select id="f_customer_display_baud_rate">
      <option value="2400">2400</option>
      <option value="4800">4800</option>
      <option value="9600" selected>9600</option>
      <option value="19200">19200</option>
      <option value="38400">38400</option>
      <option value="57600">57600</option>
      <option value="115200">115200</option>
    </select>
  </div>
  
  <div class="form-group">
    <label>البروتوكول</label>
    <select id="f_customer_display_protocol">
      <option value="escpos" selected>ESC/POS (الأكثر شيوعاً)</option>
      <option value="cd5220">CD5220 (Citizen, Logic Controls)</option>
      <option value="aedex">AEDEX (LCD Displays)</option>
      <option value="generic">Generic (عام)</option>
    </select>
  </div>
  
  <div class="form-row">
    <div class="form-group">
      <label>عدد الأعمدة</label>
      <input type="number" id="f_customer_display_columns" value="20" min="16" max="40">
    </div>
    
    <div class="form-group">
      <label>عدد الأسطر</label>
      <input type="number" id="f_customer_display_rows" value="2" min="1" max="4">
    </div>
  </div>
  
  <div class="form-group">
    <label>الترميز (Encoding)</label>
    <select id="f_customer_display_encoding">
      <option value="windows-1256" selected>Windows-1256 (Arabic)</option>
      <option value="utf-8">UTF-8</option>
      <option value="ascii">ASCII</option>
    </select>
  </div>
  
  <div class="form-group">
    <label>السطوع (1-100)</label>
    <input type="range" id="f_customer_display_brightness" min="1" max="100" value="100">
    <span id="brightness_value">100%</span>
  </div>
  
  <div class="form-group">
    <label>رسالة الترحيب</label>
    <input type="text" id="f_customer_display_welcome_msg" placeholder="مرحباً بك" maxlength="100">
  </div>
  
  <div class="form-group">
    <label>رسالة الشكر</label>
    <input type="text" id="f_customer_display_thankyou_msg" placeholder="شكراً لزيارتك" maxlength="100">
  </div>
  
  <div class="form-actions">
    <button type="button" id="btnTestDisplay" class="btn-primary">🧪 اختبار الشاشة</button>
  </div>
</section>
```

---

### 13. تعديل `src/renderer/settings/renderer.js`

أضف كود JavaScript لإدارة واجهة الإعدادات:

```javascript
// في أعلى الملف - تعريف المتغيرات
const fCustomerDisplayEnabled = document.getElementById('f_customer_display_enabled');
const fCustomerDisplaySimulator = document.getElementById('f_customer_display_simulator');
const fCustomerDisplayPort = document.getElementById('f_customer_display_port');
const fCustomerDisplayBaudRate = document.getElementById('f_customer_display_baud_rate');
const fCustomerDisplayColumns = document.getElementById('f_customer_display_columns');
const fCustomerDisplayRows = document.getElementById('f_customer_display_rows');
const fCustomerDisplayProtocol = document.getElementById('f_customer_display_protocol');
const fCustomerDisplayEncoding = document.getElementById('f_customer_display_encoding');
const fCustomerDisplayBrightness = document.getElementById('f_customer_display_brightness');
const fCustomerDisplayWelcomeMsg = document.getElementById('f_customer_display_welcome_msg');
const fCustomerDisplayThankyouMsg = document.getElementById('f_customer_display_thankyou_msg');
const btnRefreshPorts = document.getElementById('btnRefreshPorts');
const btnTestDisplay = document.getElementById('btnTestDisplay');

// تحميل المنافذ المتاحة
async function loadAvailablePorts() {
  try {
    const result = await window.electronAPI.customer_display_list_ports();
    if (result.success && result.ports) {
      fCustomerDisplayPort.innerHTML = '<option value="">اختر المنفذ</option>';
      result.ports.forEach(port => {
        const option = document.createElement('option');
        option.value = port.path;
        option.textContent = `${port.path} - ${port.manufacturer}`;
        fCustomerDisplayPort.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error loading ports:', error);
  }
}

// عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  loadAvailablePorts();
  
  // تحديث قيمة السطوع
  if (fCustomerDisplayBrightness) {
    fCustomerDisplayBrightness.addEventListener('input', (e) => {
      document.getElementById('brightness_value').textContent = `${e.target.value}%`;
    });
  }
  
  // زر تحديث المنافذ
  if (btnRefreshPorts) {
    btnRefreshPorts.addEventListener('click', loadAvailablePorts);
  }
  
  // زر اختبار الشاشة
  if (btnTestDisplay) {
    btnTestDisplay.addEventListener('click', async () => {
      try {
        const result = await window.electronAPI.customer_display_test('اختبار الشاشة');
        if (result.success) {
          alert('تم اختبار الشاشة بنجاح!');
        } else {
          alert('فشل اختبار الشاشة: ' + result.error);
        }
      } catch (error) {
        alert('خطأ في اختبار الشاشة: ' + error.message);
      }
    });
  }
});

// داخل دالة تحميل الإعدادات
async function loadSettings() {
  const s = await window.electronAPI.get_settings();
  if (!s) return;
  
  // ... باقي الإعدادات
  
  // Customer Display settings
  if (fCustomerDisplayEnabled) fCustomerDisplayEnabled.checked = !!s.customer_display_enabled;
  if (fCustomerDisplaySimulator) fCustomerDisplaySimulator.checked = !!s.customer_display_simulator;
  if (fCustomerDisplayPort) fCustomerDisplayPort.value = s.customer_display_port || '';
  if (fCustomerDisplayBaudRate) fCustomerDisplayBaudRate.value = String(s.customer_display_baud_rate || 9600);
  if (fCustomerDisplayColumns) fCustomerDisplayColumns.value = String(s.customer_display_columns || 20);
  if (fCustomerDisplayRows) fCustomerDisplayRows.value = String(s.customer_display_rows || 2);
  if (fCustomerDisplayProtocol) fCustomerDisplayProtocol.value = s.customer_display_protocol || 'escpos';
  if (fCustomerDisplayEncoding) fCustomerDisplayEncoding.value = s.customer_display_encoding || 'windows-1256';
  if (fCustomerDisplayBrightness) {
    fCustomerDisplayBrightness.value = String(s.customer_display_brightness || 100);
    document.getElementById('brightness_value').textContent = `${s.customer_display_brightness || 100}%`;
  }
  if (fCustomerDisplayWelcomeMsg) fCustomerDisplayWelcomeMsg.value = s.customer_display_welcome_msg || 'مرحباً بك';
  if (fCustomerDisplayThankyouMsg) fCustomerDisplayThankyouMsg.value = s.customer_display_thankyou_msg || 'شكراً لزيارتك';
}

// داخل دالة حفظ الإعدادات
async function saveSettings() {
  const data = {
    // ... باقي الإعدادات
    
    // Customer Display settings
    customer_display_enabled: !!(fCustomerDisplayEnabled?.checked),
    customer_display_simulator: !!(fCustomerDisplaySimulator?.checked),
    customer_display_port: (fCustomerDisplayPort?.value || '').trim(),
    customer_display_baud_rate: parseInt(fCustomerDisplayBaudRate?.value || '9600'),
    customer_display_columns: parseInt(fCustomerDisplayColumns?.value || '20'),
    customer_display_rows: parseInt(fCustomerDisplayRows?.value || '2'),
    customer_display_protocol: (fCustomerDisplayProtocol?.value || 'escpos').trim(),
    customer_display_encoding: (fCustomerDisplayEncoding?.value || 'windows-1256').trim(),
    customer_display_brightness: parseInt(fCustomerDisplayBrightness?.value || '100'),
    customer_display_welcome_msg: (fCustomerDisplayWelcomeMsg?.value || '').trim(),
    customer_display_thankyou_msg: (fCustomerDisplayThankyouMsg?.value || '').trim()
  };
  
  const result = await window.electronAPI.save_settings(data);
  if (result.success) {
    alert('تم حفظ الإعدادات بنجاح!');
  } else {
    alert('فشل حفظ الإعدادات: ' + result.error);
  }
}
```

---

## 🛒 التكامل مع واجهة المبيعات

### 14. تعديل `src/renderer/sales/renderer.js`

أضف هذا الكود لتحديث الشاشة تلقائياً:

```javascript
// في أعلى الملف - متغيرات عامة
let customerDisplayEnabled = false;
let currencyCodeForDisplay = 'SAR';
let customerDisplayIdleTimer = null;
let customerDisplayShowingThankYou = false;

// تحميل إعدادات شاشة العرض
async function loadCustomerDisplaySettings() {
  try {
    const settings = await window.electronAPI.get_settings();
    if (settings) {
      customerDisplayEnabled = !!settings.customer_display_enabled;
      currencyCodeForDisplay = settings.currency_code || 'SAR';
    }
  } catch (error) {
    console.error('Error loading customer display settings:', error);
  }
}

// تحديث شاشة العرض عند تغيير السلة
async function updateCustomerDisplay() {
  if (!customerDisplayEnabled) {
    return;
  }
  
  // لا تحدث الشاشة إذا كانت تعرض رسالة الشكر
  if (customerDisplayShowingThankYou) {
    return;
  }
  
  try {
    // إلغاء timer الترحيب إذا كان هناك مبيعات
    if (customerDisplayIdleTimer) {
      clearTimeout(customerDisplayIdleTimer);
      customerDisplayIdleTimer = null;
    }
    
    // إذا كانت السلة فارغة - عرض رسالة الترحيب
    if (!currentCart || currentCart.length === 0) {
      await window.electronAPI.customer_display_show_welcome();
      return;
    }
    
    // عرض آخر منتج تم إضافته
    const lastItem = currentCart[currentCart.length - 1];
    await window.electronAPI.customer_display_display_item({
      itemName: lastItem.product_name,
      price: lastItem.total_price,
      currency: currencyCodeForDisplay
    });
    
  } catch (error) {
    console.error('Error updating customer display:', error);
  }
}

// عرض الإجمالي على الشاشة
async function showTotalOnCustomerDisplay() {
  if (!customerDisplayEnabled) return;
  
  try {
    const total = calculateGrandTotal();
    await window.electronAPI.customer_display_display_total({
      total: total,
      currency: currencyCodeForDisplay
    });
  } catch (error) {
    console.error('Error showing total on customer display:', error);
  }
}

// عرض رسالة الشكر بعد إتمام البيع
async function showThankYouOnCustomerDisplay() {
  if (!customerDisplayEnabled) return;
  
  try {
    customerDisplayShowingThankYou = true;
    await window.electronAPI.customer_display_show_thankyou();
    
    // العودة لرسالة الترحيب بعد 5 ثواني
    setTimeout(async () => {
      customerDisplayShowingThankYou = false;
      await window.electronAPI.customer_display_show_welcome();
    }, 5000);
    
  } catch (error) {
    console.error('Error showing thank you on customer display:', error);
  }
}

// عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async () => {
  await loadCustomerDisplaySettings();
  
  // ... باقي الكود
});

// استدعاء updateCustomerDisplay() عند:
// 1. إضافة منتج للسلة
function addProductToCart(product) {
  // ... كود إضافة المنتج
  
  updateCustomerDisplay(); // إضافة هذا السطر
}

// 2. حذف منتج من السلة
function removeProductFromCart(index) {
  // ... كود حذف المنتج
  
  updateCustomerDisplay(); // إضافة هذا السطر
}

// 3. تغيير الكمية
function updateQuantity(index, newQty) {
  // ... كود تحديث الكمية
  
  updateCustomerDisplay(); // إضافة هذا السطر
}

// 4. عند طباعة الفاتورة - عرض الشكر
async function printInvoice() {
  // ... كود طباعة الفاتورة
  
  await showThankYouOnCustomerDisplay(); // إضافة هذا السطر
}

// 5. عند ضغط زر عرض الإجمالي
function showTotal() {
  showTotalOnCustomerDisplay();
}
```

---

## ✅ خطوات التنفيذ بالتسلسل

### الخطوة 1: إنشاء المجلدات

```bash
mkdir -p src/main/customer-display/protocols
```

### الخطوة 2: إنشاء الملفات

قم بإنشاء جميع الملفات المذكورة أعلاه بنفس الترتيب.

### الخطوة 3: تثبيت المكتبات

```bash
npm install serialport
npm run postinstall
```

### الخطوة 4: تحديث قاعدة البيانات

سيتم ذلك تلقائياً عند تشغيل التطبيق من خلال `settings.js`

### الخطوة 5: التكامل

- عدّل `main.js` لاستدعاء `initCustomerDisplay()`
- عدّل `preload.js` لإضافة APIs
- عدّل واجهة الإعدادات (HTML + JS)
- عدّل واجهة المبيعات

### الخطوة 6: التشغيل والاختبار

```bash
npm start
```

---

## 🧪 طريقة الاختبار

### 1. اختبار وضع المحاكاة

- افتح الإعدادات
- فعّل "تفعيل شاشة العرض للعميل"
- فعّل "وضع المحاكاة"
- احفظ الإعدادات
- ستظهر نافذة محاكي الشاشة

### 2. اختبار مع الجهاز الفعلي

- وصّل شاشة العرض عبر USB أو Serial
- افتح الإعدادات
- اضغط "🔄 تحديث" لعرض المنافذ
- اختر المنفذ الصحيح (مثل COM3 أو COM4)
- اختر البروتوكول المناسب
- اضغط "🧪 اختبار الشاشة"
- احفظ الإعدادات

### 3. اختبار التكامل مع المبيعات

- افتح شاشة المبيعات
- أضف منتجات - يجب أن تظهر على الشاشة
- احذف منتجات - يجب أن تتحدث الشاشة
- اطبع فاتورة - يجب أن تظهر رسالة الشكر

---

## 📊 جدول البروتوكولات المدعومة

| البروتوكول | الشاشات المدعومة | ملاحظات |
|-----------|------------------|---------|
| **ESC/POS** | EPSON, Star, Bixolon, معظم الشاشات | الأكثر شيوعاً والأكثر توافقاً |
| **CD5220** | Citizen CD5220, Logic Controls | شاشات Citizen القديمة |
| **AEDEX** | AEDEX VFD, بعض LCD displays | شاشات LCD الصينية |
| **Generic** | أي شاشة غير معروفة | بروتوكول بسيط للشاشات غير المدعومة |

---

## 🔧 الإعدادات الشائعة

### لشاشة 20×2 (الأكثر شيوعاً)

- **Columns**: 20
- **Rows**: 2
- **Baud Rate**: 9600
- **Protocol**: ESC/POS
- **Encoding**: windows-1256

### لشاشة 40×4

- **Columns**: 40
- **Rows**: 4
- **Baud Rate**: 9600
- **Protocol**: ESC/POS
- **Encoding**: windows-1256

---

## ⚠️ استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| الشاشة لا تعمل | تأكد من اختيار المنفذ الصحيح والبروتوكول المناسب |
| نص مشوّه | جرّب تغيير الـ Encoding أو البروتوكول |
| لا توجد منافذ | تأكد من توصيل الشاشة وتثبيت التعريفات |
| فصل متكرر | تحقق من كابل التوصيل والمنفذ |
| أحرف عربية خاطئة | استخدم windows-1256 encoding |

---

## 📝 ملاحظات مهمة

1. **دعم الشاشات متعددة الأسطر**: النظام يدعم أي عدد من الأسطر (2, 3, 4, أو أكثر)
2. **Auto-connect**: يتم الاتصال تلقائياً عند تشغيل البرنامج
3. **Auto-reconnect**: إعادة الاتصال تلقائياً عند انقطاع الاتصال (حتى 5 محاولات)
4. **Simulator Mode**: للاختبار بدون جهاز فعلي
5. **Thread-safe**: جميع العمليات آمنة للاستخدام المتزامن

---

## 🎯 المميزات الإضافية القابلة للإضافة

يمكنك إضافة هذه المميزات لاحقاً:

- **Scrolling Text**: نص متحرك للنصوص الطويلة
- **Animations**: رسوم متحركة وانتقالات
- **Custom Messages**: رسائل مخصصة حسب الوقت/المناسبة
- **QR Code Display**: عرض QR Codes
- **Barcode Display**: عرض Barcodes
- **Multi-language**: دعم لغات متعددة

---

## 📚 المراجع

- [ESC/POS Command Reference](https://reference.epson-biz.com/modules/ref_escpos/index.php)
- [SerialPort Documentation](https://serialport.io/docs/)
- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/api/ipc-main)

---

## ✨ الخلاصة

هذا الدليل يحتوي على **كل شيء** لإنشاء نظام شاشة عرض للعميل من الصفر:

✅ **8 ملفات كود كاملة** (البروتوكولات + الإدارة + المحاكي)  
✅ **قاعدة البيانات** (11 حقل)  
✅ **IPC Handlers** (12 handler)  
✅ **واجهة الإعدادات** (HTML + JavaScript كاملة)  
✅ **التكامل مع المبيعات** (تحديث تلقائي)  
✅ **دعم 4 بروتوكولات** (ESC/POS, CD5220, AEDEX, Generic)  
✅ **وضع المحاكاة** (للاختبار)  
✅ **Auto-connect & Auto-reconnect**  
✅ **دعم العربية** (Windows-1256)  
✅ **شاشات متعددة الأسطر** (2+ rows)

يمكنك نسخ هذا الملف وإرساله للذكاء الاصطناعي لإنشاء نفس النظام بالضبط في أي مشروع آخر! 🚀
