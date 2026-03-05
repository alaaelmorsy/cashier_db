'use strict';

const ARABIC_TO_WIN1256 = {
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
  0x0652: 0xF2,
};

class BaseProtocol {
  constructor(serialPort, config) {
    this.port = serialPort;
    this.config = config || {};
    this.columns = config.columns || 20;
    this.rows = config.rows || 2;
    this.encoding = config.encoding || 'ascii';
  }

  async write(text, row = 0) {
    throw new Error('write() must be implemented');
  }

  async clear() {
    throw new Error('clear() must be implemented');
  }

  async init() {
    throw new Error('init() must be implemented');
  }

  async setCursorPosition(row, col) {
  }

  async setBrightness(level) {
    return { success: true };
  }

  async close() {
  }

  async displayWelcome(message) {
    const msg = message || this.config.welcomeMsg || '';
    await this.clear();
    if (msg) {
      const line = this.padText(msg, this.columns, 'center');
      await this.write(line, 0);
    }
    return { success: true };
  }

  async displayItem(itemName, price, currency) {
    await this.clear();
    const nameStr = this.truncateText(String(itemName || ''), this.columns - 1);
    const priceStr = this.formatPrice(price, currency);
    if (this.rows >= 2) {
      await this.write(nameStr, 0);
      await this.write(this.padText(priceStr, this.columns, 'right'), 1);
    } else {
      const line = this.truncateText(nameStr + ' ' + priceStr, this.columns);
      await this.write(line, 0);
    }
    return { success: true };
  }

  async displayTotal(total, currency) {
    await this.clear();
    const totalStr = this.formatPrice(total, currency);
    if (this.rows >= 2) {
      await this.write(this.padText('TOTAL', this.columns, 'center'), 0);
      await this.write(this.padText(totalStr, this.columns, 'center'), 1);
    } else {
      await this.write(this.padText('TOTAL: ' + totalStr, this.columns, 'center'), 0);
    }
    return { success: true };
  }

  async displayThankYou(message) {
    const msg = message || this.config.thankyouMsg || '';
    await this.clear();
    if (msg) {
      const line = this.padText(msg, this.columns, 'center');
      await this.write(line, 0);
    }
    return { success: true };
  }

  padText(text, length, align = 'left') {
    const str = String(text || '');
    const displayLen = this.getDisplayLength(str);
    if (displayLen >= length) return str;
    const spaces = length - displayLen;
    if (align === 'center') {
      const left = Math.floor(spaces / 2);
      const right = spaces - left;
      return ' '.repeat(left) + str + ' '.repeat(right);
    }
    if (align === 'right') {
      return ' '.repeat(spaces) + str;
    }
    return str + ' '.repeat(spaces);
  }

  truncateText(text, maxLength) {
    const str = String(text || '');
    let len = 0;
    let result = '';
    for (const ch of str) {
      const clen = this.getCharLength(ch);
      if (len + clen > maxLength) break;
      len += clen;
      result += ch;
    }
    return result;
  }

  getDisplayLength(text) {
    let len = 0;
    for (const ch of String(text || '')) {
      len += this.getCharLength(ch);
    }
    return len;
  }

  getCharLength(char) {
    const code = char.charCodeAt(0);
    if (code > 0x7F && code <= 0x9F) return 1;
    if (code > 0x9F) return 1;
    return 1;
  }

  encodeText(text) {
    const str = String(text || '');
    if (this.encoding === 'ascii') {
      return Buffer.from(str, 'ascii');
    }
    if (this.encoding === 'windows-1256') {
      return this.encodeWindows1256(str);
    }
    return Buffer.from(str, 'utf-8');
  }

  encodeWindows1256(text) {
    const bytes = [];
    for (const ch of String(text || '')) {
      const code = ch.charCodeAt(0);
      if (code < 0x80) {
        bytes.push(code);
      } else {
        const mapped = ARABIC_TO_WIN1256[code];
        bytes.push(mapped !== undefined ? mapped : 0x3F);
      }
    }
    return Buffer.from(bytes);
  }

  formatPrice(amount, currency) {
    const num = parseFloat(amount) || 0;
    const formatted = num.toFixed(2);
    return currency ? `${formatted} ${currency}` : formatted;
  }

  splitLines(text, maxWidth) {
    const words = String(text || '').split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (this.getDisplayLength(test) <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = this.truncateText(word, maxWidth);
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  writeToPort(buffer) {
    return new Promise((resolve, reject) => {
      if (!this.port || !this.port.isOpen) {
        return reject(new Error('Port not open'));
      }
      this.port.write(buffer, (err) => {
        if (err) return reject(err);
        this.port.drain((err2) => {
          if (err2) return reject(err2);
          resolve();
        });
      });
    });
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

module.exports = BaseProtocol;
